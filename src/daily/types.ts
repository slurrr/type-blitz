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
export type VoiceId = keyof typeof VOICES;

export const THINKING_LEVELS = ['low', 'medium', 'high', 'xhigh'] as const;
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
  };
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
}
export interface Writer {
  model: string;
  thinking: ThinkingLevel;
  generate(request: WriterRequest): Promise<WriterResult>;
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
