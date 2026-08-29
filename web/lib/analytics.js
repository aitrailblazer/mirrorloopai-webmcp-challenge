const ALLOWED_EVENTS = new Set(["quiz_started", "quiz_completed"]);

export function createFunnelTracker({ apiBaseURL, fetchImpl = fetch, storage = null }) {
  const sent = new Set();

  return function record(event) {
    if (!ALLOWED_EVENTS.has(event) || sent.has(event)) return;
    const key = `mirrorloop.funnel.${event}`;
    try {
      if (storage?.getItem(key) === "1") {
        sent.add(event);
        return;
      }
      storage?.setItem(key, "1");
    } catch {
      // Storage can be disabled. In-memory deduplication still applies.
    }
    sent.add(event);
    void fetchImpl(`${apiBaseURL}/v1/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      keepalive: true,
      body: JSON.stringify({ event }),
    }).catch(() => {
      // Analytics must never interrupt the reflection.
    });
  };
}

