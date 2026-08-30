import assert from "node:assert/strict";
import test from "node:test";
import { createReflectionStore, REFLECTION_STORAGE_KEY } from "../lib/reflection-storage.js";

const quiz = {
  version: "2.0.0",
  questions: Array.from({ length: 3 }, (_, index) => ({
    id: index + 1,
    options: [{ arcCode: "01" }, { arcCode: "02" }],
  })),
};

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test("saves and restores answer codes without unrelated personal data", () => {
  const storage = memoryStorage();
  const store = createReflectionStore(storage);
  assert.equal(store.save(quiz, ["01", null, "02"]), true);
  assert.deepEqual(store.load(quiz), ["01", null, "02"]);
  assert.deepEqual(JSON.parse(storage.values.get(REFLECTION_STORAGE_KEY)), {
    schema: 1,
    quizVersion: "2.0.0",
    answers: ["01", null, "02"],
  });
});

test("rejects stale, malformed, and impossible saved answers", () => {
  for (const payload of [
    "{not-json",
    JSON.stringify({ schema: 1, quizVersion: "1.0.0", answers: ["01", null, "02"] }),
    JSON.stringify({ schema: 1, quizVersion: "2.0.0", answers: ["99", null, "02"] }),
    JSON.stringify({ schema: 1, quizVersion: "2.0.0", answers: ["01"] }),
  ]) {
    const storage = memoryStorage({ [REFLECTION_STORAGE_KEY]: payload });
    assert.deepEqual(createReflectionStore(storage).load(quiz), [null, null, null]);
  }
});

test("clears saved answers and tolerates unavailable browser storage", () => {
  const storage = memoryStorage();
  const store = createReflectionStore(storage);
  store.save(quiz, ["01", "02", "01"]);
  assert.equal(store.clear(), true);
  assert.deepEqual(store.load(quiz), [null, null, null]);

  const unavailable = createReflectionStore(null);
  assert.deepEqual(unavailable.load(quiz), [null, null, null]);
  assert.equal(unavailable.save(quiz, ["01", "02", "01"]), false);
  assert.equal(unavailable.clear(), false);
});
