import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { MIRRORLOOP_WEBMCP_TOOL_NAMES } from "../web/lib/webmcp.js";

const corpus = JSON.parse(await readFile(
  new URL("../web/evals/webmcp-operational-use-cases.json", import.meta.url),
  "utf8",
));

assert.equal(corpus.schemaVersion, "mirrorloop.webmcp.operational-use-cases.v1");
assert.equal(corpus.cases.length, 6);

const ids = new Set();
const covered = new Set();
for (const entry of corpus.cases) {
  assert.match(entry.id, /^usecase-[a-z0-9-]+$/);
  assert.ok(!ids.has(entry.id), `duplicate use-case id: ${entry.id}`);
  ids.add(entry.id);
  assert.ok(entry.prompt.trim());
  assert.ok(entry.expectedBehavior.trim());
  assert.ok(entry.expectedCalls.length > 0);
  for (const call of entry.expectedCalls) {
    assert.ok(
      MIRRORLOOP_WEBMCP_TOOL_NAMES.includes(call.name),
      `unknown tool in ${entry.id}: ${call.name}`,
    );
    assert.ok(call.arguments && typeof call.arguments === "object");
    covered.add(call.name);
  }
}

for (const tool of [
  "start_reflection",
  "get_card",
  "review_reflection_answers",
  "recommend_card_edition",
]) {
  assert.ok(covered.has(tool), `missing operational tool coverage: ${tool}`);
}

const serialized = JSON.stringify(corpus);
for (const inventedTool of ["get_current_transit_clock", "recommend_physical_deck"]) {
  assert.ok(
    !corpus.cases.some((entry) => entry.expectedCalls.some((call) => call.name === inventedTool)),
    `invented tool appears in expected calls: ${inventedTool}`,
  );
}
for (const boundary of [
  "Do not diagnose",
  "Do not claim access to Geneva",
  "Do not claim it is selected by a current transit",
  "Do not compare another person's private session",
  "Do not call it a physical deck",
]) {
  assert.ok(serialized.includes(boundary), `missing use-case boundary: ${boundary}`);
}

console.log(
  `WebMCP operational use cases: PASS (${corpus.cases.length} cases, `
  + `${covered.size} production tools)`,
);
