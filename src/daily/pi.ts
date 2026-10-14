import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type { ThinkingLevel, Writer, WriterRequest, WriterResult } from './types.js';

// A deliberately tiny structural boundary to the separately installed Pi SDK.
// The game has no Pi dependency; replacing this file with an API client is independent.
export interface PiModel { provider: string; id: string }
export interface PiContext {
  systemPrompt: string;
  messages: { role: 'user'; content: string; timestamp: number }[];
  tools: never[];
}
export interface PiOptions {
  reasoning: ThinkingLevel;
  maxTokens: number;
  maxRetries: number;
  transport: 'sse';
  cacheRetention: 'none';
  toolChoice: 'none';
  signal: AbortSignal;
  onPayload: (payload: unknown) => void;
}
export interface PiRuntime {
  getPhysicalModel(provider: string, model: string): PiModel | undefined;
  completeSimple(model: PiModel, context: PiContext, options: PiOptions): Promise<{
    stopReason: string;
    errorMessage?: string;
    provider: string;
    model: string;
    content: { type: string; text?: string }[];
    usage?: WriterResult['usage'];
  }>;
}
export const DEFAULT_MODEL = 'gpt-5.6-luna';
export const DEFAULT_THINKING: ThinkingLevel = 'xhigh';

/** Refuse the request BEFORE sending if the provider adds instructions, tools or history. */
export function verifyPayload(payload: unknown, request: WriterRequest, thinking: ThinkingLevel): void {
  const p = payload as {
    instructions?: unknown; tools?: unknown[]; input?: { role?: string; content?: { type?: string; text?: string }[] }[];
    tool_choice?: string; store?: boolean; reasoning?: { effort?: string };
  } | null;
  if (!p || p.instructions !== request.systemPrompt || (p.tools?.length ?? 0) !== 0 ||
      p.tool_choice !== 'none' || p.store !== false || p.reasoning?.effort !== thinking || !Array.isArray(p.input) || p.input.length !== 1 ||
      p.input[0].role !== 'user' || !Array.isArray(p.input[0].content) || p.input[0].content.length !== 1 ||
      p.input[0].content[0].type !== 'input_text' || p.input[0].content[0].text !== request.userPrompt) {
    throw new Error('Writer isolation check failed: unexpected prompt, history, storage or tools. Request not sent.');
  }
}

export function makePiWriter(runtime: PiRuntime, modelId: string, thinking: ThinkingLevel = DEFAULT_THINKING): Writer {
  const model = runtime.getPhysicalModel('openai-codex', modelId);
  if (!model) throw new Error(`Pi has no physical openai-codex/${modelId} model. Choose an available model explicitly.`);
  const name = `${model.provider}/${model.id}`;
  return {
    model: name,
    thinking,
    async generate(request) {
      let verified = false;
      const context: PiContext = {
        systemPrompt: request.systemPrompt,
        messages: [{ role: 'user', content: request.userPrompt, timestamp: Date.now() }],
        tools: []
      };
      // No AgentSession, resource loader, settings, tools, or saved conversations are constructed.
      const response = await runtime.completeSimple(model, context, {
        reasoning: thinking, maxTokens: 16384, maxRetries: 0, transport: 'sse',
        cacheRetention: 'none', toolChoice: 'none', signal: AbortSignal.timeout(300_000),
        onPayload(payload) {
          verifyPayload(payload, request, thinking);
          verified = true;
        }
      });
      if (!verified) throw new Error('Pi did not run the outgoing-payload isolation check.');
      if (response.stopReason !== 'stop') {
        throw new Error(`Writer stopped (${response.stopReason}): ${response.errorMessage ?? 'no complete passage'}`);
      }
      if (`${response.provider}/${response.model}` !== name) throw new Error('Unexpected model substitution.');
      if (response.content.some(c => c.type !== 'text' && c.type !== 'thinking')) {
        throw new Error('Writer returned a non-text/tool response.');
      }
      return {
        model: name,
        thinking,
        text: response.content.filter(c => c.type === 'text').map(c => c.text ?? '').join(''),
        audit: {
          systemPrompt: context.systemPrompt, userPrompt: request.userPrompt,
          tools: [], messageRoles: ['user'], payloadVerified: verified
        },
        // Never persist auth, headers, hidden reasoning, or a full provider response.
        usage: response.usage && {
          input: response.usage.input, output: response.usage.output,
          cacheRead: response.usage.cacheRead, cacheWrite: response.usage.cacheWrite
        }
      };
    }
  };
}

export async function createPiWriter(modelId = DEFAULT_MODEL, thinking: ThinkingLevel = DEFAULT_THINKING): Promise<Writer> {
  let root = process.env.TYPE_BLITZ_PI_ROOT;
  if (!root) {
    const { stdout } = await promisify(execFile)('npm', ['root', '--global'], { timeout: 10_000 });
    root = join(stdout.trim(), '@earendil-works/pi-coding-agent');
  }
  root = resolve(root);
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  if (pkg.name !== '@earendil-works/pi-coding-agent') throw new Error('TYPE_BLITZ_PI_ROOT must point to the Pi package directory.');
  const sdk = await import(pathToFileURL(join(root, 'dist/index.js')).href);
  const runtime: PiRuntime = await sdk.ModelRuntime.create({
    // Use Pi's credential store, not its custom model overlays, resources or agent configuration.
    modelsPath: null, allowModelNetwork: false, refreshOnCreate: false
  });
  return makePiWriter(runtime, modelId, thinking);
}
