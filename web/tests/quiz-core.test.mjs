import assert from "node:assert/strict";
import test from "node:test";
import {
  compareQuestionChoices,
  RESPONSE_GROUPS,
  resultCopy,
  scoreAnswers,
  supportingPattern,
} from "../lib/quiz-core.js";
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

test("two-choice contrast is neutral, public, and non-selecting", () => {
  const contrast = compareQuestionChoices(quiz.questions[0], quiz.archetypes, "01", "06");
  assert.equal(contrast.question_id, 1);
  assert.deepEqual(
    [contrast.choice_a.code, contrast.choice_a.label, contrast.choice_a.lens, contrast.choice_a.focus],
    ["01", "A destination to move toward", "Horizon Signal", "Finding direction"],
  );
  assert.deepEqual(
    [contrast.choice_b.code, contrast.choice_b.label, contrast.choice_b.lens, contrast.choice_b.focus],
    ["06", "One clean fork chosen", "Fracture Path", "Decisions under pressure"],
  );
  assert.match(contrast.operational_contrast, /first instinct/i);
  assert.match(contrast.boundary, /does not rank, select, or record/i);
  assert.equal(contrast.selection_status, "NEITHER_SELECTED");
  assert.equal(JSON.stringify(contrast).length < 1500, true);
});

test("two-choice contrast rejects equal or unavailable choices", () => {
  assert.throws(
    () => compareQuestionChoices(quiz.questions[0], quiz.archetypes, "01", "01"),
    /two different choices/i,
  );
  assert.throws(
    () => compareQuestionChoices(quiz.questions[0], quiz.archetypes, "01", "99"),
    /both choices must be available/i,
  );
});

test("every two-choice contrast stays within the WebMCP response budget", () => {
  for (const question of quiz.questions) {
    for (let left = 0; left < question.options.length; left += 1) {
      for (let right = left + 1; right < question.options.length; right += 1) {
        const contrast = compareQuestionChoices(
          question,
          quiz.archetypes,
          question.options[left].arcCode,
          question.options[right].arcCode,
        );
        assert.equal(JSON.stringify(contrast).length < 1500, true);
        assert.equal(contrast.selection_status, "NEITHER_SELECTED");
      }
    }
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
