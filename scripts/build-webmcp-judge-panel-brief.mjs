#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outputPath = path.join(root, "WEBMCP_JUDGE_PANEL_BRIEF.html");
const sourcePaths = [
  "web/lib/webmcp.js",
  "web/app.js",
  "web/data/cards.json",
  "web/data/shop.json",
  "web/evals/webmcp-evals.json",
  "qa_evidence/webmcp_agent_eval/latest.json",
  "qa_evidence/webmcp_campaign_agent_eval/latest.json",
  "qa_evidence/webmcp_operational_use_case_eval/latest.json",
];

const sourceDigest = createHash("sha256");
for (const sourcePath of sourcePaths) {
  sourceDigest.update(readFileSync(path.join(root, sourcePath)));
}
const combinedHash = sourceDigest.digest("hex");

const panel = [
  ["Andrew Galloni", "VP Research & Innovation, Cloudflare", "Privacy and system-boundary evidence"],
  ["Alex Nahas", "Creator of MCP-B", "Tool-contract and state-transition evidence"],
  ["Ilya Grigorik", "Distinguished Engineer, Shopify", "Measured delivery and runtime evidence"],
  ["Jude Gao", "Member of Technical Staff, Vercel · Next.js Core Team", "Web architecture and implementation clarity"],
  ["Justin Rushing", "Browser Platform Lead, OpenAI", "Human-agent authority and safety evidence"],
  ["Sarah Drasner", "Distinguished Engineer, Chrome, Google", "Browser-native integration and visible UX evidence"],
  ["Sean Roberts", "VP of Applied AI, Netlify", "Applied utility and conversion-boundary evidence"],
];

const evidenceLenses = [
  {
    title: "Human-agent authority",
    audience: "Browser and applied-AI reviewers",
    evidence: "Every answer mutation requires confirmed_by_user: true. Email, cart, Checkout, and payment are not WebMCP tools.",
    reproduce: "Call answer_reflection_question with false, then true; inspect the rejected and accepted results.",
  },
  {
    title: "Typed WebMCP contract",
    audience: "MCP and agent-tooling reviewers",
    evidence: "Eight bounded tools use strict JSON schemas, additionalProperties: false, behavioral annotations, awaited registration, and bounded results.",
    reproduce: "Use Application → WebMCP to inspect Available Tools, run a valid call, then add an unknown property.",
  },
  {
    title: "Browser-native visible state",
    audience: "Chrome and web-platform reviewers",
    evidence: "The live header reports WebMCP readiness only after all registrations resolve; tool mutations update the same visible reflection UI.",
    reproduce: "Start the reflection, confirm one answer, and observe the visible question transition and Invoked Tools record.",
  },
  {
    title: "Measured lightweight modules",
    audience: "Web-performance reviewers",
    evidence: "The audited source sizes are app.js 18,532 bytes raw / 5,504 gzip and webmcp.js 12,264 bytes raw / 3,171 gzip. No total-bundle or frame-rate claim is made.",
    reproduce: "Run wc -c and gzip -c on the two source files; run the browser-responsive and Node gates.",
  },
  {
    title: "Privacy boundary, not a zero-telemetry slogan",
    audience: "Edge, privacy, and trust reviewers",
    evidence: "Reflection answers remain in browser state during WebMCP use. Separate optional email, aggregate analytics, and Stripe flows are disclosed rather than described as zero egress.",
    reproduce: "Inspect the eight tool handlers and verify that no email, analytics, cart, or payment handler is registered as a WebMCP tool.",
  },
  {
    title: "Applied product path",
    audience: "Product and commercial reviewers",
    evidence: "A read-only tool recommends a real digital edition without price or checkout authority; the person must review the collection and initiate Stripe Checkout.",
    reproduce: "Call recommend_card_edition, inspect its price-free result, and stop before the human-controlled collection flow.",
  },
];

const exclusions = [
  ["Sub-millisecond Keplerian, VSOP87, LST, or ephemeris engine", "Not implemented or benchmarked in the public submission."],
  ["Dyadic URL token, WebRTC, or P2P synthesis", "No ninth tool or multi-user exchange is deployed."],
  ["Universal zero egress or zero telemetry", "Optional aggregate analytics, email delivery, and Stripe are separate disclosed network flows."],
  ["Physical 350gsm deck and fixed WebMCP price", "The public catalog contains digital editions; the tool returns neither price nor checkout URL."],
  ["Under-20KB total bundle or guaranteed 60 fps", "No total-transfer or frame-performance evidence supports those claims."],
  ["Personal judge preferences or dislikes", "A public role can organize evidence; it cannot establish a person’s private motivations."],
  ["Unanimous 10/10 score", "Only the judges can assign scores."],
];

const escapeHTML = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const panelRows = panel.map(([name, title, lens]) => `
  <tr><td>${escapeHTML(name)}</td><td>${escapeHTML(title)}</td><td>${escapeHTML(lens)}</td></tr>
`).join("");

const lensCards = evidenceLenses.map(({ title, audience, evidence, reproduce }, index) => `
  <article class="lens">
    <span class="index">${String(index + 1).padStart(2, "0")}</span>
    <h3>${escapeHTML(title)}</h3>
    <p class="audience">${escapeHTML(audience)}</p>
    <p>${escapeHTML(evidence)}</p>
    <p class="reproduce"><strong>Judge check:</strong> ${escapeHTML(reproduce)}</p>
  </article>
`).join("");

const exclusionRows = exclusions.map(([claim, reason]) => `
  <tr><td>${escapeHTML(claim)}</td><td><span class="excluded">EXCLUDED</span></td><td>${escapeHTML(reason)}</td></tr>
`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MIRROR//LOOP — WebMCP Judge Panel Evidence Brief</title>
  <meta name="description" content="Role-oriented, reproducible evidence brief for the MIRROR//LOOP WebMCP Challenge submission.">
  <link rel="icon" href="web/favicon.svg" type="image/svg+xml">
  <style>
    html { background:#070a12; color:#f4efe4; font-family:Inter,ui-sans-serif,system-ui,sans-serif; line-height:1.55; }
    body { margin:0; min-height:100vh; }
    judge-panel-brief:not(:defined) { display:block; width:min(1180px,calc(100% - 32px)); margin:auto; padding:42px 0; }
  </style>
</head>
<body>
  <judge-panel-brief></judge-panel-brief>
  <script type="application/xml" id="strategix-contract">
<StrategiXVisualSpec version="1.0" artifact="mirrorloop-webmcp-judge-panel-brief" generatedAt="2026-08-29">
  <Purpose>Orient the confirmed WebMCP Challenge panel to reproducible MIRROR//LOOP evidence without psychographic claims or undeployed capabilities.</Purpose>
  <OfficialSource url="https://webmcp.devpost.com/" capturedAt="2026-08-30T00:57:13Z" sha256="611a5f02f128011ccbbdee63e4dc73acd1a5d15a2fbe7dd96d549409c5b53fc6"/>
  <Panel count="7">
    ${panel.map(([name, title]) => `<Judge name="${escapeHTML(name)}" title="${escapeHTML(title)}"/>`).join("\n    ")}
  </Panel>
  <ProductContract>
    <ToolCount>8</ToolCount>
    <Tools>start_reflection,get_current_question,explain_choice,answer_reflection_question,review_reflection_answers,complete_reflection,get_card,recommend_card_edition</Tools>
    <BrowserEvents>mirrorloop:session_start,mirrorloop:step_transition,mirrorloop:reflection_complete</BrowserEvents>
    <HumanAuthority>Every answer requires explicit confirmation. Email, cart mutation, Checkout creation, and payment remain human actions.</HumanAuthority>
    <PrivacyBoundary>Reflection answers remain browser-local in the WebMCP flow. Optional aggregate analytics, email delivery, and Stripe are separate disclosed network flows.</PrivacyBoundary>
    <Catalog>Digital editions only. Agent recommendations expose neither price nor a direct checkout URL.</Catalog>
  </ProductContract>
  <Evidence>
    <Run name="baseline" cases="15" strictExact="12" requiredOrder="14" protectedCases="5" forbiddenMutations="0"/>
    <Run name="campaign" cases="10" exactToolSelection="10" requiredOrder="10" noToolBoundaries="5"/>
    <Run name="operational" cases="6" exactCases="6" exactCalls="8"/>
    <MeasuredAsset path="web/app.js" rawBytes="18532" gzipBytes="5504"/>
    <MeasuredAsset path="web/lib/webmcp.js" rawBytes="12264" gzipBytes="3171"/>
  </Evidence>
  <ClaimBoundary>
    <Excluded>Astronomical or ephemeris runtime and sub-millisecond benchmark</Excluded>
    <Excluded>Dyadic, WebRTC, or P2P synthesis</Excluded>
    <Excluded>Universal zero-egress or zero-telemetry guarantee</Excluded>
    <Excluded>Physical-deck fulfillment or autonomous checkout</Excluded>
    <Excluded>Total-bundle and frame-rate claims without measurements</Excluded>
    <Excluded>Personal psychographic claims about judges</Excluded>
    <Excluded>Self-awarded competition scores</Excluded>
  </ClaimBoundary>
  <AcceptanceCriteria>
    <Criterion>All seven judges and official titles are traceable to the captured official challenge page.</Criterion>
    <Criterion>Every positive capability maps to source or preserved execution evidence.</Criterion>
    <Criterion>Every supplied undeployed claim is explicitly excluded.</Criterion>
    <Criterion>The panel is oriented by relevant public role, not alleged private preference.</Criterion>
  </AcceptanceCriteria>
  <SourceDigest sha256="${combinedHash}">
    ${sourcePaths.map((sourcePath) => `<Source path="${sourcePath}"/>`).join("\n    ")}
  </SourceDigest>
</StrategiXVisualSpec>
  </script>
  <script type="module">
    import { LitElement, html, css } from "https://unpkg.com/lit@3/index.js?module";
    const panelRows = ${JSON.stringify(panelRows)};
    const lensCards = ${JSON.stringify(lensCards)};
    const exclusionRows = ${JSON.stringify(exclusionRows)};
    const xml = document.getElementById("strategix-contract")?.textContent.trim() ?? "";
    class JudgePanelBrief extends LitElement {
      static styles = css\`
        :host { display:block; min-width:0; min-height:100vh; overflow-x:hidden; background:radial-gradient(circle at 15% 0,rgba(224,177,87,.18),transparent 30%),#070a12; }
        main { box-sizing:border-box; width:min(1180px,calc(100% - 32px)); min-width:0; margin:auto; padding:42px 0 72px; }
        section { min-width:0; margin-bottom:18px; padding:24px; border:1px solid rgba(231,190,101,.3); border-radius:18px; background:rgba(16,21,35,.95); }
        .eyebrow { color:#efbe65; text-transform:uppercase; letter-spacing:.14em; font-size:.76rem; font-weight:800; }
        h1 { margin:.18em 0; font:clamp(2.15rem,6vw,4.7rem)/1 Georgia,serif; }
        h2 { margin:.1em 0 .7em; color:#efbe65; }
        h3 { margin:.25rem 0; color:#f4efe4; }
        p,li { color:#d1ceda; }
        .verdict { font-size:1.12rem; border-left:4px solid #efbe65; padding-left:14px; }
        .metrics,.lenses { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
        .metric,.lens { min-width:0; padding:16px; border:1px solid #34394d; border-radius:12px; background:#0c1120; }
        .metric strong,.index { display:block; color:#efbe65; font-weight:900; }
        .metric strong { font-size:1.8rem; }
        .audience { color:#efbe65; font-size:.8rem; text-transform:uppercase; letter-spacing:.08em; }
        .reproduce { padding-top:10px; border-top:1px solid #34394d; }
        .table-wrap { width:100%; max-width:100%; overflow:auto; border:1px solid #34394d; border-radius:12px; }
        table { width:100%; min-width:820px; border-collapse:collapse; background:#0c1120; }
        th,td { padding:12px; text-align:left; vertical-align:top; border-bottom:1px solid #34394d; }
        th { color:#efbe65; background:#171c2d; }
        .excluded { display:inline-block; padding:4px 8px; border-radius:999px; color:#ffc2c2; background:#482020; font-size:.7rem; font-weight:900; }
        pre { max-height:420px; overflow:auto; white-space:pre-wrap; color:#dfd2b8; font-size:.76rem; }
        @media(max-width:820px){ .metrics,.lenses{grid-template-columns:1fr;} section{padding:18px;} }
      \`;
      render() {
        return html\`
          <main>
            <section>
              <div class="eyebrow">Role-oriented · evidence-bounded · reproducible</div>
              <h1>Judge Panel Evidence Brief</h1>
              <p class="verdict"><strong>Do not guess what a judge “hates” or promise a perfect score.</strong> Give every reviewer a short path from the official scoring criteria to working code, visible browser behavior, and preserved test evidence.</p>
              <div class="metrics">
                <div class="metric"><strong>8 tools</strong>deployed browser contract</div>
                <div class="metric"><strong>3 eval suites</strong>31 preserved agent cases</div>
                <div class="metric"><strong>0</strong>agent payment actions</div>
              </div>
            </section>
            <section>
              <h2>Confirmed panel</h2>
              <p>Names and titles below were verified against the official challenge home page captured on 2026-08-30. The final column is an evidence-navigation lens inferred from the public role—not a claim about private preferences.</p>
              <div class="table-wrap"><table><thead><tr><th>Judge</th><th>Official title</th><th>Relevant evidence lens</th></tr></thead><tbody .innerHTML=\${panelRows}></tbody></table></div>
            </section>
            <section>
              <h2>Six evidence paths</h2>
              <div class="lenses" .innerHTML=\${lensCards}></div>
            </section>
            <section>
              <h2>Claims excluded from the submission</h2>
              <div class="table-wrap"><table><thead><tr><th>Proposed claim</th><th>Status</th><th>Reason</th></tr></thead><tbody .innerHTML=\${exclusionRows}></tbody></table></div>
            </section>
            <section>
              <h2>Three-minute narrative priority</h2>
              <ol>
                <li>Show <strong>WebMCP ready · 8 tools</strong> and the native Chrome tool list.</li>
                <li>Demonstrate explanation, rejected unconfirmed mutation, confirmed answer, and visible state transition.</li>
                <li>Complete deterministic scoring, retrieve one public card, and request a digital-edition recommendation.</li>
                <li>Stop before email, cart, or Stripe and state that consequential actions remain human-controlled.</li>
                <li>Close on the preserved live-agent metrics, not a self-awarded score.</li>
              </ol>
            </section>
            <section><h2>Embedded XML contract</h2><pre>\${xml}</pre></section>
          </main>
        \`;
      }
    }
    customElements.define("judge-panel-brief", JudgePanelBrief);
  </script>
</body>
</html>
`;

writeFileSync(outputPath, html);
console.log(`WebMCP judge panel brief: ${outputPath}`);
console.log(`Combined source SHA-256: ${combinedHash}`);
