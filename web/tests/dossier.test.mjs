import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildReflectionDossier } from "../lib/dossier.js";
import { resultCopy, scoreAnswers } from "../lib/quiz-core.js";

const quiz = JSON.parse(await readFile(new URL("../data/quiz.json", import.meta.url), "utf8"));
const cards = JSON.parse(await readFile(new URL("../data/cards.json", import.meta.url), "utf8"));
const answers = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const scored = scoreAnswers(answers, quiz.archetypes);
const copy = resultCopy(scored.dominant);
const result = { ...scored, summary: copy.summary, boundedAction: copy.prompt };

test("builds a complete portable Markdown dossier without private session data", () => {
  const artifact = buildReflectionDossier({
    format: "markdown",
    generatedAt: "2026-08-30T20:00:00.000Z",
    localDate: "2026-08-30",
    quiz,
    answers,
    result,
    card: cards.cards[0],
  });

  assert.equal(artifact.filename, "mirrorloop-reflection-2026-08-30.md");
  assert.equal(artifact.mimeType, "text/markdown;charset=utf-8");
  assert.match(artifact.content, /# MIRROR\/\/LOOP Reflection Dossier/);
  assert.match(artifact.content, /Representative first card from the primary lens ARC/);
  assert.equal((artifact.content.match(/^### \d+\./gm) ?? []).length, 12);
  for (const code of Object.keys(quiz.archetypes)) {
    assert.match(artifact.content, new RegExp(`\\| ${code} \\|`));
  }
  for (const forbidden of ["private founder dispute", "@", "storage_id", "internal prompt", "Geneva_Bible_1599"]) {
    assert.equal(artifact.content.includes(forbidden), false);
  }
});

test("builds JSON with an explicitly requested public card and ordered answers", () => {
  const artifact = buildReflectionDossier({
    format: "json",
    generatedAt: "2026-08-30T20:00:00.000Z",
    localDate: "2026-08-30",
    quiz,
    answers,
    result,
    card: cards.cards[11],
    cardRelationship: "explicit",
  });
  const parsed = JSON.parse(artifact.content);
  assert.equal(artifact.filename, "mirrorloop-reflection-2026-08-30.json");
  assert.equal(parsed.card.card_id, "012");
  assert.equal(parsed.card.relationship, "explicit");
  assert.equal(parsed.ordered_answers.length, 12);
  assert.equal(parsed.ordered_answers[0].selected_response, "A destination to move toward");
  assert.equal(parsed.reflection.observed_frequencies.length, 12);
  assert.equal(parsed.reflection.primary_lens.code, "01");
});

test("rejects an incomplete reflection or unsupported format", () => {
  assert.throws(() => buildReflectionDossier({
    format: "pdf",
    generatedAt: "",
    localDate: "",
    quiz,
    answers,
    result,
    card: cards.cards[0],
  }), /markdown or json/);
  assert.throws(() => buildReflectionDossier({
    format: "json",
    generatedAt: "",
    localDate: "",
    quiz,
    answers: answers.slice(0, 11),
    result,
    card: cards.cards[0],
  }), /Complete all 12/);
});
