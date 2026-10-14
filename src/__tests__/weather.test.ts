import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { generateAttempt, getAttempt, listAttempts, markAttempt, readReviews, seedFromAttempt } from '../daily/history.js';
import { sourceId, withPreviewLock } from '../daily/preview.js';
import { WEATHER_VOICES, type VoiceId, type Writer } from '../daily/types.js';
import { addWeatherReport, buildWeatherRequest, collectWeather, collectWeatherOnce, HELENA, readWeather, seedFromWeather, selectPeriods, validateWeather, type WeatherFetch } from '../daily/weather.js';

const now = new Date('2026-03-22T01:00:00Z'); // March 21, evening in Helena, NOT UTC March 22.
const forecastUrl = 'https://api.weather.gov/gridpoints/TFX/100,100/forecast';
const period = (name: string, startTime: string, endTime: string, isDaytime: boolean) => ({
  name, startTime, endTime, isDaytime, temperature: 35, temperatureUnit: 'F',
  probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 0 },
  windSpeed: '5 to 10 mph', windDirection: 'W', shortForecast: 'Mostly Cloudy', detailedForecast: 'Mostly cloudy, with a temperature around 35.'
});
const forecast = { properties: { updated: '2026-03-22T00:00:00Z', periods: [
  period('Today', '2026-03-21T06:00:00-06:00', '2026-03-21T18:00:00-06:00', true),
  period('Tonight', '2026-03-21T18:00:00-06:00', '2026-03-22T06:00:00-06:00', false),
  period('Sunday', '2026-03-22T06:00:00-06:00', '2026-03-22T18:00:00-06:00', true),
  period('Sunday Night', '2026-03-22T18:00:00-06:00', '2026-03-23T06:00:00-06:00', false)
] } };
const points = { properties: { forecast: forecastUrl, timeZone: HELENA.timeZone } };
const requests: string[] = [];
const fetcher: WeatherFetch = async (url, options) => {
  requests.push(url);
  assert.equal(options.redirect, 'error');
  assert.ok(options.signal);
  assert.ok(!JSON.stringify(options).includes('Authorization'), 'public requests use no account credentials');
  return new Response(JSON.stringify(url === forecastUrl ? forecast : points));
};
const packet = await collectWeather(fetcher, now);
assert.equal(requests.length, 2);
assert.equal(packet.forecast!.periods[0].precipitationChance, 0, 'zero is not missing data');
assert.deepEqual(selectPeriods(packet, 'today').map(p => p.name), ['Tonight'], 'use location day, omit expired periods');
assert.deepEqual(selectPeriods(packet, 'extended').map(p => p.name), ['Sunday', 'Sunday Night']);
const overnight = { ...packet, frozenAt: '2026-03-22T07:00:00Z' };
assert.deepEqual(selectPeriods(overnight, 'today').map(p => p.name), ['Tonight', 'Sunday', 'Sunday Night'], 'include ongoing overnight period');
let failedCalls = 0;
await assert.rejects(() => collectWeather(async () => {
  failedCalls++; return new Response('unavailable', { status: 503 });
}, now), /503/);
assert.equal(failedCalls, 1, 'no automatic retry');
let unsafeCalls = 0;
await assert.rejects(() => collectWeather(async () => {
  unsafeCalls++; return new Response(JSON.stringify({ properties: { ...points.properties, forecast: 'http://localhost/private' } }));
}, now), /URL/);
assert.equal(unsafeCalls, 1, 'reject off-service URLs before any second request');
assert.throws(() => validateWeather({ ...packet, reports: [{ source: 'station', text: 'Snow', reportedAt: now.toISOString() }] }), /attributed/);
assert.throws(() => validateWeather({ ...packet, frozenAt: 'yesterday' }), /timestamp/);
assert.throws(() => validateWeather({ ...packet, location: { ...HELENA, latitude: 91 } }), /Invalid/);
const invalid = structuredClone(packet);
invalid.forecast!.periods[0].precipitationChance = 101;
assert.throws(() => validateWeather(invalid), /period/);
const overlap = structuredClone(packet);
overlap.forecast!.periods[1].startTime = overlap.forecast!.periods[0].startTime;
assert.throws(() => validateWeather(overlap), /unordered/);
const missingChance = structuredClone(forecast);
(missingChance.properties.periods[0].probabilityOfPrecipitation as { value: number | null }).value = null;
const unknown = await collectWeather(async url => new Response(JSON.stringify(url === forecastUrl ? missingChance : points)), now);
assert.equal(unknown.forecast!.periods[0].precipitationChance, null);

const directory = await mkdtemp(join(tmpdir(), 'type-blitz-weather-test-'));
try {
  const reddit = '{"unchanged":"Reddit context"}\n';
  await writeFile(join(directory, 'context.json'), reddit);
  const note = "It snowed, now it is melting, and it still feels cold.";
  await withPreviewLock(directory, () => addWeatherReport(directory, note, now));
  const reported = await readWeather(directory);
  assert.equal(reported.forecast, undefined);
  assert.equal(reported.reports[0].source, 'user');
  assert.equal(reported.reports[0].text, note);
  await assert.rejects(() => buildWeatherRequest(reported, 'weatherman', 'today'), /No forecast/);
  const feel = await buildWeatherRequest(reported, 'weather-friend', 'feel');
  assert.ok(feel.userPrompt.includes(note));
  assert.ok(!feel.systemPrompt.includes(note), 'source report never becomes system instructions');
  assert.ok(feel.systemPrompt.includes('not a forecast bulletin'));
  assert.ok(!feel.systemPrompt.includes('local weather presenter'));
  let collections = 0;
  const collect = async () => { collections++; return packet; };
  await withPreviewLock(directory, () => collectWeatherOnce(directory, false, collect));
  await withPreviewLock(directory, () => collectWeatherOnce(directory, false, collect));
  assert.equal(collections, 1);
  const frozen = await readWeather(directory);
  assert.equal(frozen.reports.length, 1, 'collection retains separately dated user report');
  assert.equal(await readFile(join(directory, 'context.json'), 'utf8'), reddit, 'weather never changes Reddit context');
  const before = await readFile(join(directory, 'weather-context.json'), 'utf8');
  await assert.rejects(() => withPreviewLock(directory, () => collectWeatherOnce(directory, true, async () => { throw new Error('offline'); })), /offline/);
  assert.equal(await readFile(join(directory, 'weather-context.json'), 'utf8'), before, 'failed refresh keeps frozen evidence');
  const prompts = await Promise.all((Object.keys(WEATHER_VOICES) as VoiceId[]).map(v => buildWeatherRequest(frozen, v, 'today')));
  assert.equal(new Set(prompts.map(p => p.userPrompt)).size, 1);
  assert.equal(new Set(prompts.map(p => p.systemPrompt)).size, 5);
  assert.ok(prompts[0].systemPrompt.includes('nihilistic college student'));
  assert.ok(!prompts[0].systemPrompt.includes('post and comments'), 'weather does not inherit Reddit-specific instructions');
  assert.ok(!prompts[3].systemPrompt.includes('nihilistic college student'));
  assert.ok(prompts[3].systemPrompt.includes('local weather presenter'));
  const input = JSON.parse(prompts[3].userPrompt.split('\n\n').slice(1).join('\n\n'));
  assert.equal(input.location.name, HELENA.name);
  assert.deepEqual(input.forecast.periods.map((p: { name: string }) => p.name), ['Tonight']);
  const writer: Writer = { model: 'fixture', thinking: 'off', async generate(request) {
    return { model: 'fixture', thinking: 'off', text: 'Helena is still cold enough to make the melting snow feel like a technicality rather than a victory. There is less white on the ground, but the jacket remains firmly employed. For now, the improvement is mostly something you can point at through a window.',
      audit: { ...request, tools: [], messageRoles: ['user'], payloadVerified: true, reasoningEffort: 'none' } };
  } };
  const seed = await seedFromWeather(frozen, 'weather-friend', 'feel');
  const a = await withPreviewLock(directory, () => generateAttempt(directory, seed, writer));
  assert.equal(a.status, 'ready');
  assert.equal(a.source.kind, 'weather');
  assert.equal(a.passage!.genre, 'Daily AI / Weather');
  assert.equal(a.sourceId, sourceId(frozen));
  assert.deepEqual(await getAttempt(directory, 1), JSON.parse(JSON.stringify(a)), 'history recognizes hyphenated weather voice filenames');
  await withPreviewLock(directory, () => markAttempt(directory, 1, 'good'));
  assert.equal((await readReviews(directory))['1'].rating, 'good');
  const original = await readFile(join(directory, 'attempts', '001-weather-friend.json'), 'utf8');
  await withPreviewLock(directory, () => addWeatherReport(directory, 'A later user report.', new Date(now.getTime() + 3600_000)));
  const b = await withPreviewLock(directory, () => generateAttempt(directory, seedFromAttempt(a), writer));
  assert.deepEqual(b.request, a.request, 'replay ignores changed current input');
  assert.equal(b.replayOf, 1);
  assert.equal(await readFile(join(directory, 'attempts', '001-weather-friend.json'), 'utf8'), original);
  const cli = (...args: string[]) => promisify(execFile)(process.execPath, [
    '--import', 'tsx', 'src/dailyPreview.ts', '--dir', directory, 'weather', ...args
  ], { timeout: 15_000 });
  const dry = await cli('generate', 'all', '--mode', 'feel', '--dry-run');
  assert.ok(dry.stdout.includes('5 prompt(s); zero model calls and zero attempts.'));
  assert.equal((await listAttempts(directory)).length, 2);
  await assert.rejects(() => cli('generate'), /Choose --model and --thinking/);
  assert.ok((await cli('show')).stdout.includes('USER REPORT'));
  await writeFile(join(directory, 'weather-context.json'), '{broken');
  await assert.rejects(() => collectWeatherOnce(directory, false, collect), SyntaxError);
  assert.equal(collections, 1, 'invalid cache is not silently replaced or fetched');
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log('✅ Weather collection, provenance, time zones, prompt isolation, offline dry runs and immutable replay tests passed.');
