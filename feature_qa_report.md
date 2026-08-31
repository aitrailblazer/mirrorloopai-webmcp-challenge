# Feature QA Report

Tracker source: `feature_status_tracker.csv`

Generated: 2026-08-31T04:39:25Z

## Totals

- Total features discovered: 95
- Current status — Verified: 63
- Current status — Fixed: 28
- Current status — Needs Product Decision: 4
- Final verified after retest: 91
- Final blocked: 0
- Product decisions remaining: 4

## Unresolved Critical Or High

- SUB-005 `Under-three-minute narrated demo plan` — Critical — Needs Product Decision
- SUB-007 `Devpost project draft readiness` — Critical — Needs Product Decision
- SUB-008 `Eligibility, ownership, and third-party rights attestation` — Critical — Needs Product Decision
- SUB-012 `Team attribution before deadline` — High — Needs Product Decision

## Remaining Operator Decisions

- SUB-005 `Under-three-minute narrated demo plan` — Yes — operator must authorize and publish the final video.
- SUB-007 `Devpost project draft readiness` — Yes — creating the Devpost project is an external representational action.
- SUB-008 `Eligibility, ownership, and third-party rights attestation` — Yes — entrant age/location/authority and asset rights.
- SUB-012 `Team attribution before deadline` — Yes — confirm solo entry or provide teammate identities for invitation.

## Files Changed Or Audited

- `web/config.js`
- `api/cmd/server/main.go; api/cmd/server/main_test.go; deploy/deploy-api.sh`
- `api/internal/subscriber/http.go; api/internal/subscriber/http_test.go; api/internal/subscriber/service.go`
- `api/cmd/server/main.go; api/internal/subscriber/mailer.go; api/internal/subscriber/mailer_test.go; api/internal/subscriber/http.go; api/internal/subscriber/http_test.go`
- `web/index.html; web/privacy.html; api/internal/subscriber/mailer.go`
- `web/styles.css`
- `web/app.js; api/internal/subscriber/http.go`
- `deploy/bootstrap-gcp.sh; deploy/deploy-api.sh; deploy/firestore.indexes.json; firebase.json; web/config.js`
- `web/app.js; web/lib/analytics.js; web/tests/analytics.test.mjs; web/privacy.html; api/internal/analytics; api/internal/subscriber/http.go; api/internal/subscriber/service.go; api/cmd/analytics-report; Makefile; docs/MirrorLoopAI_Subscriber_Magnet_Architecture_2026_08_25.html; CHANGELOG.md`
- `web/index.html; web/styles.css`
- `web/data/quiz.json; web/tests/quiz-core.test.mjs`
- `web/app.js; web/lib/quiz-core.js; web/styles.css; web/index.html`
- `web/index.html; web/app.js; scripts/validate-site.mjs`
- `web/app.js; web/index.html; web/lib/quiz-core.js; web/styles.css; web/tests/quiz-core.test.mjs`
- `web/index.html; web/app.js; web/config.js; web/lib/webmcp.js; web/shop.html; web/shop.js; web/styles.css; web/llms.txt`
- `api/internal/subscriber/mailer.go; api/internal/subscriber/mailer_test.go`
- `api/internal/subscriber/model.go; api/internal/subscriber/model_test.go; api/internal/subscriber/mailer.go; api/internal/subscriber/mailer_test.go; api/internal/subscriber/service_test.go`
- `web/config.js; web/shop.js; web/tests/shop.test.mjs`
- `web/index.html; web/app.js; web/lib/webmcp.js; firebase.json`
- `web/index.html; web/app.js; web/shop.js; web/styles.css`
- `web/llms.txt; scripts/validate-site.mjs`
- `web/app.js; web/lib/webmcp.js; web/tests/webmcp.test.mjs`
- `web/index.html; web/app.js; web/styles.css; scripts/validate-site.mjs; CHANGELOG.md`
- `competition_manifest.json; README.md; SUBMISSION.md; web/llms.txt; CHANGELOG.md; qa_evidence/submission_readiness/public-repository-2026-08-30.txt`
- `README.md; package.json; scripts/validate-submission.mjs`
- `SUBMISSION.md; scripts/validate-submission.mjs`
- `docs/demo/narration.txt; docs/demo/youtube-description.txt; scripts/build-demo-narration.mjs; scripts/record-webmcp-demo.mjs; scripts/package-demo-video.mjs; README.md; SUBMISSION.md; package.json; CHANGELOG.md; qa_evidence/submission_demo/local-video-verification-2026-08-30.txt`
- `README.md; SUBMISSION.md; scripts/validate-submission.mjs`
- `THIRD_PARTY_NOTICES.md; README.md; SUBMISSION.md; scripts/validate-submission.mjs`
- `SUBMISSION.md; README.md; scripts/validate-submission.mjs`
- `README.md; SUBMISSION.md`
- `RESOURCE_REVIEW.html; scripts/validate-submission.mjs; README.md; SUBMISSION.md`
- `web/lib/webmcp.js; web/tests/webmcp.test.mjs; web/app.js; web/index.html`
- `web/lib/webmcp.js; web/tests/webmcp.test.mjs`
- `web/evals/webmcp-evals.json; scripts/validate-webmcp-evals.mjs; package.json; README.md; SUBMISSION.md`
- `scripts/run-webmcp-agent-evals.mjs; scripts/build-webmcp-agent-eval-report.mjs; scripts/validate-webmcp-agent-evidence.mjs; WEBMCP_AGENT_EVAL_REPORT.html; qa_evidence/webmcp_agent_eval/; README.md; SUBMISSION.md; package.json; package-lock.json; CHANGELOG.md; CONTINUITY.md; feature_status_tracker.csv; .gitignore`
- `README.md; web/evals/webmcp-evals.json; scripts/validate-webmcp-evals.mjs; WEBMCP_DEMO_SHOT_LIST.html; scripts/validate-submission.mjs; CHANGELOG.md`
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
- `api/cmd/server/main.go; api/internal/subscriber/model.go; api/internal/subscriber/model_test.go; api/internal/subscriber/service.go; api/internal/subscriber/service_test.go; api/internal/subscriber/mailer.go; api/internal/subscriber/mailer_test.go; web/app.js; web/index.html; web/privacy.html; scripts/validate-site.mjs; CHANGELOG.md; qa_evidence/owner_quiz_submission_notification/; feature_status_tracker.csv; feature_status_tracker.xlsx; feature_status_tracker.html; feature_qa_report.md`
- `feature_status_tracker.csv; feature_status_tracker.xlsx; feature_status_tracker.html; feature_qa_report.md; CHANGELOG.md; qa_evidence/submission_readiness/deadline-preflight-2026-08-30.txt`
- `web/lib/webmcp.js; web/app.js; web/index.html; web/styles.css; web/tests/webmcp.test.mjs; scripts/test-webmcp-hud-browser.mjs; scripts/validate-site.mjs; package.json; README.md; SUBMISSION.md; CHANGELOG.md; qa_evidence/webmcp_glass_cockpit/`
- `web/lib/quiz-core.js; web/lib/webmcp.js; web/app.js; web/tests/quiz-core.test.mjs; web/tests/webmcp.test.mjs; scripts/test-webmcp-hud-browser.mjs; web/evals/webmcp-evals.json; web/evals/webmcp-campaign-evals.json; competition_manifest.json; README.md; SUBMISSION.md; CONTINUITY.md; CHANGELOG.md; active WebMCP generators/artifacts; qa_evidence/webmcp_compare_choices/; feature_status_tracker.csv; feature_status_tracker.xlsx; feature_status_tracker.html; feature_qa_report.md`
- `web/lib/quiz-core.js; web/lib/webmcp.js; web/app.js; web/tests/quiz-core.test.mjs; web/tests/webmcp.test.mjs; scripts/test-webmcp-hud-browser.mjs; web/evals/webmcp-evals.json; web/evals/webmcp-campaign-evals.json; competition_manifest.json; README.md; SUBMISSION.md; CONTINUITY.md; CHANGELOG.md; active WebMCP generators/artifacts; qa_evidence/webmcp_preview_answer_impact/; feature_status_tracker.csv; feature_status_tracker.xlsx; feature_status_tracker.html; feature_qa_report.md`
- `web/lib/dossier.js; web/lib/webmcp.js; web/app.js; web/tests/dossier.test.mjs; web/tests/webmcp.test.mjs; scripts/test-webmcp-hud-browser.mjs; web/evals/webmcp-evals.json; web/evals/webmcp-campaign-evals.json; competition_manifest.json; README.md; SUBMISSION.md; CONTINUITY.md; active WebMCP generators/artifacts; qa_evidence/webmcp_reflection_dossier/; feature_status_tracker.csv; feature_status_tracker.xlsx; feature_status_tracker.html; feature_qa_report.md; CHANGELOG.md`
- `scripts/test-webmcp-eval.mjs; package.json; .github/workflows/webmcp-eval.yml; README.md; SUBMISSION.md; scripts/validate-submission.mjs; CHANGELOG.md; qa_evidence/webmcp_ci_eval/; feature_status_tracker.csv; feature_status_tracker.xlsx; feature_status_tracker.html; feature_qa_report.md`
- `README.md; web/evals/webmcp-evals.json; scripts/validate-webmcp-evals.mjs; WEBMCP_DEMO_SHOT_LIST.html; scripts/validate-submission.mjs; CHANGELOG.md; feature_status_tracker.csv; feature_status_tracker.xlsx; feature_status_tracker.html; feature_qa_report.md; qa_evidence/webmcp_agent_copilot_rationale/`

## Commits Recorded In Tracker

- `41658abc55cbfe16536285d46e994b636160a5f5`
- `41ccce140e13759d970ffd4d7b7dc3f5ada9372c`
- `7f06937bcbdb9d91c2c243920f8d68a06784f064`
- `b1b5bc3`
- `4d835111b8ee24560deabafe60efc8499dc105ec`
- `828ee7a`
- `e0362b2`
- `c6e6b0f`
- `8ee2753; cb956ad`
- `fcde886`
- `1c0200a`
- `58d7d83`
- `2c7686c`
- `c6fac39`
- `2bed64d`
- `a030ae1`
- `24c8cba`
- `13d9bfc`
- `ab71f14`
- `c21b785`
- `9ed7544; d26e0e5`
- `e185c72; 6c90ff4`
- `2e4116f; b52b3b4`
- `103ed7e`
- `60762af`
- `1df9bff`
- `16bdaae`
- `04af3d3`
- `ab1ce3f`
