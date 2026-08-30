#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outputPath = path.join(root, "WEBMCP_COMPETITION_HARDENING_AUDIT.html");
const sources = [
  "web/lib/webmcp.js",
  "web/app.js",
  "web/data/cards.json",
  "web/data/shop.json",
  "qa_evidence/webmcp_agent_eval/latest.json",
  "qa_evidence/webmcp_campaign_agent_eval/latest.json",
  "qa_evidence/webmcp_operational_use_case_eval/latest.json",
];
const sourceDigest = createHash("sha256");
for (const source of sources) sourceDigest.update(readFileSync(path.join(root, source)));
const combinedHash = sourceDigest.digest("hex");

const claims = [
  ["Self-awarded 10/10 judging scores", "UNRESOLVED", "Only judges can assign competition scores. Replace scores with reproducible evidence."],
  ["Typed WebMCP actions reduce navigation burden", "SUPPORTED_WITH_QUALIFICATION", "Eight typed tools replace brittle control inference for the bounded reflection and card flows."],
  ["Three-Voice framing", "SUPPORTED_WITH_QUALIFICATION", "Useful as a narrative design metaphor; it is not a browser protocol or measured outcome."],
  ["canvas_spin_init, lens_pulse, dial_step, lock_active_card events", "CONTRADICTED", "The app emits session_start, step_transition, and reflection_complete."],
  ["Sub-millisecond LST, Keplerian, or VSOP87 engine", "CONTRADICTED", "No public astronomical engine or benchmark exists in this repository."],
  ["focus_area requires a zero-XSS remediation", "NOT_APPLICABLE", "The value is trimmed, capped at 300 characters, kept in browser state, and not rendered or returned. Absolute zero-risk claims remain inappropriate."],
  ["Integer-to-lens-code normalization", "CONTRADICTED", "Two-digit enum strings are intentional. Auto-padding would weaken the strict typed contract."],
  ["Completion requires all twelve confirmed answers", "SUPPORTED", "The production completion gate rejects incomplete sessions."],
  ["Tool 9 dyadic synthesis and P2P zero knowledge", "CONTRADICTED", "No ninth tool or multi-user exchange exists. This needs separate privacy, consent, threat-model, and product review."],
  ["Physical decks at fixed prices", "CONTRADICTED", "The current public catalog contains digital editions; WebMCP returns no price."],
  ["x402 or autonomous settlement", "CONTRADICTED", "Payments remain a visible, human-controlled Stripe flow outside WebMCP."],
  ["Geneva game theory and Zaveta 18D diagnostics", "UNRESOLVED", "These are private symbolic interpretations, not public validated decision-science features."],
];
const rows = claims.map(([claim, status, disposition]) => `
  <tr><td>${claim}</td><td><span class="status ${status.toLowerCase()}">${status}</span></td><td>${disposition}</td></tr>
`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MIRROR//LOOP — WebMCP Competition Claim Hardening</title>
  <meta name="description" content="Evidence-bounded competition narrative, demo, and release decision for MIRROR//LOOP WebMCP.">
  <style>
    html { background:#070a12; color:#f5f0e2; font-family:Inter,ui-sans-serif,system-ui,sans-serif; line-height:1.55; }
    body { margin:0; min-height:100vh; }
    competition-hardening:not(:defined) { display:block; width:min(1180px,calc(100% - 32px)); margin:auto; padding:42px 0; }
  </style>
</head>
<body>
  <competition-hardening></competition-hardening>
  <script type="application/xml" id="strategix-contract">
<StrategiXVisualSpec version="1.0" artifact="mirrorloop-webmcp-competition-hardening" generatedAt="2026-08-29">
  <Purpose>Replace unsupported perfect-score, architecture, security, science, product, and payment claims with a judge-reproducible competition narrative.</Purpose>
  <ProductContract>
    <ToolCount>8</ToolCount>
    <Tools>start_reflection,get_current_question,explain_choice,answer_reflection_question,review_reflection_answers,complete_reflection,get_card,recommend_card_edition</Tools>
    <BrowserEvents>mirrorloop:session_start,mirrorloop:step_transition,mirrorloop:reflection_complete</BrowserEvents>
    <HumanAuthority>Answers require explicit confirmation. Email, cart mutation, Checkout creation, and payment remain human actions.</HumanAuthority>
    <Catalog>Digital editions only; recommendations expose neither price nor direct Stripe URL.</Catalog>
    <PrivateData excluded="true">Geneva, Zaveta, Rosicrucian, APEX, full source texts, internal interpretations, subscriber data</PrivateData>
  </ProductContract>
  <ClaimLedger>
    <Claim id="score" status="UNRESOLVED">Self-awarded 10/10 scores are removed.</Claim>
    <Claim id="typed_navigation" status="SUPPORTED_WITH_QUALIFICATION">Eight typed tools support the bounded experience.</Claim>
    <Claim id="invented_events" status="CONTRADICTED">Four proposed event names do not exist.</Claim>
    <Claim id="astronomy" status="CONTRADICTED">No public LST, Keplerian, VSOP87, transit, or ray engine is claimed.</Claim>
    <Claim id="focus_xss" status="NOT_APPLICABLE">Focus text is bounded, private browser state and is not rendered or returned.</Claim>
    <Claim id="strict_codes" status="SUPPORTED">Two-digit enum strings remain strict; integer normalization is rejected.</Claim>
    <Claim id="completion_gate" status="SUPPORTED">All twelve answers are required before completion.</Claim>
    <Claim id="tool9_p2p" status="CONTRADICTED">No ninth tool, dyadic exchange, or P2P workflow is deployed.</Claim>
    <Claim id="physical_products" status="CONTRADICTED">No physical product or fixed WebMCP price is claimed.</Claim>
    <Claim id="autonomous_payment" status="CONTRADICTED">No x402 or autonomous settlement is deployed.</Claim>
    <Claim id="historical_authority" status="UNRESOLVED">Symbolic private material is not promoted as validated decision science.</Claim>
  </ClaimLedger>
  <Evidence>
    <Run name="baseline" cases="15" strict_exact="12" required_order="14" protected_cases="5" forbidden_mutations="0"/>
    <Run name="campaign" cases="10" exact_tool_selection="10" required_order="10" no_tool_boundaries="5"/>
    <Run name="operational" cases="6" exact_cases="6" exact_calls="8"/>
  </Evidence>
  <DemoContract duration_target="2:35" maximum="3:00">
    <Beat order="1">Show the live page and WebMCP ready · 8 tools.</Beat>
    <Beat order="2">Start a reflection, read the current question, and explain one choice.</Beat>
    <Beat order="3">Demonstrate failed unconfirmed recording, then explicit confirmation and visible step transition.</Beat>
    <Beat order="4">Use a prepared eleven-answer state, confirm the twelfth answer, and complete deterministic local scoring.</Beat>
    <Beat order="5">Retrieve Card 004 and show its bounded action.</Beat>
    <Beat order="6">Recommend a matching digital ARC edition, then stop before Stripe.</Beat>
    <Beat order="7">Close with the human-agent authority boundary and public evidence links.</Beat>
  </DemoContract>
  <DecisionLog>
    <Decision date="2026-08-29">Freeze the submitted eight-tool architecture instead of adding an unreviewed ninth tool, P2P exchange, astronomical engine, physical fulfillment, or autonomous payment.</Decision>
    <Decision date="2026-08-29">Do not self-award judging scores; organize evidence under the four published judging criteria.</Decision>
  </DecisionLog>
  <AcceptanceCriteria>
    <Criterion>Every public capability in the corrected narrative maps to inspected code or preserved execution evidence.</Criterion>
    <Criterion>The demo remains under three minutes and uses only the eight production tools.</Criterion>
    <Criterion>No public copy claims ephemeris, physical fulfillment, autonomous payment, diagnosis, or a zero-risk privacy guarantee.</Criterion>
    <Criterion>External submission gates remain explicit until performed by the operator.</Criterion>
  </AcceptanceCriteria>
  <OpenRisks>
    <Risk>Repository visibility, Devpost publication, public YouTube video, and rights attestations remain external operator gates.</Risk>
    <Risk>Observed model runs do not guarantee universal model behavior or competition scores.</Risk>
  </OpenRisks>
  <SourceDigest sha256="${combinedHash}">
    ${sources.map((source) => `<Source path="${source}"/>`).join("\n    ")}
  </SourceDigest>
</StrategiXVisualSpec>
  </script>
  <script type="module">
    import { LitElement, html, css } from "https://unpkg.com/lit@3/index.js?module";
    const claimRows = ${JSON.stringify(rows)};
    const xml = document.getElementById("strategix-contract")?.textContent.trim() ?? "";
    class CompetitionHardening extends LitElement {
      static styles = css\`
        :host { display:block; min-width:0; min-height:100vh; overflow-x:hidden; background:radial-gradient(circle at 18% 0,rgba(224,177,87,.18),transparent 30%),#070a12; }
        main { box-sizing:border-box; width:min(1180px,calc(100% - 32px)); min-width:0; margin:auto; padding:42px 0 72px; }
        section { min-width:0; margin-bottom:18px; padding:24px; border:1px solid rgba(231,190,101,.3); border-radius:18px; background:rgba(16,21,35,.94); }
        .eyebrow { color:#efbe65; text-transform:uppercase; letter-spacing:.14em; font-size:.76rem; font-weight:800; }
        h1 { margin:.18em 0; font:clamp(2.2rem,6vw,4.8rem)/1 Georgia,serif; }
        h2 { margin:.1em 0 .7em; color:#efbe65; }
        p,li { color:#d1ceda; }
        .verdict { font-size:1.14rem; border-left:4px solid #efbe65; padding-left:14px; }
        .metrics,.criteria,.beats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
        .metric,.criterion,.beat { min-width:0; padding:16px; border:1px solid #34394d; border-radius:12px; background:#0c1120; }
        .metric strong { display:block; color:#efbe65; font-size:1.9rem; }
        .criterion strong,.beat strong { color:#efbe65; }
        .table-wrap { width:100%; max-width:100%; overflow:auto; border:1px solid #34394d; border-radius:12px; }
        table { width:100%; min-width:900px; border-collapse:collapse; background:#0c1120; }
        th,td { padding:12px; text-align:left; vertical-align:top; border-bottom:1px solid #34394d; }
        th { color:#efbe65; background:#171c2d; }
        .status { display:inline-block; max-width:230px; padding:4px 8px; border-radius:999px; font-size:.69rem; font-weight:900; overflow-wrap:anywhere; }
        .supported,.supported_with_qualification { color:#a9f0bc; background:#173727; }
        .contradicted { color:#ffc2c2; background:#482020; }
        .unresolved,.not_applicable { color:#ffe3a0; background:#413719; }
        .copy { white-space:pre-wrap; padding:18px; border-radius:12px; background:#090d18; color:#ece6d8; }
        code { color:#dbc7ff; overflow-wrap:anywhere; }
        pre { max-height:420px; overflow:auto; white-space:pre-wrap; color:#dfd2b8; font-size:.76rem; }
        @media(max-width:820px){ .metrics,.criteria,.beats{grid-template-columns:1fr;} }
      \`;
      render() {
        return html\`
          <main>
            <section>
              <div class="eyebrow">Evidence-bounded submission control</div>
              <h1>Competition Claim Hardening</h1>
              <p class="verdict"><strong>The strongest submission is the reproducible one—not the one that declares itself perfect.</strong> Keep the real eight-tool experience, show the evidence, and exclude invented events, engines, products, and payment authority.</p>
              <div class="metrics">
                <div class="metric"><strong>8 tools</strong>production contract</div>
                <div class="metric"><strong>3 events</strong>actual UI synchronization</div>
                <div class="metric"><strong>0</strong>agent payment authority</div>
              </div>
            </section>
            <section>
              <h2>Claim-to-code ledger</h2>
              <div class="table-wrap"><table><thead><tr><th>Proposed claim</th><th>Status</th><th>Required disposition</th></tr></thead><tbody .innerHTML=\${claimRows}></tbody></table></div>
            </section>
            <section>
              <h2>Judge-facing evidence, not self-scoring</h2>
              <div class="criteria">
                <div class="criterion"><strong>WebMCP Leverage</strong><p>Eight purpose-built tools operate the same visible reflection and card surfaces that people use.</p></div>
                <div class="criterion"><strong>Execution</strong><p>Strict schemas, confirmation gates, partial-registration rollback, character budgets, and three preserved live evaluation sets.</p></div>
                <div class="criterion"><strong>Potential Impact</strong><p>Natural-language guidance reduces navigation work while keeping private reflection local and consequential actions human-controlled.</p></div>
                <div class="criterion"><strong>Creativity &amp; Ambition</strong><p>A 144-card reflection system becomes agent-navigable without turning the browser agent into an identity, email, cart, or payment authority.</p></div>
              </div>
              <div class="metrics">
                <div class="metric"><strong>12 / 15</strong>baseline strict cases; 14 / 15 ordered</div>
                <div class="metric"><strong>10 / 10</strong>campaign tool selection and order</div>
                <div class="metric"><strong>6 / 6</strong>operational exact cases; 8 / 8 calls</div>
              </div>
            </section>
            <section>
              <h2>Corrected 2:35 demo</h2>
              <div class="beats">
                <div class="beat"><strong>0:00–0:18</strong><p>Open the live site. Show “WebMCP ready · 8 tools” and the visible experience.</p></div>
                <div class="beat"><strong>0:18–0:48</strong><p>Start the reflection, read the current question, and ask the agent to explain one choice.</p></div>
                <div class="beat"><strong>0:48–1:18</strong><p>Show that an unconfirmed answer is rejected. Confirm it and show the visible step transition.</p></div>
                <div class="beat"><strong>1:18–1:48</strong><p>Load a prepared eleven-answer state, confirm answer twelve, and complete deterministic local scoring.</p></div>
                <div class="beat"><strong>1:48–2:12</strong><p>Retrieve Card 004 and show its public Mirror prompt and bounded Loop action.</p></div>
                <div class="beat"><strong>2:12–2:35</strong><p>Recommend a digital ARC edition. Stop before Stripe and state the human authority boundary.</p></div>
              </div>
            </section>
            <section>
              <h2>Copy-ready Devpost core</h2>
              <div class="copy">MIRROR//LOOP turns a deterministic 12-question, 144-card reflection experience into a typed browser capability for AI agents. Eight WebMCP tools let an agent start or resume a reflection, explain choices, record only explicitly confirmed answers, review and revise the current browser session, complete local deterministic scoring, retrieve public cards, and recommend a digital edition.

The browser page remains the authority for state and visible outcomes. Private source corpora are not exposed. Email submission, cart changes, Stripe Checkout, and payment remain visible human actions. This is not an ephemeris, diagnosis, physical-product fulfillment system, or autonomous commerce agent.

The submitted evidence includes a 15-case baseline, a 10-case campaign boundary suite, and six operational scenarios executed through the production-discovered WebMCP contracts. Judges can reproduce the core path in Chrome DevTools: start, read, explain, reject an unconfirmed answer, confirm it, complete all twelve answers, retrieve Card 004, and request a digital-edition recommendation.</div>
            </section>
            <section>
              <h2>Release decision</h2>
              <p><strong>Freeze the eight-tool build.</strong> Do not add Tool 9, P2P exchange, an astronomical engine, physical fulfillment, or x402 before submission. Those features change privacy, consent, data-flow, product, or payment boundaries and require separate design and testing.</p>
              <p>Still external: public repository visibility, Devpost publication, a public captioned YouTube demo, anonymous-access checks, and operator rights/eligibility attestations.</p>
            </section>
            <section><h2>Embedded XML contract</h2><pre>\${xml}</pre></section>
          </main>
        \`;
      }
    }
    customElements.define("competition-hardening", CompetitionHardening);
  </script>
</body>
</html>
`;

writeFileSync(outputPath, html);
console.log(`WebMCP competition hardening audit: ${outputPath}`);
console.log(`Combined source SHA-256: ${combinedHash}`);
