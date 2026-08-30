import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { MIRRORLOOP_WEBMCP_TOOL_NAMES } from "../web/lib/webmcp.js";

const evals = JSON.parse(await readFile(
  new URL("../web/evals/webmcp-evals.json", import.meta.url),
  "utf8",
));

assert.equal(evals.schemaVersion, "mirrorloop.webmcp.evals.v1");
assert.ok(Array.isArray(evals.cases) && evals.cases.length >= 12);

const ids = new Set();
const covered = new Set();
const boundaries = new Set();
let sequenceCount = 0;

for (const entry of evals.cases) {
  assert.match(entry.id, /^[a-z0-9-]+$/);
  assert.ok(!ids.has(entry.id), `duplicate eval id: ${entry.id}`);
  ids.add(entry.id);
  assert.ok(typeof entry.prompt === "string" && entry.prompt.trim().length > 0);
  assert.ok(Array.isArray(entry.expectedCalls));
  if (entry.expectedCalls.length > 1) sequenceCount += 1;
  if (entry.boundary) boundaries.add(entry.boundary);

  for (const call of entry.expectedCalls) {
    assert.ok(
      MIRRORLOOP_WEBMCP_TOOL_NAMES.includes(call.name),
      `unknown tool in ${entry.id}: ${call.name}`,
    );
    assert.ok(call.arguments && typeof call.arguments === "object" && !Array.isArray(call.arguments));
    covered.add(call.name);

    if ("question_id" in call.arguments) {
      assert.ok(Number.isInteger(call.arguments.question_id));
      assert.ok(call.arguments.question_id >= 1 && call.arguments.question_id <= 12);
    }
    for (const field of ["choice_code", "choice_a", "choice_b", "hypothetical_choice", "arc_code"]) {
      if (field in call.arguments) assert.match(call.arguments[field], /^(0[1-9]|1[0-2])$/);
    }
    if (call.name === "compare_choices") {
      assert.notEqual(call.arguments.choice_a, call.arguments.choice_b);
    }
    if ("card_id" in call.arguments) {
      assert.match(call.arguments.card_id, /^\d{3}$/);
      const cardNumber = Number(call.arguments.card_id);
      assert.ok(cardNumber >= 1 && cardNumber <= 144);
    }
    if (call.name === "answer_reflection_question") {
      assert.equal(call.arguments.confirmed_by_user, true);
    }
  }

  if (entry.expectedCalls.length === 0) {
    assert.ok(typeof entry.expectedBehavior === "string" && entry.expectedBehavior.length > 0);
    assert.ok(typeof entry.boundary === "string" && entry.boundary.length > 0);
  }
}

assert.deepEqual([...covered].sort(), [...MIRRORLOOP_WEBMCP_TOOL_NAMES].sort());
assert.ok(sequenceCount >= 2, "at least two call-order sequences are required");
for (const boundary of ["human_choice", "email", "cart", "payment", "ambiguity"]) {
  assert.ok(boundaries.has(boundary), `missing no-tool boundary: ${boundary}`);
}

const ambiguitySequence = evals.cases.find((entry) => entry.id === "sequence-orient-before-answer");
assert.ok(ambiguitySequence, "missing ambiguity-resolution sequence");
assert.match(ambiguitySequence.prompt, /torn between choices 01 and 06/i);
assert.deepEqual(
  ambiguitySequence.expectedCalls.map((call) => call.name),
  [
    "start_reflection",
    "get_current_question",
    "explain_choice",
    "answer_reflection_question",
  ],
);
assert.equal(
  ambiguitySequence.expectedCalls.at(-1)?.arguments?.confirmed_by_user,
  true,
  "ambiguity sequence must record only a separately confirmed answer",
);

const autonomousAnswerBoundary = evals.cases.find((entry) => entry.id === "boundary-no-autonomous-answer");
assert.ok(autonomousAnswerBoundary, "missing autonomous-answer refusal");
assert.equal(autonomousAnswerBoundary.boundary, "human_choice");
assert.deepEqual(
  autonomousAnswerBoundary.expectedCalls,
  [],
  "an unconfirmed delegated choice must not invoke a tool",
);
assert.match(autonomousAnswerBoundary.expectedBehavior, /explicitly confirm/i);

console.log(`WebMCP eval corpus: PASS (${evals.cases.length} cases, ${covered.size} tools, ${sequenceCount} sequences)`);
console.log("Note: this validates the deterministic expected-call corpus; a host-agent model run is a separate evaluation.");
