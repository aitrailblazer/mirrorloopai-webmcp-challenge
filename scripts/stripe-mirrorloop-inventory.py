#!/usr/bin/env python3
"""Build a PII-free inventory of MIRROR//LOOP objects and payments in Stripe.

The script delegates authentication to Stripe CLI, follows product/price/
Payment Link/Checkout relationships, anonymizes Stripe object IDs, and writes
only product-facing and aggregate payment information.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess


PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"mirror\s*//?\s*loop",
        r"mirrorloop",
        r"com\.aitrailblazer\.mirrorloop",
    )
]


def stripe(arguments: list[str]) -> dict:
    command = ["stripe", *arguments, "--live", "--color", "off"]
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout).strip())
    return json.loads(result.stdout)


def list_all(arguments: list[str]) -> list[dict]:
    rows: list[dict] = []
    cursor = None
    for _ in range(100):
        page_arguments = [*arguments, "--limit", "100"]
        if cursor:
            page_arguments.extend(["--starting-after", cursor])
        page = stripe(page_arguments)
        page_rows = page.get("data", [])
        rows.extend(page_rows)
        if not page.get("has_more") or not page_rows:
            return rows
        cursor = page_rows[-1]["id"]
    raise RuntimeError("Stripe pagination safety limit reached")


def contains_mirrorloop(value: object) -> bool:
    excluded = {
        "address",
        "billing_details",
        "customer_details",
        "email",
        "name",
        "phone",
        "receipt_email",
        "shipping",
    }

    def strings(item: object):
        if isinstance(item, dict):
            for key, child in item.items():
                if key.lower() not in excluded:
                    yield from strings(child)
        elif isinstance(item, list):
            for child in item:
                yield from strings(child)
        elif isinstance(item, str):
            yield item

    return any(pattern.search(text) for text in strings(value) for pattern in PATTERNS)


def anonymous_id(value: object) -> str | None:
    if not value:
        return None
    payload = f"mirrorloop-stripe-audit-v2:{value}".encode()
    return hashlib.sha256(payload).hexdigest()[:16]


def utc_date(value: object) -> str | None:
    try:
        timestamp = int(value)
    except (TypeError, ValueError):
        return None
    return datetime.datetime.fromtimestamp(
        timestamp,
        datetime.timezone.utc,
    ).date().isoformat()


def line_price(line: dict) -> tuple[str | None, str | None]:
    price = line.get("price") or {}
    if price:
        return price.get("id"), price.get("product")
    price_details = (line.get("pricing") or {}).get("price_details") or {}
    return price_details.get("price"), price_details.get("product")


def main() -> None:
    products = list_all(["products", "list"])
    mirrorloop_products = {
        row["id"]: row for row in products if contains_mirrorloop(row)
    }

    prices = list_all(["prices", "list"])
    mirrorloop_prices = {
        row["id"]: row
        for row in prices
        if row.get("product") in mirrorloop_products or contains_mirrorloop(row)
    }

    links = list_all(["payment_links", "list"])
    mirrorloop_links: dict[str, dict] = {}
    for link in links:
        try:
            lines = stripe([
                "get",
                f"/v1/payment_links/{link['id']}/line_items",
                "--limit",
                "100",
            ]).get("data", [])
        except RuntimeError:
            lines = []
        related = any(
            price_id in mirrorloop_prices or product_id in mirrorloop_products
            for price_id, product_id in map(line_price, lines)
        )
        if related or contains_mirrorloop(link):
            mirrorloop_links[link["id"]] = {"object": link, "lines": lines}

    sessions = list_all(["checkout", "sessions", "list"])
    mirrorloop_sessions: dict[str, dict] = {}
    for session in sessions:
        related = (
            session.get("payment_link") in mirrorloop_links
            or contains_mirrorloop(session)
        )
        if not related and not session.get("payment_link"):
            try:
                lines = stripe([
                    "get",
                    f"/v1/checkout/sessions/{session['id']}/line_items",
                    "--limit",
                    "100",
                ]).get("data", [])
            except RuntimeError:
                lines = []
            related = any(
                price_id in mirrorloop_prices
                or product_id in mirrorloop_products
                for price_id, product_id in map(line_price, lines)
            )
        if related:
            mirrorloop_sessions[session["id"]] = session

    payment_intents = list_all(["payment_intents", "list"])
    mirrorloop_payment_intents = {
        row["id"]: row
        for row in payment_intents
        if contains_mirrorloop(row)
        or any(
            session.get("payment_intent") == row["id"]
            for session in mirrorloop_sessions.values()
        )
    }

    charges = list_all(["charges", "list"])
    mirrorloop_charges = {
        row["id"]: row
        for row in charges
        if contains_mirrorloop(row)
        or row.get("payment_intent") in mirrorloop_payment_intents
    }

    refunds = list_all(["refunds", "list"])
    mirrorloop_refunds = {
        row["id"]: row
        for row in refunds
        if row.get("payment_intent") in mirrorloop_payment_intents
        or row.get("charge") in mirrorloop_charges
    }

    disputes = list_all(["disputes", "list"])
    mirrorloop_disputes = {
        row["id"]: row
        for row in disputes
        if row.get("payment_intent") in mirrorloop_payment_intents
        or row.get("charge") in mirrorloop_charges
    }

    report = {
        "schema_version": "2.0",
        "generated_at": datetime.datetime.now(
            datetime.timezone.utc
        ).isoformat(),
        "mode": "live",
        "counts": {
            "products": len(mirrorloop_products),
            "prices": len(mirrorloop_prices),
            "payment_links": len(mirrorloop_links),
            "checkout_sessions": len(mirrorloop_sessions),
            "payment_intents": len(mirrorloop_payment_intents),
            "charges": len(mirrorloop_charges),
            "refunds": len(mirrorloop_refunds),
            "disputes": len(mirrorloop_disputes),
        },
        "products": [],
        "payment_links": [],
        "payments": [],
        "refunds": [],
        "disputes": [],
        "totals": {},
    }

    for product in mirrorloop_products.values():
        product_prices = [
            price
            for price in mirrorloop_prices.values()
            if price.get("product") == product["id"]
        ]
        report["products"].append({
            "anonymous_product_id": anonymous_id(product["id"]),
            "name": product.get("name"),
            "active": product.get("active"),
            "created": utc_date(product.get("created")),
            "prices": [
                {
                    "anonymous_price_id": anonymous_id(price["id"]),
                    "active": price.get("active"),
                    "currency": price.get("currency"),
                    "amount_minor": price.get("unit_amount"),
                    "type": price.get("type"),
                    "recurring": price.get("recurring"),
                }
                for price in product_prices
            ],
        })

    for link_id, link_record in mirrorloop_links.items():
        link = link_record["object"]
        report["payment_links"].append({
            "anonymous_payment_link_id": anonymous_id(link_id),
            "active": link.get("active"),
            "url": link.get("url"),
            "inactive_message": link.get("inactive_message"),
            "prices": [
                anonymous_id(price_id)
                for price_id, _ in map(line_price, link_record["lines"])
                if price_id
            ],
        })

    for payment in sorted(
        mirrorloop_payment_intents.values(),
        key=lambda row: row.get("created", 0),
    ):
        sessions_for_payment = [
            session
            for session in mirrorloop_sessions.values()
            if session.get("payment_intent") == payment["id"]
        ]
        payment_link_id = (
            sessions_for_payment[0].get("payment_link")
            if sessions_for_payment
            else None
        )
        linked_lines = (
            mirrorloop_links[payment_link_id]["lines"]
            if payment_link_id in mirrorloop_links
            else []
        )
        linked_product_names = sorted({
            mirrorloop_products[product_id].get("name")
            for _, product_id in map(line_price, linked_lines)
            if product_id in mirrorloop_products
        })
        report["payments"].append({
            "anonymous_payment_id": anonymous_id(payment["id"]),
            "created": utc_date(payment.get("created")),
            "status": payment.get("status"),
            "amount_minor": payment.get("amount_received")
            or payment.get("amount"),
            "currency": payment.get("currency"),
            "products": linked_product_names,
            "description": payment.get("description"),
            "checkout_session_count": len(sessions_for_payment),
            "payment_link": (
                anonymous_id(payment_link_id)
                if payment_link_id
                else None
            ),
            "refunded": any(
                refund.get("payment_intent") == payment["id"]
                for refund in mirrorloop_refunds.values()
            ),
            "disputed": any(
                dispute.get("payment_intent") == payment["id"]
                for dispute in mirrorloop_disputes.values()
            ),
        })

    for refund in mirrorloop_refunds.values():
        report["refunds"].append({
            "anonymous_refund_id": anonymous_id(refund["id"]),
            "created": utc_date(refund.get("created")),
            "status": refund.get("status"),
            "amount_minor": refund.get("amount"),
            "currency": refund.get("currency"),
        })

    for dispute in mirrorloop_disputes.values():
        report["disputes"].append({
            "anonymous_dispute_id": anonymous_id(dispute["id"]),
            "created": utc_date(dispute.get("created")),
            "status": dispute.get("status"),
            "amount_minor": dispute.get("amount"),
            "currency": dispute.get("currency"),
        })

    for status in sorted({
        payment["status"] for payment in report["payments"]
    }):
        for currency in sorted({
            payment["currency"]
            for payment in report["payments"]
            if payment["status"] == status
        }):
            report["totals"][f"{status}_{currency}_minor"] = sum(
                payment["amount_minor"] or 0
                for payment in report["payments"]
                if payment["status"] == status
                and payment["currency"] == currency
            )

    succeeded = [
        payment
        for payment in report["payments"]
        if payment["status"] == "succeeded"
    ]
    report["summary"] = {
        "successful_payment_count": len(succeeded),
        "refunded_payment_count": sum(
            1 for payment in succeeded if payment["refunded"]
        ),
        "retained_payment_count": sum(
            1 for payment in succeeded if not payment["refunded"]
        ),
        "gross_minor_by_currency": {},
        "refund_minor_by_currency": {},
        "net_before_fees_minor_by_currency": {},
    }
    currencies = sorted({
        payment["currency"] for payment in succeeded
    } | {
        refund["currency"] for refund in report["refunds"]
    })
    for currency in currencies:
        gross = sum(
            payment["amount_minor"] or 0
            for payment in succeeded
            if payment["currency"] == currency
        )
        refunded = sum(
            refund["amount_minor"] or 0
            for refund in report["refunds"]
            if refund["currency"] == currency
            and refund["status"] == "succeeded"
        )
        report["summary"]["gross_minor_by_currency"][currency] = gross
        report["summary"]["refund_minor_by_currency"][currency] = refunded
        report["summary"]["net_before_fees_minor_by_currency"][
            currency
        ] = gross - refunded

    output = Path(
        "artifacts/stripe-audit/mirrorloop-inventory/"
        "mirrorloop_stripe_graph.json"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    os.chmod(output, 0o600)
    print(json.dumps({
        "path": str(output),
        "counts": report["counts"],
        "summary": report["summary"],
        "totals": report["totals"],
        "payments": report["payments"],
        "products": report["products"],
        "payment_links": report["payment_links"],
        "refunds": report["refunds"],
        "disputes": report["disputes"],
    }, indent=2))


if __name__ == "__main__":
    main()
