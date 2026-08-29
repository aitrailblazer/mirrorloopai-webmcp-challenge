# MIRROR//LOOP — The Horizon Signal

MIRROR//LOOP is a live, privacy-bounded WebMCP reflection experience. A person
can ask an AI agent to guide a deterministic 12-question reflection, explain
choices, review or revise confirmed answers, reveal one of 144 cards, and
recommend a matching digital edition. The person remains in control of every
answer, email submission, cart change, and payment.

- **Live experience:** [mirrorloopai.com](https://mirrorloopai.com/)
- **Source:** [aitrailblazer/mirrorloopai-webmcp-challenge](https://github.com/aitrailblazer/mirrorloopai-webmcp-challenge)
- **Devpost package:** [SUBMISSION.md](SUBMISSION.md)
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

## Eight bounded tools

1. `start_reflection`
2. `get_current_question`
3. `explain_choice`
4. `answer_reflection_question`
5. `review_reflection_answers`
6. `complete_reflection`
7. `get_card`
8. `recommend_card_edition`

The production page visibly reports **WebMCP ready · 8 tools** after native
registration. The implementation uses the browser-native registration pattern:

```js
const modelContext =
  document.modelContext ?? navigator.modelContext;

modelContext.registerTool({
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

## What humans and agents do together

The human supplies intent and confirms choices. The agent can:

- start or resume the local reflection;
- read the active question and explain any choice;
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

**Added during the challenge after August 25, 2026:** the eight WebMCP tools,
strict schemas and annotations, explicit answer-confirmation boundary, prior
answer revision, public 144-card lookup, safe edition recommendation, visible
eight-tool readiness badge, production browser verification, conversion link
from result to the matching ARC, agent discovery metadata, and this submission
audit/package.

Timestamped evidence begins with commit `b9dddec` on August 29, 2026. The
edition recommendation was added in `2e58ce9`, the broader audited experience
in `9740b57`, and the visible readiness badge in `592c08a`.

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
3. Confirm the header reads **WebMCP ready · 8 tools**.
4. Inspect the page's registered tools.
5. Run `start_reflection`, `get_current_question`, and `explain_choice`.
6. Confirm an answer with `confirmed_by_user: true`.
7. Complete the reflection, call `get_card`, and call
   `recommend_card_edition`.
8. Verify that no tool can submit email, mutate the cart, create Checkout, or
   make a payment.

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
