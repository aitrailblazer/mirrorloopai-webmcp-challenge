#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const evidenceText = readFileSync(
  path.join(root, "qa_evidence/webmcp_operational_use_case_eval/latest.json"),
  "utf8",
);
const evidence = JSON.parse(evidenceText);
const report = readFileSync(path.join(root, "WEBMCP_OPERATIONAL_USE_CASES.html"), "utf8");

assert.equal(evidence.corpus.schemaVersion, "mirrorloop.webmcp.operational-use-cases.v1");
assert.equal(evidence.corpus.cases, 6);
assert.equal(evidence.results.length, 6);
assert.equal(evidence.runtime.exposedTools.length, 8);
assert.equal(evidence.runtime.apiCredentialRecorded, false);
assert.equal(evidence.metrics.exactCaseAccuracy, 1);
assert.equal(evidence.metrics.exactToolSelectionAccuracy, 1);
assert.equal(evidence.metrics.requiredToolsInOrderAccuracy, 1);
assert.equal(evidence.metrics.expectedArgumentMatchRate, 1);
assert.equal(evidence.metrics.expectedCallTotal, 8);
assert.equal(evidence.metrics.actualCallTotal, 8);
assert.doesNotMatch(evidenceText, /thoughtSignature|AIza[0-9A-Za-z_-]{20,}|ya29\./);

for (const required of [
  "Six Operational WebMCP Use Cases",
  "6 / 6</strong>exact live cases",
  "0</strong>invented tool calls",
  "Future Geometry",
  "The current product is digital",
  '<script type="application/xml" id="strategix-contract">',
]) {
  assert.ok(report.includes(required), `operational report is missing ${required}`);
}

console.log("Live WebMCP operational evidence: PASS (6/6 exact cases, 8/8 calls)");
