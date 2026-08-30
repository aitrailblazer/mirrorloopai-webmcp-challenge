# MIRROR//LOOP — WebMCP Challenge Submission Package

## Submission fields

**Project title:** MIRROR//LOOP — The Horizon Signal

**Tagline:** A privacy-bounded WebMCP reflection where people and agents turn
uncertainty into one confirmed next step.

**Live URL:** https://mirrorloopai.com/

**Source URL:** https://github.com/aitrailblazer/mirrorloopai-webmcp-challenge

**Video URL:** PENDING — public YouTube URL required before submission.

## Copy-ready description

### Why this is a strong fit for WebMCP

MIRROR//LOOP is a deterministic 12-question reflection connected to a
144-card library. The useful actions already belong to the page: read the
current question, explain a choice, record a confirmed answer, review the
session, reveal a card, and identify a relevant edition. WebMCP exposes those
actions as eight typed browser tools. The agent does not scrape visual controls
or replace the page with an opaque backend conversation; it collaborates with
the same interface the person can see and use directly.

### How WebMCP improves the user experience

The ordinary interface remains complete, while an agent can reduce navigation
and interpretation effort. A visitor can ask what a choice means, proceed one
confirmed answer at a time, correct an earlier answer without restarting, and
retrieve a specific card by number. The page displays `WebMCP ready · 8 tools`
when registration succeeds and an honest direct-use fallback when it does not.

### What humans and agents can now do together

The human owns purpose, meaning, and consent. The agent owns bounded navigation,
explanation, and retrieval. Together they can complete a structured reflection
without handing email, purchase, or payment authority to the agent. The final
recommendation leads to a human-visible collection page; adding an item and
starting Stripe Checkout remain explicit human actions. This combination of
conversational guidance and hard transaction boundaries was cumbersome with
generic DOM automation and is direct with WebMCP.

### How WebMCP is implemented

`web/lib/webmcp.js` defines eight tools with JSON input schemas,
`additionalProperties: false`, behavioral annotations, and same-origin
registration through awaited `modelContext.registerTool(...)` calls. The installer selects
`document.modelContext` first and supports the compatible navigator surface.
Three tools change only ephemeral local reflection state; five are read-only.
`answer_reflection_question` requires `confirmed_by_user: true`. No tool can
submit an email address, mutate the cart, create a Checkout Session, or pay.
Automated tests validate registration, schemas, annotations, malformed inputs,
confirmation, revision, card lookup, and commerce isolation.

The installer reports readiness only after every registration resolves, aborts
partial registrations after rejection, and preserves the complete direct-use
experience. Current Chrome character budgets are enforced, including a
1,500-character result ceiling. An official-style expected-call corpus covers
all eight tools, ordered flows, ambiguous requests, and no-tool boundaries.

## Judging criteria map

### WebMCP Leverage

- Eight purpose-built tools operate the real page state and deterministic quiz.
- Typed schemas replace brittle control inference.
- An agent can explain, record, review, revise, complete, retrieve, and
  recommend across one coherent session.
- Evidence: `web/lib/webmcp.js`, `web/tests/webmcp.test.mjs`, and
  `web/evals/webmcp-evals.json`.

### Execution

- Live HTTPS production origin with a visible eight-tool readiness state.
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
| `b9dddec` | 2026-08-29 | Seven secure reflection and card tools |
| `2e58ce9` | 2026-08-29 | Eighth read-only edition recommendation tool |
| `9740b57` | 2026-08-29 | Revision flow, conversion path, metadata, and audited fixes |
| `592c08a` | 2026-08-29 | Immediately visible `WebMCP ready · 8 tools` badge |

The repository history is the timestamped source of truth. The competition
entry claims only these documented extensions as challenge-period work.

## Demo video script — target 2:35

Use screen narration only or music for which the entrant owns all necessary
rights. Do not show secret dashboards, email addresses, payment details, or
third-party trademarks beyond what is necessary to demonstrate ordinary use.

| Time | Visual | Narration |
| --- | --- | --- |
| 0:00–0:15 | Open the live homepage and point to `WebMCP ready · 8 tools`. | “MIRROR//LOOP turns a 12-question reflection and 144 cards into a bounded human-agent collaboration.” |
| 0:15–0:35 | Show the registered tool list. | “The page registers eight typed tools. They operate the visible experience rather than a hidden replacement service.” |
| 0:35–1:05 | Ask the agent to start, read the question, and explain one choice. | “The agent can orient and explain, but it cannot choose for me.” |
| 1:05–1:30 | Confirm an answer, advance, then revise the earlier answer. | “Every recorded choice requires explicit confirmation, and I can correct a prior answer without restarting.” |
| 1:30–1:55 | Review and complete the reflection. | “Scoring stays deterministic in the page. The agent guides the flow; it does not invent the result.” |
| 1:55–2:15 | Retrieve Card 012 and request a matching edition. | “The same contract exposes all 144 public cards and a price-free, read-only edition recommendation.” |
| 2:15–2:35 | Open the collection page manually and stop before checkout. | “Email, cart changes, and payment remain human actions. WebMCP adds assistance without taking control.” |

Before publishing, verify the final video is under three minutes, publicly
viewable on YouTube, audible, captioned, and demonstrates the deployed build.

## Judge test path

1. In Chrome 149 or later, enable `chrome://flags/#enable-webmcp-testing`,
   restart Chrome, and open https://mirrorloopai.com/.
2. Confirm `WebMCP ready · 8 tools`.
3. Open DevTools and select **Application → WebMCP**. Confirm eight entries
   under **Available Tools** and no schema errors.
4. Select each tool and use **Run tool**; inspect calls and results under
   **Invoked Tools**. Begin with `start_reflection`,
   `get_current_question`, and `explain_choice`.
5. Call `answer_reflection_question` first with
   `confirmed_by_user: false` and verify rejection; then use `true`.
6. Review, revise one prior answer, and complete the session.
7. Call `get_card` with `012`.
8. Call `recommend_card_edition` with an ARC and edition.
9. Add an unknown argument during a manual run and confirm the schema
   diagnostic is visible.
10. Verify no WebMCP tool can submit email, mutate a cart, create Checkout, or
   make payment.

For a deterministic preflight, run `npm run test:webmcp:evals`. It validates
the expected intent-to-tool, arguments, ordering, and no-tool cases in
`web/evals/webmcp-evals.json`. A separate live Gemini 2.5 Flash run used the
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

Chrome is the verified path accepted by the rules. Actual ChatGPT in-app
browser behavior is still unconfirmed. Unsupported hosts retain the full direct
reflection and display a truthful fallback status.

## Final operator checklist

- [ ] Confirm entrant age, country/region eligibility, and authority to enter.
- [ ] Confirm ownership or authorized use of every submitted image, font,
      narrative, code component, and demo-video element.
- [ ] Complete the final secret, personal-data, and private-corpus scan.
- [ ] Make the GitHub repository public and confirm anonymous access.
- [ ] Confirm the MIT license is visible in the repository root and About panel.
- [ ] Create the Devpost project and paste the copy-ready fields.
- [ ] Record, caption, and publish the under-three-minute YouTube demo.
- [ ] Replace the pending Video URL above and in Devpost.
- [ ] Test the live site and public repository from a signed-out browser.
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
