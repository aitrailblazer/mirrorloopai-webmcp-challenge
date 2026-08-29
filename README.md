# MIRROR//LOOP — WebMCP Challenge

Private competition workspace for the public MIRROR//LOOP experience at
[mirrorloopai.com](https://mirrorloopai.com/).

## Included

- The static MIRROR//LOOP website and 12-question reflection quiz.
- Curated card and shop data used by the public experience.
- The Go submission, email, analytics, inbound-mail, and Stripe integration.
- Firebase and Cloud Run deployment configuration.
- Automated tests, validation scripts, and sanitized QA evidence.
- The Chrome WebMCP origin-trial enrollment for `mirrorloopai.com`.

## Deliberately excluded

- Local `.env` files and credentials.
- Stripe, Resend, Turnstile, Firebase, or GCP secrets.
- Subscriber records, quiz responses, and production database exports.
- Private Rosicrucian, Geneva Bible, Zaveta, or APEX source corpora.
- Temporary renders and unrelated generated media.

The private corpora may inform curated card interpretations in the application,
but they are not redistributed by this repository or exposed through WebMCP.

## Local verification

```bash
npm test
npm run test:stripe
npm run validate
go test ./...
go vet ./...
```

## WebMCP tools

The page registers seven same-origin tools when `document.modelContext` or the
compatible navigator surface is available:

1. `start_reflection`
2. `get_current_question`
3. `explain_choice`
4. `answer_reflection_question`
5. `review_reflection_answers`
6. `complete_reflection`
7. `get_card`

The tools navigate the existing deterministic quiz and mutate only ephemeral
browser state. Recording an answer requires an explicit human-confirmation
field. Email submission and checkout are deliberately not exposed as tools.
All schemas reject unknown properties, and no cross-origin `exposedTo` grant is
configured.

The web demo exposes a deliberately reduced public registry for Cards 001–144:
identifier, ARC, title, glyph, domain, Mirror prompt, and bounded Loop action.
Image-generation prompts, internal evaluations, source corpora, and private
interpretive fields are excluded.

## Competition status

The repository is private during development. The seven tools are implemented;
Chrome WebMCP Inspector verification on the deployed origin remains required.
The repository must be security-reviewed and made public before the WebMCP
Challenge submission deadline.
