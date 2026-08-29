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

export function supportingPattern(result) {
  const count = result?.counts?.[result.secondary] ?? 0;
  return count > 0 ? { code: result.secondary, count } : null;
}
