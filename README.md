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

## Competition status

The repository is private during development. It must be security-reviewed and
made public before the WebMCP Challenge submission deadline.
