import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const index = await readFile(new URL("web/index.html", root), "utf8");
const privacy = await readFile(new URL("web/privacy.html", root), "utf8");
const quiz = JSON.parse(await readFile(new URL("web/data/quiz.json", root), "utf8"));
const app = await readFile(new URL("web/app.js", root), "utf8");
const shop = await readFile(new URL("web/shop.html", root), "utf8");
const terms = await readFile(new URL("web/terms.html", root), "utf8");
const shopCatalog = JSON.parse(await readFile(new URL("web/data/shop.json", root), "utf8"));

assert.equal(quiz.questions.length, 12);
assert.ok(index.includes('id="subscribe-form"'));
assert.ok(index.includes('type="checkbox" required'));
assert.ok(index.includes("No email required to see your result."));
assert.ok(index.includes("/images/shattered-compass-entry.webp"));
assert.ok(index.includes("The Shattered Compass"));
assert.ok(index.includes("Ask what repeats. Reveal the loop. Choose a new direction."));
assert.ok(index.indexOf('id="result-panel"') < index.indexOf('id="subscribe-form"'));
assert.ok(privacy.includes("We do not store your 12 individual quiz answers."));
assert.ok(app.indexOf("ensureTurnstile();") < app.indexOf("function ensureTurnstile()"));
assert.ok(app.indexOf("ensureTurnstile();") > app.indexOf("function showResult()"));
assert.equal(shopCatalog.items.length, 28);
assert.ok(shop.includes('id="cart-panel"'));
assert.ok(!shop.toLowerCase().includes("pre-order"));
assert.ok(shop.includes("/terms.html"));
assert.ok(terms.includes("Digital products"));
for (const forbidden of ["Rosicrucian_Library", "all_transcriptions.txt", "all_interpretations.txt", "Geneva_Bible_1599"]) {
  assert.ok(!index.includes(forbidden), `private corpus reference leaked: ${forbidden}`);
}
console.log("site validation: PASS");
