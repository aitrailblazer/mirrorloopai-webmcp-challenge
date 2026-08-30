import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const index = await readFile(new URL("web/index.html", root), "utf8");
const styles = await readFile(new URL("web/styles.css", root), "utf8");
const app = await readFile(new URL("web/app.js", root), "utf8");
const webmcp = await readFile(new URL("web/lib/webmcp.js", root), "utf8");
const submission = await readFile(new URL("SUBMISSION.md", root), "utf8");
const brief = await readFile(new URL("WEBMCP_JUDGE_PANEL_BRIEF.html", root), "utf8");
const publicRuntime = [index, styles, app, webmcp].join("\n");

for (const required of [
  'http-equiv="origin-trial"',
  'role="status" aria-live="polite"',
  'role="progressbar"',
  'aria-valuemin="1"',
  'aria-valuemax="12"',
  'aria-valuenow="1"',
  'id="result-panel" class="result-panel" hidden aria-live="polite"',
]) {
  assert.ok(index.includes(required), `missing Chrome UX markup: ${required}`);
}

for (const required of [
  ".progress-track span",
  "transition: width .25s ease",
  "@media (prefers-reduced-motion: reduce)",
  "transition: none !important",
]) {
  assert.ok(styles.includes(required), `missing motion contract: ${required}`);
}

for (const required of [
  'elements.question.focus()',
  '$("#result-name").focus({ preventScroll: true })',
  '"mirrorloop:session_start"',
  '"mirrorloop:step_transition"',
  '"mirrorloop:reflection_complete"',
]) {
  assert.ok(app.includes(required), `missing visible-state behavior: ${required}`);
}

for (const absent of [
  "requestAnimationFrame",
  "--active-angle",
  "<canvas",
]) {
  assert.ok(!publicRuntime.includes(absent), `unsupported mechanism unexpectedly present: ${absent}`);
}
assert.ok(!index.includes("<svg"), "public page unexpectedly contains an inline SVG dial");

for (const required of [
  "semantic 12-step progressbar",
  "reduced-motion preference",
  "No SVG dial, frame-rate, zero-paint, or",
  "compositor-thread claim is made.",
]) {
  assert.ok(submission.includes(required), `missing bounded submission copy: ${required}`);
}

for (const required of [
  "Chrome motion and accessibility claim ledger",
  "144-sector animated SVG dial",
  "CONTRADICTED",
  "Zero-flag Chrome setup",
  "UNRESOLVED",
  "A judge's private preferences or dislikes",
]) {
  assert.ok(brief.includes(required), `missing Chrome claim ledger entry: ${required}`);
}

console.log("WebMCP Chrome UX claim contract: PASS");
