#!/usr/bin/env python3
"""Create the live order webhook and store its signing secret in GCP.

The signing secret is piped directly from Stripe to Secret Manager. It is
never printed or written to the repository.
"""

from __future__ import annotations

import json
import os
import subprocess


PROJECT_ID = os.environ.get("PROJECT_ID", "mirrorloopai-com")
SECRET_NAME = "mirrorloop-stripe-webhook-secret"
WEBHOOK_URL = "https://mirrorloopai.com/api/v1/stripe/webhook"


def run(command: list[str], *, input_text: str | None = None) -> str:
    result = subprocess.run(
        command,
        input=input_text,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout).strip())
    return result.stdout


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("test", "live"), default="live")
    args = parser.parse_args()
    mode_args = ["--live"] if args.mode == "live" else []
    existing = json.loads(run([
        "stripe", "webhook_endpoints", "list",
        *mode_args, "--limit", "100", "--color", "off",
    ]))
    if any(row.get("url") == WEBHOOK_URL for row in existing.get("data", [])):
        raise RuntimeError(
            "The live webhook already exists and Stripe will not reveal its "
            "signing secret again. Roll its signing secret in the dashboard, "
            "then add the new whsec_ value with "
            "deploy/bootstrap-stripe-webhook-secret.sh."
        )
    created = json.loads(run([
        "stripe", "webhook_endpoints", "create",
        *mode_args, "--confirm", "--color", "off",
        "-d", f"url={WEBHOOK_URL}",
        "-d", "description=MIRROR//LOOP paid-order email workflow",
        "-d", "enabled_events[0]=checkout.session.completed",
        "-d", "enabled_events[1]=checkout.session.async_payment_succeeded",
    ]))
    if created.get("error"):
        raise RuntimeError(created["error"].get("message", "Stripe rejected webhook"))
    secret = created.get("secret", "")
    if not secret.startswith("whsec_"):
        raise RuntimeError("Stripe did not return a webhook signing secret")
    try:
        run(["gcloud", "secrets", "describe", SECRET_NAME, "--project", PROJECT_ID])
    except RuntimeError:
        run([
            "gcloud", "secrets", "create", SECRET_NAME,
            "--project", PROJECT_ID, "--replication-policy=automatic",
        ])
    run([
        "gcloud", "secrets", "versions", "add", SECRET_NAME,
        "--project", PROJECT_ID, "--data-file=-",
    ], input_text=secret)
    print(f"Created {WEBHOOK_URL} and stored its signing secret in {SECRET_NAME}.")


if __name__ == "__main__":
    main()
