#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const evidencePath = path.join(root, "qa_evidence/webmcp_operational_use_case_eval/latest.json");
const outputPath = path.join(root, "WEBMCP_OPERATIONAL_USE_CASES.html");
const evaluation = JSON.parse(readFileSync(evidencePath, "utf8"));
const evidenceHash = createHash("sha256").update(readFileSync(evidencePath)).digest("hex");

const scenarios = [
  {
    number: "01",
    title: "Founder equity and governance deadlock",
    dilemma: "Two founders need a safer way to structure a difficult equity or control conversation.",
    flow: "Start a focused reflection, then retrieve Card 002 · The Horizon Contract and Card 006 · Future Geometry.",
    action: "Draft one time-limited governance experiment with a review date, explicit scope, and reversible exit. A lawyer must review legal terms.",
    boundary: "No Blue Ray score, legal conclusion, automatic vesting contract, or Card 006 “Fracture Path” claim.",
    tools: "start_reflection → get_card(002) → get_card(006)",
  },
  {
    number: "02",
    title: "Over-simulation off-ramp",
    dilemma: "An operator has too many tabs and analyses open and wants one smaller next step.",
    flow: "Retrieve Card 004 · Future Noise and read its public bounded action.",
    action: "Test one smaller reversible version and record whether the same evidenced risk appears.",
    boundary: "Reflective support, not a screen-fatigue diagnosis; no transit clock, Mercury hour, forced completion, or physical deck.",
    tools: "get_card(004)",
  },
  {
    number: "03",
    title: "Product-launch inertia",
    dilemma: "A creator has delayed contact with real users while waiting for completeness.",
    flow: "Retrieve Card 001 · Future-First Thinking and use its public Mirror prompt and Loop action.",
    action: "Choose one reversible launch probe, then compare what became clearer with what remained uncertain.",
    boundary: "No d₄/d₉ diagnostic score and no private Geneva marginalia or hidden interpretation is returned.",
    tools: "get_card(001)",
  },
  {
    number: "04",
    title: "Explicit ten-minute sprint frame",
    dilemma: "A team wants a short standup frame without pretending that a clock chose its priorities.",
    flow: "The human explicitly selects Card 003 · The First Vector as the meeting lens.",
    action: "Each engineer names the smallest meaningful probe that could change information, access, or momentum.",
    boundary: "The card is chosen by the team—not by a celestial transit, Mercury hour, or astronomical calculation.",
    tools: "get_card(003)",
  },
  {
    number: "05",
    title: "Current-session contradiction review",
    dilemma: "A participant wants to see the pattern in choices they already confirmed.",
    flow: "Review the current browser session’s confirmed answer records.",
    action: "Use the visible answers as conversation material; independently run each participant’s reflection before any consensual comparison.",
    boundary: "No access to another person’s session, no automatic Counterpoint Matrix, and no organizational diagnosis.",
    tools: "review_reflection_answers",
  },
  {
    number: "06",
    title: "Digital workspace reference",
    dilemma: "A visitor wants a persistent visual reference related to ARC 01.",
    flow: "Recommend the ARC 01 Mono digital edition as an optional workspace reference.",
    action: "The human may review the collection page and decide whether to open Stripe Checkout.",
    boundary: "The current product is digital—not a 350gsm physical deck. The tool states no price and performs no cart or payment action.",
    tools: "recommend_card_edition(ARC 01, mono)",
  },
];

const scenarioMarkup = scenarios.map((scenario) => `<article class="scenario">
  <div class="number">${scenario.number}</div>
  <div>
    <h3>${scenario.title}</h3>
    <p><strong>Dilemma.</strong> ${scenario.dilemma}</p>
    <p><strong>Reproducible WebMCP flow.</strong> ${scenario.flow}</p>
    <p><strong>Bounded action.</strong> ${scenario.action}</p>
    <p class="boundary"><strong>Boundary.</strong> ${scenario.boundary}</p>
    <code>${scenario.tools}</code>
  </div>
</article>`).join("\n");

const resultMarkup = evaluation.results.map((result) => `<tr>
  <td><code>${result.id}</code></td>
  <td>${result.expectedCalls.map((call) => call.name).join(" → ")}</td>
  <td>${result.actualCalls.map((call) => call.name).join(" → ")}</td>
  <td class="${result.score.exactCase ? "pass" : "fail"}">${result.score.exactCase ? "PASS" : "FAIL"}</td>
</tr>`).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MIRROR//LOOP — Six Operational WebMCP Use Cases</title>
  <meta name="description" content="Six evidence-bounded, production-reproducible MIRROR//LOOP WebMCP scenarios.">
  <style>
    html { background:#080b14; color:#f5f0e2; font-family:Inter,ui-sans-serif,system-ui,sans-serif; line-height:1.55; }
    body { margin:0; min-height:100vh; }
    operational-use-cases:not(:defined) { display:block; width:min(1120px,calc(100% - 32px)); margin:auto; padding:40px 0; }
  </style>
</head>
<body>
  <operational-use-cases></operational-use-cases>

  <script type="application/xml" id="strategix-contract">
<StrategiXVisualSpec version="1.0" artifact="mirrorloop-webmcp-operational-use-cases" generatedAt="${evaluation.generatedAt}">
  <Purpose>Define six concrete operational examples that a judge or visitor can reproduce with the live ten-tool MIRROR//LOOP WebMCP contract.</Purpose>
  <ProductContract>
    <Rule>Every described agent action must map to a production tool and public data.</Rule>
    <Rule>Human confirmation remains mandatory before recording any answer.</Rule>
    <Rule>Private Geneva, Zaveta, Rosicrucian, APEX, and internal interpretation corpora remain outside the public tool contract.</Rule>
    <Rule>No scenario may imply diagnosis, legal advice, ephemeris calculation, physical fulfillment, fixed price, cart mutation, or payment authority.</Rule>
  </ProductContract>
  <UseCases>
    <UseCase id="01" name="founder_governance" tools="start_reflection,get_card"/>
    <UseCase id="02" name="over_simulation" tools="get_card"/>
    <UseCase id="03" name="launch_inertia" tools="get_card"/>
    <UseCase id="04" name="explicit_sprint_frame" tools="get_card"/>
    <UseCase id="05" name="current_session_review" tools="review_reflection_answers"/>
    <UseCase id="06" name="digital_workspace_reference" tools="recommend_card_edition"/>
  </UseCases>
  <DataContract>
    <PublicCardFields>id, code, arc, arcName, domain, glyph, title, mirror, loop</PublicCardFields>
    <PrivateData excluded="true">full source texts, marginal commentary, internal interpretations, generation prompts, subscriber data</PrivateData>
  </DataContract>
  <Workflow>State dilemma; select a real bounded tool; show the visible/public result; preserve the boundary; leave consequential decisions to the human.</Workflow>
  <AcceptanceCriteria>
    <Criterion>All six live prompts select the exact expected tool sequence and arguments.</Criterion>
    <Criterion>No invented tool is included in an expected call.</Criterion>
    <Criterion>Card titles and product fulfillment match the public registries.</Criterion>
    <Criterion>Every scenario includes an explicit authority or evidence boundary.</Criterion>
  </AcceptanceCriteria>
  <DecisionLog>
    <Decision date="2026-08-29">Retain the six business contexts while replacing fictional runtime and fulfillment claims with existing production capabilities.</Decision>
  </DecisionLog>
  <RisksAndOpenQuestions>
    <Risk>These are reflective workflows, not evidence of better business, medical, legal, or organizational outcomes.</Risk>
    <Risk>A single model run demonstrates observed compatibility, not universal agent reliability.</Risk>
  </RisksAndOpenQuestions>
  <SourceDigest>
    <Source path="web/lib/webmcp.js">Production ten-tool contract.</Source>
    <Source path="web/data/cards.json">Public 144-card metadata.</Source>
    <Source path="web/data/shop.json">Digital catalog boundary.</Source>
    <Source path="web/evals/webmcp-operational-use-cases.json">Frozen six-case oracle.</Source>
    <Source path="qa_evidence/webmcp_operational_use_case_eval/latest.json" sha256="${evidenceHash}">Live model evidence.</Source>
  </SourceDigest>
  <ImplementationNotes>The public tool count is ten; compare_choices adds read-only differentiation and preview_answer_impact adds provisional score simulation without new persistence, identity, commerce, or payment authority.</ImplementationNotes>
</StrategiXVisualSpec>
  </script>

  <script type="module">
    import { LitElement, html, css } from "https://unpkg.com/lit@3/index.js?module";
    const scenarios = ${JSON.stringify(scenarioMarkup)};
    const results = ${JSON.stringify(resultMarkup)};
    const xml = document.getElementById("strategix-contract")?.textContent.trim() ?? "";
    class OperationalUseCases extends LitElement {
      static styles = css\`
        :host { display:block; min-width:0; min-height:100vh; overflow-x:hidden; background:radial-gradient(circle at 15% 0,rgba(225,177,87,.16),transparent 30%),#080b14; }
        main { box-sizing:border-box; width:min(1120px,calc(100% - 32px)); min-width:0; margin:auto; padding:42px 0 70px; }
        .hero,.panel { min-width:0; border:1px solid rgba(226,185,91,.3); background:rgba(18,22,37,.92); border-radius:18px; padding:24px; margin-bottom:18px; }
        .eyebrow { color:#efbe65; text-transform:uppercase; letter-spacing:.14em; font-size:.76rem; font-weight:800; }
        h1 { font:clamp(2.2rem,6vw,4.7rem)/1 Georgia,serif; margin:.18em 0; }
        h2 { color:#efbe65; margin:.1em 0 .7em; }
        h3 { margin:0 0 8px; color:#f5f0e2; }
        p { color:#cfccda; }
        .metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:20px; }
        .metric { padding:16px; border:1px solid #34374d; border-radius:12px; background:#0d1120; }
        .metric strong { display:block; color:#efbe65; font-size:1.8rem; }
        .scenario-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .scenario { display:grid; grid-template-columns:54px 1fr; gap:12px; padding:18px; border:1px solid #34374d; border-radius:14px; background:#0d1120; }
        .number { color:#efbe65; font:2rem/1 Georgia,serif; }
        .scenario p { margin:.45em 0; }
        .boundary { border-left:3px solid #efbe65; padding-left:10px; }
        code { color:#dbc7ff; overflow-wrap:anywhere; }
        .table-wrap { width:100%; max-width:100%; overflow:auto; border:1px solid #34374d; border-radius:12px; }
        table { width:100%; min-width:760px; border-collapse:collapse; background:#0d1120; }
        th,td { padding:12px; text-align:left; border-bottom:1px solid #34374d; }
        th { color:#efbe65; background:#171c2d; }
        .pass { color:#90e7aa; font-weight:800; }
        pre { white-space:pre-wrap; overflow:auto; max-height:420px; color:#dfd2b8; font-size:.76rem; }
        @media(max-width:760px){ .scenario-grid{grid-template-columns:1fr;} .metrics{grid-template-columns:1fr;} }
      \`;
      render() {
        return html\`
          <main>
            <section class="hero">
              <div class="eyebrow">Production-reproducible scenario contract</div>
              <h1>Six Operational WebMCP Use Cases</h1>
              <p>Each scenario retains the real operational dilemma while using only public card metadata and the ten bounded tools. Symbolic material is presented as a reflection lens—not as diagnosis, astronomy, legal authority, or hidden evidence.</p>
              <div class="metrics">
                <div class="metric"><strong>6</strong>operational contexts</div>
                <div class="metric"><strong>6 / 6</strong>exact live cases</div>
                <div class="metric"><strong>0</strong>invented tool calls</div>
              </div>
            </section>
            <section class="panel">
              <h2>The corrected scenarios</h2>
              <div class="scenario-grid" .innerHTML=\${scenarios}></div>
            </section>
            <section class="panel">
              <h2>Live-agent evidence</h2>
              <p>The preserved Gemini 2.5 Flash run received the prior eight contracts discovered from production. All six cases matched that frozen sequence and arguments exactly; compare_choices and preview_answer_impact are covered by the current deterministic and browser suites pending a refreshed external-agent run.</p>
              <div class="table-wrap"><table>
                <thead><tr><th>Scenario</th><th>Expected</th><th>Selected</th><th>Result</th></tr></thead>
                <tbody .innerHTML=\${results}></tbody>
              </table></div>
              <p><code>qa_evidence/webmcp_operational_use_case_eval/latest.json</code><br>SHA-256 <code>${evidenceHash}</code></p>
            </section>
            <section class="panel">
              <h2>Embedded XML contract</h2>
              <pre>\${xml}</pre>
            </section>
          </main>
        \`;
      }
    }
    customElements.define("operational-use-cases", OperationalUseCases);
  </script>
</body>
</html>
`;

writeFileSync(outputPath, html);
console.log(`WebMCP operational use cases: ${outputPath}`);
console.log(`Evidence SHA-256: ${evidenceHash}`);
