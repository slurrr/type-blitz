import type { Passage } from '../types.js';

export interface SourceComment {
  id: string;
  parentId: string;
  text: string;
  score: number;
  replies: SourceComment[];
}

export interface SourcePost {
  id: string;
  title: string;
  text: string;
  subreddit: string;
  permalink: string;
  url: string;
  publishedAt: string;
  score: number;
  commentCount: number;
}

export interface SourcePacket {
  version: 1;
  feed: string;
  fetchedAt: string;
  selection: string;
  limitations: string[];
  post: SourcePost;
  comments: SourceComment[];
}

export const VOICES = {
  student: 'Nihilistic college student',
  blogger: 'Earnest mommy blogger',
  satirist: 'Dry satirical observer'
} as const;
// Historical IDs stay readable/replayable, but are not active weather choices.
const LEGACY_WEATHER_VOICES = {
  weatherman: 'Local weather anchor',
  'weather-friend': 'Relatable weather observer',
  'weather-dark': 'Dark local weather presenter'
} as const;
export const WEATHER_VOICES = {
  'forecast-negative': 'Nasty local weatherman',
  'forecast-neutral': 'Neutral local weatherman',
  'forecast-positive': 'Personally optimistic local weatherman',
  'reaction-negative': 'Negative human weather reaction',
  'reaction-positive': 'Overly positive human weather reaction'
} as const;
export const HEADLINE_VOICES = { 'headline-reaction': 'Personal headline reaction' } as const;
export const ALL_VOICES = { ...VOICES, ...LEGACY_WEATHER_VOICES, ...WEATHER_VOICES, ...HEADLINE_VOICES };
export type VoiceId = keyof typeof ALL_VOICES;

export const THINKING_LEVELS = ['off', 'low', 'medium', 'high', 'xhigh'] as const;
export type ThinkingLevel = typeof THINKING_LEVELS[number];

export interface WriterRequest {
  systemPrompt: string;
  userPrompt: string;
}
export interface WriterResult {
  text: string;
  model: string;
  thinking: ThinkingLevel;
  audit: {
    systemPrompt: string;
    userPrompt: string;
    tools: string[];
    messageRoles: string[];
    payloadVerified: boolean;
    reasoningEffort?: string;
  };
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
}
export interface Writer {
  model: string;
  thinking: ThinkingLevel;
  generate(request: WriterRequest): Promise<WriterResult>;
}

export const RATINGS = ['good', 'mid', 'bad'] as const;
export type Rating = typeof RATINGS[number];
export interface Review {
  rating?: Rating;
  note: string;
  updatedAt: string;
}
export type Reviews = Record<string, Review>;

export interface Attempt extends PreviewSample {
  attemptId: number;
  promptId: string;
  source: { title: string; year: number; kind?: 'reddit' | 'weather' | 'headlines' };
  execution: 'sequential' | 'parallel' | 'unknown';
  replayOf?: number;
  importedFrom?: { file: string; sha256: string };
}

export interface PreviewSample {
  version: 1;
  voice: VoiceId;
  label: string;
  sourceId: string;
  createdAt: string;
  elapsedMs?: number;
  model: string;
  thinking: ThinkingLevel;
  request: WriterRequest;
  status: 'pending' | 'ready' | 'error';
  result?: WriterResult;
  passage?: Passage;
  warnings?: string[];
  error?: string;
}
