export const DAILY_TIME_ZONE = 'America/Denver';

const clock = new Intl.DateTimeFormat('en-US', {
  timeZone: DAILY_TIME_ZONE, calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  timeZoneName: 'longOffset'
});

/** ISO 8601 in the scheduling zone, retaining the instant, milliseconds and DST offset. */
export function localTimestamp(now = new Date()): string {
  const p = Object.fromEntries(clock.formatToParts(now).map(part => [part.type, part.value]));
  const offset = p.timeZoneName === 'GMT' ? '+00:00' : p.timeZoneName.replace('GMT', '');
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${String(now.getUTCMilliseconds()).padStart(3, '0')}${offset}`;
}

/** Old UTC records remain untouched; only their human-readable timestamp is localized. */
export function displayTimestamp(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return value;
  return localTimestamp(new Date(value)).replace('T', ' ');
}

export const APP_TIMESTAMP_FIELDS = new Set([
  'at', 'createdAt', 'startedAt', 'finishedAt', 'generatedAt',
  'fetchedAt', 'frozenAt', 'updatedAt', 'reportedAt'
]);
