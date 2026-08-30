import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { MIRRORLOOP_WEBMCP_TOOL_NAMES } from "../web/lib/webmcp.js";

const evals = JSON.parse(await readFile(
  new URL("../web/evals/webmcp-campaign-evals.json", import.meta.url),
  "utf8",
));

assert.equal(evals.schemaVersion, "mirrorloop.webmcp.campaign-evals.v1");
assert.equal(evals.cases.length, 12);

const ids = new Set();
const coveredTools = new Set();
const boundaries = new Set();

for (const entry of evals.cases) {
  assert.match(entry.id, /^[a-z0-9-]+$/);
  assert.ok(!ids.has(entry.id), `duplicate eval id: ${entry.id}`);
  ids.add(entry.id);
  assert.ok(typeof entry.prompt === "string" && entry.prompt.trim());
  assert.ok(Array.isArray(entry.expectedCalls));

  for (const call of entry.expectedCalls) {
    assert.ok(
      MIRRORLOOP_WEBMCP_TOOL_NAMES.includes(call.name),
      `unknown tool in ${entry.id}: ${call.name}`,
    );
    assert.ok(call.arguments && typeof call.arguments === "object" && !Array.isArray(call.arguments));
    coveredTools.add(call.name);
    if (call.name === "answer_reflection_question") {
      assert.equal(call.arguments.confirmed_by_user, true);
    }
  }

  if (entry.expectedCalls.length === 0) {
    assert.ok(typeof entry.expectedBehavior === "string" && entry.expectedBehavior.length > 0);
    assert.ok(typeof entry.boundary === "string" && entry.boundary.length > 0);
    boundaries.add(entry.boundary);
  }
}

for (const tool of [
  "start_reflection",
  "explain_choice",
  "compare_choices",
  "preview_answer_impact",
  "answer_reflection_question",
  "get_current_question",
  "get_card",
  "recommend_card_edition",
]) {
  assert.ok(coveredTools.has(tool), `missing advertised supported tool: ${tool}`);
}
for (const boundary of [
  "unsupported_astronomy",
  "unsupported_physical_product",
  "commerce",
  "diagnosis",
  "email_privacy",
]) {
  assert.ok(boundaries.has(boundary), `missing campaign boundary: ${boundary}`);
}

assert.equal(MIRRORLOOP_WEBMCP_TOOL_NAMES.length, 10);
console.log(
  `WebMCP campaign corpus: PASS (${evals.cases.length} cases, `
  + `${coveredTools.size} supported tools, ${boundaries.size} claim boundaries)`,
);
