# Third-Party Services, Data, and Rights Checklist

This file identifies external components used by MIRROR//LOOP. It is not a
substitute for the entrant's final legal and competition-eligibility review.

## Runtime services

- **Google Cloud / Firebase:** Hosting, Cloud Run, Firestore, and Secret Manager.
- **Cloudflare Turnstile:** abuse-prevention check on the optional email flow.
- **Resend:** outbound subscriber/order email and inbound forwarding workflow.
- **Stripe:** server-created hosted Checkout and signed payment webhooks.

These services are integrated through their documented APIs and ordinary
account credentials. Credentials, customer records, subscriber records, and
production exports are excluded from this repository.

## Software dependencies

The repository's direct Go dependencies are listed in `go.mod`; transitive
module checksums are in `go.sum`. The web application uses browser APIs and
repository-owned JavaScript without a bundled third-party package tree.

The project source is offered under the top-level MIT license. Each external
dependency remains under its own license and terms.

## Content boundary

The competition repository includes only the public website assets and a
reduced 144-card registry needed for the visible experience. Private
Rosicrucian, Geneva Bible, Zaveta, and APEX corpora are neither redistributed
nor exposed through WebMCP. No claim is made that the repository licenses those
source corpora for redistribution.

## Operator attestations required before submission

- [ ] I meet the competition's age and geographic eligibility requirements.
- [ ] I am authorized to submit this project and accept the competition terms.
- [ ] I own or have permission to use the submitted card imagery, typography,
      written material, source code, and every demo-video element.
- [ ] My use of Google Cloud, Cloudflare, Resend, Stripe, and any other service
      complies with the applicable account and API terms.
- [ ] The public repository contains no credentials, personal data, private
      source corpus, or asset that may not be redistributed.
- [ ] The public demo uses no unlicensed music or third-party media.
