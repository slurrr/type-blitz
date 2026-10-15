import assert from 'node:assert/strict';
import { dailyDay } from '../daily/session.js';
import { displayTimestamp, localTimestamp } from '../daily/time.js';
import { renderSavedDataHtml } from '../daily/requestView.js';

// Includes local midnight, winter/summer offsets, skipped/repeated DST hours and year rollover.
const cases = [
  ['2026-10-15T01:29:55.200Z', '2026-10-14T19:29:55.200-06:00'],
  ['2026-10-15T06:00:00.001Z', '2026-10-15T00:00:00.001-06:00'],
  ['2026-01-15T07:00:00.000Z', '2026-01-15T00:00:00.000-07:00'],
  ['2026-03-08T08:59:59.999Z', '2026-03-08T01:59:59.999-07:00'],
  ['2026-03-08T09:00:00.000Z', '2026-03-08T03:00:00.000-06:00'],
  ['2026-11-01T07:30:00.000Z', '2026-11-01T01:30:00.000-06:00'],
  ['2026-11-01T08:30:00.000Z', '2026-11-01T01:30:00.000-07:00'],
  ['2027-01-01T01:00:00.000Z', '2026-12-31T18:00:00.000-07:00']
];
const originalTZ = process.env.TZ;
try {
  for (const zone of ['UTC', 'Asia/Tokyo', 'America/Denver']) {
    process.env.TZ = zone;
    for (const [utc, expected] of cases) {
      const date = new Date(utc);
      assert.equal(localTimestamp(date), expected);
      assert.equal(Date.parse(expected), date.getTime(), 'instant and milliseconds preserved');
      assert.equal(expected.slice(0, 10), dailyDay(date), 'saved date matches scheduling day');
      assert.equal(displayTimestamp(utc), expected.replace('T', ' '));
      assert.equal(displayTimestamp(expected), displayTimestamp(utc), 'old/new records display identically');
    }
  }
} finally {
  if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ;
}
for (const invalid of ['', 'yesterday', '2026-10-15', '2026-10-15T01:29:55', '<script>bad()</script>']) {
  assert.equal(displayTimestamp(invalid), invalid, 'do not guess a timezone for invalid/ambiguous saved values');
}
assert.throws(() => localTimestamp(new Date(NaN)), RangeError);
const utc = cases[0][0], local = cases[0][1].replace('T', ' ');
const record = { startedAt: utc, events: [{ at: utc }], source: { fetchedAt: utc, publishedAt: utc } };
const before = JSON.stringify(record);
const html = renderSavedDataHtml('Saved collection', record);
assert.ok(html.includes(local));
assert.ok(html.includes(`<dt>Published At</dt><dd><pre><code>${utc}</code>`), 'publisher timestamp remains attributed as saved');
assert.ok(html.includes('America/Denver'));
assert.ok(html.includes('&quot;startedAt&quot;: &quot;' + utc), 'complete JSON retains its original timestamp');
assert.equal(JSON.stringify(record), before, 'rendering never mutates historical data');
console.log('✅ Helena timestamp persistence/display, midnight, DST, scheduling consistency and immutable history passed.');
