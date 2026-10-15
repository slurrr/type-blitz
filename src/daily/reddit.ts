import { stripVTControlCharacters } from 'node:util';
import type { SourceComment, SourcePacket, SourcePost } from './types.js';

export const FEED_URL = 'https://www.reddit.com/r/popular/hot.json?limit=25&raw_json=1';
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

// JSON from the network stays unknown until individual fields have been checked.
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
export function cleanText(value: unknown, limit = 2000): string {
  if (typeof value !== 'string') return '';
  return stripVTControlCharacters(value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, limit);
}
function children(listing: unknown): unknown[] {
  const root = object(listing);
  const items = object(root.data).children;
  if (root.kind !== 'Listing' || !Array.isArray(items)) {
    throw new Error('Expected a Reddit Listing; login/block pages and API errors are not source data.');
  }
  return items;
}
function removed(text: string): boolean {
  return !text || /^\[(removed|deleted)\]$/i.test(text);
}
function httpUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

/** Conservative eligibility, not a semantic quality classifier. Preview the packet before writing. */
export function eligiblePosts(listing: unknown, now = Date.now(), limit = 25): SourcePost[] {
  const posts: SourcePost[] = [];
  for (const item of children(listing).slice(0, limit)) {
    const child = object(item);
    const p = object(child.data);
    if (child.kind !== 't3' || p.stickied || p.over_18 || p.removed_by_category) continue;
    const id = cleanText(p.id, 20);
    const title = cleanText(p.title, 500);
    const text = cleanText(p.selftext, 3000);
    const url = httpUrl(p.url);
    const permalink = typeof p.permalink === 'string' ? p.permalink : '';
    const age = now - number(p.created_utc) * 1000;
    if (!/^[a-z0-9]+$/.test(id) || !/^\/r\/[A-Za-z0-9_]+\/comments\/[a-z0-9]+\/[A-Za-z0-9_]*\/?$/.test(permalink)) continue;
    if (!url) continue;
    if (age < -60_000 || age > MAX_AGE_MS || number(p.num_comments) < 20) continue;
    if (text && removed(text)) continue;
    const media = p.is_video || p.is_gallery || ['image', 'hosted:video', 'rich:video'].includes(String(p.post_hint))
      || /\.(gif|jpe?g|png|webp|mp4)(\?|$)/i.test(url)
      || /https?:\/\/(?:i|v)\.redd\.it\//i.test(url);
    // A media-only post has no textual context we can inspect. Do not guess from its comments.
    if (media && text.length < 100) continue;
    if (title.length < 70 && text.length < 100) continue;
    posts.push({
      id, title, text, subreddit: cleanText(p.subreddit, 100),
      permalink: new URL(permalink, 'https://www.reddit.com').href,
      url, publishedAt: new Date(number(p.created_utc) * 1000).toISOString(),
      score: number(p.score), commentCount: number(p.num_comments)
    });
  }
  return posts;
}
export function selectPost(listing: unknown, now = Date.now()): SourcePost {
  const post = eligiblePosts(listing, now)[0];
  if (post) return post;
  throw new Error('No recent, active, text-understandable candidate in the first 25 posts. No extra requests made.');
}

export function extractComments(thread: unknown, postId: string): SourceComment[] {
  if (!Array.isArray(thread) || thread.length !== 2) throw new Error('Expected a Reddit post/comments response.');
  const post = object(object(children(thread[0])[0]).data);
  if (post.id !== postId) throw new Error('Comments belong to a different post.');
  const seenIds = new Set<string>();
  const seenText = new Set<string>();
  function extract(listing: unknown, parent: string, depth: number): SourceComment[] {
    const result: SourceComment[] = [];
    for (const item of children(listing).slice(0, 30)) {
      const child = object(item);
      const c = object(child.data);
      if (child.kind !== 't1') continue; // Never follow "more" comment requests.
      const id = cleanText(c.name, 40);
      const body = cleanText(typeof c.body === 'string'
        ? c.body.replace(/!\[[^\]]*\]\([^)]*\)/g, '') : '', depth === 0 ? 1200 : 700);
      const author = cleanText(c.author, 100);
      if (c.parent_id !== parent || !/^t1_[a-z0-9]+$/.test(id) || seenIds.has(id)) continue;
      if (c.stickied || c.distinguished === 'moderator' || /(?:bot|automoderator)$/i.test(author)) continue;
      if (removed(body) || body.length < 25 || seenText.has(body.toLowerCase())) continue;
      if (/I am a bot|automatic reminder|this action was performed automatically/i.test(body)) continue;
      seenIds.add(id);
      seenText.add(body.toLowerCase());
      const replies = depth === 0 && c.replies ? extract(c.replies, id, 1) : [];
      result.push({ id, parentId: parent, text: body, score: number(c.score), replies });
      if (result.length === (depth === 0 ? 6 : 2)) break;
    }
    return result;
  }
  const comments = extract(thread[1], 't3_' + postId, 0);
  if (comments.length < 3) throw new Error('Fewer than three substantive comments survived cleanup. No fallback scrape.');
  return comments;
}

export function makePacket(post: SourcePost, comments: SourceComment[], fetchedAt: string): SourcePacket {
  return {
    version: 1, feed: FEED_URL, fetchedAt,
    selection: 'First eligible post in popular/hot: within 72 hours, 20+ comments, descriptive text, no media-only context. Top-sort comments, up to six branches and two replies each.',
    limitations: [
      'Public popular feed accessed in a real browser; account/region-independent ranking is not guaranteed.',
      'Post/headline and comments are claims and reactions, not independently verified reporting. Linked articles were not fetched.',
      'Small top-sorted discussion sample; votes are not universal consensus. Text may be length-capped.'
    ],
    post, comments
  };
}
