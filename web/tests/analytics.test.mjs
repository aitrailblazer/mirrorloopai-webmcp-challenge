import assert from "node:assert/strict";
import test from "node:test";
import { createFunnelTracker } from "../lib/analytics.js";

test("funnel tracker sends only aggregate allowlisted event names", async () => {
  const requests = [];
  const storage = new Map();
  const record = createFunnelTracker({
    apiBaseURL: "/api",
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true };
    },
  });

  record("quiz_started");
  record("quiz_started");
  record("subscription_confirmed");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/v1/analytics/events");
  assert.deepEqual(JSON.parse(requests[0].options.body), { event: "quiz_started" });
  assert.equal(requests[0].options.credentials, "omit");
});

test("session storage suppresses duplicate events after reload", () => {
  const storage = {
    getItem: () => "1",
    setItem: () => assert.fail("existing event should not rewrite storage"),
  };
  let requests = 0;
  const record = createFunnelTracker({
    apiBaseURL: "/api",
    storage,
    fetchImpl: async () => {
      requests += 1;
      return { ok: true };
    },
  });
  record("quiz_completed");
  assert.equal(requests, 0);
});

