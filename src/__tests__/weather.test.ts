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
  await assert.rejects(() => buildWeatherRequest(reported, 'forecast-positive'), /No forecast/);
  const feel = await buildWeatherRequest(reported, 'reaction-positive');
  assert.ok(feel.userPrompt.includes(note));
  assert.ok(!feel.systemPrompt.includes(note), 'source report never becomes system instructions');
  assert.ok(feel.systemPrompt.includes('not a forecast or advice'));
  assert.ok(!feel.systemPrompt.includes('local forecast'));
  assert.ok(!/Helena|Montana|latitude|longitude|reportedAt|temperature|forecast/i.test(feel.userPrompt));
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
  assert.deepEqual(Object.keys(WEATHER_VOICES), ['forecast-negative', 'forecast-neutral', 'forecast-positive', 'reaction-negative', 'reaction-positive']);
  const prompts = await Promise.all((Object.keys(WEATHER_VOICES) as VoiceId[]).map(v => buildWeatherRequest(frozen, v)));
  assert.equal(new Set(prompts.map(p => p.userPrompt)).size, 2, 'presenters get a forecast; reactions get only the scene');
  assert.equal(new Set(prompts.map(p => p.systemPrompt)).size, 5);
  assert.equal(prompts[0].userPrompt, prompts[1].userPrompt);
  assert.equal(prompts[1].userPrompt, prompts[2].userPrompt);
  assert.equal(prompts[3].userPrompt, prompts[4].userPrompt);
  for (const prompt of prompts) {
    assert.ok(!/nihilistic college student|mommy blogger|Start with the supplied location/.test(prompt.systemPrompt));
  }
  assert.ok(prompts[0].systemPrompt.includes('nasty, foul-mouthed'));
  assert.ok(prompts[1].systemPrompt.includes('warm, steady local weatherman'));
  assert.ok(prompts[1].systemPrompt.includes('do not minimize danger'));
  assert.ok(!prompts[0].systemPrompt.includes('one concrete, ordinary intention'));
  assert.ok(prompts[2].systemPrompt.includes('incorrigibly optimistic'));
  assert.ok(prompts[2].systemPrompt.includes('one brief personal aside'));
  assert.ok(prompts[3].systemPrompt.includes('one concrete, ordinary intention'));
  assert.ok(prompts[4].systemPrompt.includes('one concrete, ordinary intention'));
  assert.ok(prompts[3].systemPrompt.includes('one telling detail'));
  assert.ok(prompts[4].systemPrompt.includes('one telling detail'));
  assert.ok(prompts[3].systemPrompt.includes('You fucking hate'));
  assert.ok(prompts[4].systemPrompt.includes('ridiculously pleased'));
  assert.ok(prompts[0].systemPrompt.includes('There is no required opening'));
  assert.ok(!prompts[3].systemPrompt.includes('Helena'));
  assert.ok(!prompts[4].systemPrompt.includes('Helena'));
  const input = JSON.parse(prompts[0].userPrompt.split('\n\n').slice(1).join('\n\n'));
  assert.equal(input.location, HELENA.name);
  assert.deepEqual(input.periods.map((p: { name: string }) => p.name), ['Tonight']);
  assert.ok(!prompts[0].userPrompt.includes(note), 'user anecdotes do not leak into the forecast');
  const reactionInput = JSON.parse(prompts[3].userPrompt.split('\n\n').slice(1).join('\n\n'));
  assert.deepEqual(reactionInput, { situation: [note] });
  const fallback = await buildWeatherRequest({ ...frozen, reports: [] }, 'reaction-negative');
  assert.deepEqual(JSON.parse(fallback.userPrompt.split('\n\n')[1]), { situation: ['Mostly Cloudy'] });
  const stale = { ...frozen, reports: [{ ...frozen.reports[0], reportedAt: '2026-03-20T01:00:00Z' }] };
  assert.equal((await buildWeatherRequest(stale, 'reaction-negative')).userPrompt, fallback.userPrompt);
  for (const scene of ['It is hot and humid.', 'It is raining.', 'It is mild and sunny.']) {
    const otherWeather = { ...frozen, reports: [{ ...frozen.reports[0], text: scene }] };
    for (const [voice, original] of [['reaction-negative', prompts[3]], ['reaction-positive', prompts[4]]] as const) {
      const request = await buildWeatherRequest(otherWeather, voice);
      assert.equal(request.systemPrompt, original.systemPrompt, 'personal-intention guidance is independent of weather conditions');
      assert.deepEqual(JSON.parse(request.userPrompt.split('\n\n')[1]), { situation: [scene] });
    }
  }
  await assert.rejects(() => buildWeatherRequest(frozen, 'student'), /active weather voice/);
  await assert.rejects(() => buildWeatherRequest(frozen, 'weather-dark'), /replay-only/);
  await assert.rejects(() => buildWeatherRequest(frozen, 'forecast-negative', 'feel'), /require/);
  await assert.rejects(() => buildWeatherRequest(frozen, 'reaction-negative', 'today'), /require/);
  const extended = await buildWeatherRequest(frozen, 'forecast-positive', 'extended');
  assert.ok(extended.userPrompt.includes('Sunday Night'));
  const writer: Writer = { model: 'fixture', thinking: 'off', async generate(request) {
    return { model: 'fixture', thinking: 'off', text: 'Helena is still cold enough to make the melting snow feel like a technicality rather than a victory. There is less white on the ground, but the jacket remains firmly employed. For now, the improvement is mostly something you can point at through a window.',
      audit: { ...request, tools: [], messageRoles: ['user'], payloadVerified: true, reasoningEffort: 'none' } };
  } };
  const seed = await seedFromWeather(frozen, 'reaction-positive');
  const a = await withPreviewLock(directory, () => generateAttempt(directory, seed, writer));
  assert.equal(a.status, 'ready');
  assert.equal(a.source.kind, 'weather');
  assert.equal(a.passage!.genre, 'Daily AI / Weather');
  assert.equal(a.sourceId, sourceId(frozen));
  assert.deepEqual(await getAttempt(directory, 1), JSON.parse(JSON.stringify(a)), 'history recognizes hyphenated weather voice filenames');
  await withPreviewLock(directory, () => markAttempt(directory, 1, 'good'));
  assert.equal((await readReviews(directory))['1'].rating, 'good');
  const original = await readFile(join(directory, 'attempts', '001-reaction-positive.json'), 'utf8');
  await withPreviewLock(directory, () => addWeatherReport(directory, 'A later user report.', new Date(now.getTime() + 3600_000)));
  const b = await withPreviewLock(directory, () => generateAttempt(directory, seedFromAttempt(a), writer));
  assert.deepEqual(b.request, a.request, 'replay ignores changed current input');
  assert.equal(b.replayOf, 1);
  assert.equal(await readFile(join(directory, 'attempts', '001-reaction-positive.json'), 'utf8'), original);
  const cli = (...args: string[]) => promisify(execFile)(process.execPath, [
    '--import', 'tsx', 'src/dailyPreview.ts', '--dir', directory, 'weather', ...args
  ], { timeout: 15_000 });
  const dry = await cli('generate', 'all', '--dry-run');
  assert.ok(dry.stdout.includes('5 prompt(s); zero model calls and zero attempts.'));
  const neutralDry = await cli('generate', 'forecast-neutral', '--dry-run');
  assert.ok(neutralDry.stdout.includes('warm, steady local weatherman'));
  await assert.rejects(() => cli('generate', 'all', '--mode', 'feel', '--dry-run'), /require/);
  await assert.rejects(() => cli('generate', 'student', '--dry-run'), /Unknown weather voice/);
  const variants = ['gpt-6.1-sol:low', 'gpt-6-astra:low', 'gpt-5.6-luna:off'];
  const matrix = await cli('generate', 'all', '--parallel', '--dry-run', ...variants.flatMap(v => ['--variant', v]));
  assert.ok(matrix.stdout.includes('5 voices x 3 variants = 15 calls (parallel)'));
  await assert.rejects(() => cli('generate', '--dry-run', '--variant', variants[0], '--variant', variants[0]), /Duplicate/);
  await assert.rejects(() => cli('generate', '--dry-run', '--model', 'fixture', '--variant', variants[0], '--variant', variants[1]), /not both/);
  await assert.rejects(() => cli('generate', '--dry-run', '--model', 'fixture'), /Choose --model and --thinking/);
  assert.equal((await listAttempts(directory)).length, 2);
  await assert.rejects(() => cli('generate'), /Choose --model and --thinking/);
  assert.ok((await cli('show')).stdout.includes('USER REPORT'));
  const legacy = await withPreviewLock(directory, () => generateAttempt(directory, { ...seedFromAttempt(a), voice: 'weather-dark' }, writer));
  assert.equal((await getAttempt(directory, legacy.attemptId)).voice, 'weather-dark', 'retired IDs remain readable');
  assert.deepEqual(seedFromAttempt(legacy).request, a.request, 'archived replay does not load retired prompt files');
  await writeFile(join(directory, 'weather-context.json'), '{broken');
  await assert.rejects(() => collectWeatherOnce(directory, false, collect), SyntaxError);
  assert.equal(collections, 1, 'invalid cache is not silently replaced or fetched');
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log('✅ Weather collection, provenance, time zones, prompt isolation, offline dry runs and immutable replay tests passed.');
