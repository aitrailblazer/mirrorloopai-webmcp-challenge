#!/usr/bin/env node

import crypto from "crypto";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import process from "process";

const API_BASE = "https://api.stripe.com/v1";
const API_VERSION = "2026-03-25.dahlia";
const DEFAULT_DAYS = 90;

function usage() {
  console.log(`Usage: node scripts/stripe-audit-collect.mjs [options]

Collects Stripe data locally with STRIPE_READONLY_KEY and writes sanitized JSON.
No Stripe key or raw Stripe object ID is written to output.

Options:
  --out FILE                 Output JSON file (default: artifacts/stripe-audit/<timestamp>/stripe_audit_sanitized.json)
  --days N                   Lookback window for payments and transactions (default: ${DEFAULT_DAYS})
  --substack-export FILE     Optional local Substack revenue export, JSON or simple CSV
  --mode-label LABEL         test, sandbox, live, or unknown label for the output (default inferred from key)
  --limit N                  Page size per Stripe list request, max 100 (default: 100)
  --help                     Show this help

Environment:
  STRIPE_READONLY_KEY                    Prefer rk_test/rk_live restricted read-only key.
  STRIPE_AUDIT_HASH_SALT                 Required for stable anonymization. Never exported.
  STRIPE_GCP_PROJECT                     Optional GCP project for Secret Manager lookup.
                                         Falls back to GOOGLE_CLOUD_PROJECT.
  STRIPE_READONLY_KEY_SECRET_NAME        Optional secret name (default: mirrorloop-stripe-audit-readonly-key).
  STRIPE_AUDIT_HASH_SALT_SECRET_NAME     Optional secret name (default: mirrorloop-stripe-audit-hash-salt).
`);
}

function parseArgs(argv) {
  const args = {
    out: "",
    days: DEFAULT_DAYS,
    substackExport: "",
    modeLabel: "",
    limit: 100,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help") {
      usage();
      process.exit(0);
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    i += 1;
    switch (arg) {
      case "--out":
        args.out = value;
        break;
      case "--days":
        args.days = parsePositiveInt(value, "--days");
        break;
      case "--substack-export":
        args.substackExport = value;
        break;
      case "--mode-label":
        args.modeLabel = value;
        break;
      case "--limit":
        args.limit = Math.min(100, parsePositiveInt(value, "--limit"));
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function parsePositiveInt(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function inferModeFromKey(key) {
  if (key.startsWith("rk_test_") || key.startsWith("sk_test_")) return "test";
  if (key.startsWith("rk_live_") || key.startsWith("sk_live_")) return "live";
  return "unknown";
}

function validateEnvironment() {
  const projectID = process.env.STRIPE_GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
  const key = resolveSecret({
    envName: "STRIPE_READONLY_KEY",
    projectID,
    secretName: process.env.STRIPE_READONLY_KEY_SECRET_NAME || "mirrorloop-stripe-audit-readonly-key",
    label: "Stripe read-only key",
  });
  const salt = resolveSecret({
    envName: "STRIPE_AUDIT_HASH_SALT",
    projectID,
    secretName: process.env.STRIPE_AUDIT_HASH_SALT_SECRET_NAME || "mirrorloop-stripe-audit-hash-salt",
    label: "Stripe audit hash salt",
  });
  if (!key) {
    throw new Error("STRIPE_READONLY_KEY is required, or set STRIPE_GCP_PROJECT/GOOGLE_CLOUD_PROJECT with STRIPE_READONLY_KEY_SECRET_NAME. Use a restricted read-only key; do not paste it into chat.");
  }
  if (!salt || salt.length < 16) {
    throw new Error("STRIPE_AUDIT_HASH_SALT is required, or set STRIPE_GCP_PROJECT/GOOGLE_CLOUD_PROJECT with STRIPE_AUDIT_HASH_SALT_SECRET_NAME. It must be at least 16 characters and is never exported.");
  }
  if (!key.startsWith("rk_")) {
    console.error("Warning: STRIPE_READONLY_KEY does not look like a restricted key (rk_*). Prefer a restricted read-only key.");
  }
  return { key, salt };
}

function resolveSecret({ envName, projectID, secretName, label }) {
  const envValue = process.env[envName] || "";
  if (envValue) return envValue;
  if (!projectID) return "";
  try {
    return execFileSync("gcloud", [
      "secrets",
      "versions",
      "access",
      "latest",
      "--secret",
      secretName,
      "--project",
      projectID,
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error(`${label} could not be read from GCP Secret Manager secret ${secretName}. Confirm gcloud login, project access, and secret name.`);
  }
}

function anonymizer(salt) {
  return (prefix, raw) => {
    if (!raw) return null;
    const digest = crypto.createHmac("sha256", salt).update(String(raw)).digest("hex").slice(0, 16);
    return `${prefix}_${digest}`;
  };
}

function unixDaysAgo(days) {
  return Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
}

function dateFromUnix(value) {
  if (!value) return null;
  return new Date(value * 1000).toISOString().slice(0, 10);
}

function secretSafeHeaders(key) {
  return {
    Authorization: `Bearer ${key}`,
    "Stripe-Version": API_VERSION,
  };
}

async function stripeGet(key, endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, String(value));
    }
  }
  const response = await fetch(url, { headers: secretSafeHeaders(key) });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!response.ok) {
    const type = body?.error?.type || "stripe_error";
    const code = body?.error?.code || response.status;
    const message = body?.error?.message || response.statusText;
    throw new Error(`Stripe read failed for ${endpoint}: ${type} ${code}: ${message}`);
  }
  return body;
}

async function stripeList(key, endpoint, params = {}, maxPages = 10) {
  const rows = [];
  let startingAfter = "";
  for (let page = 0; page < maxPages; page += 1) {
    const body = await stripeGet(key, endpoint, { ...params, ...(startingAfter ? { starting_after: startingAfter } : {}) });
    const data = Array.isArray(body?.data) ? body.data : [];
    rows.push(...data);
    if (!body?.has_more || data.length === 0) break;
    startingAfter = data[data.length - 1].id;
  }
  return rows;
}

async function stripeMaybeGet(key, endpoint, params = {}) {
  try {
    return { ok: true, value: await stripeGet(key, endpoint, params) };
  } catch (err) {
    return { ok: false, warning: String(err?.message || err) };
  }
}

function sanitizeBalance(balance) {
  return {
    available: sanitizeCurrencyAmounts(balance?.available),
    pending: sanitizeCurrencyAmounts(balance?.pending),
  };
}

function sanitizeCurrencyAmounts(values) {
  if (!Array.isArray(values)) return [];
  return values.map((item) => ({
    amount: numeric(item?.amount),
    currency: lowercase(item?.currency),
    source_types: sanitizeSourceTypes(item?.source_types),
  }));
}

function sanitizeSourceTypes(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => /^[a-z0-9_]+$/i.test(key))
      .map(([key, amount]) => [String(key), numeric(amount)]),
  );
}

function numeric(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function lowercase(value) {
  return String(value || "").toLowerCase();
}

function deriveSource(obj) {
  const candidates = [
    obj?.metadata?.source,
    obj?.metadata?.platform,
    obj?.metadata?.substack,
    obj?.description,
    obj?.statement_descriptor,
    obj?.statement_descriptor_suffix,
  ].map((value) => String(value || "").toLowerCase());
  return candidates.some((value) => value.includes("substack")) ? "substack" : "unknown";
}

function sanitizePaymentIntent(pi, hash) {
  const charge = pi?.latest_charge && typeof pi.latest_charge === "object"
    ? pi.latest_charge
    : (Array.isArray(pi?.charges?.data) ? pi.charges.data[0] : null);
  const balanceTx = charge?.balance_transaction && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
  const decline = declineSignal(pi, charge);
  return {
    anon_payment_id: hash("pay", pi?.id),
    anon_customer_id: hash("cust", pi?.customer),
    source: deriveSource(pi),
    created: dateFromUnix(pi?.created),
    amount: numeric(pi?.amount_received || pi?.amount),
    currency: lowercase(pi?.currency),
    status: String(pi?.status || "unknown"),
    payment_method_type: Array.isArray(pi?.payment_method_types) ? String(pi.payment_method_types[0] || "unknown") : "unknown",
    fee: numeric(balanceTx?.fee),
    net: numeric(balanceTx?.net),
    fee_details: sanitizeFeeDetails(balanceTx?.fee_details),
    refunded: numeric(charge?.amount_refunded) > 0,
    disputed: Boolean(charge?.disputed),
    decline,
  };
}

function sanitizeFailedPayment(pi, hash) {
  const charge = pi?.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const decline = declineSignal(pi, charge);
  return {
    anon_payment_id: hash("pay", pi?.id),
    anon_customer_id: hash("cust", pi?.customer),
    created: dateFromUnix(pi?.created),
    amount: numeric(pi?.amount),
    currency: lowercase(pi?.currency),
    failure_reason: String(pi?.last_payment_error?.code || decline.decline_code || "unknown"),
    decline_code: decline.decline_code,
    advice_code: decline.advice_code,
    network_decline_code: decline.network_decline_code,
    network_advice_code: decline.network_advice_code,
    outcome_type: decline.outcome_type,
    network_status: decline.network_status,
    retry_status: "unknown",
    next_retry_date: null,
  };
}

function sanitizeCharge(charge, hash) {
  const balanceTx = charge?.balance_transaction && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
  return {
    anon_charge_id: hash("ch", charge?.id),
    anon_customer_id: hash("cust", charge?.customer),
    source: deriveSource(charge),
    created: dateFromUnix(charge?.created),
    amount: numeric(charge?.amount),
    currency: lowercase(charge?.currency),
    status: String(charge?.status || "unknown"),
    paid: Boolean(charge?.paid),
    fee: numeric(balanceTx?.fee),
    net: numeric(balanceTx?.net),
    fee_details: sanitizeFeeDetails(balanceTx?.fee_details),
    refunded: numeric(charge?.amount_refunded) > 0,
    disputed: Boolean(charge?.disputed),
    decline: declineSignal(null, charge),
  };
}

function sanitizeFeeDetails(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    amount: numeric(item?.amount),
    currency: lowercase(item?.currency),
    type: safeFeeDetailText(item?.type),
    description: safeFeeDetailText(item?.description),
  }));
}

function safeFeeDetailText(value) {
  return String(value || "unknown")
    .replace(/[^a-zA-Z0-9 ._:/()+%-]/g, "")
    .slice(0, 120);
}

function declineSignal(paymentIntent, charge) {
  const error = paymentIntent?.last_payment_error || {};
  const outcome = charge?.outcome || {};
  return {
    decline_code: String(error?.decline_code || outcome?.reason || charge?.failure_code || "unknown"),
    advice_code: String(error?.advice_code || outcome?.advice_code || "unknown"),
    network_decline_code: String(outcome?.network_decline_code || "unknown"),
    network_advice_code: String(outcome?.network_advice_code || "unknown"),
    outcome_type: String(outcome?.type || "unknown"),
    network_status: String(outcome?.network_status || "unknown"),
  };
}

function sanitizePayout(payout, hash) {
  return {
    anon_payout_id: hash("po", payout?.id),
    created: dateFromUnix(payout?.created),
    arrival_date: dateFromUnix(payout?.arrival_date),
    amount: numeric(payout?.amount),
    currency: lowercase(payout?.currency),
    status: String(payout?.status || "unknown"),
    method: String(payout?.method || "unknown"),
    type: safePayoutType(payout?.type),
    source_type: String(payout?.source_type || "unknown"),
    automatic: Boolean(payout?.automatic),
    failure_code: String(payout?.failure_code || "none"),
    failure_message: String(payout?.failure_message || ""),
    reconciliation_status: String(payout?.reconciliation_status || "unknown"),
    trace_id_status: String(payout?.trace_id?.status || "unknown"),
  };
}

function safePayoutType(value) {
  const normalized = String(value || "unknown");
  return normalized === "bank_account" ? "bank" : normalized;
}

function sanitizeInvoice(invoice, hash) {
  return {
    anon_invoice_id: hash("inv", invoice?.id),
    anon_customer_id: hash("cust", invoice?.customer),
    created: dateFromUnix(invoice?.created),
    due_date: dateFromUnix(invoice?.due_date || invoice?.next_payment_attempt),
    amount_due: numeric(invoice?.amount_due),
    amount_paid: numeric(invoice?.amount_paid),
    currency: lowercase(invoice?.currency),
    status: String(invoice?.status || "unknown"),
    collection_method: String(invoice?.collection_method || "unknown"),
    attempt_count: numeric(invoice?.attempt_count),
  };
}

function sanitizeSubscription(subscription, hash) {
  const firstItem = subscription?.items?.data?.[0];
  const price = firstItem?.price || {};
  return {
    anon_subscription_id: hash("sub", subscription?.id),
    anon_customer_id: hash("cust", subscription?.customer),
    status: String(subscription?.status || "unknown"),
    current_period_start: dateFromUnix(subscription?.current_period_start),
    current_period_end: dateFromUnix(subscription?.current_period_end),
    amount: numeric(price?.unit_amount),
    currency: lowercase(price?.currency),
    interval: String(price?.recurring?.interval || "unknown"),
    source: deriveSource(subscription),
  };
}

function sanitizeCheckoutSession(session, hash) {
  return {
    anon_checkout_session_id: hash("cs", session?.id),
    anon_customer_id: hash("cust", session?.customer),
    created: dateFromUnix(session?.created),
    amount_total: numeric(session?.amount_total),
    currency: lowercase(session?.currency),
    mode: String(session?.mode || "unknown"),
    payment_status: String(session?.payment_status || "unknown"),
    status: String(session?.status || "unknown"),
    source: deriveSource(session),
  };
}

function summarizeReportType(reportType) {
  return {
    id: String(reportType?.id || "unknown"),
    name: String(reportType?.name || "unknown"),
    data_available_start: dateFromUnix(reportType?.data_available_start),
    data_available_end: dateFromUnix(reportType?.data_available_end),
  };
}

function sanitizeAccountPayoutSettings(account) {
  const schedule = account?.settings?.payouts?.schedule || {};
  return {
    country: String(account?.country || "unknown"),
    default_currency: lowercase(account?.default_currency),
    charges_enabled: Boolean(account?.charges_enabled),
    payouts_enabled: Boolean(account?.payouts_enabled),
    schedule: {
      interval: String(schedule?.interval || "unknown"),
      delay_days: numeric(schedule?.delay_days),
      weekly_anchor: String(schedule?.weekly_anchor || ""),
      monthly_anchor: numeric(schedule?.monthly_anchor),
    },
  };
}

function estimateMrr(records) {
  return records
    .filter((row) => row.status === "active")
    .reduce((sum, row) => {
      if (row.interval === "month") return sum + row.amount;
      if (row.interval === "year") return sum + Math.round(row.amount / 12);
      return sum;
    }, 0);
}

function parseSimpleCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

function loadSubstackExport(filePath, hash) {
  if (!filePath) {
    return {
      source_file: null,
      period_start: null,
      period_end: null,
      expected_revenue: 0,
      records: [],
    };
  }
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = filePath.endsWith(".json") ? JSON.parse(text) : parseSimpleCsv(text);
  const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.records) ? parsed.records : []);
  const sanitized = rows.map((row) => {
    const amount = numeric(row.amount || row.amount_paid || row.net || row.gross || row.revenue);
    const rawSubscriber = row.customer_id || row.subscriber_id || row.email || row.user_id || row.id;
    return {
      anon_substack_record_id: hash("sst", rawSubscriber || JSON.stringify(row).slice(0, 64)),
      date: String(row.date || row.created || row.period || "").slice(0, 10) || null,
      amount,
      currency: lowercase(row.currency || "usd"),
      status: String(row.status || "unknown"),
    };
  });
  const dates = sanitized.map((row) => row.date).filter(Boolean).sort();
  return {
    source_file: path.basename(filePath),
    period_start: dates[0] || null,
    period_end: dates[dates.length - 1] || null,
    expected_revenue: sanitized.reduce((sum, row) => sum + row.amount, 0),
    records: sanitized,
  };
}

function assertNoSecretLikePayload(value) {
  const text = JSON.stringify(value);
  const forbidden = [
    /sk_live_/i,
    /sk_test_/i,
    /rk_live_/i,
    /rk_test_/i,
    /stripe_readonly_key/i,
    /api[_-]?key/i,
    /secret/i,
    /client_secret/i,
    /receipt_url/i,
    /hosted_invoice_url/i,
    /billing_details/i,
    /card_[A-Za-z0-9]{10,}/i,
    /bank_account/i,
    /@/,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`Sanitized payload contains forbidden marker: ${pattern}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const { key, salt } = validateEnvironment();
  const hash = anonymizer(salt);
  const createdGte = unixDaysAgo(args.days);
  const generatedAt = new Date().toISOString();
  const outputPath = args.out || path.join("artifacts", "stripe-audit", timestamp(), "stripe_audit_sanitized.json");

  const balance = await stripeGet(key, "/balance");
  const accountResult = await stripeMaybeGet(key, "/account");
  const [payouts, balanceTransactions, paymentIntents, charges, invoices, subscriptions, checkoutSessions, reportTypes, reportRuns] = await Promise.all([
    stripeList(key, "/payouts", { limit: args.limit }, 2),
    stripeList(key, "/balance_transactions", { limit: args.limit, "created[gte]": createdGte }, 10),
    stripeList(key, "/payment_intents", { limit: args.limit, "created[gte]": createdGte, "expand[]": "data.latest_charge.balance_transaction" }, 10),
    stripeList(key, "/charges", { limit: args.limit, "created[gte]": createdGte, "expand[]": "data.balance_transaction" }, 10),
    stripeList(key, "/invoices", { limit: args.limit, "created[gte]": createdGte }, 10),
    stripeList(key, "/subscriptions", { limit: args.limit, status: "all" }, 10),
    stripeList(key, "/checkout/sessions", { limit: args.limit, "created[gte]": createdGte }, 10),
    stripeList(key, "/reporting/report_types", {}, 1),
    stripeList(key, "/reporting/report_runs", { limit: args.limit }, 1),
  ]);

  const subscriptionRecords = subscriptions.map((subscription) => sanitizeSubscription(subscription, hash));
  const sanitized = {
    schema_version: "1.0",
    generated_at: generatedAt,
    mode: args.modeLabel || inferModeFromKey(key),
    currency: "usd",
    lookback_days: args.days,
    balances: sanitizeBalance(balance),
    payments: paymentIntents.map((pi) => sanitizePaymentIntent(pi, hash)),
    charges: charges.map((charge) => sanitizeCharge(charge, hash)),
    payouts: payouts.map((payout) => sanitizePayout(payout, hash)),
    balance_transactions: balanceTransactions.map((tx) => ({
      anon_balance_transaction_id: hash("btxn", tx?.id),
      created: dateFromUnix(tx?.created),
      available_on: dateFromUnix(tx?.available_on),
      amount: numeric(tx?.amount),
      fee: numeric(tx?.fee),
      net: numeric(tx?.net),
      fee_details: sanitizeFeeDetails(tx?.fee_details),
      currency: lowercase(tx?.currency),
      type: String(tx?.type || "unknown"),
      reporting_category: String(tx?.reporting_category || "unknown"),
      status: String(tx?.status || "unknown"),
    })),
    invoices: invoices.map((invoice) => sanitizeInvoice(invoice, hash)),
    checkout_sessions: checkoutSessions.map((session) => sanitizeCheckoutSession(session, hash)),
    failed_payments: paymentIntents
      .filter((pi) => pi?.status === "requires_payment_method" || pi?.last_payment_error)
      .map((pi) => sanitizeFailedPayment(pi, hash)),
    subscriptions: {
      active_count: subscriptionRecords.filter((row) => row.status === "active").length,
      mrr: estimateMrr(subscriptionRecords),
      records: subscriptionRecords,
    },
    reporting: {
      report_types_count: reportTypes.length,
      payment_analytics_report_types: reportTypes
        .filter((reportType) => /payins_insights|payment|card_payments|balance_change|payout|fee/i.test(`${reportType?.id || ""} ${reportType?.name || ""}`))
        .slice(0, 40)
        .map(summarizeReportType),
      recent_report_runs: reportRuns.slice(0, 20).map((reportRun) => ({
        report_type: String(reportRun?.report_type || "unknown"),
        status: String(reportRun?.status || "unknown"),
        created: dateFromUnix(reportRun?.created),
        has_result: Boolean(reportRun?.result),
      })),
    },
    payout_settings: accountResult.ok ? sanitizeAccountPayoutSettings(accountResult.value) : null,
    substack: loadSubstackExport(args.substackExport, hash),
    collection_warnings: [
      ...(key.startsWith("rk_") ? [] : ["Key does not look like a restricted key. Prefer rk_test/rk_live with read-only permissions."]),
      ...(accountResult.ok ? [] : [`Account payout settings unavailable: ${accountResult.warning}`]),
    ],
  };

  assertNoSecretLikePayload(sanitized);
  writeJson(outputPath, sanitized);
  console.log(`Wrote sanitized Stripe audit export: ${outputPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
