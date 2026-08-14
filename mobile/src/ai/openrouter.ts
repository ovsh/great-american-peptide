// Minimal OpenRouter client for the Ask Poke harness.
//
// Scripts only in phase 1. The app never carries a provider key; a later
// phase puts a proxy in front of this (see `docs/ai-chat.md` §2).
//
// Two habits are load-bearing:
//  - `allow_fallbacks: false` on every call. An eval that measures one model
//    must not be silently routed to another one.
//  - no retries. A retry hides a rate limit or a bad request behind a slower
//    green run.

import type { ToolDef } from './tools.ts';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export type ToolChoice = 'auto' | 'required' | 'none';

export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  tool_choice?: ToolChoice;
  reasoning?: { effort: ReasoningEffort };
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export interface ChatResponse {
  message: { content: string | null; tool_calls?: ToolCall[] };
  usage: Usage | null;
}

export interface AiClient {
  chat(request: ChatRequest): Promise<ChatResponse>;
}

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
  }
}

const STATUS_COPY: Record<number, string> = {
  400: 'The request was rejected. Check the model id and the tool schemas.',
  401: 'The key was not accepted. Check OPENROUTER_API_KEY.',
  402: 'The account has no credit left.',
  403: 'The account cannot use this model.',
  408: 'The provider timed out. Try again.',
  429: 'The provider is busy. Try again in a moment.',
};

/** One short line per failure, for a script log or a later app surface. */
export function describeOpenRouterError(status: number): string {
  const copy = STATUS_COPY[status];
  if (copy) return copy;
  if (status >= 500 && status <= 599) return 'The provider had a problem. Try again in a moment.';
  return 'The request failed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readUsage(body: unknown): Usage | null {
  if (!isRecord(body) || !isRecord(body.usage)) return null;
  const usage = body.usage;
  return {
    promptTokens: numberOrZero(usage.prompt_tokens),
    completionTokens: numberOrZero(usage.completion_tokens),
    costUsd: numberOrZero(usage.cost),
  };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorDetail(body: unknown): string {
  if (isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string') {
    return `: ${body.error.message}`;
  }
  if (typeof body === 'string' && body.trim() !== '') return `: ${body.trim()}`;
  return '';
}

/** Reads the key from the environment only. Never from a file in the repo. */
export function openRouterKeyFromEnv(): string | null {
  const key = typeof process === 'undefined' ? undefined : process.env.OPENROUTER_API_KEY;
  return key && key.trim() !== '' ? key.trim() : null;
}

export interface OpenRouterClientOptions {
  apiKey?: string;
  baseUrl?: string;
}

export function createOpenRouterClient(options: OpenRouterClientOptions = {}): AiClient {
  const apiKey = options.apiKey ?? openRouterKeyFromEnv();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  const baseUrl = options.baseUrl ?? OPENROUTER_BASE_URL;

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://peptide.industries',
          'X-Title': 'Poke',
        },
        body: JSON.stringify({
          ...request,
          provider: { allow_fallbacks: false },
          usage: { include: true },
        }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        throw new OpenRouterError(
          `${describeOpenRouterError(response.status)} (${response.status})${errorDetail(body)}`,
          response.status,
        );
      }

      const choices = isRecord(body) && Array.isArray(body.choices) ? body.choices : [];
      const first: unknown = choices[0];
      const message = isRecord(first) && isRecord(first.message) ? first.message : null;
      if (!message) throw new OpenRouterError('The response carried no message.', response.status);
      return {
        message: {
          content: typeof message.content === 'string' ? message.content : null,
          ...(Array.isArray(message.tool_calls)
            ? { tool_calls: message.tool_calls as ToolCall[] }
            : {}),
        },
        usage: readUsage(body),
      };
    },
  };
}
