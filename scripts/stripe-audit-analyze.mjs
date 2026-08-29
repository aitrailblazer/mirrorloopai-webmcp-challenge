#!/usr/bin/env node

import fs from "fs";
import path from "path";
import process from "process";

function usage() {
  console.log(`Usage: node scripts/stripe-audit-analyze.mjs --input FILE [--out FILE]

Analyzes sanitized Stripe/Substack JSON only. This script does not call Stripe.

Options:
  --input FILE    Sanitized JSON from scripts/stripe-audit-collect.mjs
  --out FILE      Output report JSON (default: alongside input as stripe_audit_analysis.json)
  --help          Show this help
`);
}

function parseArgs(argv) {
  const args = { input: "", out: "" };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help") {
      usage();
      process.exit(0);
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    i += 1;
    switch (arg) {
      case "--input":
        args.input = value;
        break;
      case "--out":
        args.out = value;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.input) throw new Error("--input is required");
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function amount(rows, field = "amount") {
  return rows.reduce((sum, row) => sum + number(row?.[field]), 0);
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const start = new Date(`${a}T00:00:00Z`).getTime();
  const end = new Date(`${b}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function dateDaysAgo(generatedAt, days) {
  const base = generatedAt ? new Date(generatedAt) : new Date();
  return new Date(base.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function since(rows, field, cutoff) {
  return rows.filter((row) => String(row?.[field] || "") >= cutoff);
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, rows: group }));
}

function analyzePayouts(payouts) {
  const delays = payouts.map((row) => daysBetween(row.created, row.arrival_date)).filter((value) => value !== null);
  const values = payouts.map((row) => number(row.amount));
  const avg = average(values);
  const large = payouts.filter((row) => avg !== null && Math.abs(number(row.amount) - avg) > Math.max(avg * 0.5, 10_000));
  return {
    count: payouts.length,
    average_delay_days: average(delays),
    median_delay_days: median(delays),
    failed_or_canceled: payouts.filter((row) => ["failed", "canceled"].includes(row.status)),
    pending_or_in_transit: payouts.filter((row) => ["pending", "in_transit"].includes(row.status)),
    large_fluctuations: large,
    by_status: countBy(payouts, (row) => row.status || "unknown"),
    by_method: countBy(payouts, (row) => row.method || "unknown"),
    by_source_type: countBy(payouts, (row) => row.source_type || "unknown"),
    failure_codes: countBy(
      payouts.filter((row) => row.failure_code && row.failure_code !== "none"),
      (row) => row.failure_code,
    ),
  };
}

function analyzeFailedPayments(failedPayments) {
  return groupBy(failedPayments, (row) => row.decline_code || row.failure_reason || "unknown")
    .map(({ key, rows }) => ({
      decline_code: key,
      failure_reasons: [...new Set(rows.map((row) => row.failure_reason || "unknown"))].sort(),
      advice_codes: [...new Set(rows.map((row) => row.advice_code || "unknown"))].sort(),
      network_decline_codes: [...new Set(rows.map((row) => row.network_decline_code || "unknown"))].sort(),
      count: rows.length,
      amount: amount(rows),
      retry_statuses: [...new Set(rows.map((row) => row.retry_status || "unknown"))].sort(),
      likely_recovery_action: recoveryAction(key),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function countBy(rows, keyFn) {
  return groupBy(rows, keyFn)
    .map(({ key, rows: groupRows }) => ({ key, count: groupRows.length, amount: amount(groupRows) }))
    .sort((a, b) => b.count - a.count || b.amount - a.amount);
}

function recoveryAction(reason) {
  if (reason.includes("insufficient")) return "Retry on payroll cadence and send a payment-method update reminder.";
  if (reason.includes("authentication")) return "Trigger customer authentication flow and monitor next invoice attempt.";
  if (reason.includes("expired")) return "Prompt the customer to update the card expiration date or replace the card.";
  if (reason.includes("incorrect") || reason.includes("invalid")) return "Ask the customer to correct card details or use a different payment method.";
  if (reason.includes("stolen") || reason.includes("lost")) return "Do not retry automatically; ask the customer for a different payment method.";
  if (reason.includes("declined")) return "Prompt payment-method replacement and suppress repeated blind retries.";
  return "Review issuer response, retry schedule, and customer notification path.";
}

function analyzeDrift(data) {
  const substackExpected = number(data?.substack?.expected_revenue);
  const substackStripePayments = (data.payments || []).filter((row) => row.source === "substack" && row.status === "succeeded");
  const stripeObserved = amount(substackStripePayments);
  const delta = stripeObserved - substackExpected;
  return {
    substack_expected_revenue: substackExpected,
    stripe_observed_substack_revenue: stripeObserved,
    delta,
    delta_percent: substackExpected ? (delta / substackExpected) * 100 : null,
    limitation: substackExpected === 0
      ? "No Substack expected revenue export was provided; drift cannot be fully measured."
      : null,
  };
}

function forecast(data, payments, payouts, failedPayments) {
  const dailyNet = amount(payments, "net") / Math.max(number(data.lookback_days) || 90, 1);
  const dailyPayout = amount(payouts) / Math.max(number(data.lookback_days) || 90, 1);
  const failedDrag = amount(failedPayments) * 0.35;
  const available = amount(data?.balances?.available || []);
  const pending = amount(data?.balances?.pending || []);
  const build = (days) => {
    const expectedInflows = Math.round(dailyNet * days);
    const expectedPayouts = Math.round(dailyPayout * days);
    const projected = available + pending + expectedInflows - failedDrag;
    return {
      horizon_days: days,
      available_balance: available,
      pending_balance: pending,
      expected_net_inflows: expectedInflows,
      expected_payout_reference: expectedPayouts,
      failed_payment_risk_drag: Math.round(failedDrag),
      projected_cash_available: Math.round(projected),
      confidence: payments.length >= 20 ? "medium" : "low",
      assumptions: [
        "Uses historical daily net payment average from sanitized lookback window.",
        "Treats 35% of failed payment amount as near-term risk drag.",
        "Does not model external bank expenses or Substack platform-side timing unless provided.",
      ],
    };
  };
  return [build(14), build(30)];
}

function feeReview(payments) {
  const totalAmount = amount(payments);
  const totalFees = amount(payments, "fee");
  const feeRate = totalAmount ? totalFees / totalAmount : null;
  const byMethod = groupBy(payments, (row) => row.payment_method_type || "unknown")
    .map(({ key, rows }) => ({
      payment_method_type: key,
      volume: amount(rows),
      fees: amount(rows, "fee"),
      fee_rate: amount(rows) ? amount(rows, "fee") / amount(rows) : null,
    }));
  return {
    total_fees: totalFees,
    fee_rate: feeRate,
    by_payment_method: byMethod,
    opportunities: [
      "Confirm subscription plans are using the lowest-friction supported payment methods for your audience.",
      "Reduce failed-payment retries that generate operational drag by tuning dunning and reminders.",
      "Review refund and dispute reasons monthly; preventable refunds are fee and revenue leakage.",
      "Separate Substack-tagged payment reporting from other Stripe activity to avoid reconciliation labor.",
      "Use payout cadence reporting to align cash reserves with actual settlement timing.",
    ],
  };
}

function feeBreakdown(data, successfulPayments) {
  const balanceTransactions = data.balance_transactions || [];
  const feeBearing = balanceTransactions.filter((row) => number(row.fee) !== 0);
  const feeDetails = balanceTransactions.flatMap((tx) => (tx.fee_details || []).map((detail) => ({
    ...detail,
    reporting_category: tx.reporting_category || "unknown",
    transaction_type: tx.type || "unknown",
  })));
  const successfulPaymentVolume = amount(successfulPayments);
  const chargeLikeAmount = balanceTransactions
    .filter((row) => row.type === "charge" || row.type === "payment" || row.reporting_category === "charge")
    .reduce((sum, row) => sum + number(row.amount), 0);
  const totalFeesFromPayments = amount(successfulPayments, "fee");
  const totalFeesFromBalanceTransactions = amount(balanceTransactions, "fee");
  return {
    sanity: {
      balance_transactions_count: balanceTransactions.length,
      fee_bearing_balance_transactions: feeBearing.length,
      successful_payment_volume: successfulPaymentVolume,
      fees_from_successful_payments: totalFeesFromPayments,
      fees_from_balance_transactions: totalFeesFromBalanceTransactions,
      gross_charge_like_balance_transaction_amount: chargeLikeAmount,
      payment_fee_rate: successfulPaymentVolume ? totalFeesFromPayments / successfulPaymentVolume : null,
      balance_transaction_fee_rate_on_charge_like_amount: chargeLikeAmount ? totalFeesFromBalanceTransactions / chargeLikeAmount : null,
    },
    by_reporting_category: summarizeFeeGroups(feeBearing, ["reporting_category"]),
    by_transaction_type: summarizeFeeGroups(feeBearing, ["type"]),
    by_currency: summarizeFeeGroups(feeBearing, ["currency"]),
    by_reporting_category_and_type: summarizeFeeGroups(feeBearing, ["reporting_category", "type"]),
    fee_details: {
      count: feeDetails.length,
      total_amount: amount(feeDetails),
      by_type: summarizeFeeDetailGroups(feeDetails, ["type"]),
      by_description: summarizeFeeDetailGroups(feeDetails, ["description"]),
      by_currency: summarizeFeeDetailGroups(feeDetails, ["currency"]),
      by_reporting_category_and_type: summarizeFeeDetailGroups(feeDetails, ["reporting_category", "transaction_type", "type"]),
    },
  };
}

function summarizeFeeGroups(rows, fields) {
  return groupBy(rows, (row) => fields.map((field) => row[field] || "unknown").join(" | "))
    .map(({ key, rows: groupRows }) => {
      const groupAmount = amount(groupRows);
      const groupFee = amount(groupRows, "fee");
      return {
        key,
        count: groupRows.length,
        amount: groupAmount,
        fee: groupFee,
        net: amount(groupRows, "net"),
        fee_rate_on_amount: groupAmount ? groupFee / groupAmount : null,
      };
    })
    .sort((a, b) => Math.abs(b.fee) - Math.abs(a.fee));
}

function summarizeFeeDetailGroups(rows, fields) {
  return groupBy(rows, (row) => fields.map((field) => row[field] || "unknown").join(" | "))
    .map(({ key, rows: groupRows }) => ({
      key,
      count: groupRows.length,
      amount: amount(groupRows),
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

function recommendations(report) {
  return [
    {
      action: "Run the sanitized Stripe audit weekly and compare deltas against the prior report.",
      impact: "Improves billing trust and catches drift early.",
      effort: "low",
    },
    {
      action: "Add explicit Substack source tagging or a deterministic mapping table before claiming Substack MRR.",
      impact: "Prevents false revenue attribution.",
      effort: "medium",
    },
    {
      action: "Work failed payments by largest recoverable reason group first.",
      impact: `Targets ${report.failed_payments.by_reason[0]?.amount || 0} in the largest failed-payment bucket.`,
      effort: "low",
    },
    {
      action: "Track payout delay median and alert when new payouts exceed the historical median by two days.",
      impact: "Improves cash-flow response time.",
      effort: "low",
    },
    {
      action: "Keep Stripe restricted key permissions documented beside the collector runbook.",
      impact: "Maintains least-privilege audit posture.",
      effort: "low",
    },
  ];
}

function packageIdeas() {
  return [
    {
      name: "Cash Flow Guardian",
      target_user: "Substack founder-operator using Stripe for recurring payments.",
      core_promise: "Know the next 14 and 30 days of cash risk before it hits the bank account.",
      modules: ["Payout cadence", "Balance runway", "Failed-payment drag", "Refund/dispute watch", "Top-up timing"],
      deployment_notes: "Run locally from sanitized Stripe export; publish only aggregate report artifacts.",
    },
    {
      name: "Stripe Billing Trust Kit",
      target_user: "Creator business that needs explainable Stripe/Substack reconciliation.",
      core_promise: "Turn payment records into a repeatable billing trust evidence packet.",
      modules: ["Source mapping", "Drift ledger", "Duplicate/missing checks", "Fee review", "Evidence bundle"],
      deployment_notes: "Requires explicit Substack source mapping; no raw subscriber data enters the report.",
    },
  ];
}

function assertSanitized(data) {
  const text = JSON.stringify(data);
  const forbidden = [/sk_live_/i, /sk_test_/i, /rk_live_/i, /rk_test_/i, /client_secret/i, /receipt_url/i, /hosted_invoice_url/i, /billing_details/i, /@/];
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`Input does not look sanitized; forbidden marker found: ${pattern}`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv);
  const data = readJson(args.input);
  assertSanitized(data);
  const generatedAt = data.generated_at || new Date().toISOString();
  const payments = data.payments || [];
  const charges = data.charges || [];
  const successful = payments.length > 0
    ? payments.filter((row) => row.status === "succeeded")
    : charges.filter((row) => row.paid || row.status === "succeeded");
  const cutoff30 = dateDaysAgo(generatedAt, 30);
  const cutoff90 = dateDaysAgo(generatedAt, 90);
  const payouts = data.payouts || [];
  const failedCharges = charges
    .filter((row) => row.status === "failed")
    .map((row) => ({
      ...row,
      failure_reason: row.decline?.decline_code || "unknown",
      decline_code: row.decline?.decline_code || "unknown",
      advice_code: row.decline?.advice_code || "unknown",
      network_decline_code: row.decline?.network_decline_code || "unknown",
      network_advice_code: row.decline?.network_advice_code || "unknown",
      outcome_type: row.decline?.outcome_type || "unknown",
      network_status: row.decline?.network_status || "unknown",
    }));
  const failedPayments = [...(data.failed_payments || []), ...failedCharges];
  const checkoutSessions = data.checkout_sessions || [];

  const report = {
    generated_at: new Date().toISOString(),
    source_generated_at: generatedAt,
    schema_version: data.schema_version || "unknown",
    mode: data.mode || "unknown",
    overview: {
      available_balance: amount(data?.balances?.available || []),
      pending_balance: amount(data?.balances?.pending || []),
      volume_30d: amount(since(successful, "created", cutoff30)),
      volume_90d: amount(since(successful, "created", cutoff90)),
      active_subscriptions: number(data?.subscriptions?.active_count),
      mrr: number(data?.subscriptions?.mrr),
      checkout_sessions: checkoutSessions.length,
      checkout_session_volume_30d: amount(since(checkoutSessions, "created", cutoff30), "amount_total"),
      checkout_session_volume_90d: amount(since(checkoutSessions, "created", cutoff90), "amount_total"),
      explicit_substack_mrr_limitation: "MRR is Substack-specific only if upstream source mapping tagged subscription records as Substack.",
    },
    api_coverage: {
      payment_intents: payments.length,
      charges: charges.length,
      checkout_sessions: checkoutSessions.length,
      balance_transactions: (data.balance_transactions || []).length,
      invoices: (data.invoices || []).length,
      payouts: payouts.length,
      reporting_report_types: number(data?.reporting?.report_types_count),
      recent_report_runs: (data?.reporting?.recent_report_runs || []).length,
      note: "Stripe dashboard analytics can use internal payment analytics datasets; direct object lists and reporting exports may legitimately differ from dashboard cards.",
    },
    payout_settings: data.payout_settings || null,
    payouts: analyzePayouts(payouts),
    upcoming_invoices: (data.invoices || [])
      .filter((row) => ["open", "draft", "uncollectible"].includes(row.status))
      .slice(0, 30),
    billing_drift: analyzeDrift(data),
    failed_payments: {
      count: failedPayments.length,
      total_amount: amount(failedPayments),
      by_reason: analyzeFailedPayments(failedPayments),
    },
    cash_flow_forecast: forecast(data, successful, payouts, failedPayments),
    fee_review: feeReview(successful),
    fee_breakdown: feeBreakdown(data, successful),
    recommendations: [],
    package_ideas: packageIdeas(),
  };
  report.recommendations = recommendations(report);

  const outPath = args.out || path.join(path.dirname(args.input), "stripe_audit_analysis.json");
  writeJson(outPath, report);
  console.log(`Wrote Stripe audit analysis: ${outPath}`);
}

main();
