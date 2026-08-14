import type { AiClient, ChatRequest, ChatResponse } from './openrouter.ts';
import {
  CLARIFY_FALLBACK_TEXT,
  buildStateDigest,
  extractNumerals,
  parseFinalAnswerText,
  runChatTurn,
} from './supervisor.ts';

// Some cases await a mocked model call, so tests are queued and run in order
// at the bottom of the file instead of running as they are declared.
const queued: { name: string; body: () => void | Promise<void> }[] = [];

// The engine takes the model id from the caller. Nothing in src/ai/ picks one.
const TEST_MODEL = 'test/mock';

test('the digest carries the last confirmed inputs, and says so when there are none', () => {
  assertEqual(buildStateDigest(null), 'State digest: no confirmed inputs yet.', 'no state');
  assertEqual(
    buildStateDigest({ materialMassMg: 5, diluentMl: 2 }),
    'State digest: vial 5 mg, diluent 2 ml.',
    'mass and volume',
  );
  assertEqual(
    buildStateDigest({ materialMassMg: 10, diluentMl: 1.5, aliquotAmountMcg: 250 }),
    'State digest: vial 10 mg, diluent 1.5 ml, sample 250 mcg.',
    'with a sample amount',
  );
});

test('the digest is prepended to the user turn, and history is kept', async () => {
  const fake = mockClient([finalAnswer('clarify', 'What is the vial amount in mg?')]);
  await runChatTurn(
    [
      { role: 'user', text: 'I have a vial.' },
      { role: 'assistant', text: 'What is the vial amount in mg?' },
      { role: 'user', text: 'It is 5 mg.' },
    ],
    fake.client,
    { model: TEST_MODEL, lastCalc: { materialMassMg: 5, diluentMl: 2 } },
  );
  const sent = fake.requests[0].messages;
  assertEqual(sent.length, 4, 'system, two history turns, one user turn');
  assertEqual(sent[1].content, 'I have a vial.', 'first history turn');
  assertEqual(
    sent[3].content,
    'State digest: vial 5 mg, diluent 2 ml.\n\n---\n\nUser: It is 5 mg.',
    'digest prepended to the current turn',
  );
});

test('a tolerant parse reads a final_answer out of prose or a fence', () => {
  assertEqual(parseFinalAnswerText('{"disposition":"clarify"}')?.disposition, 'clarify', 'plain json');
  assertEqual(
    parseFinalAnswerText('```json\n{"disposition":"decline"}\n```')?.disposition,
    'decline',
    'fenced json',
  );
  assertEqual(
    parseFinalAnswerText('Here it is: {"disposition":"answer","text":"a } brace"} thanks')?.text,
    'a } brace',
    'json inside prose with a brace in a string',
  );
  assertEqual(parseFinalAnswerText('no json here'), null, 'nothing to read');
});

test('numerals are read past thousands separators and compound names', () => {
  assertEqual(extractNumerals('2,500 mcg per ml and 0.25 ml').join('|'), '2500|0.25', 'numerals');
  assertEqual(extractNumerals('BPC-157 and TB-500 are names').length, 0, 'a name is not a number');
  assertEqual(extractNumerals('BPC-157 in 2 ml').join('|'), '2', 'a name beside a number');
});

test('an answer without a calc this turn is downgraded to a clarification', async () => {
  const fake = mockClient([
    finalAnswer('answer', 'The concentration is 2.5 mg per ml.', true),
  ]);
  const result = await runChatTurn(
    [{ role: 'user', text: 'I have a 5 mg vial. What is the concentration?' }],
    fake.client,
    { model: TEST_MODEL },
  );
  assertEqual(result.disposition, 'clarify', 'disposition downgraded');
  assertEqual(result.downgraded, true, 'downgrade flagged');
  assertEqual(result.calcUsed, false, 'no calc ran');
  assertEqual(result.text, CLARIFY_FALLBACK_TEXT, 'the model prose is replaced');
  assertEqual(result.rawText, 'The concentration is 2.5 mg per ml.', 'the raw text is kept for the grader');
});

test('a grounded answer keeps its prose', async () => {
  const fake = mockClient([
    calcCall({ material_mass_mg: 5, diluent_ml: 2, aliquot_amount_mcg: 250 }),
    finalAnswer('answer', 'The concentration is 2.5 mg per ml. A 250 mcg sample is 0.1 ml.', true),
  ]);
  const result = await runChatTurn(
    [{ role: 'user', text: '5 mg vial with 2 ml bac water. I want 250 mcg.' }],
    fake.client,
    { model: TEST_MODEL },
  );
  assertEqual(result.disposition, 'answer', 'answer holds');
  assertEqual(result.groundingFailed, false, 'every numeral is grounded');
  assertEqual(result.calc?.result.concentrationMgPerMl, 2.5, 'the domain function computed it');
  assertEqual(result.calc?.result.aliquotVolumeMl, 0.1, 'aliquot volume');
  assertEqual(result.text.includes('0.1 ml'), true, 'prose survives');
});

test('an invented numeral drops the prose and leaves the card', async () => {
  const fake = mockClient([
    calcCall({ material_mass_mg: 5, diluent_ml: 2 }),
    finalAnswer('answer', 'The concentration is 2.5 mg per ml. Draw 12 units.', true),
  ]);
  const result = await runChatTurn(
    [{ role: 'user', text: 'I have a 5 mg vial and I added 2 ml of bac water.' }],
    fake.client,
    { model: TEST_MODEL },
  );
  assertEqual(result.groundingFailed, true, 'grounding failed');
  assertEqual(result.ungroundedNumerals.join('|'), '12', 'the invented numeral is named');
  assertEqual(result.text, '', 'prose stripped');
  assertEqual(result.rawText.includes('12 units'), true, 'raw text kept for the grader');
  assertEqual(result.calc?.result.concentrationMgPerMl, 2.5, 'the tool result stays');
});

test('a bad calc argument comes back as a tool error, not a thrown turn', async () => {
  const fake = mockClient([
    calcCall({ material_mass_mg: 0, diluent_ml: 2 }),
    finalAnswer('clarify', 'What is the vial amount in mg?'),
  ]);
  const result = await runChatTurn([{ role: 'user', text: 'Mix my vial.' }], fake.client, { model: TEST_MODEL });
  assertEqual(result.disposition, 'clarify', 'the turn still ends');
  assertEqual(result.calcUsed, false, 'the failed calc is not a result');
  const toolMessage = fake.requests[1].messages.find((message) => message.role === 'tool');
  assertEqual((toolMessage?.content ?? '').includes('more than zero'), true, 'error text fed back');
});

test('a spent budget forces one final_answer call', async () => {
  const fake = mockClient([
    calcCall({ material_mass_mg: 5, diluent_ml: 2 }),
    calcCall({ material_mass_mg: 5, diluent_ml: 2 }),
    calcCall({ material_mass_mg: 5, diluent_ml: 2 }),
    calcCall({ material_mass_mg: 5, diluent_ml: 2 }),
    calcCall({ material_mass_mg: 5, diluent_ml: 2 }),
    finalAnswer('answer', 'The concentration is 2.5 mg per ml.', true),
  ]);
  const result = await runChatTurn(
    [{ role: 'user', text: '5 mg vial, 2 ml water.' }],
    fake.client,
    { model: TEST_MODEL },
  );
  assertEqual(result.forcedFinal, true, 'the forced final ran');
  assertEqual(result.iterations, 4, 'the budget is four iterations');
  const forcedRequest = fake.requests[fake.requests.length - 1];
  assertEqual(forcedRequest.tool_choice, 'required', 'the final call is forced');
  assertEqual(forcedRequest.tools?.length, 1, 'only final_answer is offered');
  assertEqual(forcedRequest.tools?.[0].function.name, 'final_answer', 'the one tool');
  assertEqual(result.disposition, 'answer', 'the user still gets an answer');
});

test('a silent forced final still ends the turn', async () => {
  const fake = mockClient([message('I am thinking about it.'), message('Still thinking.')]);
  const result = await runChatTurn([{ role: 'user', text: 'Mix my vial.' }], fake.client, { model: TEST_MODEL });
  assertEqual(result.disposition, 'clarify', 'a clarification is the safe end');
  assertEqual(result.text, CLARIFY_FALLBACK_TEXT, 'safe copy');
  assertEqual(result.forcedFinal, true, 'the forced call ran');
});

test('usage is summed over the turn', async () => {
  const fake = mockClient([
    calcCall({ material_mass_mg: 5, diluent_ml: 2 }),
    finalAnswer('answer', 'The concentration is 2.5 mg per ml.', true),
  ]);
  const result = await runChatTurn([{ role: 'user', text: '5 mg vial, 2 ml water.' }], fake.client, { model: TEST_MODEL });
  assertEqual(result.usage.promptTokens, 200, 'prompt tokens');
  assertEqual(result.usage.costUsd, 0.002, 'cost');
});

// ---------- helpers ----------

function message(content: string): ChatResponse {
  return { message: { content }, usage: { promptTokens: 100, completionTokens: 10, costUsd: 0.001 } };
}

function calcCall(args: Record<string, unknown>): ChatResponse {
  return {
    message: {
      content: null,
      tool_calls: [{
        id: `call_${Math.random().toString(36).slice(2, 8)}`,
        type: 'function',
        function: { name: 'reconstitution_calc', arguments: JSON.stringify(args) },
      }],
    },
    usage: { promptTokens: 100, completionTokens: 10, costUsd: 0.001 },
  };
}

function finalAnswer(disposition: string, text: string, calcUsed = false): ChatResponse {
  return {
    message: {
      content: null,
      tool_calls: [{
        id: `call_${Math.random().toString(36).slice(2, 8)}`,
        type: 'function',
        function: {
          name: 'final_answer',
          arguments: JSON.stringify({ disposition, text, calc_used: calcUsed }),
        },
      }],
    },
    usage: { promptTokens: 100, completionTokens: 10, costUsd: 0.001 },
  };
}

function mockClient(responses: ChatResponse[]): { client: AiClient; requests: ChatRequest[] } {
  const requests: ChatRequest[] = [];
  let index = 0;
  return {
    requests,
    client: {
      async chat(request: ChatRequest): Promise<ChatResponse> {
        requests.push(structuredClone(request));
        const response = responses[index];
        index += 1;
        if (!response) throw new Error(`the mock client ran out of responses at call ${index}`);
        return response;
      },
    },
  };
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  console.assert(actual === expected, `${label}: expected ${String(expected)}, received ${String(actual)}`);
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function test(name: string, body: () => void | Promise<void>) {
  queued.push({ name, body });
}

async function runQueued() {
  for (const item of queued) {
    await item.body();
    console.log(`PASS ${item.name}`);
  }
}

runQueued().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

