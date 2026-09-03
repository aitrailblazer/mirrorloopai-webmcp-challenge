#!/usr/bin/env python3
"""Provision the canonical MIRROR//LOOP web catalog in live Stripe.

The operation is idempotent by metadata.mirrorloop_sku and Price lookup_key.
It intentionally creates products and prices only; the website creates a
single hosted Checkout Session for the visitor's complete cart.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "catalog" / "shop-source.json"
WEB_CATALOG = ROOT / "web" / "data" / "shop.json"
GO_CATALOG = ROOT / "api" / "internal" / "commerce" / "catalog_gen.go"
SITE = "https://mirrorloopai.com"

LEGACY_NAMES = {
    "arc-01-mono": "Mirror // Loop — Arc 01: Future-Pull Mechanics (Mono Edition · Visual )",
    "arc-01-color": "Mirror // Loop — Arc 01: Future-Pull Mechanics (Full-Color Visual Edition)",
    "deck-mono-visual": "144 Mirror // Loop - Full 144-Card Deck  in pure gold-on-black minimalism. (Regular: $349)",
    "deck-color-visual": "144 Mirror // Loop — Full 144-Card Deck (Full-Color Visual Edition · Pre-order) Regular: $399",
    "deck-mono-insight": "144 Mirror // Loop — Full 144-Card Deck (Mono Insight Edition · Pre-order) Regular: $499",
    "deck-color-insight": "144 Mirror // Loop — Full 144-Card Deck (Full-Color Insight Edition · Pre-order) Regular: $599",
}


STRIPE_MODE = "live"


def existing_product_names(item: dict) -> set[str]:
    """Return every known historical name for one canonical storefront SKU."""
    names = {f"{item['title']} — {item['subtitle']}"}
    legacy_name = LEGACY_NAMES.get(item["sku"])
    if legacy_name:
        names.add(legacy_name)
    if item.get("arcCode"):
        edition = (
            "Mono Visual Edition"
            if item["edition"] == "mono"
            else "Full-Color Visual Edition"
        )
        names.add(
            f"Mirror // Loop — Arc {item['arcCode']}: "
            f"{item['domain']} ({edition})"
        )
    return names


def stripe(arguments: list[str], dry_run: bool = False) -> dict:
    if dry_run:
        print("DRY RUN:", " ".join(arguments))
        return {}
    command = ["stripe", *arguments, "--color", "off"]
    if STRIPE_MODE == "live":
        command.append("--live")
    if any(operation in arguments for operation in ("create", "update")):
        command.append("--confirm")
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout).strip())
    if not result.stdout.strip():
        raise RuntimeError("Stripe returned no object; the write was not applied")
    payload = json.loads(result.stdout)
    if payload.get("error"):
        error = payload["error"]
        raise RuntimeError(
            f"{error.get('code', 'stripe_error')}: "
            f"{error.get('message', 'Stripe rejected the operation')}"
        )
    return payload


def list_all(resource: list[str]) -> list[dict]:
    rows: list[dict] = []
    cursor = None
    for _ in range(100):
        arguments = [*resource, "--limit", "100"]
        if cursor:
            arguments.extend(["--starting-after", cursor])
        page = stripe(arguments)
        page_rows = page.get("data", [])
        rows.extend(page_rows)
        if not page.get("has_more") or not page_rows:
            return rows
        cursor = page_rows[-1]["id"]
    raise RuntimeError("Stripe pagination safety limit reached")


def expanded_items(source: dict) -> list[dict]:
    items = list(source["collections"])
    for arc in source["arcs"]:
        for edition in source["arcEditions"]:
            items.append({
                "sku": f"arc-{arc['code']}-{edition['edition']}",
                "title": f"ARC {arc['code']} · {arc['name']}",
                "subtitle": edition["label"],
                "description": (
                    f"{edition['description']} "
                    f"{arc['domain']}, Cards {arc['firstCard']:03d}–"
                    f"{arc['firstCard'] + 11:03d}."
                ),
                "unitAmount": edition["unitAmount"],
                "edition": edition["edition"],
                "kind": "arc",
                "arcCode": arc["code"],
                "domain": arc["domain"],
                "image": (
                    f"/images/shop/arc-{arc['code']}-"
                    f"{edition['edition']}.webp"
                ),
            })
    return items


def create_or_update_product(
    item: dict,
    products: list[dict],
    dry_run: bool,
) -> dict:
    by_sku = {
        product.get("metadata", {}).get("mirrorloop_sku"): product
        for product in products
    }
    by_name = {product.get("name"): product for product in products}
    product = by_sku.get(item["sku"]) or next(
        (
            by_name[name]
            for name in existing_product_names(item)
            if name in by_name
        ),
        None,
    )
    name = f"{item['title']} — {item['subtitle']}"
    arguments = [
        "-d", f"name={name}",
        "-d", f"description={item['description']}",
        "-d", "active=true",
        "-d", f"images[0]={SITE}{item['image']}",
        "-d", f"metadata[mirrorloop_sku]={item['sku']}",
        "-d", f"metadata[kind]={item['kind']}",
        "-d", f"metadata[edition]={item['edition']}",
        "-d", "metadata[fulfillment]=digital",
    ]
    if item.get("arcCode"):
        arguments.extend([
            "-d",
            f"metadata[arc_code]={item['arcCode']}",
        ])
    if product:
        updated = stripe(
            ["products", "update", product["id"], *arguments],
            dry_run,
        )
        return updated or {**product, "name": name}
    product_id = "prod_ml_" + item["sku"].replace("-", "_")
    created = stripe(
        ["products", "create", "--id", product_id, *arguments],
        dry_run,
    )
    return created or {"id": product_id, "name": name, "metadata": {
        "mirrorloop_sku": item["sku"],
    }}


def create_or_update_price(
    item: dict,
    product: dict,
    prices: list[dict],
    dry_run: bool,
) -> dict:
    lookup_key = "mirrorloop_" + item["sku"].replace("-", "_") + "_usd"
    product_prices = [
        price for price in prices if price.get("product") == product["id"]
    ]
    price = next(
        (
            row for row in product_prices
            if row.get("currency") == "usd"
            and row.get("unit_amount") == item["unitAmount"]
            and row.get("type") == "one_time"
        ),
        None,
    )
    if price:
        updated = stripe([
            "prices", "update", price["id"],
            "-d", "active=true",
            "-d", f"nickname=MIRROR//LOOP {item['sku']}",
            "-d", f"lookup_key={lookup_key}",
            "-d", "transfer_lookup_key=true",
            "-d", f"metadata[mirrorloop_sku]={item['sku']}",
        ], dry_run)
        return updated or price
    created = stripe([
        "prices", "create",
        "-d", "currency=usd",
        "-d", f"unit_amount={item['unitAmount']}",
        "-d", f"product={product['id']}",
        "-d", f"nickname=MIRROR//LOOP {item['sku']}",
        "-d", f"lookup_key={lookup_key}",
        "-d", f"metadata[mirrorloop_sku]={item['sku']}",
    ], dry_run)
    return created or {
        "id": f"dry_run_{item['sku']}",
        "currency": "usd",
        "unit_amount": item["unitAmount"],
    }


def retire_preorders(products: list[dict], prices: list[dict], dry_run: bool):
    preorder = next(
        (
            product for product in products
            if product.get("name")
            == "Identity Blueprint Pre-order $127 (regular $144)"
        ),
        None,
    )
    if not preorder:
        return
    stripe(["products", "update", preorder["id"], "-d", "active=false"], dry_run)
    for price in prices:
        if price.get("product") == preorder["id"] and price.get("active"):
            stripe(["prices", "update", price["id"], "-d", "active=false"], dry_run)


def verify_write_permissions(
    products: list[dict],
    prices: list[dict],
    dry_run: bool,
) -> None:
    """Fail before catalog mutation unless the CLI key can write both objects."""
    if dry_run:
        return
    product = next((row for row in products if row.get("active")), None)
    price = next((row for row in prices if row.get("active")), None)
    if not product or not price:
        raise RuntimeError("Stripe has no active product and price for write preflight")
    stripe([
        "products", "update", product["id"],
        "-d", f"active={str(product['active']).lower()}",
    ])
    stripe([
        "prices", "update", price["id"],
        "-d", f"active={str(price['active']).lower()}",
    ])


def write_catalog(items: list[dict]) -> None:
    public = {
        "schemaVersion": "1.0",
        "items": [
            {
                key: value
                for key, value in item.items()
                if key not in {"stripePriceID", "unitAmount", "displayPrice"}
            }
            for item in items
        ],
    }
    WEB_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    WEB_CATALOG.write_text(json.dumps(public, indent=2) + "\n")

    lines = [
        "// Code generated by scripts/stripe-provision-shop.py; DO NOT EDIT.",
        "package commerce",
        "",
        "var allowedPrices = map[string]string{",
    ]
    for item in items:
        lines.append(f'\t"{item["sku"]}": "{item["stripePriceID"]}",')
    lines.extend(["}", "", "var productNames = map[string]string{"])
    for item in items:
        name = f"{item['title']} — {item['subtitle']}"
        lines.append(
            f'\t{json.dumps(item["sku"])}: {json.dumps(name)},'
        )
    lines.extend(["}", ""])
    GO_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    GO_CATALOG.write_text("\n".join(lines))


def main() -> None:
    global STRIPE_MODE
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--mode", choices=("test", "live"), default="live")
    args = parser.parse_args()
    STRIPE_MODE = args.mode
    source = json.loads(SOURCE.read_text())
    items = expanded_items(source)
    products = list_all(["products", "list"])
    prices = list_all(["prices", "list"])
    verify_write_permissions(products, prices, args.dry_run)
    retire_preorders(products, prices, args.dry_run)
    published = []
    for item in items:
        product = create_or_update_product(item, products, args.dry_run)
        price = create_or_update_price(
            item,
            product,
            prices,
            args.dry_run,
        )
        published.append({
            **item,
            "stripePriceID": price["id"],
        })
        print(f"{item['sku']}: {product['id']} / {price['id']}")
    if not args.dry_run:
        write_catalog(published)
        print(f"Wrote {WEB_CATALOG}")
        print(f"Wrote {GO_CATALOG}")


if __name__ == "__main__":
    main()
