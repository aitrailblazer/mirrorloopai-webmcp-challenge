export const RESPONSE_GROUPS = Object.freeze([
  { title: "Move or change direction", description: "Direction, stability, or a different role", range: [0, 3] },
  { title: "Steady yourself", description: "Calm, perspective, or one clear choice", range: [3, 6] },
  { title: "Work with tension or change", description: "Hold both sides, reveal a rule, or shift energy", range: [6, 9] },
  { title: "Understand what is happening", description: "Find the signal, a next step, or common ground", range: [9, 12] },
]);

const COPY = Object.freeze({
  "01": ["You naturally look for a direction worth moving toward.", "Name the next visible horizon. What is one step that points toward it?"],
  "02": ["You first improve the conditions around a problem so steadiness can return.", "Change one part of your environment that would make the next choice easier."],
  "03": ["You respond by reconsidering who you are becoming in the situation.", "Ask: what version of me can meet this without repeating the old role?"],
  "04": ["You seek enough inner calm to choose rather than react.", "Pause for one minute. Name the feeling, then name the choice beneath it."],
  "05": ["You zoom out and place the moment inside a longer story.", "Imagine looking back in six months. What would make this moment useful?"],
  "06": ["You regain movement by choosing a clear fork and committing to it.", "Write the two real options. Choose the smallest reversible commitment."],
  "07": ["You can hold competing truths long enough for a wider answer to appear.", "Complete both sentences: “It is true that…” and “It is also true that…”"],
  "08": ["You look for the unspoken expectation or agreement shaping the moment.", "Name the hidden rule. Is it still fair, mutual, and necessary?"],
  "09": ["You look for the spark that can rapidly change the emotional state.", "Choose one healthy action that changes your energy within five minutes."],
  "10": ["You seek the signal inside what failed, broke, or became unclear.", "Separate the event from the story. What fact is the clearest signal?"],
  "11": ["You trust a small action that can create sustained momentum.", "Choose a step small enough to begin now and useful enough to repeat tomorrow."],
  "12": ["You look for the point where different needs can align into one direction.", "List what matters most. What single action honors more than one priority?"],
});

export function scoreAnswers(answers, archetypes) {
  if (!Array.isArray(answers) || answers.length !== 12) {
    throw new Error("Exactly 12 answers are required.");
  }
  const counts = Object.fromEntries(Object.keys(archetypes).map((code) => [code, 0]));
  for (const code of answers) {
    if (!(code in counts)) throw new Error(`Unknown response code: ${code}`);
    counts[code] += 1;
  }
  const ranking = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  return {
    dominant: ranking[0],
    secondary: ranking[1],
    tertiary: ranking[2],
    shadow: ranking.at(-1),
    counts,
  };
}

export function resultCopy(code) {
  const [summary, prompt] = COPY[code] ?? ["You have a pattern worth noticing.", "What choice would create a little more room today?"];
  return { summary, prompt };
}

export function compareQuestionChoices(question, archetypes, choiceA, choiceB) {
  const optionA = question?.options?.find(({ arcCode }) => arcCode === choiceA);
  const optionB = question?.options?.find(({ arcCode }) => arcCode === choiceB);
  const archetypeA = archetypes?.[choiceA];
  const archetypeB = archetypes?.[choiceB];
  if (!question || !optionA || !optionB || !archetypeA || !archetypeB) {
    throw new Error("Both choices must be available for this question.");
  }
  if (choiceA === choiceB) {
    throw new Error("Choose two different choices to compare.");
  }

  const copyA = resultCopy(choiceA);
  const copyB = resultCopy(choiceB);
  const describe = (code, option, archetype, copy) => ({
    code,
    label: option.microIntent,
    lens: archetype.name,
    focus: archetype.domain,
    plain_language_meaning: copy.summary,
  });

  return {
    question_id: question.id,
    prompt: question.title,
    choice_a: describe(choiceA, optionA, archetypeA, copyA),
    choice_b: describe(choiceB, optionB, archetypeB, copyB),
    operational_contrast: `${archetypeA.name} centers on “${optionA.microIntent}” through ${archetypeA.domain.toLowerCase()}; ${archetypeB.name} centers on “${optionB.microIntent}” through ${archetypeB.domain.toLowerCase()}. Notice which describes your first instinct in this situation—not which sounds better.`,
    boundary: "This comparison does not rank, select, or record either choice.",
    selection_status: "NEITHER_SELECTED",
  };
}

export function previewAnswerImpact(answers, archetypes, questionID, hypotheticalChoice) {
  if (!Array.isArray(answers) || answers.length !== 12 || answers.some((code) => !code)) {
    throw new Error("Complete all 12 questions before previewing an answer change.");
  }
  if (!Number.isInteger(questionID) || questionID < 1 || questionID > 12) {
    throw new Error("question_id must be a whole number from 1 to 12.");
  }
  if (!archetypes || !(hypotheticalChoice in archetypes)) {
    throw new Error("The hypothetical choice is not available.");
  }

  const currentChoice = answers[questionID - 1];
  if (!(currentChoice in archetypes)) {
    throw new Error(`Question ${questionID} does not have a recorded answer.`);
  }
  if (currentChoice === hypotheticalChoice) {
    throw new Error("The hypothetical choice is already recorded for this question.");
  }

  const projectedAnswers = [...answers];
  projectedAnswers[questionID - 1] = hypotheticalChoice;
  const current = scoreAnswers(answers, archetypes);
  const projected = scoreAnswers(projectedAnswers, archetypes);

  return {
    status: "PROVISIONAL_PREVIEW",
    question_id: questionID,
    current_choice: {
      code: currentChoice,
      name: archetypes[currentChoice].name,
    },
    hypothetical_choice: {
      code: hypotheticalChoice,
      name: archetypes[hypotheticalChoice].name,
    },
    current_dominant: {
      code: current.dominant,
      name: archetypes[current.dominant].name,
      frequency: current.counts[current.dominant],
    },
    projected_dominant: {
      code: projected.dominant,
      name: archetypes[projected.dominant].name,
      frequency: projected.counts[projected.dominant],
    },
    dominant_changed: current.dominant !== projected.dominant,
    frequency_delta: {
      [currentChoice]: -1,
      [hypotheticalChoice]: 1,
    },
    boundary: "This preview does not save, select, or revise any answer.",
  };
}

export function supportingPattern(result) {
  const count = result?.counts?.[result.secondary] ?? 0;
  return count > 0 ? { code: result.secondary, count } : null;
}
