const FORMATS = Object.freeze(["markdown", "json"]);

function requireCompleteSession(quiz, answers, result, card) {
  if (!quiz?.questions || quiz.questions.length !== 12) {
    throw new Error("The 12-question reflection contract is unavailable.");
  }
  if (!Array.isArray(answers) || answers.length !== 12 || answers.some((code) => !code)) {
    throw new Error("Complete all 12 questions before exporting a reflection dossier.");
  }
  if (!result?.dominant || !result?.counts) {
    throw new Error("Call complete_reflection before exporting a reflection dossier.");
  }
  if (!card?.id) throw new Error("The public card metadata is unavailable.");
}

function lens(quiz, result, code) {
  const archetype = quiz.archetypes[code];
  return {
    code,
    name: archetype.name,
    domain: archetype.domain,
    glyph: archetype.glyph,
    observed_count: result.counts[code],
  };
}

function markdownEscape(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("|", "\\|");
}

function renderMarkdown(dossier) {
  const support = dossier.reflection.supporting_lens;
  const lines = [
    "# MIRROR//LOOP Reflection Dossier",
    "",
    `Generated locally: ${dossier.generated_at_local}`,
    "",
    "## Reflection",
    "",
    `**Primary lens:** ${dossier.reflection.primary_lens.code} · ${dossier.reflection.primary_lens.name} (${dossier.reflection.primary_lens.observed_count} of 12)`,
    support
      ? `**Supporting lens:** ${support.code} · ${support.name} (${support.observed_count} of 12)`
      : "**Supporting lens:** No second pattern stood out",
    "",
    dossier.reflection.summary,
    "",
    `**Bounded action:** ${dossier.reflection.bounded_action}`,
    "",
    "### Observed frequencies",
    "",
    "| Code | Lens | Responses |",
    "| --- | --- | ---: |",
    ...dossier.reflection.observed_frequencies.map(
      (item) => `| ${item.code} | ${markdownEscape(item.name)} | ${item.count} |`,
    ),
    "",
    "## Card reference",
    "",
    `**${dossier.card.card_id} · ${dossier.card.title}**`,
    "",
    `ARC ${dossier.card.arc} · ${dossier.card.arc_name} · ${dossier.card.domain}`,
    "",
    `Relationship: ${dossier.card.relationship_label}`,
    "",
    `**Mirror:** ${dossier.card.mirror}`,
    "",
    `**Bounded action:** ${dossier.card.bounded_action}`,
    "",
    "## Your 12 choices",
    "",
    ...dossier.ordered_answers.flatMap((answer) => [
      `### ${answer.question_id}. ${answer.question}`,
      "",
      `Selected: **${answer.choice_code} · ${answer.selected_response}**`,
      "",
      `Lens: ${answer.lens_name} — ${answer.lens_domain}`,
      "",
    ]),
    "## Privacy boundary",
    "",
    dossier.privacy_boundary,
    "",
    dossier.reflection.boundary,
    "",
  ];
  return lines.join("\n");
}

export function buildReflectionDossier({
  format,
  generatedAt,
  localDate,
  quiz,
  answers,
  result,
  card,
  cardRelationship = "representative_of_primary_arc",
}) {
  if (!FORMATS.includes(format)) throw new Error("format must be markdown or json.");
  requireCompleteSession(quiz, answers, result, card);
  const supportingCode = result.counts[result.secondary] > 0 ? result.secondary : null;
  const dossier = {
    schema: "mirrorloop.reflection.dossier.v1",
    generated_at_utc: generatedAt,
    generated_at_local: localDate,
    reflection: {
      primary_lens: lens(quiz, result, result.dominant),
      supporting_lens: supportingCode ? lens(quiz, result, supportingCode) : null,
      observed_frequencies: Object.keys(quiz.archetypes).map((code) => ({
        code,
        name: quiz.archetypes[code].name,
        count: result.counts[code],
      })),
      summary: result.summary,
      bounded_action: result.boundedAction,
      boundary: "A reflective snapshot, not a diagnosis, prediction, or fixed identity.",
    },
    card: {
      relationship: cardRelationship,
      relationship_label: cardRelationship === "explicit"
        ? "Card explicitly requested for this export."
        : "Representative first card from the primary lens ARC; not selected by the participant.",
      card_id: card.id,
      code: card.code,
      arc: card.arc,
      arc_name: card.arcName,
      title: card.title,
      glyph: card.glyph,
      domain: card.domain,
      mirror: card.mirror,
      bounded_action: card.loop,
      source_scope: "Curated public MIRROR//LOOP card metadata.",
    },
    ordered_answers: quiz.questions.map((question, index) => {
      const choiceCode = answers[index];
      const option = question.options.find(({ arcCode }) => arcCode === choiceCode);
      return {
        question_id: question.id,
        stage: question.sectionTitle,
        question: question.title,
        choice_code: choiceCode,
        selected_response: option.microIntent,
        lens_name: quiz.archetypes[choiceCode].name,
        lens_domain: quiz.archetypes[choiceCode].domain,
      };
    }),
    privacy_boundary: "Created entirely in this browser from the completed session. This export does not send the dossier, email address, focus text, or answers to a server.",
  };
  const extension = format === "markdown" ? "md" : "json";
  return {
    dossier,
    content: format === "markdown" ? renderMarkdown(dossier) : `${JSON.stringify(dossier, null, 2)}\n`,
    extension,
    mimeType: format === "markdown" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8",
    filename: `mirrorloop-reflection-${localDate}.${extension}`,
  };
}
