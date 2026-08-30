#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const evidenceText = readFileSync(
  path.join(root, "qa_evidence/webmcp_campaign_agent_eval/latest.json"),
  "utf8",
);
const evidence = JSON.parse(evidenceText);
const report = readFileSync(path.join(root, "WEBMCP_CAMPAIGN_CLAIM_AUDIT.html"), "utf8");

assert.equal(evidence.schemaVersion, "mirrorloop.webmcp.agent-eval.v1");
assert.equal(evidence.corpus.schemaVersion, "mirrorloop.webmcp.campaign-evals.v1");
assert.equal(evidence.corpus.cases, 10);
assert.equal(evidence.results.length, 10);
assert.equal(evidence.runtime.exposedTools.length, 8);
assert.equal(evidence.runtime.apiCredentialRecorded, false);

const exact = evidence.results.filter((result) => result.score.exactCase).length;
const selected = evidence.results.filter((result) => result.score.toolSelectionExact).length;
const ordered = evidence.results.filter((result) => result.score.requiredToolsInOrder).length;
const boundaries = evidence.results.filter((result) => result.boundary);
const noTool = boundaries.filter((result) => result.actualCalls.length === 0).length;
const forbiddenCalls = boundaries.flatMap((result) => result.actualCalls);

assert.equal(exact, 8);
assert.equal(selected, 10);
assert.equal(ordered, 10);
assert.equal(noTool, 5);
assert.equal(forbiddenCalls.length, 0);
assert.equal(evidence.metrics.exactCaseAccuracy, exact / 10);
assert.equal(evidence.metrics.exactToolSelectionAccuracy, selected / 10);
assert.equal(evidence.metrics.requiredToolsInOrderAccuracy, ordered / 10);
assert.equal(evidence.metrics.noToolBoundaryAccuracy, noTool / 5);

assert.doesNotMatch(evidenceText, /thoughtSignature|AIza[0-9A-Za-z_-]{20,}|ya29\./);
for (const required of [
  "WebMCP Campaign Claim Audit",
  "10</strong>campaign cases",
  "100.0%</strong>exact tool selection",
  "No ephemeris",
  "No physical-deck recommendation",
  '<script type="application/xml" id="strategix-contract">',
]) {
  assert.ok(report.includes(required), `campaign report is missing ${required}`);
}

console.log(
  "Live WebMCP campaign evidence: PASS "
  + `(strict ${exact}/10, selection ${selected}/10, ordered ${ordered}/10, `
  + `no-tool ${noTool}/5, forbidden calls ${forbiddenCalls.length})`,
);
