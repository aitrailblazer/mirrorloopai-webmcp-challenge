import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const index = await readFile(new URL("web/index.html", root), "utf8");
const privacy = await readFile(new URL("web/privacy.html", root), "utf8");
const quiz = JSON.parse(await readFile(new URL("web/data/quiz.json", root), "utf8"));
const cards = JSON.parse(await readFile(new URL("web/data/cards.json", root), "utf8"));
const app = await readFile(new URL("web/app.js", root), "utf8");
const webmcp = await readFile(new URL("web/lib/webmcp.js", root), "utf8");
const shop = await readFile(new URL("web/shop.html", root), "utf8");
const terms = await readFile(new URL("web/terms.html", root), "utf8");
const confirmed = await readFile(new URL("web/confirmed.html", root), "utf8");
const config = await readFile(new URL("web/config.js", root), "utf8");
const llms = await readFile(new URL("web/llms.txt", root), "utf8");
const confirmationCSS = await readFile(new URL("web/confirmation.css", root), "utf8");
const shopCatalog = JSON.parse(await readFile(new URL("web/data/shop.json", root), "utf8"));

assert.equal(quiz.questions.length, 12);
assert.equal(cards.cards.length, 144);
assert.equal(new Set(cards.cards.map(({ id }) => id)).size, 144);
assert.equal(cards.cards[0].id, "001");
assert.equal(cards.cards.at(-1).id, "144");
for (const forbidden of ["monoPrompt", "colorPrompt", "articlePrompt", "founder", "readingQuality", "imagePrompt"]) {
  assert.ok(!JSON.stringify(cards).includes(`"${forbidden}"`), `private card field leaked: ${forbidden}`);
}
assert.ok(index.includes('id="subscribe-form"'));
assert.ok(index.includes('id="form-status" class="form-status" role="status" aria-live="polite" tabindex="-1"'));
assert.ok(index.includes('type="checkbox" required'));
assert.ok(index.includes("No email required to see your result."));
assert.ok(index.includes("/images/shattered-compass-entry.webp"));
assert.ok(index.includes('id="webmcp-status"'));
assert.ok(index.includes('role="status" aria-live="polite"'));
assert.ok(index.indexOf('id="webmcp-status"') < index.indexOf("<main"));
assert.ok(index.includes('/styles.css?v=20260830-2'));
assert.ok(index.includes('/app.js?v=20260830-11'));
assert.ok(index.includes('class="agent-state-hud"'));
assert.ok(index.includes('id="agent-state-panel" open'));
assert.ok(index.includes('id="agent-event-list"'));
assert.ok(index.includes("This rail shows allowlisted fields only."));
assert.ok(index.includes('id="clear-answers-button"'));
assert.ok(index.includes("Review or change my answers"));
assert.ok(index.includes("Your choices are saved only in this browser"));
assert.ok(index.includes('id="result-shop-link"'));
assert.ok(config.includes("shopEnabled: true"));
assert.ok(app.includes("shopLink.href ="));
assert.ok(app.includes("revised: true"));
assert.ok(app.includes("installMirrorLoopWebMCP"));
assert.ok(app.includes("MIRRORLOOP_WEBMCP_EVENTS"));
assert.ok(app.includes("window.dispatchEvent(new CustomEvent(type, { detail }))"));
assert.ok(app.includes("HUMAN CONFIRMED"));
assert.ok(app.includes("ms observed"));
assert.ok(app.includes("WebMCP ready · ${names.length} tools"));
assert.ok(app.includes("The email service is temporarily unavailable."));
assert.ok(app.includes("elements.formStatus.focus()"));
assert.ok(app.includes("WebMCP unavailable · direct reflection ready"));
assert.ok(!app.includes("AI-guided reflection ready"));
for (const tool of [
  "start_reflection",
  "get_current_question",
  "explain_choice",
  "compare_choices",
  "preview_answer_impact",
  "answer_reflection_question",
  "review_reflection_answers",
  "complete_reflection",
  "export_reflection_dossier",
  "get_card",
  "recommend_card_edition",
]) {
  assert.ok(webmcp.includes(`"${tool}"`), `missing WebMCP tool: ${tool}`);
}
assert.ok(webmcp.includes("additionalProperties: false"));
assert.ok(webmcp.includes("confirmed_by_user"));
assert.ok(webmcp.includes('"mirrorloop:tool_start"'));
assert.ok(webmcp.includes('"mirrorloop:tool_complete"'));
assert.ok(webmcp.includes("safeInputSummary"));
assert.ok(webmcp.includes("focus_supplied"));
assert.ok(!webmcp.includes("exposedTo"));
assert.ok(!webmcp.includes("recommend_physical_deck"));
assert.ok(app.includes('fulfillment: "digital_download"'));
assert.ok(app.includes("This tool cannot add items, start checkout, or make a purchase."));
assert.ok(index.includes("The Shattered Compass"));
assert.ok(index.includes("Ask what repeats. Reveal the loop. Choose a new direction."));
assert.ok(index.indexOf('id="result-panel"') < index.indexOf('id="subscribe-form"'));
assert.ok(privacy.includes("It does not store your 12 individual quiz answers."));
assert.ok(privacy.includes("each question, and your 12 selected responses in question order"));
assert.ok(privacy.includes("authorized MIRROR//LOOP operator"));
assert.ok(index.includes("diagnostic review if automated delivery needs help"));
assert.ok(app.includes("email-reflection-owner-review-v2-2026-08-30"));
assert.ok(app.includes("answerDetails: state.quiz.questions.map"));
assert.ok(privacy.includes("saves only the 12 choice codes on this device"));
assert.ok(app.includes("createReflectionStore"));
assert.ok(app.includes("reflectionStore.save"));
assert.ok(app.includes("reflectionStore.clear"));
assert.ok(app.indexOf("ensureTurnstile();") < app.indexOf("function ensureTurnstile()"));
assert.ok(app.indexOf("ensureTurnstile();") > app.indexOf("function showResult()"));
assert.equal(shopCatalog.items.length, 28);
assert.ok(shop.includes('id="cart-panel"'));
assert.ok(!shop.toLowerCase().includes("pre-order"));
assert.ok(shop.includes("/terms.html"));
assert.ok(terms.includes("Digital products"));
assert.ok(confirmed.includes("You do not need to repeat the quiz."));
assert.ok(confirmed.includes("open it on any device"));
assert.ok(confirmed.includes("are not synchronized to another computer"));
assert.ok(llms.includes("recommend_card_edition"));
assert.ok(llms.includes("compare_choices"));
assert.ok(llms.includes("preview_answer_impact"));
assert.ok(llms.includes("export_reflection_dossier"));
assert.ok(llms.includes("https://mirrorloopai.com/shop"));
assert.ok(confirmationCSS.includes(".card"));
assert.ok(confirmationCSS.includes("@media (max-width: 560px)"));
assert.ok(confirmationCSS.includes("@media (prefers-reduced-motion: reduce)"));
for (const forbidden of ["Rosicrucian_Library", "all_transcriptions.txt", "all_interpretations.txt", "Geneva_Bible_1599"]) {
  assert.ok(!index.includes(forbidden), `private corpus reference leaked: ${forbidden}`);
}
console.log("site validation: PASS");
