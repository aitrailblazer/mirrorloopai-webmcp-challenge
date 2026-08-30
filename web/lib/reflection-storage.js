export const REFLECTION_STORAGE_KEY = "mirrorloop.reflection.answers.v1";

function blankAnswers(quiz) {
  return Array(quiz?.questions?.length ?? 0).fill(null);
}

function validAnswers(quiz, answers) {
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) return false;
  return answers.every((choiceCode, index) => (
    choiceCode === null
    || quiz.questions[index].options.some((option) => option.arcCode === choiceCode)
  ));
}

export function createReflectionStore(storage, key = REFLECTION_STORAGE_KEY) {
  return {
    load(quiz) {
      const empty = blankAnswers(quiz);
      if (!storage) return empty;
      try {
        const raw = storage.getItem(key);
        if (!raw) return empty;
        const saved = JSON.parse(raw);
        if (
          saved?.schema !== 1
          || saved.quizVersion !== quiz.version
          || !validAnswers(quiz, saved.answers)
        ) {
          storage.removeItem?.(key);
          return empty;
        }
        return [...saved.answers];
      } catch {
        return empty;
      }
    },

    save(quiz, answers) {
      if (!storage || !validAnswers(quiz, answers)) return false;
      try {
        storage.setItem(key, JSON.stringify({
          schema: 1,
          quizVersion: quiz.version,
          answers: [...answers],
        }));
        return true;
      } catch {
        return false;
      }
    },

    clear() {
      if (!storage) return false;
      try {
        storage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}
