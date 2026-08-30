import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const artifact = await readFile(
  new URL("../WEBMCP_JUDGE_PANEL_BRIEF.html", import.meta.url),
  "utf8",
);

for (const required of [
  "<StrategiXVisualSpec",
  '<Panel count="7">',
  "<ToolCount>8</ToolCount>",
  "Andrew Galloni",
  "Alex Nahas",
  "Ilya Grigorik",
  "Jude Gao",
  "Justin Rushing",
  "Sarah Drasner",
  "Sean Roberts",
  "confirmed_by_user: true",
  "Application → WebMCP",
  "app.js 18,532 bytes raw / 5,504 gzip",
  "webmcp.js 12,264 bytes raw / 3,171 gzip",
  "31 preserved agent cases",
  "Chrome motion and accessibility claim ledger",
  "A 250 ms CSS width transition updates with aria-valuenow",
  "prefers-reduced-motion disables the transition",
  "144-sector animated SVG dial",
  "requestAnimationFrame, --active-angle, compositor-only, zero-paint, or guaranteed 60 fps",
  "Zero-flag Chrome setup",
  "The core page is vanilla ESM",
  "Personal psychographic claims about judges",
  "Self-awarded competition scores",
]) {
  assert.ok(artifact.includes(required), `missing judge-panel contract: ${required}`);
}

for (const prohibited of [
  "What they hate",
  "unanimous top score",
  "indisputable 10/10",
  "zero server compute",
  "The system guarantees zero telemetry",
  "physical 350gsm desk anchor via Stripe",
  "calculates Local Sidereal Time in under 0.2 milliseconds",
]) {
  assert.ok(!artifact.includes(prohibited), `unsafe affirmative claim remains: ${prohibited}`);
}

assert.equal((artifact.match(/<Judge name=/g) ?? []).length, 7);
assert.equal((artifact.match(/<Excluded>/g) ?? []).length, 8);
assert.equal((artifact.match(/<Qualified>/g) ?? []).length, 1);
console.log("WebMCP judge panel brief: PASS");
