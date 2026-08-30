import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const artifact = await readFile(
  new URL("../WEBMCP_JUDGE_PANEL_BRIEF.html", import.meta.url),
  "utf8",
);

for (const required of [
  "<StrategiXVisualSpec",
  '<Panel count="7">',
  "<ToolCount>11</ToolCount>",
  "Andrew Galloni",
  "Alex Nahas",
  "Ilya Grigorik",
  "Jude Gao",
  "Justin Rushing",
  "Sarah Drasner",
  "Sean Roberts",
  "confirmed_by_user: true",
  "Application → WebMCP",
  "app.js 25,231 bytes raw / 7,252 gzip",
  "webmcp.js 19,254 raw / 4,496 gzip",
  "31 preserved agent cases",
  "Chrome motion and accessibility claim ledger",
  '<RoleEvidence count="6" framing="public-role-only">',
  "Six role-oriented evidence paths",
  "The agent is not read-only",
  "eleventh tool is the confirmed local-only export_reflection_dossier action",
  "There is no kinematics.js",
  "not zero telemetry, zero database, zero compute",
  "not a purely event-only or strictly unidirectional architecture",
  "current catalog is digital delivery",
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
assert.equal((artifact.match(/<Excluded>/g) ?? []).length, 10);
assert.equal((artifact.match(/<Qualified>/g) ?? []).length, 1);
assert.equal((artifact.match(/<Role name=/g) ?? []).length, 6);
console.log("WebMCP judge panel brief: PASS");
