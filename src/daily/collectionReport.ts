import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { writeOnce } from './history.js';
import { cleanText } from './reddit.js';

export interface CollectionEvent {
  stage: 'feed' | 'article' | 'headlines' | 'buzz' | 'weather';
  status: 'start' | 'ready' | 'skip' | 'error';
  url?: string;
  title?: string;
  reason?: string;
  details?: Record<string, unknown>;
}
export type CollectionObserver = (event: CollectionEvent) => void;
export const collectionReportPath = (directory: string, id: string) => join(directory, 'collection', id + '.json');

/** Archive diagnostic metadata on success AND failure; no credentials, headers or browser history. */
export async function traceCollection<T>(
  directory: string, id: string, operation: (observe: CollectionObserver) => Promise<T>
): Promise<T> {
  await mkdir(join(directory, 'collection'), { recursive: true });
  const events: (CollectionEvent & { at: string })[] = [];
  const startedAt = new Date().toISOString();
  let failure: string | undefined;
  try {
    return await operation(event => events.push({ ...event, at: new Date().toISOString() }));
  } catch (error) {
    failure = cleanText(error instanceof Error ? error.message : String(error), 2000);
    throw error;
  } finally {
    await writeOnce(collectionReportPath(directory, id), {
      version: 1, runId: id, startedAt, finishedAt: new Date().toISOString(),
      status: failure === undefined ? 'ready' : 'error', error: failure, events
    });
  }
}
