#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outputPath = path.join(root, "WEBMCP_JUDGE_PANEL_BRIEF.html");
const sourcePaths = [
  "web/index.html",
  "web/styles.css",
  "web/lib/webmcp.js",
  "web/lib/analytics.js",
  "web/app.js",
  "web/shop.js",
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
    evidence: "Ten bounded tools use strict JSON schemas, additionalProperties: false, behavioral annotations, awaited registration, and bounded results.",
    reproduce: "Use Application → WebMCP to inspect Available Tools, run a valid call, then add an unknown property.",
  },
  {
    title: "Browser-native visible state",
    audience: "Chrome and web-platform reviewers",
    evidence: "The live header reports WebMCP readiness only after all registrations resolve. Confirmed tool mutations update the same visible question, semantic progressbar, and focus target used by a person.",
    reproduce: "Start the reflection, confirm one answer, and inspect aria-valuenow, question-title focus, the visible progress transition, and the Invoked Tools record.",
  },
  {
    title: "Measured lightweight modules",
    audience: "Web-performance reviewers",
    evidence: "The audited source sizes are app.js 27,503 bytes raw / 7,952 gzip, webmcp.js 21,428 raw / 4,815 gzip, and dossier.js 5,494 raw / 1,948 gzip. No total-bundle or frame-rate claim is made.",
    reproduce: "Run wc -c and gzip -c on the two source files; run the browser-responsive and Node gates.",
  },
  {
    title: "Privacy boundary, not a zero-telemetry slogan",
    audience: "Edge, privacy, and trust reviewers",
    evidence: "Reflection answers remain in browser state during WebMCP use. Separate optional email, aggregate analytics, and Stripe flows are disclosed rather than described as zero egress.",
    reproduce: "Inspect the ten tool handlers and verify that no email, analytics, cart, or payment handler is registered as a WebMCP tool.",
  },
  {
    title: "Applied product path",
    audience: "Product and commercial reviewers",
    evidence: "A read-only tool recommends a real digital edition without price or checkout authority; the person must review the collection and initiate Stripe Checkout.",
    reproduce: "Call recommend_card_edition, inspect its price-free result, and stop before the human-controlled collection flow.",
  },
];

const chromeClaims = [
  ["Origin Trial token in the production document", "SUPPORTED", "web/index.html contains the WebMCP Origin Trial meta token. The documented Chrome 149 testing flag remains the verified judge path until no-flag access is reproduced."],
  ["Graceful browser feature detection and fallback", "SUPPORTED", "The installer checks document.modelContext, then navigator.modelContext, awaits registration, and preserves the complete direct reflection when WebMCP is unavailable."],
  ["Accessible visible reflection progress", "SUPPORTED", "The page exposes a named progressbar with min/max/current values, polite status and result regions, question/result focus movement, and reduced-motion CSS."],
  ["Tool-driven browser events", "SUPPORTED", "The page emits mirrorloop:session_start, mirrorloop:step_transition, and mirrorloop:reflection_complete; these events accompany real visible state changes."],
  ["144-sector animated SVG dial", "CONTRADICTED", "The public competition page contains no SVG or canvas dial. Its real motion is a 250 ms CSS width transition on the 12-step progress indicator."],
  ["requestAnimationFrame, --active-angle, compositor-only, zero-paint, or guaranteed 60 fps", "UNMEASURED", "Those mechanisms and performance receipts are absent. The submission makes no frame-rate, paint, or compositor-thread claim."],
  ["Zero-flag Chrome setup", "UNRESOLVED", "The token is present, but the reproducible judge path still documents Chrome 149 with the WebMCP testing flag. Do not promise zero setup."],
  ["Dependency-free total experience", "QUALIFIED", "The core page is vanilla ESM, but optional Turnstile, email, analytics, and Stripe flows are disclosed external integrations."],
  ["A judge's private preferences or dislikes", "EXCLUDED", "A public role can organize an inspection path; it cannot establish a person's private motivations."],
];

const roleEvidence = [
  {
    name: "Justin Rushing",
    lens: "Human-agent authority and safe browser execution",
    supported: "The agent may read, explain, and preview one hypothetical score change, and may mutate only ephemeral reflection state. Every answer requires confirmed_by_user: true. Email, cart, Checkout, and payment remain outside the eleven-tool contract.",
    correction: "The agent is not read-only: start, answer, and completion tools intentionally mutate local state. Completion returns a bounded reflective prompt, not a guaranteed physical test or hard Return Line.",
    reproduce: "Reject an unconfirmed answer, accept a confirmed answer, then verify that no registered tool can submit email, alter the cart, or create payment.",
  },
  {
    name: "Alex Nahas",
    lens: "Typed browser-tool contracts and state gating",
    supported: "All eleven tools use bounded JSON schemas, additionalProperties: false, explicit required fields, runtime validators, annotations, awaited registration, and a 1,500-character result limit. Completion, answer-impact preview, and dossier export reject incomplete sessions.",
    correction: "The eleventh tool is the confirmed local-only export_reflection_dossier action; recommend_card_edition remains price-free and read-only. Validation does not auto-pad identifiers, and errors use the WebMCP isError text envelope rather than an invented structured INCOMPLETE_SESSION payload.",
    reproduce: "Inspect Available Tools, pass an unknown field, pass card_id 4 instead of 004, and call complete_reflection before question 12.",
  },
  {
    name: "Ilya Grigorik",
    lens: "Measured delivery and network behavior",
    supported: "Audited source modules measure app.js at 27,503 bytes raw / 7,952 gzip, webmcp.js at 21,428 raw / 4,815 gzip, and dossier.js at 5,494 raw / 1,948 gzip. Reflection tool execution uses in-page state after required public data loads.",
    correction: "There is no kinematics.js, VSOP87/Keplerian solver, LST benchmark, under-20KB total-transfer proof, or zero-request session. The page loads public JSON and records two allowlisted aggregate funnel events.",
    reproduce: "Run wc and gzip on the two modules, then inspect Network while loading the quiz and starting/completing a reflection.",
  },
  {
    name: "Andrew Galloni",
    lens: "Privacy and infrastructure boundaries",
    supported: "The 12 answers and optional focus stay in browser state during WebMCP use. Only aggregate quiz-start/completion event names are recorded; email and Stripe are separate, disclosed, human-initiated flows.",
    correction: "The production system is not zero telemetry, zero database, zero compute, or Cloudflare Pages. It uses Firebase Hosting, Cloud Run, Firestore, Turnstile, Resend, and Stripe. No dyadic hash token, encryption handshake, WebRTC, or P2P exchange is deployed.",
    reproduce: "Inspect the analytics payload and privacy notice, confirm the WebMCP handlers do not transmit answers, and inspect the documented service inventory.",
  },
  {
    name: "Jude Gao",
    lens: "Web architecture and maintainable client state",
    supported: "The public frontend uses native ESM modules with separated quiz scoring, analytics, WebMCP registration, and shop orchestration. The project avoids a production UI framework and bundler.",
    correction: "The tools call application adapters that update visible DOM state and also dispatch CustomEvents; this is not a purely event-only or strictly unidirectional architecture. The repository has Playwright as a development dependency, so only the public runtime—not the entire repository—is framework-free.",
    reproduce: "Inspect imports and adapter calls in app.js and webmcp.js, then trace one answer from tool execution through renderQuestion and mirrorloop:step_transition.",
  },
  {
    name: "Sean Roberts",
    lens: "Applied utility and human-controlled conversion",
    supported: "A Firebase-hosted static frontend offers a free reflection, optional double-opt-in email, 28 digital products, and server-created Stripe Checkout. Agent recommendations are price-free and read-only; the person chooses the product and starts Checkout.",
    correction: "The current catalog is digital delivery, not physical 350gsm decks or fixed $48–$64 offers. The site still uses a Go Cloud Run API, Firestore, Resend, Turnstile, and Stripe, so zero server maintenance or zero compute would be inaccurate.",
    reproduce: "Complete the reflection, request an edition recommendation, inspect its digital_download and purchase boundary, then manually open the collection and stop before Checkout.",
  },
];

const exclusions = [
  ["Sub-millisecond Keplerian, VSOP87, LST, or ephemeris engine", "Not implemented or benchmarked in the public submission."],
  ["Dyadic URL token, WebRTC, or P2P synthesis", "No multi-user exchange is deployed."],
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

const chromeClaimRows = chromeClaims.map(([claim, status, evidence]) => `
  <tr><td>${escapeHTML(claim)}</td><td><span class="claim-status ${status.toLowerCase()}">${escapeHTML(status)}</span></td><td>${escapeHTML(evidence)}</td></tr>
`).join("");

const roleCards = roleEvidence.map(({ name, lens, supported, correction, reproduce }) => `
  <article class="role-card">
    <p class="audience">${escapeHTML(name)}</p>
    <h3>${escapeHTML(lens)}</h3>
    <p><strong>Supported:</strong> ${escapeHTML(supported)}</p>
    <p><strong>Correction:</strong> ${escapeHTML(correction)}</p>
    <p class="reproduce"><strong>Judge check:</strong> ${escapeHTML(reproduce)}</p>
  </article>
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
    <ToolCount>11</ToolCount>
    <Tools>start_reflection,get_current_question,explain_choice,compare_choices,preview_answer_impact,answer_reflection_question,review_reflection_answers,complete_reflection,export_reflection_dossier,get_card,recommend_card_edition</Tools>
    <BrowserEvents>mirrorloop:session_start,mirrorloop:step_transition,mirrorloop:reflection_complete</BrowserEvents>
    <HumanAuthority>Every answer requires explicit confirmation. Email, cart mutation, Checkout creation, and payment remain human actions.</HumanAuthority>
    <PrivacyBoundary>Reflection answers remain browser-local in the WebMCP flow. Optional aggregate analytics, email delivery, and Stripe are separate disclosed network flows.</PrivacyBoundary>
    <Catalog>Digital editions only. Agent recommendations expose neither price nor a direct checkout URL.</Catalog>
    <VisibleProgress role="progressbar" minimum="1" maximum="12">A 250 ms CSS width transition updates with aria-valuenow; prefers-reduced-motion disables the transition.</VisibleProgress>
    <Accessibility>Status and result regions use aria-live polite. Question and result headings receive focus as state advances.</Accessibility>
    <OriginTrial qualification="verified-flag-path">The token is embedded, while the documented reproducible test path retains the Chrome 149 WebMCP testing flag.</OriginTrial>
  </ProductContract>
  <Evidence>
    <Run name="baseline" cases="15" strictExact="12" requiredOrder="14" protectedCases="5" forbiddenMutations="0"/>
    <Run name="campaign" cases="10" exactToolSelection="10" requiredOrder="10" noToolBoundaries="5"/>
    <Run name="operational" cases="6" exactCases="6" exactCalls="8"/>
    <MeasuredAsset path="web/app.js" rawBytes="18532" gzipBytes="5504"/>
    <MeasuredAsset path="web/lib/webmcp.js" rawBytes="12264" gzipBytes="3171"/>
  </Evidence>
  <RoleEvidence count="6" framing="public-role-only">
    ${roleEvidence.map(({ name, lens, supported, correction, reproduce }) => `<Role name="${escapeHTML(name)}" lens="${escapeHTML(lens)}">
      <Supported>${escapeHTML(supported)}</Supported>
      <Correction>${escapeHTML(correction)}</Correction>
      <Reproduce>${escapeHTML(reproduce)}</Reproduce>
    </Role>`).join("\n    ")}
  </RoleEvidence>
  <ClaimBoundary>
    <Excluded>Astronomical or ephemeris runtime and sub-millisecond benchmark</Excluded>
    <Excluded>Dyadic, WebRTC, or P2P synthesis</Excluded>
    <Excluded>Universal zero-egress or zero-telemetry guarantee</Excluded>
    <Excluded>Physical-deck fulfillment or autonomous checkout</Excluded>
    <Excluded>Total-bundle and frame-rate claims without measurements</Excluded>
    <Excluded>Personal psychographic claims about judges</Excluded>
    <Excluded>Self-awarded competition scores</Excluded>
    <Excluded>Invented 144-sector SVG, requestAnimationFrame, CSS angle, compositor-only, zero-paint, or guaranteed 60-fps claims</Excluded>
    <Excluded>Private judge likes, dislikes, or guaranteed scores</Excluded>
    <Excluded>Kinematics, LST, dyadic/P2P, zero-network, zero-telemetry, zero-database, zero-compute, and physical-product claims</Excluded>
    <Qualified>Vanilla ESM core does not mean the optional external-service flows are dependency-free.</Qualified>
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
    const chromeClaimRows = ${JSON.stringify(chromeClaimRows)};
    const roleCards = ${JSON.stringify(roleCards)};
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
        .metrics,.lenses,.roles { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
        .metric,.lens,.role-card { min-width:0; padding:16px; border:1px solid #34394d; border-radius:12px; background:#0c1120; }
        .metric strong,.index { display:block; color:#efbe65; font-weight:900; }
        .metric strong { font-size:1.8rem; }
        .audience { color:#efbe65; font-size:.8rem; text-transform:uppercase; letter-spacing:.08em; }
        .reproduce { padding-top:10px; border-top:1px solid #34394d; }
        .table-wrap { width:100%; max-width:100%; overflow:auto; border:1px solid #34394d; border-radius:12px; }
        table { width:100%; min-width:820px; border-collapse:collapse; background:#0c1120; }
        th,td { padding:12px; text-align:left; vertical-align:top; border-bottom:1px solid #34394d; }
        th { color:#efbe65; background:#171c2d; }
        .excluded { display:inline-block; padding:4px 8px; border-radius:999px; color:#ffc2c2; background:#482020; font-size:.7rem; font-weight:900; }
        .claim-status { display:inline-block; padding:4px 8px; border-radius:999px; font-size:.7rem; font-weight:900; }
        .supported { color:#c9ffd8; background:#17462a; }
        .contradicted,.excluded { color:#ffc2c2; background:#482020; }
        .unmeasured,.unresolved,.qualified { color:#ffe5a9; background:#51401d; }
        pre { max-height:420px; overflow:auto; white-space:pre-wrap; color:#dfd2b8; font-size:.76rem; }
        @media(max-width:820px){ .metrics,.lenses,.roles{grid-template-columns:1fr;} section{padding:18px;} }
        @media(prefers-reduced-motion:reduce){ *,*::before,*::after{scroll-behavior:auto!important;animation:none!important;transition:none!important;} }
      \`;
      render() {
        return html\`
          <main>
            <section>
              <div class="eyebrow">Role-oriented · evidence-bounded · reproducible</div>
              <h1>Judge Panel Evidence Brief</h1>
              <p class="verdict"><strong>Do not guess what a judge “hates” or promise a perfect score.</strong> Give every reviewer a short path from the official scoring criteria to working code, visible browser behavior, and preserved test evidence.</p>
              <div class="metrics">
                <div class="metric"><strong>11 tools</strong>deployed browser contract</div>
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
              <h2>Chrome motion and accessibility claim ledger</h2>
              <p>This is the honest platform story: semantic visible progress, explicit focus, polite announcements, reduced-motion support, awaited WebMCP registration, and a graceful direct-use fallback. It is not an invented SVG performance demo.</p>
              <div class="table-wrap"><table><thead><tr><th>Claim</th><th>Status</th><th>Reproducible evidence or boundary</th></tr></thead><tbody .innerHTML=\${chromeClaimRows}></tbody></table></div>
            </section>
            <section>
              <h2>Six role-oriented evidence paths</h2>
              <p>These paths use the remaining judges’ official public roles to shorten verification. They do not claim knowledge of anyone’s preferences, pet peeves, or likely score.</p>
              <div class="roles" .innerHTML=\${roleCards}></div>
            </section>
            <section>
              <h2>Three-minute narrative priority</h2>
              <ol>
                <li>Show <strong>WebMCP ready · 11 tools</strong> and the native Chrome tool list.</li>
                <li>Demonstrate explanation, rejected unconfirmed mutation, confirmed answer, and the same visible progress and focus transition a person receives.</li>
                <li>Complete deterministic scoring, retrieve one public card, and request a digital-edition recommendation.</li>
                <li>Stop before email, cart, or Stripe and state that consequential actions remain human-controlled.</li>
                <li>Close on preserved live-agent metrics and reduced-motion/accessibility evidence—not invented SVG or self-awarded performance claims.</li>
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
