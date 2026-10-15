import { randomUUID } from 'node:crypto';
import { collectionReportPath, traceCollection } from './collectionReport.js';
import { withPreviewLock } from './preview.js';
import { collectDailySources } from './sources.js';

/** Explicit source-only diagnostic. Never initializes a writer or changes the day's run/cache state. */
export async function checkDailyCollection(
  directory: string, collect = collectDailySources, signal: AbortSignal = new AbortController().signal
): Promise<{ ok: boolean; report: string; headlines?: string[]; buzz?: string[]; error?: string }> {
  return withPreviewLock(directory, async () => {
    const id = randomUUID(), report = collectionReportPath(directory, id);
    try {
      const sources = await traceCollection(directory, id, observe => collect(signal, () => {}, observe));
      return { ok: true, report, headlines: sources.headlines.stories.map(s => s.article.title),
        buzz: sources.buzz.map(p => p.post.title) };
    } catch (error) {
      return { ok: false, report, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
