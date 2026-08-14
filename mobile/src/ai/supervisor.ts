// The Ask Poke turn engine: one loop, two tools, four iterations.
//
// Everything the model can get wrong is caught here, in code, not by trust:
//  - "answer" is only legal when reconstitution_calc ran in this turn.
//  - every numeral in the reply must come from a tool result, from the user,
//    or from the state digest. Ungrounded prose is dropped.
//  - the budget always ends in a final_answer, forced if the model dawdles.
// See `docs/ai-chat.md` §1 and §2.

import { ASK_POKE_SYSTEM_PROMPT } from './prompt.ts';
import type {
  AiClient,
  ChatMessage,
  ChatRequest,
  ReasoningEffort,
  ToolCall,
  Usage,
} from './openrouter.ts';
import {
  ASK_POKE_TOOLS,
  FINAL_ANSWER_TOOL,
  calcResultPayload,
  coerceFinalAnswer,
  runReconstitutionCalc,
  type CalcArgs,
  type CalcRun,
  type Disposition,
} from './tools.ts';

export const MAX_ITERATIONS = 4;

/** Copy the harness falls back to. Short sentences, one question, no numbers. */
export const CLARIFY_FALLBACK_TEXT = 'I do not have the numbers I need. What is the vial amount in mg?';

export const DECLINE_FALLBACK_TEXT =
  'I cannot help with the amount to take. Ask a licensed clinician about that. I can convert a vial into a concentration.';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface RunTurnOptions {
  /**
   * The model id, always chosen by the caller. No default lives here: the
   * bake-off picks the model, and a constant in this module would quietly
   * become that decision.
   */
  model: string;
  reasoning?: ReasoningEffort;
  /** The inputs of the last confirmed calc, carried between turns by the caller. */
  lastCalc?: CalcArgs | null;
  systemPrompt?: string;
  maxIterations?: number;
}

export interface TurnResult {
  disposition: Disposition;
  /** What the user sees. Empty when ungrounded prose was dropped over a card. */
  text: string;
  /** What the model wrote, kept for the eval grader. Never rendered. */
  rawText: string;
  calcUsed: boolean;
  calc: CalcRun | null;
  toolCalls: string[];
  calcArgsSeen: CalcArgs[];
  groundingFailed: boolean;
  ungroundedNumerals: string[];
  downgraded: boolean;
  forcedFinal: boolean;
  iterations: number;
  digest: string;
  model: string;
  usage: Usage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ---------- state digest ----------

function trimNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

/**
 * One line of carried state, prepended to the user turn so a follow-up such as
 * "make it 1 ml instead" resolves without re-reading the whole history.
 */
export function buildStateDigest(lastCalc: CalcArgs | null | undefined): string {
  if (!lastCalc) return 'State digest: no confirmed inputs yet.';
  const parts = [
    `vial ${trimNumber(lastCalc.materialMassMg)} mg`,
    `diluent ${trimNumber(lastCalc.diluentMl)} ml`,
  ];
  if (lastCalc.aliquotAmountMcg !== undefined && lastCalc.aliquotAmountMcg > 0) {
    parts.push(`sample ${trimNumber(lastCalc.aliquotAmountMcg)} mcg`);
  }
  return `State digest: ${parts.join(', ')}.`;
}

// ---------- numeral grounding ----------

const NUMERAL = /\d+(?:\.\d+)?/g;

// A peptide name is not a number. BPC-157 and GLP-1 must not read as a claim.
const NAMED_COMPOUND = /\b[A-Za-z]{2,}-\d+\b/g;

/** Every numeral in a piece of text, less compound names and thousands commas. */
export function extractNumerals(text: string): string[] {
  const flattened = text
    .replace(NAMED_COMPOUND, ' ')
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2');
  return flattened.match(NUMERAL) ?? [];
}

function decimalsOf(numeral: string): number {
  const dot = numeral.indexOf('.');
  return dot < 0 ? 0 : numeral.length - dot - 1;
}

/**
 * A numeral is grounded when some allowed value rounds to it at the precision
 * the model wrote. "0.25 ml" is grounded by 0.2499999, "2 mg" is not grounded
 * by 5.
 */
function isGrounded(numeral: string, allowed: number[]): boolean {
  const written = Number(numeral);
  if (!Number.isFinite(written)) return true;
  const tolerance = 0.5 * Math.pow(10, -decimalsOf(numeral)) + 1e-9;
  return allowed.some((value) => Math.abs(value - written) <= tolerance);
}

function calcValues(run: CalcRun): number[] {
  const values = [
    run.args.materialMassMg,
    run.args.diluentMl,
    run.result.concentrationMgPerMl,
    run.result.concentrationMcgPerMl,
    run.result.totalMaterialMcg,
  ];
  if (run.args.aliquotAmountMcg !== undefined) values.push(run.args.aliquotAmountMcg);
  if (run.result.aliquotVolumeMl !== null) values.push(run.result.aliquotVolumeMl);
  return values;
}

/** The numerals the reply is allowed to use: tool results, user words, digest. */
export function groundedValues(runs: CalcRun[], sources: string[]): number[] {
  const values = runs.flatMap(calcValues);
  for (const source of sources) {
    for (const numeral of extractNumerals(source)) values.push(Number(numeral));
  }
  return values.filter((value) => Number.isFinite(value));
}

/** The numerals in `text` that no allowed value can account for. */
export function ungroundedNumerals(text: string, allowed: number[]): string[] {
  return extractNumerals(text).filter((numeral) => !isGrounded(numeral, allowed));
}

// ---------- tolerant final_answer parsing ----------

/**
 * Some models write the final_answer payload as prose, or fenced, or wrapped
 * in a sentence. Read the first balanced object out of it rather than losing
 * the turn to a formatting slip.
 */
export function parseFinalAnswerText(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const text = fenced ? fenced[1].trim() : trimmed;

  const parseRecord = (json: string): Record<string, unknown> | null => {
    try {
      const parsed: unknown = JSON.parse(json);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const whole = parseRecord(text);
  if (whole) return whole;

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (start < 0) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return parseRecord(text.slice(start, index + 1));
    }
  }
  return null;
}

function parseToolArguments(call: ToolCall): unknown {
  const raw = call.function.arguments;
  if (typeof raw !== 'string') return raw ?? {};
  const parsed = parseFinalAnswerText(raw);
  return parsed ?? {};
}

// ---------- the turn ----------

function emptyUsage(): Usage {
  return { promptTokens: 0, completionTokens: 0, costUsd: 0 };
}

function addUsage(total: Usage, next: Usage | null): void {
  if (!next) return;
  total.promptTokens += next.promptTokens;
  total.completionTokens += next.completionTokens;
  total.costUsd += next.costUsd;
}

/**
 * Runs one turn. `messages` is the conversation so far, oldest first; the last
 * entry must be the user turn to answer.
 */
export async function runChatTurn(
  messages: ConversationTurn[],
  client: AiClient,
  options: RunTurnOptions,
): Promise<TurnResult> {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') {
    throw new Error('runChatTurn needs a conversation that ends with a user turn');
  }
  const model = options.model;
  const maxIterations = options.maxIterations ?? MAX_ITERATIONS;
  const digest = buildStateDigest(options.lastCalc ?? null);
  const userTexts = messages.filter((turn) => turn.role === 'user').map((turn) => turn.text);

  const wire: ChatMessage[] = [
    { role: 'system', content: options.systemPrompt ?? ASK_POKE_SYSTEM_PROMPT },
    ...messages.slice(0, -1).map((turn): ChatMessage => ({ role: turn.role, content: turn.text })),
    { role: 'user', content: `${digest}\n\n---\n\nUser: ${last.text}` },
  ];

  const usage = emptyUsage();
  const toolCalls: string[] = [];
  const calcArgsSeen: CalcArgs[] = [];
  const runs: CalcRun[] = [];
  let iterations = 0;
  let forcedFinal = false;

  const request = (
    extra: Partial<ChatRequest> = {},
  ): ChatRequest => ({
    model,
    messages: wire,
    tools: ASK_POKE_TOOLS,
    ...(options.reasoning ? { reasoning: { effort: options.reasoning } } : {}),
    ...extra,
  });

  const finish = (raw: unknown): TurnResult => {
    const parsed = coerceFinalAnswer(raw);
    const calc = runs.length > 0 ? runs[runs.length - 1] : null;
    const rawText = parsed?.text ?? '';
    let disposition: Disposition = parsed?.disposition ?? 'clarify';
    let text = rawText;
    let downgraded = false;

    // Rule 2 of the architecture: "answer" needs a calc from this turn.
    if (disposition === 'answer' && calc === null) {
      disposition = 'clarify';
      downgraded = true;
      text = CLARIFY_FALLBACK_TEXT;
    }
    if (text.trim() === '') {
      text = disposition === 'decline' ? DECLINE_FALLBACK_TEXT : CLARIFY_FALLBACK_TEXT;
    }

    const allowed = groundedValues(runs, [...userTexts, digest]);
    const ungrounded = ungroundedNumerals(text, allowed);
    const groundingFailed = ungrounded.length > 0;
    if (groundingFailed) {
      // Rule 1: the prose goes, the tool result stays. With no card to fall
      // back on, safe copy takes its place so the turn is never silent.
      text = calc === null
        ? (disposition === 'decline' ? DECLINE_FALLBACK_TEXT : CLARIFY_FALLBACK_TEXT)
        : '';
    }

    return {
      disposition,
      text,
      rawText,
      calcUsed: calc !== null,
      calc,
      toolCalls,
      calcArgsSeen,
      groundingFailed,
      ungroundedNumerals: ungrounded,
      downgraded,
      forcedFinal,
      iterations,
      digest,
      model,
      usage,
    };
  };

  const executeCalc = (args: unknown): string => {
    const outcome = runReconstitutionCalc(args);
    if (!outcome.ok) return JSON.stringify({ error: outcome.error });
    runs.push(outcome.run);
    calcArgsSeen.push(outcome.run.args);
    return calcResultPayload(outcome.run);
  };

  let response = await client.chat(request());
  addUsage(usage, response.usage);

  while (iterations < maxIterations) {
    const calls = response.message.tool_calls ?? [];
    const final = calls.find((call) => call.function.name === 'final_answer');
    if (final) return finish(parseToolArguments(final));

    if (calls.length === 0) {
      const parsed = parseFinalAnswerText(response.message.content ?? '');
      if (parsed) return finish(parsed);
      break;
    }

    iterations += 1;
    wire.push({ role: 'assistant', content: response.message.content, tool_calls: calls });
    for (const call of calls) {
      const name = call.function.name;
      toolCalls.push(name);
      let content: string;
      try {
        content = name === 'reconstitution_calc'
          ? executeCalc(parseToolArguments(call))
          : JSON.stringify({ error: `unknown tool ${name}` });
      } catch (error) {
        // A tool failure is text the model can read, never a thrown turn.
        const message = error instanceof Error ? error.message : String(error);
        content = JSON.stringify({ error: message });
      }
      wire.push({ role: 'tool', tool_call_id: call.id, content });
    }

    response = await client.chat(request());
    addUsage(usage, response.usage);
  }

  // The budget is spent. Force the one tool that ends the turn, so the user
  // gets an answer or a question, never silence.
  forcedFinal = true;
  wire.push({
    role: 'user',
    content: 'Stop here and call final_answer now with one disposition and your reply text.',
  });
  const forced = await client.chat(request({ tools: [FINAL_ANSWER_TOOL], tool_choice: 'required' }));
  addUsage(usage, forced.usage);
  const forcedCall = (forced.message.tool_calls ?? []).find(
    (call) => call.function.name === 'final_answer',
  );
  if (forcedCall) return finish(parseToolArguments(forcedCall));
  return finish(parseFinalAnswerText(forced.message.content ?? ''));
}
