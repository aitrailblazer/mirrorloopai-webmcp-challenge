# MIRROR//LOOP — WebMCP Challenge Submission Package

## Submission fields

**Project title:** MIRROR//LOOP — The Horizon Signal

**Tagline:** A privacy-bounded WebMCP reflection where people and agents turn
uncertainty into one confirmed next step.

**Live URL:** https://mirrorloopai.com/

**Source URL:** https://github.com/aitrailblazer/mirrorloopai-webmcp-challenge

**Video URL:** https://youtu.be/dcLbiYJrboI

## Copy-ready description

### Why this is a strong fit for WebMCP

MIRROR//LOOP is a deterministic 12-question reflection connected to a
144-card library. The useful actions already belong to the page: read the
current question, explain or compare choices, record a confirmed answer, review the
session, reveal a card, and identify a relevant edition. WebMCP exposes those
actions as eleven typed browser tools. The agent does not scrape visual controls
or replace the page with an opaque backend conversation; it collaborates with
the same interface the person can see and use directly.

### How WebMCP improves the user experience

The ordinary interface remains complete, while an agent can reduce navigation
and interpretation effort. A visitor can ask what a choice means, proceed one
confirmed answer at a time, correct an earlier answer without restarting, and
retrieve a specific card by number, preview how one hypothetical answer
would affect a completed result without saving it, or download the completed
result and all 12 choices locally after explicit confirmation. The page displays
`WebMCP ready · 11 tools`
when registration succeeds and an honest direct-use fallback when it does not.
A collapsible Agent State rail makes each tool start and completion legible on
the page, including a privacy-filtered input summary, observed local elapsed
time, success or error state, and an explicit human-confirmation badge.

### What humans and agents can now do together

The human owns purpose, meaning, and consent. The agent owns bounded navigation,
explanation, and retrieval. Together they can complete a structured reflection
without handing email, purchase, or payment authority to the agent. The final
recommendation leads to a human-visible collection page; adding an item and
starting Stripe Checkout remain explicit human actions. This combination of
conversational guidance and hard transaction boundaries was cumbersome with
generic DOM automation and is direct with WebMCP.

### How WebMCP is implemented

`web/lib/webmcp.js` defines eleven tools with JSON input schemas,
`additionalProperties: false`, behavioral annotations, and same-origin
registration through awaited `modelContext.registerTool(...)` calls. The installer selects
`document.modelContext` first and supports the compatible navigator surface.
Four tools can change browser-local state or create a local download; seven are
read-only.
`answer_reflection_question` requires `confirmed_by_user: true`. No tool can
submit an email address, mutate the cart, create a Checkout Session, or pay.
Automated tests validate registration, schemas, annotations, malformed inputs,
confirmation, revision, card lookup, commerce isolation, lifecycle-event
ordering, telemetry redaction, and the responsive Agent State rail.

### Verified core repository scope

- Eleven typed tools with closed JSON Schemas, bounded runtime validation, and
  structured tool errors.
- Explicit `confirmed_by_user: true` before an answer can be recorded or
  revised.
- Deterministic browser-side scoring of 12 answers with stable ascending-code tie-breaking;
  this scoring path performs no cloud computation.
- Curated public metadata for Cards 001–144 without publishing private prompt
  engineering or source corpora.
- Read-only digital-edition recommendations with email, cart, Checkout, and
  payment kept outside WebMCP authority.
- A production Origin Trial token, observed Chrome DevTools discovery, and
  automated registration and contract gates.

The installer reports readiness only after every registration resolves, aborts
partial registrations after rejection, and preserves the complete direct-use
experience. Current Chrome character budgets are enforced, including a
1,500-character result ceiling. An official-style expected-call corpus covers
all eleven tools, ordered flows, ambiguous requests, and no-tool boundaries.

The visible browser response is deliberately simple and inspectable: a
semantic 12-step progressbar updates `aria-valuenow`, its CSS width transition
tracks the current question, polite live regions report WebMCP and result
state, and focus moves to the active question or completed result. The
reduced-motion preference disables transitions and smooth scrolling. The
production document contains the WebMCP Origin Trial token and the runtime
feature-detects the supported model-context surface before falling back to the
complete manual experience. No SVG dial, frame-rate, zero-paint, or
compositor-thread claim is made.

## Judging criteria map

### WebMCP Leverage

- Eleven purpose-built tools operate the real page state and deterministic quiz.
- Typed schemas replace brittle control inference.
- An agent can explain, record, review, revise, complete, retrieve, and
  recommend across one coherent session.
- Evidence: `web/lib/webmcp.js`, `web/tests/webmcp.test.mjs`, and
  `web/evals/webmcp-evals.json`.

### Execution

- Live HTTPS production origin with a visible eleven-tool readiness state.
- On-page registration and invocation evidence without requiring DevTools.
- Strict schemas, read/write annotations, explicit answer confirmation, and
  graceful no-WebMCP fallback.
- Complete Node, Go, production, responsive, and security test evidence.
- Evidence: `feature_status_tracker.html` and `feature_qa_report.md`.

### Potential Impact

- Makes a dense 144-card reflective system approachable without requiring the
  visitor to learn its internal structure first.
- Preserves manual access and accessibility while adding agent assistance.
- Provides a reusable pattern for keeping identity, communication, cart, and
  payment actions outside agent authority.
- This is a product-design claim, not measured adoption; audience impact has
  not yet been empirically established.

### Creativity & Ambition

- Combines a visible card-based reflection, deterministic scoring, agent-guided
  correction, and contextual catalog discovery.
- Uses WebMCP as a bounded collaboration layer rather than an invisible
  autonomous buyer.
- Connects 12 questions to 144 public cards while keeping private research
  corpora and internal interpretive material out of the browser contract.

## Pre-existing work and challenge-period extension

The landing page, deterministic quiz, curated card/shop data, subscriber email
flow, Go backend, cloud deployment, and human-controlled Stripe Checkout
existed before the challenge began on August 25, 2026.

Meaningful WebMCP work was added after the challenge began:

| Commit | Date | Challenge-period work |
| --- | --- | --- |
| `ba15276` | 2026-08-29 | Seven secure reflection and card tools |
| `8ec0a6f` | 2026-08-29 | Eighth read-only edition recommendation tool |
| `b1b5bc3` | 2026-08-29 | Revision flow, conversion path, metadata, and audited fixes |
| `828ee7a` | 2026-08-29 | Immediately visible WebMCP readiness badge |

The repository history is the timestamped source of truth. The competition
entry claims only these documented extensions as challenge-period work.

## Demo video — verified 2:32 candidate

Use screen narration only or music for which the entrant owns all necessary
rights. Do not show secret dashboards, email addresses, payment details, or
third-party trademarks beyond what is necessary to demonstrate ordinary use.
The canonical second-by-second recording contract, evidence map, excluded-claim
list, and publication checklist are in
[`WEBMCP_DEMO_SHOT_LIST.html`](WEBMCP_DEMO_SHOT_LIST.html).

| Time | Visual | Narration focus |
| --- | --- | --- |
| 0:00–0:13 | MIRROR//LOOP logo, AITrailblazer identity, copyright, and WebMCP Challenge title card. | Establish who we are, what the competition explores, and why safer human-agent cooperation matters. |
| 0:13–0:28 | Product-and-problem card. | Explain MIRROR//LOOP as a non-diagnostic reflection for stressed people facing generic advice and pseudo-solutions. |
| 0:28–0:40 | Website-challenge card. | Explain the comprehension and navigation burden of 12 questions and 144 unfamiliar cards. |
| 0:40–0:52 | WebMCP solution card. | Define WebMCP as named, site-owned tools with validated inputs and structured results that replace scraping and guessing. |
| 0:52–1:03 | Competition-entry card. | Show one experience, two interfaces, and eleven bounded tools; the agent clarifies, the browser scores, and the person confirms. |
| 1:03–1:13 | Show `WebMCP ready · 11 tools` and the Agent State rail. | Make registration and tool activity visible without DevTools. |
| 1:13–1:29 | Start a reflection, request the current question, and compare two choices. | The agent clarifies using authoritative public language but does not rank or record. |
| 1:29–1:41 | Reject an unconfirmed answer, then confirm it and advance the visible flow. | Human authority is enforced in code. |
| 1:41–1:50 | Complete the twelve-answer result. | The browser's deterministic scorer produces the result; the agent does not invent it. |
| 1:50–2:03 | Preview one hypothetical change, then retrieve a public card. | The preview is provisional and the 144-card registry is exact and curated. |
| 2:03–2:20 | Request a matching digital edition and export the local dossier. | Commerce remains read-only; confirmed export downloads without email or an account. |
| 2:20–2:32 | Hold a dedicated MIRROR//LOOP ending screen with live and source URLs. | Meaning, identity, communication, cart, and payment remain under human control. |

The local candidate is 152.283 seconds, 1440×900 H.264 with AAC narration
spoken by Apple's installed `Ava (Premium)` voice at a measured 175-word-per-
minute setting. Sixteen scene cues synchronize the visible gold spotlight,
plain-language explanation rail, narration, and 36-caption SRT. Yellow open
captions are burned into a dedicated 180-pixel lower band so they do not cover
page content or bottom labels. The packaged audio/video drift is 1 millisecond,
the full decode check passes, and the
MP4 has SHA-256
`6618296d5eb76b1262fa21412cf414bce286d7fe7422dd7ce761cfa4ef6cae9c`.
The public YouTube upload is available at
https://youtu.be/dcLbiYJrboI. Anonymous playback was verified on
September 1, 2026: the public watch page loaded without an authenticated
YouTube session, exposed the published title, and reported the complete
2-minute-32-second media duration.

## Judge test path

1. In Chrome 149 or later, enable `chrome://flags/#enable-webmcp-testing`,
   restart Chrome, and open https://mirrorloopai.com/.
2. Confirm `WebMCP ready · 11 tools`.
3. Open DevTools and select **Application → WebMCP**. Confirm eleven entries
   under **Available Tools** and no schema errors.
4. Select each tool and use **Run tool**; inspect calls and results under
   **Invoked Tools**. Begin with `start_reflection`,
   `get_current_question`, `explain_choice`, `compare_choices`, and
   `preview_answer_impact`.
5. Call `compare_choices` with Question 1, Choices 01 and 06; verify that
   neither choice is selected or recorded.
6. Call `answer_reflection_question` first with
   `confirmed_by_user: false` and verify rejection; then use `true`.
7. Review and complete the session, then call `preview_answer_impact` and
   verify the result and saved answers remain unchanged.
8. Revise one prior answer with explicit confirmation.
9. Call `get_card` with `012`.
10. Call `recommend_card_edition` with an ARC and edition.
11. Add an unknown argument during a manual run and confirm the schema
   diagnostic is visible.
11. Verify no WebMCP tool can submit email, mutate a cart, create Checkout, or
   make payment.

For a deterministic judge preflight, run `npm run test:webmcp`. It starts its
own local server and headless Chrome, mounts all eleven tools through
`navigator.modelContext`, validates the current 18-case corpus, and proves the
confirmation, premature-completion, output-budget, and no-checkout boundaries.
The `npm run test:webmcp-eval` alias runs the same gate. A rejected tool call is
a structured `isError: true` WebMCP result—not an HTTP 400 response. A separate
live Gemini 2.5 Flash run used the
browser-discovered production contracts and real WebMCP execution path: 12/15
cases matched the frozen call-and-argument oracle exactly, 14/15 preserved the
required tool order, and all five protected boundary cases avoided forbidden
mutations. See `WEBMCP_AGENT_EVAL_REPORT.html` and
`qa_evidence/webmcp_agent_eval/latest.json`.

Every official challenge resource and its implementation decision is recorded
in `RESOURCE_REVIEW.html`.

Public campaign wording is separately reconciled against the production
contract in `WEBMCP_CAMPAIGN_CLAIM_AUDIT.html`. Its 10-case live-agent run
preserved the expected tool selection and order in every case and invoked no
tool for unsupported astronomy, physical-product, diagnosis, email-submission,
cart, or payment requests. The submission does not claim an ephemeris,
physical-deck fulfillment, autonomous purchase, diagnosis, or a universal
zero-server-data guarantee.

Six concrete operational demo scenarios are available in
`WEBMCP_OPERATIONAL_USE_CASES.html`. They preserve the founder, operator,
launch, sprint, team, and workspace contexts while mapping every agent action
to the production eleven-tool contract. A live Gemini/WebMCP Inspector run
matched all six frozen cases and all nine expected calls exactly.

The competition-wide claim matrix, verified 2:32 demo, and copy-ready
core are in `WEBMCP_COMPETITION_HARDENING_AUDIT.html`. This audit separates
implemented evidence from future concepts and explicitly excludes invented
events, P2P exchange, astronomical calculations, physical
fulfillment, x402, and autonomous payment from the submitted build.

The confirmed panel roster and six short, role-oriented reproduction paths are
in `WEBMCP_JUDGE_PANEL_BRIEF.html`. The brief uses public titles to organize
evidence; it does not infer judges' private preferences. It also rejects
undeployed astronomy, P2P, physical-product, universal zero-telemetry,
unmeasured bundle-performance, invented SVG/compositor behavior, zero-setup
claims, and self-awarded score claims. Its role-oriented verification matrix
gives technical reviewers a direct source-and-runtime path for agent
authority, schema discipline, measured delivery, disclosed data boundaries,
modular frontend structure, and human-controlled digital commerce.

Chrome is the verified path accepted by the rules. Actual ChatGPT in-app
browser behavior is still unconfirmed. Unsupported hosts retain the full direct
reflection and display a truthful fallback status.

## Final operator checklist

- [ ] Confirm entrant age, country/region eligibility, and authority to enter.
- [ ] Confirm ownership or authorized use of every submitted image, font,
      narrative, code component, and demo-video element.
- [x] Complete the final secret, personal-data, and private-corpus scan.
- [x] Make the GitHub repository public and confirm anonymous access.
- [x] Confirm the MIT license is visible in the repository root and About panel.
- [ ] Create the Devpost project and paste the copy-ready fields.
- [x] Record, narrate, caption, and locally verify the under-three-minute demo.
- [x] Publish the verified demo to YouTube and confirm anonymous playback.
- [ ] Add the verified Video URL above to Devpost.
- [x] Test the live site and public repository without authenticated access.
- [ ] Submit before September 3, 2026 at 1:00 PM PDT.

## Judging-window release freeze

Immediately before submission:

1. Run every verification command in `README.md`.
2. Tag the exact submitted commit `webmcp-challenge-submission`.
3. Record the deployed asset version and public URLs in the tracker evidence.
4. Confirm anonymous access to the site, repository, and YouTube video.
5. Stop changing the submitted repository, Devpost entry, and deployed site
   after the deadline.
6. If development must continue during judging, fork from the submitted commit
   and do not merge or deploy that work until judging ends.

Judging is scheduled from September 4, 2026 at 10:00 AM PDT through
September 21, 2026 at 5:00 PM PDT. Keep the submitted build freely accessible
through that period.
