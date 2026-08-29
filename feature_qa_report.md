# Feature QA Report

Tracker source: `feature_status_tracker.csv`

## Totals

- Total features discovered: 56
- Total verified before fixes: 50
- Total failed before fixes: 6
- Total fixed: 0
- Total verified after retest: 50
- Total still blocked: 0
- Total needing product decision: 1

## Unresolved Critical Or High

- F-028 `Release asset coherence` — Critical — Failed Test
- ST-006 `Secure hosted checkout handoff` — Critical — Failed Test
- WM-011 `Native public-origin WebMCP discovery` — Critical — Failed Test
- CV-001 `Reflection-to-collection next step` — High — Failed Test
- WM-012 `Revise a prior agent-recorded answer` — High — Failed Test

## Files Changed Or Audited

- `web/index.html; web/styles.css`
- `web/index.html; web/images/shattered-compass-entry.webp`
- `web/index.html`
- `web/index.html; web/app.js`
- `web/app.js; web/data/quiz.json; web/styles.css`
- `web/app.js`
- `web/lib/quiz-core.js; api/internal/subscriber/model.go`
- `web/app.js; web/lib/quiz-core.js; web/data/quiz.json`
- `web/config.js`
- `api/cmd/server/main.go; api/cmd/server/main_test.go; deploy/deploy-api.sh`
- `api/internal/subscriber/http.go; api/internal/subscriber/http_test.go; api/internal/subscriber/service.go`
- `api/cmd/server/main.go; api/internal/subscriber/mailer.go; api/internal/subscriber/mailer_test.go; api/internal/subscriber/http.go; api/internal/subscriber/http_test.go`
- `web/index.html; web/privacy.html; api/internal/subscriber/mailer.go`
- `web/confirmed.html`
- `web/styles.css`
- `web/app.js; api/internal/subscriber/http.go`
- `scripts/validate-site.mjs; firebase.json; deploy/firestore.rules; api/internal/subscriber/http.go`
- `deploy/bootstrap-gcp.sh; deploy/deploy-api.sh; deploy/firestore.indexes.json; firebase.json; web/config.js`
- `web/app.js; web/lib/analytics.js; web/tests/analytics.test.mjs; web/privacy.html; api/internal/analytics; api/internal/subscriber/http.go; api/internal/subscriber/service.go; api/cmd/analytics-report; Makefile; docs/MirrorLoopAI_Subscriber_Magnet_Architecture_2026_08_25.html; CHANGELOG.md`
- `web/data/quiz.json; web/tests/quiz-core.test.mjs`
- `web/app.js; web/lib/quiz-core.js; web/styles.css; web/index.html`
- `web/index.html; web/app.js; scripts/validate-site.mjs`
- `web/index.html; web/app.js; web/styles.css`
- `web/app.js; web/index.html; web/lib/quiz-core.js; web/styles.css; web/tests/quiz-core.test.mjs`
- `web/index.html; web/privacy.html; web/confirmed.html; web/app.js`
- `api/internal/subscriber/mailer.go; api/internal/subscriber/mailer_test.go`
- `api/internal/subscriber/model.go; api/internal/subscriber/model_test.go; api/internal/subscriber/mailer.go; api/internal/subscriber/mailer_test.go; api/internal/subscriber/service_test.go`
- `web/shop.html; web/shop.js; web/styles.css`
- `web/data/shop.json; web/shop.js`
- `web/shop.html; web/shop.js`
- `web/shop.js; web/shop.html`
- `web/shop.js`
- `web/shop.js; api/internal/commerce/checkout.go; api/internal/commerce/catalog_gen.go`
- `web/terms.html; web/shop.html`
- `web/index.html; web/app.js; web/lib/webmcp.js`
- `web/lib/webmcp.js; web/app.js`
- `web/lib/webmcp.js; web/app.js; web/data/quiz.json`
- `web/lib/webmcp.js; web/app.js; web/lib/quiz-core.js`
- `web/lib/webmcp.js; web/app.js; web/data/cards.json`
- `web/lib/webmcp.js; web/app.js; web/data/shop.json`
- `web/lib/webmcp.js; api/internal/commerce/checkout.go`
- `web/index.html; web/app.js; web/lib/webmcp.js; firebase.json`
- `web/index.html; web/app.js; web/shop.html`
- `web/index.html; web/shop.html; web/terms.html; web/privacy.html`
- `web/llms.txt; web/robots.txt; web/sitemap.xml; web/index.html`

## Commits Recorded In Tracker

- `41658abc55cbfe16536285d46e994b636160a5f5`
- `41ccce140e13759d970ffd4d7b7dc3f5ada9372c`
- `7f06937bcbdb9d91c2c243920f8d68a06784f064`
- `4d835111b8ee24560deabafe60efc8499dc105ec`

## Test Evidence

- Test types used: `Automated + browser`, `Automated + integration + production`, `Persona walkthrough + automated + browser`, `Production cache regression`, `Automated Test + Code Review`, `Automated Test + Cross-surface Review`, `Automated Test`, `Automated Test + Accessibility Review`, `Automated Test + Content Review`, `Browser + responsive`, `Browser interaction`, `Browser + automated`, `Automated integration + production smoke`, `Content + link review`, `Automated + security`, `Automated security review`, `Production browser + Inspector`, `Browser + content`, `Automated links + browser`, `Automated content + production smoke`
- Commands run are not captured as a dedicated tracker column, so this report only summarizes tracker-backed test evidence.

## Coverage Gaps

- No explicit coverage gaps recorded

## Recommended Next Pass

- Resolve the remaining unresolved critical/high rows before expanding scope.
