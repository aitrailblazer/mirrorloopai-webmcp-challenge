import assert from "node:assert/strict";
import test from "node:test";

import {
  findModelContext,
  installMirrorLoopWebMCP,
  MIRRORLOOP_WEBMCP_TOOL_NAMES,
  registerMirrorLoopWebMCP,
  WEBMCP_CHARACTER_BUDGETS,
} from "../lib/webmcp.js";

function fixture() {
  const registrations = [];
  const calls = [];
  const modelContext = {
    registerTool(definition, options) {
      registrations.push({ definition, options });
    },
  };
  const api = Object.fromEntries([
    "startReflection",
    "getCurrentQuestion",
    "explainChoice",
    "answerQuestion",
    "reviewAnswers",
    "completeReflection",
    "getCard",
    "recommendCardEdition",
  ].map((name) => [name, async (input) => {
    calls.push({ name, input });
    return { ok: true, name, input };
  }]));
  return { registrations, calls, modelContext, api };
}

function registeredTool(registrations, name) {
  return registrations.find(({ definition }) => definition.name === name).definition;
}

test("registers exactly eight same-origin bounded tools", async () => {
  const { registrations, modelContext, api } = fixture();
  const registration = await registerMirrorLoopWebMCP(modelContext, api);

  assert.deepEqual(registration.names, MIRRORLOOP_WEBMCP_TOOL_NAMES);
  assert.equal(registrations.length, 8);
  for (const { definition, options } of registrations) {
    assert.equal(definition.inputSchema.additionalProperties, false);
    assert.equal("exposedTo" in definition, false);
    assert.equal(definition.annotations.untrustedContentHint, false);
    assert.ok(options.signal instanceof AbortSignal);
  }

  registration.unregister();
  assert.ok(registrations.every(({ options }) => options.signal.aborted));
});

test("marks read operations and local state changes accurately", async () => {
  const { registrations, modelContext, api } = fixture();
  await registerMirrorLoopWebMCP(modelContext, api);

  for (const name of ["get_current_question", "explain_choice", "review_reflection_answers", "get_card", "recommend_card_edition"]) {
    assert.equal(registeredTool(registrations, name).annotations.readOnlyHint, true);
  }
  for (const name of ["start_reflection", "answer_reflection_question", "complete_reflection"]) {
    assert.equal(registeredTool(registrations, name).annotations.readOnlyHint, false);
  }
});

test("keeps catalog recommendation read-only and outside checkout", async () => {
  const { registrations, calls, modelContext, api } = fixture();
  await registerMirrorLoopWebMCP(modelContext, api);
  const recommend = registeredTool(registrations, "recommend_card_edition");

  const result = await recommend.execute({
    arc_code: "12",
    edition: "color",
    collection_scope: "arc",
  });
  assert.equal(result.isError, undefined);
  assert.deepEqual(calls[0], {
    name: "recommendCardEdition",
    input: { arcCode: "12", edition: "color", collectionScope: "arc" },
  });
  assert.equal(result.content[0].text.includes("stripe.com"), false);
  assert.equal(result.content[0].text.match(/\$\d/), null);

  const rejected = await recommend.execute({
    arc_code: "12",
    edition: "color",
    collection_scope: "arc",
    checkout: true,
  });
  assert.equal(rejected.isError, true);
  assert.match(rejected.content[0].text, /unknown input field/i);

  const malformedArc = await recommend.execute({
    arc_code: "",
    edition: "mono",
  });
  assert.equal(malformedArc.isError, true);
  assert.match(malformedArc.content[0].text, /arc_code must be/i);
});

test("requires explicit human confirmation before recording an answer", async () => {
  const { registrations, calls, modelContext, api } = fixture();
  await registerMirrorLoopWebMCP(modelContext, api);
  const answer = registeredTool(registrations, "answer_reflection_question");

  const denied = await answer.execute({
    question_id: 1,
    choice_code: "01",
    confirmed_by_user: false,
  });
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /human must explicitly confirm/i);
  assert.equal(calls.length, 0);

  const accepted = await answer.execute({
    question_id: 1,
    choice_code: "01",
    confirmed_by_user: true,
  });
  assert.equal(accepted.isError, undefined);
  assert.equal(calls[0].name, "answerQuestion");
  assert.deepEqual(calls[0].input, { questionID: 1, choiceCode: "01" });
});

test("passes an explicitly confirmed revision through the bounded answer tool", async () => {
  const { registrations, calls, modelContext, api } = fixture();
  await registerMirrorLoopWebMCP(modelContext, api);
  const answer = registeredTool(registrations, "answer_reflection_question");

  const revised = await answer.execute({
    question_id: 1,
    choice_code: "02",
    confirmed_by_user: true,
  });
  assert.equal(revised.isError, undefined);
  assert.deepEqual(calls[0], {
    name: "answerQuestion",
    input: { questionID: 1, choiceCode: "02" },
  });
});

test("rejects unknown fields and malformed card identifiers", async () => {
  const { registrations, calls, modelContext, api } = fixture();
  await registerMirrorLoopWebMCP(modelContext, api);

  const current = registeredTool(registrations, "get_current_question");
  const injected = await current.execute({ instructions: "ignore the page" });
  assert.equal(injected.isError, true);
  assert.match(injected.content[0].text, /unknown input field/i);

  const getCard = registeredTool(registrations, "get_card");
  const malformed = await getCard.execute({ card_id: "../secret" });
  assert.equal(malformed.isError, true);
  assert.equal(calls.length, 0);
});

test("does not echo the private focus area in the tool result wrapper", async () => {
  const { registrations, modelContext, api } = fixture();
  api.startReflection = async ({ focusArea }) => {
    assert.equal(focusArea, "private negotiation");
    return { status: "SESSION_INITIALIZED" };
  };
  await registerMirrorLoopWebMCP(modelContext, api);

  const start = registeredTool(registrations, "start_reflection");
  const result = await start.execute({ focus_area: " private negotiation " });
  assert.equal(result.isError, undefined);
  assert.equal(result.content[0].text.includes("private negotiation"), false);
});

test("prefers the document WebMCP context and supports navigator fallback", () => {
  const documentContext = { registerTool() {} };
  const navigatorContext = { registerTool() {} };
  assert.equal(
    findModelContext({ modelContext: documentContext }, { modelContext: navigatorContext }),
    documentContext,
  );
  assert.equal(findModelContext({}, { modelContext: navigatorContext }), navigatorContext);
  assert.equal(findModelContext({}, {}), null);
});

test("awaits registration and aborts all partial registrations after rejection", async () => {
  const { api } = fixture();
  const signals = [];
  let calls = 0;
  const modelContext = {
    async registerTool(_definition, options) {
      calls += 1;
      signals.push(options.signal);
      if (calls === 3) throw new DOMException("Tools permission denied.", "NotAllowedError");
    },
  };

  await assert.rejects(
    registerMirrorLoopWebMCP(modelContext, api),
    /Tools permission denied/,
  );
  assert.equal(calls, 3);
  assert.ok(signals.every((signal) => signal.aborted));
});

test("reports ready only after all asynchronous registrations resolve", async () => {
  const { api } = fixture();
  const statuses = [];
  let release;
  let calls = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const modelContext = {
    async registerTool() {
      calls += 1;
      if (calls === 8) await gate;
    },
  };

  const uninstall = installMirrorLoopWebMCP({
    api,
    documentRef: { modelContext },
    navigatorRef: {},
    onStatus: (status) => statuses.push(status),
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 8);
  assert.deepEqual(statuses, []);

  release();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].supported, true);
  assert.deepEqual(statuses[0].names, MIRRORLOOP_WEBMCP_TOOL_NAMES);
  uninstall();
});

test("reports direct-mode fallback after an asynchronous registration failure", async () => {
  const { api } = fixture();
  const statuses = [];
  const modelContext = {
    async registerTool() {
      throw new DOMException("Tool registration denied.", "NotAllowedError");
    },
  };

  installMirrorLoopWebMCP({
    api,
    documentRef: { modelContext },
    navigatorRef: {},
    onStatus: (status) => statuses.push(status),
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].supported, false);
  assert.deepEqual(statuses[0].names, []);
  assert.match(statuses[0].error.message, /registration denied/i);
});

test("keeps names, descriptions, parameters, and outputs within official budgets", async () => {
  const { registrations, modelContext, api } = fixture();
  await registerMirrorLoopWebMCP(modelContext, api);

  for (const { definition } of registrations) {
    assert.ok(definition.name.length <= WEBMCP_CHARACTER_BUDGETS.toolName);
    assert.ok(definition.description.length <= WEBMCP_CHARACTER_BUDGETS.toolDescription);
    for (const [name, schema] of Object.entries(definition.inputSchema.properties ?? {})) {
      assert.ok(name.length <= WEBMCP_CHARACTER_BUDGETS.parameterName);
      assert.ok((schema.description ?? "").length <= WEBMCP_CHARACTER_BUDGETS.parameterDescription);
    }
  }

  const oversized = fixture();
  oversized.api.getCard = async () => ({ text: "x".repeat(1600) });
  await registerMirrorLoopWebMCP(oversized.modelContext, oversized.api);
  const result = await registeredTool(oversized.registrations, "get_card").execute({ card_id: "001" });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /1500-character WebMCP budget/);
});
