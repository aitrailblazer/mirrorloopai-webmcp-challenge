#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_INPUT = path.join(os.homedir(), ".config", "stripe", "config.toml");
const DEFAULT_OUTPUT = path.join("private", "stripe", "account.local.json");

function usage() {
  console.log(`Usage: node scripts/stripe-account-import.mjs [--input FILE] [--out FILE]

Creates a local, secret-free inventory from Stripe CLI configuration.
The output contains account metadata, credential types, expiry dates, and
one-way fingerprints. It never copies API keys.

Defaults:
  --input ${DEFAULT_INPUT}
  --out   ${DEFAULT_OUTPUT}
`);
}

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, out: DEFAULT_OUTPUT };
  for (let index = 2; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--help") {
      usage();
      return null;
    }
    if (!["--input", "--out"].includes(flag)) {
      throw new Error(`Unknown argument: ${flag}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    args[flag.slice(2)] = value;
    index += 1;
  }
  return args;
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2
    && ((trimmed.startsWith("'") && trimmed.endsWith("'"))
      || (trimmed.startsWith('"') && trimmed.endsWith('"')))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseStripeCLIConfig(text, projectName = "default") {
  const sections = { root: {} };
  let section = "root";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      sections[section] ||= {};
      continue;
    }
    const valueMatch = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
    if (valueMatch) {
      sections[section] ||= {};
      sections[section][valueMatch[1]] = unquote(valueMatch[2]);
    }
  }
  return sections[projectName] || {};
}

function fingerprint(value) {
  if (!value || value.includes("*")) return null;
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function credentialKind(value) {
  if (value.startsWith("rk_")) return "restricted";
  if (value.startsWith("sk_")) return "secret";
  if (value.startsWith("pk_")) return "publishable";
  return value ? "unknown" : "absent";
}

function expiryStatus(expiresAt, now = new Date()) {
  if (!expiresAt) return "unknown";
  const expiry = new Date(`${expiresAt}T23:59:59Z`);
  if (!Number.isFinite(expiry.getTime())) return "unknown";
  return expiry < now ? "expired" : "current";
}

function credentialSummary(mode, config) {
  const key = config[`${mode}_mode_api_key`] || "";
  const publishableKey = config[`${mode}_mode_pub_key`] || "";
  const expiresAt = config[`${mode}_mode_key_expires_at`] || null;
  return {
    key_present: Boolean(key),
    key_kind: credentialKind(key),
    key_masked_in_source: key.includes("*"),
    key_fingerprint_sha256_16: fingerprint(key),
    publishable_key_present: Boolean(publishableKey),
    publishable_key_fingerprint_sha256_16: fingerprint(publishableKey),
    expires_at: expiresAt,
    status: expiryStatus(expiresAt),
  };
}

export function buildInventory(config, sourcePath, now = new Date()) {
  const accountID = config.account_id || null;
  return {
    schema_version: "1.0",
    imported_at: now.toISOString(),
    source: path.resolve(sourcePath),
    account: {
      id: accountID,
      id_fingerprint_sha256_16: fingerprint(accountID),
      display_name: config.display_name || null,
    },
    credentials: {
      live: credentialSummary("live", config),
      test: credentialSummary("test", config),
    },
    secret_migration: {
      api_keys_copied: false,
      destination: "GCP Secret Manager",
      required_secret_names: [
        "mirrorloop-stripe-audit-readonly-key",
        "mirrorloop-stripe-audit-hash-salt",
      ],
      note: "Create a fresh restricted read-only key. Never commit API keys or webhook secrets.",
    },
  };
}

function writePrivateJSON(outputPath, value) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${outputPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporaryPath, outputPath);
  fs.chmodSync(outputPath, 0o600);
}

function main() {
  const args = parseArgs(process.argv);
  if (!args) return;
  const text = fs.readFileSync(args.input, "utf8");
  const config = parseStripeCLIConfig(text);
  const inventory = buildInventory(config, args.input);
  writePrivateJSON(args.out, inventory);
  console.log(`Wrote secret-free Stripe account inventory: ${args.out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
