# Changelog

## 2026-08-30 — Immediately visible WebMCP identification

- Added a persistent header badge that changes from `Checking WebMCP…` to the
  exact concise status `WebMCP ready · 8 tools` after all eight same-origin
  tools register.
- Added a truthful `WebMCP unavailable · direct reflection ready` fallback
  without disabling the ordinary 12-question experience.
- Kept the badge visible and free of horizontal overflow on desktop and mobile,
  with live status semantics for assistive technology.
- Preserved the existing tool, privacy, email, cart, and Stripe boundaries;
  this change identifies capability but grants no new agent action.
- Deployed the change to `mirrorloopai.com` and verified the exact ready label,
  eight-tool count, header placement, and live-region semantics in connected
  Chrome using its native WebMCP context.
- Recorded and retested the improvement as tracker story `WM-013`.

## 2026-08-29 — Full WebMCP conversion and release audit

- Audited 56 user-visible stories across the landing experience, 12-question
  reflection, email journey, storefront, Stripe handoff, accessibility,
  metadata, and eight-tool WebMCP surface.
- Fixed six tracker-backed failures: stale production assets, disabled
  storefront checkout, missing public WebMCP discovery, no result-to-product
  path, incomplete agent metadata, and the inability to revise a prior
  agent-recorded answer.
- Added a non-coercive matching-ARC action after the reflection and highlighted
  both relevant digital editions without exposing prices or starting checkout.
- Kept exactly eight WebMCP tools while allowing explicitly confirmed answer
  revisions and continuing to reject skipped future questions.
- Deployed the audited release to `mirrorloopai.com`; connected Chrome reported
  eight tools available, and production returned an HTTPS Stripe Checkout
  handoff without performing a payment.
- Regenerated the canonical CSV tracker, XLSX and HTML views, QA report, and
  retained local, production, browser, deployment, and security evidence under
  `qa_evidence/feature-audit-2026-08-29/`.

## 2026-08-29 — Truthful eighth WebMCP catalog tool

- Added `recommend_card_edition`, a read-only discovery tool backed by the
  existing public catalog of 12 ARC editions and complete 144-card editions.
- Kept the public response price-free and identified fulfillment accurately as
  a digital download.
- Prevented the tool from adding cart items, creating Stripe Checkout Sessions,
  exposing direct payment links, or making purchases.
- Rejected unsupported physical-product materials, shipping promises, prices,
  and zero-backend claims from the revised proposal.
- Added strict schema and boundary tests for the eighth tool.

## 2026-08-29 — Seven-tool WebMCP reflection layer

- Registered seven same-origin tools for starting, navigating, explaining,
  reviewing, completing, and inspecting the existing reflection experience.
- Required explicit human confirmation before an agent can record a choice.
- Added strict input schemas, unknown-field rejection, bounded card identifiers,
  read-only annotations, and curated-output trust annotations.
- Kept email submission, Stripe checkout, private corpora, and external actions
  outside the WebMCP tool boundary.
- Added a sanitized 144-card public lookup registry containing only the fields
  needed for bounded card explanation; generation prompts and internal
  evaluation metadata remain excluded.
- Added a visible graceful-fallback status for direct and AI-guided use.
- Added deterministic tests for registration, annotations, human confirmation,
  input rejection, focus-area privacy, and runtime context detection.

## 2026-08-29 — WebMCP origin-trial enrollment

- Added the Chrome WebMCP origin-trial token registered for
  `https://mirrorloopai.com:443` to the public landing page.
- Recorded the token as browser-facing deployment metadata rather than a
  secret. It enables WebMCP support in eligible Chrome versions; the
  MIRROR//LOOP quiz tools remain a separate implementation step.

## 2026-08-28 — Shattered Compass front-door visual

- Replaced the website’s former Card 012 preview with the canonical
  `The Shattered Compass` entry map.
- Reframed the accompanying text as a plain-language three-step introduction:
  ask what repeats, reveal the loop, and choose a new direction.
- Added an optimized WebP derivative for the public site while preserving the
  source artwork’s 3:2 composition.

## 2026-08-28 — Catch-all reply forwarding and mail hardening

- Activated Resend inbound receiving for the root `mirrorloopai.com` domain and
  routed its signed `email.received` webhook to the Go API.
- Added signature-age validation, Firestore replay protection, bounded
  attachment retrieval, and catch-all forwarding to the owner inbox while
  preserving the original sender as Reply-To.
- Separated the full-access inbound retrieval credential from the existing
  send-only Resend credential and stored both independently in GCP Secret
  Manager.
- Verified delivery through an arbitrary address and
  `reflection@mirrorloopai.com`; both messages were forwarded to
  `constantine@aitrailblazer.com`.
- Changed owner order notifications to use the buyer as Reply-To and replaced
  the urgent spam-like subject wording with a clearer operational subject.

## 2026-08-28 — Complete digital card storefront and Stripe cart

- Removed prices and Stripe identifiers from the public catalog; product cards
  and the cart now defer all price and total disclosure to hosted Stripe
  Checkout.
- Added a signature-verified paid-order webhook for Checkout completion and
  delayed-payment success events.
- Added retry-safe Resend messages: the buyer receives a thank-you message
  asking them to wait up to 24 hours for digital fulfillment, while the owner
  receives the buyer address, order reference, and exact editions to deliver.
- Added Firestore processing records and deterministic Resend idempotency keys
  so routine Stripe webhook retries do not send duplicate notifications.
- Added product cards for all twelve ARCs in Mono and Full-Color editions,
  plus the four complete 144-card Visual and Insight editions.
- Generated 28 storefront thumbnails from the canonical app card artwork and
  added a reproducible image-generation script.
- Added a responsive, accessible cart with edition filters, persistent local
  selections, clear digital-product language, and hosted Stripe Checkout.
- Added a server-owned SKU-to-Stripe-price allowlist so browser requests cannot
  choose or alter prices, plus origin, payload, duplicate-item, and URL checks.
- Added an idempotent live Stripe provisioning command for products, prices,
  metadata, and thumbnails; activation remains gated on the operator key's
  Products and Prices write permissions.
- Added digital delivery, refund, license, and support terms and linked them
  before checkout.
- Added Go and Node regression coverage for the catalog and checkout boundary.
- Completed a Stripe Sandbox purchase through the hosted checkout for ARC 12
  Full-Color; Stripe recorded the session as complete and paid, the signed
  webhook returned 200, Firestore recorded `emails_sent`, and Resend delivered
  both the buyer acknowledgement and owner notification.
- Archived the temporary standalone Stripe workflow-test product after the
  catalog-backed test completed.

## 2026-08-28 — MIRROR//LOOP Stripe payment inventory

- Reauthorized Stripe CLI against the AITrailblazer account and refreshed the
  private, secret-free account inventory.
- Added a read-only, pagination-complete MIRROR//LOOP inventory command that
  follows product, price, Payment Link, Checkout Session, PaymentIntent,
  charge, refund, and dispute relationships.
- Kept customer PII and raw Stripe object IDs out of the generated report;
  operational IDs are replaced with deterministic audit identifiers.
- Verified 16 successful live MIRROR//LOOP payments totaling $2,441 gross,
  including one $39 refund, for $2,402 retained before Stripe fees.

## 2026-08-27 — Stripe account custody migration

- Scanned the source workspace and found no committed Stripe API key or webhook secret.
- Moved the read-only Stripe audit collector, analyzer, and sanitized fixture into the private `mirrorloopai-web` repository.
- Added a secret-free Stripe CLI account importer that writes only to a chmod `0600`, Git-ignored local inventory.
- Replaced Azure Key Vault lookup with GCP Secret Manager lookup for the `mirrorloopai-com` operating environment.
- Replaced project-wide Secret Manager access for the subscriber service account with grants on only its four required subscriber secrets, isolating future Stripe operator credentials.
- Added a guarded secret bootstrap that accepts only Stripe restricted keys and never writes them to the repository.
- Recorded that the discovered Stripe CLI credentials expired on 2026-07-13; a fresh restricted key is required before live audit collection.
- Kept checkout, subscriptions, webhooks, and public payment UI explicitly out of scope.

## 2026-08-26 — Post-quiz email experience audit

- Audited the confirmation and delivered-reflection emails as a quiz participant, confirmed subscriber, launch-list member, mobile reader, plain-text reader, and assistive-technology user.
- Replaced the sparse confirmation message with an explicit account of what confirmation does, scanner-safe review wording, a 48-hour expiry, unsubscribe expectations, and a visible fallback URL.
- Made the delivered email preserve the useful browser result: plain-language domain, concise interpretation, observed frequency, supporting evidence when present, and one practical next step.
- Prevented the backend from assigning or emailing a zero-count supporting pattern; compact stored results now retain deterministic dominant and supporting counts without persisting individual answers.
- Added equivalent HTML and plain-text email bodies, hidden preheaders, semantic email-safe layout, descriptive links, no remote images, and launch-list expectations.
- Added regression coverage for all five email stories and for older stored records with stale presentation copy.
- Deployed Cloud Run revision `mirrorloopai-subscriber-00006-nq2`; the custom-domain API health route returned `{"status":"ok"}` after traffic moved to the revision.

## 2026-08-26 — Multi-persona public website audit

- Audited the complete public experience as an unfamiliar first-time visitor, skeptical visitor, time-pressed mobile visitor, privacy-conscious visitor, keyboard/screen-reader user, emotionally vulnerable visitor, and returning visitor.
- Moved the product promise and start action ahead of Card 012 on phones and clarified that the card is a visual-world preview rather than the visitor’s result.
- Replaced unexplained technical and ominous question labels with plain-language topics while preserving the deterministic 12-pattern scoring model.
- Reorganized each 12-choice question into four accessible disclosure groups with three choices visible at a time and added reachable mobile navigation controls.
- Added a concise pre-start privacy explanation and deferred Cloudflare Turnstile until the optional email form is actually shown.
- Added primary and supporting-pattern frequencies, explanations, and a zero-count safeguard so an unsupported secondary archetype is never presented.
- Added release-versioned CSS, JavaScript, configuration, and module URLs to prevent mixed cached assets after deployment.
- Retested all 28 tracker stories; production mobile Lighthouse remained 100 for accessibility, best practices, SEO, and agentic browsing.

## 2026-08-25 — Privacy-preserving conversion analytics

- Added first-party aggregate counters for quiz starts, quiz completions, and confirmed subscriptions without storing quiz answers, email addresses, cookies, fingerprints, or persistent visitor identifiers in analytics.
- Restricted public analytics ingestion to two allowlisted quiz events from approved site origins; confirmation counting remains server-side.
- Added per-tab duplicate suppression that never transmits its local session flags.
- Kept analytics documents private behind deny-all Firestore client rules and added an authenticated Go operator report for counts and conversion rates.
- Updated the privacy notice and architecture contract, deployed Cloud Run revision `mirrorloopai-subscriber-00005-fjv`, and revalidated production behavior.
- Production mobile Lighthouse remained 100 for accessibility, best practices, SEO, and agentic browsing.

## 2026-08-25 — Production subscriber-magnet audit and launch

- Audited all 19 public website, quiz, subscription, privacy, accessibility, security, and operations stories.
- Activated the optional post-result email flow on `mirrorloopai.com`.
- Deployed the Go subscriber API to Cloud Run with Firestore, Secret Manager, Turnstile, Resend, and a Firebase Hosting rewrite.
- Added a $10 monthly billing budget with 25%, 50%, 80%, 100%, and forecast alerts; capped Cloud Run at one instance with zero minimum instances.
- Corrected the privacy contact and added the monitored Google Workspace address as email Reply-To.
- Prevented email scanners and link previews from confirming or unsubscribing users: GET now displays an explicit action page and POST performs the state change.
- Trimmed secret values at process startup to prevent newline-contaminated authorization headers.
- Added API health, email payload, secret normalization, confirmation, unsubscribe, and public-error regression tests.
- Corrected subscriber-card text contrast; the final mobile Lighthouse audit scored 100 in accessibility, best practices, SEO, and agentic browsing.
- Completed a temporary, isolated Cloudflare test-key end-to-end run through pending, confirmation, reflection delivery, and unsubscribe; removed the QA service and test records afterward.
- Declared the active Firestore `pendingExpiresAt` TTL field override and its existing index modes so complete Hosting-and-Firestore deployments remain noninteractive and repeatable.
