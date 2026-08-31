import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const artifact = await readFile(
  new URL("../WEBMCP_COMPETITION_HARDENING_AUDIT.html", import.meta.url),
  "utf8",
);

for (const required of [
  "<StrategiXVisualSpec",
  "<ToolCount>11</ToolCount>",
  "mirrorloop:session_start,mirrorloop:step_transition,mirrorloop:reflection_complete",
  'id="score" status="UNRESOLVED"',
  'id="astronomy" status="CONTRADICTED"',
  'id="p2p" status="CONTRADICTED"',
  'id="physical_products" status="CONTRADICTED"',
  'id="autonomous_payment" status="CONTRADICTED"',
  "Do not self-award judging scores",
  "Final verified 1:55 demo",
  "Email, cart mutation, Checkout creation, and payment remain human actions",
  "Freeze the reviewed eleven-tool build",
  "public repository visibility",
]) {
  assert.ok(artifact.includes(required), `missing hardening contract: ${required}`);
}

for (const prohibited of [
  "deployed P2P",
  "unassailable 10/10",
  "zero-XSS guarantee",
  "autonomously purchases",
  "physical 350gsm",
]) {
  assert.ok(!artifact.includes(prohibited), `unsafe affirmative claim remains: ${prohibited}`);
}

assert.equal((artifact.match(/<Claim id=/g) ?? []).length, 11);
console.log("WebMCP competition hardening audit: PASS");
