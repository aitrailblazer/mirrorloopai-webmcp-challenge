# Feature QA Report

Tracker source: `feature_status_tracker.csv`

## Totals

- Total features discovered: 87
- Total verified before fixes: 58
- Total failed before fixes: 19
- Total fixed: 24
- Total verified after retest: 82
- Total still blocked: 0
- Total needing product decision: 1

## Unresolved Critical Or High

- SUB-002 `Public source repository and license` — Critical — Failed Test
- SUB-005 `Under-three-minute narrated demo plan` — Critical — Needs Product Decision
- SUB-007 `Devpost project draft readiness` — Critical — Needs Product Decision
- SUB-008 `Eligibility, ownership, and third-party rights attestation` — Critical — Needs Product Decision
- RES-008 `Explicit-confirmation eval oracle consistency` — High — Needs Product Decision

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
- `web/index.html; web/app.js; web/config.js; web/lib/webmcp.js; web/shop.html; web/shop.js; web/styles.css; web/llms.txt`
- `api/internal/subscriber/mailer.go; api/internal/subscriber/mailer_test.go`
- `api/internal/subscriber/model.go; api/internal/subscriber/model_test.go; api/internal/subscriber/mailer.go; api/internal/subscriber/mailer_test.go; api/internal/subscriber/service_test.go`
- `web/shop.html; web/shop.js; web/styles.css`
- `web/data/shop.json; web/shop.js`
- `web/shop.html; web/shop.js`
- `web/shop.js; web/shop.html`
- `web/shop.js`
- `web/config.js; web/shop.js; web/tests/shop.test.mjs`
- `web/terms.html; web/shop.html`
- `web/index.html; web/app.js; web/lib/webmcp.js`
- `web/lib/webmcp.js; web/app.js`
- `web/lib/webmcp.js; web/app.js; web/data/quiz.json`
- `web/lib/webmcp.js; web/app.js; web/lib/quiz-core.js`
- `web/lib/webmcp.js; web/app.js; web/data/cards.json`
- `web/lib/webmcp.js; web/app.js; web/data/shop.json`
- `web/lib/webmcp.js; api/internal/commerce/checkout.go`
- `web/index.html; web/app.js; web/lib/webmcp.js; firebase.json`
- `web/index.html; web/app.js; web/shop.js; web/styles.css`
- `web/index.html; web/shop.html; web/terms.html; web/privacy.html`
- `web/llms.txt; scripts/validate-site.mjs`
- `web/app.js; web/lib/webmcp.js; web/tests/webmcp.test.mjs`
- `web/index.html; web/app.js; web/styles.css; scripts/validate-site.mjs; CHANGELOG.md`
- `README.md; SUBMISSION.md; THIRD_PARTY_NOTICES.md`
- `README.md; package.json; scripts/validate-submission.mjs`
- `SUBMISSION.md; scripts/validate-submission.mjs`
- `README.md; SUBMISSION.md; scripts/validate-submission.mjs`
- `THIRD_PARTY_NOTICES.md; README.md; SUBMISSION.md; scripts/validate-submission.mjs`
- `SUBMISSION.md; README.md; scripts/validate-submission.mjs`
- `README.md; SUBMISSION.md`
- `RESOURCE_REVIEW.html; scripts/validate-submission.mjs; README.md; SUBMISSION.md`
- `web/lib/webmcp.js; web/tests/webmcp.test.mjs; web/app.js; web/index.html`
- `web/lib/webmcp.js; web/tests/webmcp.test.mjs`
- `web/evals/webmcp-evals.json; scripts/validate-webmcp-evals.mjs; package.json; README.md; SUBMISSION.md`
- `firebase.json; web/index.html`
- `scripts/run-webmcp-agent-evals.mjs; scripts/build-webmcp-agent-eval-report.mjs; scripts/validate-webmcp-agent-evidence.mjs; WEBMCP_AGENT_EVAL_REPORT.html; qa_evidence/webmcp_agent_eval/; README.md; SUBMISSION.md; package.json; package-lock.json; CHANGELOG.md; CONTINUITY.md; feature_status_tracker.csv; .gitignore`
- `feature_status_tracker.csv; WEBMCP_AGENT_EVAL_REPORT.html`
- `web/evals/webmcp-campaign-evals.json; scripts/validate-webmcp-campaign-evals.mjs; scripts/run-webmcp-agent-evals.mjs; scripts/validate-webmcp-campaign-agent-evidence.mjs; scripts/build-webmcp-campaign-claim-audit.mjs; WEBMCP_CAMPAIGN_CLAIM_AUDIT.html; README.md; SUBMISSION.md; package.json; CHANGELOG.md; qa_evidence/webmcp_campaign_agent_eval/**; qa_evidence/webmcp_campaign_claim_audit/**`
- `web/evals/webmcp-operational-use-cases.json; scripts/validate-webmcp-operational-use-cases.mjs; scripts/validate-webmcp-operational-evidence.mjs; scripts/build-webmcp-operational-use-cases.mjs; WEBMCP_OPERATIONAL_USE_CASES.html; README.md; SUBMISSION.md; scripts/validate-submission.mjs; package.json; CHANGELOG.md; qa_evidence/webmcp_operational_use_case_eval/**; qa_evidence/webmcp_operational_use_cases/**`
- `WEBMCP_COMPETITION_HARDENING_AUDIT.html; scripts/build-webmcp-competition-hardening-audit.mjs; scripts/validate-webmcp-competition-hardening.mjs; scripts/validate-submission.mjs; package.json; README.md; SUBMISSION.md; CHANGELOG.md; qa_evidence/webmcp_competition_hardening/**`
- `WEBMCP_JUDGE_PANEL_BRIEF.html; scripts/build-webmcp-judge-panel-brief.mjs; scripts/validate-webmcp-judge-panel-brief.mjs; scripts/validate-submission.mjs; package.json; README.md; SUBMISSION.md; CHANGELOG.md; qa_evidence/webmcp_judge_panel/**; feature_status_tracker.csv`
- `WEBMCP_JUDGE_PANEL_BRIEF.html; scripts/build-webmcp-judge-panel-brief.mjs; scripts/validate-webmcp-judge-panel-brief.mjs; scripts/validate-webmcp-chrome-ux.mjs; scripts/validate-submission.mjs; SUBMISSION.md; README.md; package.json; CHANGELOG.md; qa_evidence/webmcp_chrome_ux/**; feature_status_tracker.csv`
- `WEBMCP_JUDGE_PANEL_BRIEF.html; scripts/build-webmcp-judge-panel-brief.mjs; scripts/validate-webmcp-judge-panel-brief.mjs; scripts/validate-webmcp-six-role-claims.mjs; scripts/validate-submission.mjs; README.md; SUBMISSION.md; package.json; CHANGELOG.md; qa_evidence/webmcp_six_role_claims/**; feature_status_tracker.csv`
- `web/index.html; web/app.js; scripts/validate-site.mjs; CHANGELOG.md; qa_evidence/subscriber_route_recovery/**; feature_status_tracker.csv; feature_status_tracker.xlsx; feature_status_tracker.html; feature_qa_report.md`
- `web/lib/reflection-storage.js; web/tests/reflection-storage.test.mjs; web/app.js; web/index.html; web/privacy.html; scripts/test-quiz-persistence-browser.mjs; scripts/validate-site.mjs; package.json; CHANGELOG.md; qa_evidence/quiz_answer_persistence/`
- `api/internal/subscriber/http.go; api/internal/subscriber/http_test.go; CHANGELOG.md; qa_evidence/confirmation_page_design/`
- `api/internal/subscriber/http.go; api/internal/subscriber/http_test.go; web/confirmation.css; scripts/test-confirmation-page-browser.mjs; scripts/validate-site.mjs; package.json; CHANGELOG.md; qa_evidence/confirmation_page_style_regression/; feature_status_tracker.csv; feature_status_tracker.xlsx; feature_status_tracker.html; feature_qa_report.md`
- `api/internal/subscriber/service.go; api/internal/subscriber/service_test.go; api/internal/subscriber/http.go; api/internal/subscriber/http_test.go; web/confirmation.css; web/confirmed.html; scripts/test-confirmation-page-browser.mjs; scripts/validate-site.mjs; CHANGELOG.md; qa_evidence/post_confirmation_cross_device/; feature_status_tracker.csv; feature_status_tracker.xlsx; feature_status_tracker.html; feature_qa_report.md`

## Commits Recorded In Tracker

- `41658abc55cbfe16536285d46e994b636160a5f5`
- `41ccce140e13759d970ffd4d7b7dc3f5ada9372c`
- `7f06937bcbdb9d91c2c243920f8d68a06784f064`
- `9740b57`
- `4d835111b8ee24560deabafe60efc8499dc105ec`
- `592c08a`
- `2f08435`
- `2d84634`
- `9d39b92`
- `e74cc86`
- `fa341e7`
- `ddabacf`
- `7a91f15`
- `c6e7d4d`
- `fe40fe4`
- `825e1a6`
- `cfc9a70`
- `068a91f; dc43eb2`
- `b03a86c; 2ab3824`
- `16bb41c; 75ace45`

## Test Evidence

- Test types used: `Automated + browser`, `Automated + integration + production`, `Persona walkthrough + automated + browser`, `Production cache regression`, `Automated Test + Code Review`, `Automated Test + Cross-surface Review`, `Automated Test`, `Automated Test + Accessibility Review`, `Automated Test + Content Review`, `Browser + responsive`, `Browser interaction`, `Browser + automated`, `Automated integration + production smoke`, `Content + link review`, `Automated + security`, `Automated security review`, `Production browser + Inspector`, `Browser + content`, `Automated links + browser`, `Automated content + production smoke`, `Reference comparison + automated + Chrome responsive`, `Production browser + HTTP`, `GitHub metadata inspection`, `Documentation audit`, `Content audit`, `Artifact + content audit`, `Git + documentation audit`, `Authenticated browser + checklist audit`, `Compliance checklist`, `Operations documentation audit`, `Content + evidence audit`, `Browser compatibility`, `Link inventory + content review`, `Code review + automated lifecycle test`, `Automated contract-budget test`, `Eval dataset validation`, `Header and source review`, `Live browser-agent evaluation + deterministic scorer`, `Corpus-policy consistency review from live model evidence`, `Source-to-claim audit + deterministic corpus + live browser-agent evaluation`, `Source-to-contract audit + six-case deterministic corpus + live browser-agent evaluation`, `Claim-to-code audit + security boundary regression + submission/document validation`, `Documentation claim audit + HTML/XML validation + submission regression`, `Source-to-claim audit + browser accessibility/animation inspection + submission regression`, `Source-to-claim audit + generated StrategiX matrix + browser/submission regression`, `Production HTTP route + completed-quiz browser flow + adjacent subscriber regression`, `Source inspection + browser-local storage unit and end-to-end behavior`, `Source inspection + HTTP handler tests + responsive browser rendering`, `Production visual regression + CSP/resource loading + handler semantics`, `Cross-device confirmation UX + privacy + email delivery + browser rendering`
- Commands run are not captured as a dedicated tracker column, so this report only summarizes tracker-backed test evidence.

## Coverage Gaps

- No explicit coverage gaps recorded

## Recommended Next Pass

- Resolve the remaining unresolved critical/high rows before expanding scope.
