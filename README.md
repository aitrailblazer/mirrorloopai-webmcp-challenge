# MIRROR//LOOP — The Horizon Signal

MIRROR//LOOP is a live, privacy-bounded WebMCP reflection experience. A person
can ask an AI agent to guide a deterministic 12-question reflection, explain
choices, review or revise confirmed answers, reveal one of 144 cards, and
recommend a matching digital edition. The person remains in control of every
answer, email submission, cart change, and payment.

- **Live experience:** [mirrorloopai.com](https://mirrorloopai.com/)
- **Source:** [aitrailblazer/mirrorloopai-webmcp-challenge](https://github.com/aitrailblazer/mirrorloopai-webmcp-challenge)
- **Devpost package:** [SUBMISSION.md](SUBMISSION.md)
- **Official resource review:** [RESOURCE_REVIEW.html](RESOURCE_REVIEW.html)
- **Campaign claim audit and copy:** [WEBMCP_CAMPAIGN_CLAIM_AUDIT.html](WEBMCP_CAMPAIGN_CLAIM_AUDIT.html)
- **Six operational scenarios:** [WEBMCP_OPERATIONAL_USE_CASES.html](WEBMCP_OPERATIONAL_USE_CASES.html)
- **Competition claim hardening:** [WEBMCP_COMPETITION_HARDENING_AUDIT.html](WEBMCP_COMPETITION_HARDENING_AUDIT.html)
- **Judge panel evidence brief:** [WEBMCP_JUDGE_PANEL_BRIEF.html](WEBMCP_JUDGE_PANEL_BRIEF.html)
- **2:35 recording shot list:** [WEBMCP_DEMO_SHOT_LIST.html](WEBMCP_DEMO_SHOT_LIST.html)
- **License:** [MIT](LICENSE)

> **Submission gate:** this repository remains private until the operator
> completes the final secret/IP review and explicitly changes its visibility.
> The WebMCP Challenge requires the final repository to be public.

## Why WebMCP fits

The reflection already lives in a web interface, but its twelve questions,
144-card library, and edition catalog create navigation work. WebMCP lets a
compatible browser agent operate those existing page capabilities rather than
scraping prose or calling a hidden replacement API. The page remains the
authority for state, scoring, card data, and visible outcomes.

The result is a better user experience: a person can ask for clarification in
natural language, proceed one confirmed choice at a time, revisit an earlier
answer, and move from reflection to a relevant card without surrendering
control of identity or payment.

## Verified core repository scope

1. **Ten typed tools.** Strict JSON Schemas reject unknown properties, while
   bounded runtime checks validate identifiers, enumerations, lengths, and
   adapter availability before returning structured tool errors.
2. **Enforced human confirmation.** `answer_reflection_question` records or
   revises a choice only when `confirmed_by_user: true`.
3. **Deterministic browser scoring.** Exactly 12 answers produce dominant and
   supporting archetypes with stable ascending-code tie-breaking. This scoring
   path performs no cloud computation.
4. **Complete 144-card public matrix.** `get_card` exposes curated public
   metadata for Cards 001–144 without publishing private prompts or corpora.
5. **Safe commerce boundary.** `recommend_card_edition` maps a reflection to a
   real digital edition but returns no price, cart mutation, Checkout Session,
   or payment action.
6. **Verified Chrome deployment.** The production document contains the WebMCP
   Origin Trial token, native registration has been observed in Chrome
   DevTools, and the repository carries automated registration and contract
   gates.

## Ten bounded tools

1. `start_reflection`
2. `get_current_question`
3. `explain_choice`
4. `compare_choices`
5. `preview_answer_impact`
6. `answer_reflection_question`
7. `review_reflection_answers`
8. `complete_reflection`
9. `get_card`
10. `recommend_card_edition`

The production page visibly reports **WebMCP ready · 10 tools** after native
registration. Its collapsible **Agent state** rail then makes registration and
tool execution visible without DevTools: it shows the active tool, an
allowlisted input summary, observed local elapsed time, outcome, and whether an
answer carried explicit human confirmation. It never displays private focus
text or tool results. The implementation uses the browser-native registration
pattern:

```js
const modelContext =
  document.modelContext ?? navigator.modelContext;

await modelContext.registerTool({
  name: "get_current_question",
  description: "Read the active reflection question.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  execute: async () => readCurrentQuestion(),
});
```

The production implementation is in [`web/lib/webmcp.js`](web/lib/webmcp.js).
It supports the current `document.modelContext` surface and a compatible
`navigator.modelContext` fallback.

All schemas reject unknown properties. No cross-origin `exposedTo` grant is
configured. Recording or revising an answer requires an explicit
`confirmed_by_user` value. The recommendation tool is read-only and returns no
price or direct Stripe URL. Email submission, cart mutation, Checkout creation,
and payment are deliberately not WebMCP tools.

Registration is considered ready only after all ten registration promises
resolve. A rejection aborts the partial tool set and activates the normal
direct-use fallback. Tool names, descriptions, parameter descriptions, and
individual results are checked against the current Chrome WebMCP character
budgets; each result is capped at 1,500 characters.

The runtime emits `mirrorloop:webmcp_status`, `mirrorloop:tool_start`, and
`mirrorloop:tool_complete` DOM events. The visual rail consumes those events
without becoming part of tool execution, so an observability failure cannot
interrupt a reflection action. Displayed timings are measurements from the
current browser invocation, not performance guarantees.

## What humans and agents do together

The human supplies intent and confirms choices. The agent can:

- start or resume the local reflection;
- read the active question, explain any choice, and neutrally contrast two choices;
- record only a choice the human explicitly confirms;
- review answers and revise an earlier confirmed choice;
- complete the deterministic reflection;
- retrieve any public Card 001–144; and
- recommend a relevant digital edition without initiating checkout.

This was difficult with ordinary page automation because the agent had to infer
controls from presentation markup. WebMCP exposes typed, purpose-built actions
while preserving the page's normal visual flow and human decision points.

## Before and during the challenge

**Pre-existing before August 25, 2026:** the public landing page, deterministic
12-question quiz, curated card/shop data, subscriber email flow, Go backend,
Firebase/Cloud Run deployment, and human-controlled Stripe Checkout.

**Added during the challenge after August 25, 2026:** the nine WebMCP tools,
strict schemas and annotations, explicit answer-confirmation boundary, prior
answer revision, public 144-card lookup, safe edition recommendation, visible
ten-tool readiness badge, production browser verification, conversion link
from result to the matching ARC, agent discovery metadata, and this submission
audit/package.

Timestamped evidence begins with commit `ba15276` on August 29, 2026. The
edition recommendation was added in `8ec0a6f`, the broader audited experience
in `b1b5bc3`, and the visible readiness badge in `828ee7a`.

## Local setup

### Prerequisites

- Node.js 20 or newer
- Go 1.25 or the compatible toolchain declared in [`go.mod`](go.mod)
- Python 3 for the zero-build static development server
- Optional: Firebase CLI for deployment
- Optional: Chrome 149 or later with
  `chrome://flags/#enable-webmcp-testing` enabled for native tool inspection

No dependency installation is required for the static site tests.

### Run the public web experience

```bash
make serve-web
```

Open [http://localhost:8000](http://localhost:8000). Browsers without WebMCP
show **WebMCP unavailable · direct reflection ready** and retain the complete
manual experience.

### Verify

```bash
npm test
npm run test:webmcp:evals
npm run test:webmcp:agent-evidence
npm run test:webmcp:hud:browser
npm run test:stripe
npm run validate
npm run validate:submission
go test ./...
go vet ./...
```

`validate:submission` validates the local judge package and reports external
gates separately. It does not publish the repository, create a Devpost project,
or upload a video.

### Test native WebMCP

1. Use Chrome 149 or later, enable
   `chrome://flags/#enable-webmcp-testing`, and restart Chrome.
2. Open `https://mirrorloopai.com/`.
3. Confirm the header reads **WebMCP ready · 10 tools**.
4. Open DevTools, select **Application → WebMCP**, and confirm all ten tools
   appear under **Available Tools** with no schema errors.
5. Select a tool and use **Run tool** to invoke `start_reflection`,
   `get_current_question`, `explain_choice`, `compare_choices`, and
   `preview_answer_impact`; inspect each record under
   **Invoked Tools**.
6. Confirm an answer with `confirmed_by_user: true`, then deliberately try an
   unknown field and verify the schema violation is visible.
7. Complete the reflection, preview one changed answer without saving it, call
   `get_card`, and call
   `recommend_card_edition`.
8. Verify that no tool can submit email, mutate the cart, create Checkout, or
   make a payment.

The machine-readable intent corpus in
[`web/evals/webmcp-evals.json`](web/evals/webmcp-evals.json) covers all ten
tools, ordered flows, ambiguous requests, and no-tool email/cart/payment cases.
`npm run test:webmcp:evals` validates that corpus deterministically. A live
host-agent run is recorded in
[`WEBMCP_AGENT_EVAL_REPORT.html`](WEBMCP_AGENT_EVAL_REPORT.html). Gemini 2.5
Flash selected the exact frozen tool sequence and arguments in 12 of 15 cases
(80.0%), placed the required tools in order in 14 of 15 cases (93.3%), and
performed no forbidden mutation in any of the five safety-boundary cases.
Raw, credential-free evidence is retained under
`qa_evidence/webmcp_agent_eval/`.

The final competition narrative and 2:35 demo are reconciled in
`WEBMCP_COMPETITION_HARDENING_AUDIT.html`. It deliberately does not self-award
judging scores or claim nonexistent browser events, astronomy, P2P exchange,
physical fulfillment, x402, diagnosis, or autonomous payment.

The confirmed seven-person panel is oriented to the same reproducible evidence
in `WEBMCP_JUDGE_PANEL_BRIEF.html`. That brief uses public roles only to
organize inspection paths; it does not attribute private preferences to judges.
Its Chrome UX ledger documents the actual semantic progressbar, live regions,
focus changes, reduced-motion behavior, Origin Trial token, and direct-use
fallback. It explicitly rejects invented SVG, `requestAnimationFrame`,
compositor, frame-rate, zero-paint, zero-setup, and total-dependency claims.
The same brief includes a six-role, role-oriented verification matrix for
human-agent authority, typed tool contracts, measured delivery, privacy
boundaries, frontend architecture, and commercial utility. Each path contains
supported evidence, a correction to the supplied overclaim, and a reproducible
judge check; none attributes private preferences or predicts a score.

A separate campaign corpus tests the concrete scenarios used in public
promotion, including the negative boundaries. Gemini 2.5 Flash selected the
expected production tool sequence in all 10 cases and invoked no tool for any
of the five unsupported or protected requests: ephemeris/Yellow Ray
calculation, a physical deck, autonomous commerce, diagnosis, and automatic
email submission. Two calls normalized optional arguments, so strict
call-and-argument equality was 8/10. The claim matrix, corrected copy, and
evidence links are in
[`WEBMCP_CAMPAIGN_CLAIM_AUDIT.html`](WEBMCP_CAMPAIGN_CLAIM_AUDIT.html).

Six business-oriented examples for founder governance, over-simulation,
product-launch inertia, explicit sprint framing, current-session review, and a
digital workspace reference are specified in
[`WEBMCP_OPERATIONAL_USE_CASES.html`](WEBMCP_OPERATIONAL_USE_CASES.html).
All six matched their exact production tool sequence and arguments in a live
Gemini/WebMCP Inspector run. These examples explicitly exclude diagnostic,
astronomical, legal, private-corpus, physical-product, price, cart, and payment
claims.

The live runner requires Chrome for Testing 150+, an unpacked WebMCP Inspector,
an isolated browser profile, and authenticated Google Cloud ADC:

```bash
WEBMCP_EVAL_PROFILE_DIR=/tmp/isolated-webmcp-profile \
WEBMCP_INSPECTOR_EXTENSION_DIR=/path/to/webmcp-inspector \
WEBMCP_EVAL_CHROME_PATH=/path/to/chrome-for-testing \
WEBMCP_AGENT_BACKEND=vertex \
WEBMCP_VERTEX_PROJECT=your-project \
npm run eval:webmcp:agent
npm run report:webmcp:agent-evals
```

Do not point the runner at an active personal browser profile. The runner
records only credential presence; it never writes credential values to its
evidence bundle.

Connected Chrome is the verified competition path. Actual ChatGPT in-app
browser WebMCP support remains unconfirmed; if its host does not expose WebMCP,
the site truthfully falls back to the complete direct experience.

## Backend and deployment boundary

The public static site is served by Firebase Hosting. `/api/**` is rewritten to
the Go service on Cloud Run. Firestore, Secret Manager, Cloudflare Turnstile,
Resend, and Stripe are server-side integrations.

Production secrets are never stored in this repository. Local backend work uses
a Git-ignored `.env`; see `api/cmd/server/main.go` for accepted environment
variables. The default public review does not require production credentials:
the static experience and all WebMCP tests run without them.

Hosting deployment:

```bash
firebase deploy --only hosting
```

Do not deploy after the submission deadline from the competition branch. See
the freeze procedure in [SUBMISSION.md](SUBMISSION.md).

## Public-data boundary

The repository contains a deliberately reduced public registry for Cards
001–144: identifier, ARC, title, glyph, domain, Mirror prompt, and bounded Loop
action. It excludes image-generation prompts, internal evaluations, subscriber
records, production exports, credentials, and private Rosicrucian, Geneva
Bible, Zaveta, and APEX corpora.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for external services and
the operator attestation checklist.
