import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const brief = await readFile(new URL("WEBMCP_JUDGE_PANEL_BRIEF.html", root), "utf8");
const readme = await readFile(new URL("README.md", root), "utf8");
const submission = await readFile(new URL("SUBMISSION.md", root), "utf8");
const publicCopy = [brief, readme, submission].join("\n");

for (const required of [
  '<RoleEvidence count="6" framing="public-role-only">',
  "Justin Rushing",
  "Alex Nahas",
  "Ilya Grigorik",
  "Andrew Galloni",
  "Jude Gao",
  "Sean Roberts",
  "confirmed_by_user: true",
  "tenth tool is the read-only preview_answer_impact simulation",
  "There is no kinematics.js",
  "not zero telemetry, zero database, zero compute",
  "not a purely event-only or strictly unidirectional architecture",
  "current catalog is digital delivery",
  "role-oriented verification matrix",
]) {
  assert.ok(publicCopy.includes(required), `missing bounded six-role evidence: ${required}`);
}

for (const prohibited of [
  "What He Hates",
  "Instant Disqualification",
  "make them score MIRROR//LOOP a 10/10",
  "Guarantee Unanimous Top Scores",
  "The $0 Database / Zero Telemetry Architecture",
  "0 B transferred across all 12 stages",
  "under 60 lines of vanilla JavaScript",
  "computes Julian Date, GMST, Local Sidereal Time",
  "physical ARC01 Matte-Obsidian Card Decks",
]) {
  assert.ok(!publicCopy.includes(prohibited), `unsafe affirmative judge claim remains: ${prohibited}`);
}

assert.equal((brief.match(/<Role name=/g) ?? []).length, 6);
console.log("WebMCP six-role claim contract: PASS");
