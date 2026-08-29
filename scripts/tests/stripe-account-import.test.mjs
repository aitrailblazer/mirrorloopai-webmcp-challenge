import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInventory,
  parseStripeCLIConfig,
} from "../stripe-account-import.mjs";

const restrictedLiveKey = ["rk", "live", "sensitive-value"].join("_");
const secretTestKey = ["sk", "test", "sensitive-value"].join("_");
const publishableLiveKey = ["pk", "live", "public-value"].join("_");
const publishableTestKey = ["pk", "test", "public-value"].join("_");

const configText = `
project-name = 'default'

[default]
account_id = 'acct_example1234'
display_name = 'MIRROR LOOP'
live_mode_api_key = '${restrictedLiveKey}'
live_mode_key_expires_at = '2026-08-01'
live_mode_pub_key = '${publishableLiveKey}'
test_mode_api_key = '${secretTestKey}'
test_mode_key_expires_at = '2027-08-01'
test_mode_pub_key = '${publishableTestKey}'
`;

test("Stripe CLI inventory retains metadata but never API key material", () => {
  const parsed = parseStripeCLIConfig(configText);
  const inventory = buildInventory(
    parsed,
    "/tmp/config.toml",
    new Date("2026-08-27T00:00:00Z"),
  );
  const serialized = JSON.stringify(inventory);

  assert.equal(inventory.account.id, "acct_example1234");
  assert.equal(inventory.account.display_name, "MIRROR LOOP");
  assert.equal(inventory.credentials.live.key_kind, "restricted");
  assert.equal(inventory.credentials.live.status, "expired");
  assert.equal(inventory.credentials.test.key_kind, "secret");
  assert.equal(inventory.credentials.test.status, "current");
  assert.ok(inventory.credentials.live.key_fingerprint_sha256_16);
  assert.ok(!serialized.includes(restrictedLiveKey));
  assert.ok(!serialized.includes(secretTestKey));
  assert.ok(!serialized.includes(publishableLiveKey));
  assert.ok(!serialized.includes(publishableTestKey));
});
