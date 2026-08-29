import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("web/data/shop.json", root), "utf8"));
const source = JSON.parse(await readFile(new URL("catalog/shop-source.json", root), "utf8"));
const shop = await readFile(new URL("web/shop.html", root), "utf8");
const terms = await readFile(new URL("web/terms.html", root), "utf8");
const config = await readFile(new URL("web/config.js", root), "utf8");

test("shop exposes 12 ARCs in mono and full color plus four complete decks", () => {
  assert.equal(catalog.items.length, 28);
  assert.equal(catalog.items.filter((item) => item.kind === "arc").length, 24);
  assert.equal(catalog.items.filter((item) => item.kind === "collection").length, 2);
  assert.equal(catalog.items.filter((item) => item.kind === "insight").length, 2);
  for (let arc = 1; arc <= 12; arc += 1) {
    const code = String(arc).padStart(2, "0");
    assert.ok(catalog.items.some((item) => item.sku === `arc-${code}-mono`));
    assert.ok(catalog.items.some((item) => item.sku === `arc-${code}-color`));
  }
});

test("public catalog contains no prices or pre-order language", () => {
  for (const item of catalog.items) {
    assert.equal(item.unitAmount, undefined);
    assert.equal(item.displayPrice, undefined);
    assert.equal(item.stripePriceID, undefined);
    assert.ok(!JSON.stringify(item).toLowerCase().includes("pre-order"));
  }
  assert.ok(!shop.match(/\$\d/));
  assert.ok(shop.includes("Stripe will show every price"));
});

test("shop is active while Stripe remains the only price and payment surface", () => {
  assert.ok(config.includes("shopEnabled: true"));
  assert.ok(shop.includes("Stripe will show every price"));
  assert.ok(!shop.includes("checkout.stripe.com"));
  assert.ok(!shop.includes("buy.stripe.com"));
});

test("private source keeps canonical Stripe amounts", () => {
  assert.deepEqual(
    source.arcEditions.map(({ edition, unitAmount }) => ({ edition, unitAmount })),
    [
      { edition: "mono", unitAmount: 6900 },
      { edition: "color", unitAmount: 7900 },
    ],
  );
  assert.deepEqual(
    source.collections.map(({ unitAmount }) => unitAmount),
    [19900, 24900, 34900, 39900],
  );
});

test("every product image exists and checkout explains its boundary", async () => {
  await Promise.all(catalog.items.map((item) =>
    access(new URL(`web${item.image}`, root)),
  ));
  assert.ok(shop.includes("Digital editions"));
  assert.ok(shop.includes("Secure Stripe checkout"));
  assert.ok(shop.includes("not a physical deck"));
  assert.ok(shop.includes('id="cart-panel"'));
  assert.ok(shop.includes("/terms.html"));
  assert.ok(terms.includes("No physical cards"));
  assert.ok(terms.includes("within 24 hours"));
  assert.ok(terms.includes("within 14 days"));
});
