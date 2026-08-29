import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = [];

const readme = read("README.md");
const submission = read("SUBMISSION.md");
const notices = read("THIRD_PARTY_NOTICES.md");
const resourceReview = read("RESOURCE_REVIEW.html");
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
  ["README pre-existing disclosure", readme.includes("Pre-existing before August 25, 2026")],
  ["README all eight tools", manifest.webmcpTools.every((name) => readme.includes("`" + name + "`"))],
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
  ["Submission challenge-period commits", ["b9dddec", "2e58ce9", "9740b57", "592c08a"].every((hash) => submission.includes(hash))],
  ["Submission freeze plan", submission.includes("Judging-window release freeze") && submission.includes("webmcp-challenge-submission")],
  ["Third-party service inventory", ["Google Cloud", "Cloudflare Turnstile", "Resend", "Stripe"].every((name) => notices.includes(name))],
  ["Top-level MIT license", license.includes("MIT License")],
  ["Package validation entry point", packageJSON.scripts?.["validate:submission"] === "node scripts/validate-submission.mjs"],
  ["Eval validation entry point", packageJSON.scripts?.["test:webmcp:evals"] === "node scripts/validate-webmcp-evals.mjs"],
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
