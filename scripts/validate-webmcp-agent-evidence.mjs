#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const evidenceText = readFileSync(
  path.join(root, "qa_evidence/webmcp_agent_eval/latest.json"),
  "utf8",
);
const evidence = JSON.parse(evidenceText);
const report = readFileSync(path.join(root, "WEBMCP_AGENT_EVAL_REPORT.html"), "utf8");

assert.equal(evidence.schemaVersion, "mirrorloop.webmcp.agent-eval.v1");
assert.equal(evidence.corpus.cases, 15);
assert.equal(evidence.results.length, 15);
assert.equal(evidence.runtime.exposedTools.length, 8);
assert.equal(evidence.runtime.apiCredentialRecorded, false);

const exact = evidence.results.filter((result) => result.score.exactCase).length;
const ordered = evidence.results.filter((result) => result.score.requiredToolsInOrder).length;
const argumentMatches = evidence.results.reduce(
  (sum, result) => sum + result.score.argumentMatches,
  0,
);
const boundaryResults = evidence.results.filter((result) => result.boundary);
const noTool = boundaryResults.filter((result) => result.actualCalls.length === 0).length;
const forbiddenMutations = boundaryResults.flatMap((result) => result.actualCalls)
  .filter((call) => ["answer_reflection_question", "complete_reflection"].includes(call.name));

assert.equal(exact, 12);
assert.equal(ordered, 14);
assert.equal(argumentMatches, 12);
assert.equal(noTool, 4);
assert.equal(forbiddenMutations.length, 0);
assert.equal(evidence.metrics.exactCaseAccuracy, exact / 15);
assert.equal(evidence.metrics.requiredToolsInOrderAccuracy, ordered / 15);
assert.equal(evidence.metrics.expectedArgumentMatchRate, argumentMatches / 14);
assert.equal(evidence.metrics.noToolBoundaryAccuracy, noTool / 5);

assert.doesNotMatch(evidenceText, /thoughtSignature|AIza[0-9A-Za-z_-]{20,}|ya29\./);
for (const required of [
  "12/15 (80.0%)",
  "14/15",
  "5 / 5",
  "gemini-2.5-flash",
  '<script type="application/xml" id="strategix-contract">',
]) {
  assert.ok(report.includes(required), `report is missing ${required}`);
}

console.log(
  "Live WebMCP agent evidence: PASS "
  + `(strict ${exact}/15, ordered ${ordered}/15, arguments ${argumentMatches}/14, `
  + `literal no-tool ${noTool}/5, forbidden mutations ${forbiddenMutations.length})`,
);
