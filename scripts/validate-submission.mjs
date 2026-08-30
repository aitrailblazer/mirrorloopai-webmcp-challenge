import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = [];

const readme = read("README.md");
const submission = read("SUBMISSION.md");
const notices = read("THIRD_PARTY_NOTICES.md");
const resourceReview = read("RESOURCE_REVIEW.html");
const campaignAudit = read("WEBMCP_CAMPAIGN_CLAIM_AUDIT.html");
const operationalUseCases = read("WEBMCP_OPERATIONAL_USE_CASES.html");
const competitionHardening = read("WEBMCP_COMPETITION_HARDENING_AUDIT.html");
const judgePanelBrief = read("WEBMCP_JUDGE_PANEL_BRIEF.html");
const demoShotList = read("WEBMCP_DEMO_SHOT_LIST.html");
const license = read("LICENSE");
const packageJSON = JSON.parse(read("package.json"));
const manifest = JSON.parse(read("competition_manifest.json"));

const checks = [
  ["README live URL", readme.includes("https://mirrorloopai.com/")],
  ["README source URL", readme.includes("mirrorloopai-webmcp-challenge")],
  ["README native registration pattern", readme.includes("modelContext.registerTool")],
  ["README current DevTools judge path", [
    "Application → WebMCP",
    "Available Tools",
    "Invoked Tools",
    "Run tool",
    "schema violation",
  ].every((term) => readme.includes(term))],
  ["README resource review", readme.includes("RESOURCE_REVIEW.html")],
  ["README campaign claim audit", readme.includes("WEBMCP_CAMPAIGN_CLAIM_AUDIT.html")],
  ["README operational use cases", readme.includes("WEBMCP_OPERATIONAL_USE_CASES.html")],
  ["README competition hardening", readme.includes("WEBMCP_COMPETITION_HARDENING_AUDIT.html")],
  ["README judge panel brief", readme.includes("WEBMCP_JUDGE_PANEL_BRIEF.html")],
  ["README demo shot list", readme.includes("WEBMCP_DEMO_SHOT_LIST.html")],
  ["README pre-existing disclosure", readme.includes("Pre-existing before August 25, 2026")],
  ["README all nine tools", manifest.webmcpTools.length === 9 && manifest.webmcpTools.every((name) => readme.includes("`" + name + "`"))],
  ["Submission four required explanations", [
    "Why this is a strong fit for WebMCP",
    "How WebMCP improves the user experience",
    "What humans and agents can now do together",
    "How WebMCP is implemented",
  ].every((heading) => submission.includes(heading))],
  ["Submission four judging criteria", [
    "WebMCP Leverage",
    "Execution",
    "Potential Impact",
    "Creativity & Ambition",
  ].every((criterion) => submission.includes(criterion))],
  ["Submission demo plan", submission.includes("target 2:35") && submission.includes("under three minutes")],
  ["Verified core repository scope", [
    "Nine typed tools",
    "confirmed_by_user: true",
    "stable ascending-code tie-breaking",
    "Cards 001–144",
    "Origin Trial token",
    "no cloud computation",
  ].every((term) => readme.includes(term) && submission.includes(term))],
  ["Evidence-bounded demo recording contract", [
    'artifact="mirrorloop-webmcp-demo-shot-list"',
    '<Duration target="155" maximum="180" unit="seconds"/>',
    "<ToolCount>9</ToolCount>",
    "confirmed_by_user false",
    "Public YouTube upload",
    "Claims excluded from the recording",
    "P2P / WebRTC / evaluateDyad",
    "x402 or autonomous payment",
    "<VerifiedCoreRepositoryScope>",
    'id="deterministic-scoring"',
    'id="chrome-deployment"',
  ].every((term) => demoShotList.includes(term))],
  ["Submission challenge-period commits", ["ba15276", "8ec0a6f", "b1b5bc3", "828ee7a"].every((hash) => submission.includes(hash))],
  ["Submission freeze plan", submission.includes("Judging-window release freeze") && submission.includes("webmcp-challenge-submission")],
  ["Third-party service inventory", ["Google Cloud", "Cloudflare Turnstile", "Resend", "Stripe"].every((name) => notices.includes(name))],
  ["Top-level MIT license", license.includes("MIT License")],
  ["Package validation entry point", packageJSON.scripts?.["validate:submission"] === "node scripts/validate-submission.mjs"],
  ["Chrome UX validation entry point", packageJSON.scripts?.["test:webmcp:chrome-ux"] === "node scripts/validate-webmcp-chrome-ux.mjs"],
  ["Six-role validation entry point", packageJSON.scripts?.["test:webmcp:six-role-claims"] === "node scripts/validate-webmcp-six-role-claims.mjs"],
  ["Eval validation entry point", packageJSON.scripts?.["test:webmcp:evals"] === "node scripts/validate-webmcp-evals.mjs"],
  ["Campaign eval validation entry point", packageJSON.scripts?.["test:webmcp:campaign-evals"] === "node scripts/validate-webmcp-campaign-evals.mjs"],
  ["Campaign claim boundary matrix", [
    "No ephemeris",
    "No medical or psychological diagnosis",
    "No physical-deck recommendation",
    "Email submission, collection selection, price review, and Stripe Checkout remain visible human actions",
  ].every((term) => campaignAudit.includes(term))],
  ["Six bounded operational use cases", [
    "Founder equity and governance deadlock",
    "Over-simulation off-ramp",
    "Product-launch inertia",
    "Explicit ten-minute sprint frame",
    "Current-session contradiction review",
    "Digital workspace reference",
  ].every((term) => operationalUseCases.includes(term))],
  ["Competition claim hardening", [
    "<ToolCount>9</ToolCount>",
    'id="score" status="UNRESOLVED"',
    'id="astronomy" status="CONTRADICTED"',
    'id="p2p" status="CONTRADICTED"',
    "Corrected 2:35 demo",
    "Freeze the reviewed nine-tool build",
  ].every((term) => competitionHardening.includes(term))],
  ["Evidence-bounded judge panel brief", [
    '<Panel count="7">',
    "<ToolCount>9</ToolCount>",
    "Andrew Galloni",
    "Alex Nahas",
    "Ilya Grigorik",
    "Jude Gao",
    "Justin Rushing",
    "Sarah Drasner",
    "Sean Roberts",
    "Personal psychographic claims about judges",
    "Self-awarded competition scores",
    "Chrome motion and accessibility claim ledger",
    "Zero-flag Chrome setup",
    '<RoleEvidence count="6" framing="public-role-only">',
    "ninth tool is the read-only compare_choices contrast",
  ].every((term) => judgePanelBrief.includes(term))],
  ["Official resource matrix", [
    'resource_cards="36"',
    'classified="36"',
    "WebMCP evals",
    "Debug WebMCP tools",
    "Netlify WebMCP starter",
  ].every((term) => resourceReview.includes(term))],
];

for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) fail.push(name);
}

console.log("");
console.log("External gates intentionally not performed by this validator:");
console.log("- GitHub repository visibility must be PUBLIC.");
console.log("- A Devpost project must be created.");
console.log("- A public YouTube demo under three minutes must be supplied.");
console.log("- The operator must complete eligibility, ownership, and rights attestations.");
console.log("- Actual ChatGPT in-app-browser support remains optional because verified Chrome is accepted.");

if (fail.length) {
  console.error(`\nSubmission package validation failed: ${fail.join(", ")}`);
  process.exit(1);
}

console.log("\nLOCAL SUBMISSION PACKAGE PASS — external gates remain pending.");
