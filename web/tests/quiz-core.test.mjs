import assert from "node:assert/strict";
import test from "node:test";
import { RESPONSE_GROUPS, resultCopy, scoreAnswers, supportingPattern } from "../lib/quiz-core.js";
import { readFile } from "node:fs/promises";

const quiz = JSON.parse(await readFile(new URL("../data/quiz.json", import.meta.url)));

test("public quiz contains 12 complete questions", () => {
  assert.equal(quiz.questions.length, 12);
  for (const question of quiz.questions) {
    assert.equal(question.options.length, 12);
    assert.equal(new Set(question.options.map((option) => option.arcCode)).size, 12);
  }
  assert.equal(RESPONSE_GROUPS.length, 4);
});

test("public question labels use plain language", () => {
  const loadedTerms = /mechanics|physics|shadow contracts|pattern collapse|destabili[sz]|what breaks/i;
  for (const question of quiz.questions) {
    assert.doesNotMatch(`${question.sectionTitle} ${question.title}`, loadedTerms);
  }
  for (const archetype of Object.values(quiz.archetypes)) {
    assert.doesNotMatch(archetype.domain, loadedTerms);
  }
});

test("scoring matches stable Swift tie-break contract", () => {
  const result = scoreAnswers(["03", "02", "03", "02", "04", "05", "06", "07", "08", "09", "10", "11"], quiz.archetypes);
  assert.equal(result.dominant, "02");
  assert.equal(result.secondary, "03");
});

test("every archetype has plain-language result copy", () => {
  for (const code of Object.keys(quiz.archetypes)) {
    const copy = resultCopy(code);
    assert.ok(copy.summary.length > 30);
    assert.ok(copy.prompt.length > 20);
  }
});

test("response groups provide plain-language scanning help", () => {
  assert.equal(RESPONSE_GROUPS.length, 4);
  for (const group of RESPONSE_GROUPS) {
    assert.ok(group.title);
    assert.ok(group.description);
  }
});

test("a zero-count tie is not presented as a supporting pattern", () => {
  const archetypes = Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const code = String(index + 1).padStart(2, "0");
    return [code, { name: code }];
  }));
  const concentrated = scoreAnswers(Array(12).fill("01"), archetypes);
  assert.equal(supportingPattern(concentrated), null);

  const mixed = scoreAnswers([...Array(7).fill("01"), ...Array(5).fill("02")], archetypes);
  assert.deepEqual(supportingPattern(mixed), { code: "02", count: 5 });
});
