import { RESPONSE_GROUPS, resultCopy, scoreAnswers, supportingPattern } from "./lib/quiz-core.js?v=20260826-3";
import { createFunnelTracker } from "./lib/analytics.js?v=20260826-3";

const $ = (selector) => document.querySelector(selector);
const state = { quiz: null, index: 0, answers: Array(12).fill(null), result: null };
const config = window.MIRRORLOOP_CONFIG ?? { apiBaseURL: "" };
let analyticsStorage = null;
try {
  analyticsStorage = window.sessionStorage;
} catch {
  // Some private browsing modes disable storage.
}
const recordFunnelEvent = createFunnelTracker({
  apiBaseURL: config.apiBaseURL,
  storage: analyticsStorage,
});
let turnstileStarted = false;

const elements = {
  start: $("#quiz-start"), panel: $("#quiz-panel"), result: $("#result-panel"),
  progress: $("#progress-bar"), progressLabel: $("#progress-label"), progressTrack: $(".progress-track"),
  kicker: $("#section-kicker"), question: $("#question-title"), groups: $("#answer-groups"),
  back: $("#back-button"), next: $("#next-button"), form: $("#subscribe-form"),
  formStatus: $("#form-status"), subscribe: $("#subscribe-button"),
};

if (!config.subscriberEnabled) {
  $("#email-card").hidden = true;
}

async function loadQuiz() {
  const response = await fetch("/data/quiz.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("The quiz could not be loaded.");
  state.quiz = await response.json();
}

function optionButton(option, optionIndex) {
  const selected = state.answers[state.index] === option.arcCode;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `answer${selected ? " selected" : ""}`;
  button.setAttribute("aria-pressed", String(selected));
  button.dataset.code = option.arcCode;
  button.dataset.optionIndex = String(optionIndex);
  button.innerHTML = `<span class="answer-glyph" aria-hidden="true">${option.glyph}</span><span>${option.microIntent}</span>`;
  button.addEventListener("click", () => {
    state.answers[state.index] = option.arcCode;
    renderQuestion();
    elements.next.focus();
  });
  return button;
}

function renderQuestion() {
  const question = state.quiz.questions[state.index];
  elements.kicker.textContent = question.sectionTitle;
  elements.question.textContent = question.title;
  elements.progressLabel.textContent = `Question ${state.index + 1} of ${state.quiz.questions.length}`;
  const progress = ((state.index + 1) / state.quiz.questions.length) * 100;
  elements.progress.style.width = `${progress}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(state.index + 1));
  elements.groups.replaceChildren();
  RESPONSE_GROUPS.forEach(({ title, description, range }, groupIndex) => {
    const group = document.createElement("details");
    group.className = "response-group";
    group.setAttribute("name", "response-group");
    const selected = state.answers[state.index];
    const selectedInGroup = question.options.slice(...range).some((option) => option.arcCode === selected);
    group.open = selectedInGroup || (!selected && groupIndex === 0);
    const summary = document.createElement("summary");
    summary.className = "response-summary";
    summary.innerHTML = `<span>${title}</span><small>${description}</small>`;
    group.append(summary);
    const choices = document.createElement("div");
    choices.className = "answer-grid";
    question.options.slice(...range).forEach((option, offset) => choices.append(optionButton(option, range[0] + offset)));
    group.append(choices);
    group.addEventListener("toggle", () => {
      if (!group.open || !group.isConnected) return;
      elements.groups.querySelectorAll(".response-group").forEach((other) => {
        if (other !== group) other.open = false;
      });
    });
    elements.groups.append(group);
  });
  elements.back.disabled = state.index === 0;
  elements.next.disabled = !state.answers[state.index];
  elements.next.textContent = state.index === state.quiz.questions.length - 1 ? "See my reflection" : "Next question";
}

function showResult() {
  recordFunnelEvent("quiz_completed");
  state.result = scoreAnswers(state.answers, state.quiz.archetypes);
  const primary = state.quiz.archetypes[state.result.dominant];
  const support = supportingPattern(state.result);
  const copy = resultCopy(state.result.dominant);
  $("#result-glyph").textContent = primary.glyph;
  $("#result-name").textContent = primary.name;
  $("#result-domain").textContent = primary.domain;
  $("#result-summary").textContent = copy.summary;
  const primaryCount = state.result.counts[state.result.dominant];
  $("#result-evidence").textContent = `This response appeared ${primaryCount} ${primaryCount === 1 ? "time" : "times"} across your 12 choices.`;
  if (support) {
    const secondary = state.quiz.archetypes[support.code];
    $("#supporting-label").textContent = "Also present in your answers";
    $("#secondary-name").textContent = secondary.name;
    $("#secondary-summary").textContent = `${resultCopy(support.code).summary} It appeared ${support.count} ${support.count === 1 ? "time" : "times"}.`;
  } else {
    $("#supporting-label").textContent = "No second pattern stood out";
    $("#secondary-name").textContent = "";
    $("#secondary-summary").textContent = "Your choices concentrated in one response pattern, so we are not assigning a supporting pattern.";
  }
  $("#reflection-prompt").textContent = copy.prompt;
  elements.panel.hidden = true;
  elements.result.hidden = false;
  elements.result.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#result-name").setAttribute("tabindex", "-1");
  $("#result-name").focus({ preventScroll: true });
  ensureTurnstile();
}

async function subscribe(event) {
  event.preventDefault();
  elements.formStatus.textContent = "";
  elements.subscribe.disabled = true;
  elements.subscribe.textContent = "Sending…";
  const formData = new FormData(elements.form);
  const payload = {
    email: formData.get("email"),
    consent: formData.get("consent") === "on",
    consentVersion: "email-reflection-v1-2026-08-25",
    website: formData.get("website"),
    source: "mirrorloopai.com/quiz",
    quizVersion: state.quiz.version,
    answers: state.answers,
    challengeToken: window.turnstile?.getResponse?.() ?? "",
  };
  try {
    const response = await fetch(`${config.apiBaseURL}/v1/subscribers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "We could not send the email. Please try again.");
    elements.formStatus.textContent = "Check your inbox and confirm your address to receive the reflection.";
    elements.form.reset();
  } catch (error) {
    elements.formStatus.textContent = error.message;
  } finally {
    elements.subscribe.disabled = false;
    elements.subscribe.textContent = "Email my reflection";
    window.turnstile?.reset?.();
  }
}

$("#start-button").addEventListener("click", async () => {
  try {
    if (!state.quiz) await loadQuiz();
    elements.start.hidden = true;
    elements.panel.hidden = false;
    recordFunnelEvent("quiz_started");
    renderQuestion();
    elements.question.focus();
  } catch (error) {
    elements.start.querySelector("p:last-of-type").textContent = error.message;
  }
});

elements.back.addEventListener("click", () => {
  if (state.index > 0) state.index -= 1;
  renderQuestion();
  elements.question.focus();
});

elements.next.addEventListener("click", () => {
  if (!state.answers[state.index]) return;
  if (state.index === state.quiz.questions.length - 1) return showResult();
  state.index += 1;
  renderQuestion();
  elements.question.focus();
});

$("#restart-button").addEventListener("click", () => {
  state.index = 0;
  state.answers.fill(null);
  state.result = null;
  elements.result.hidden = true;
  elements.panel.hidden = false;
  renderQuestion();
  elements.question.focus();
});

elements.form.addEventListener("submit", subscribe);

function ensureTurnstile() {
  if (!config.subscriberEnabled || !config.turnstileSiteKey || turnstileStarted) return;
  turnstileStarted = true;
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.defer = true;
  script.addEventListener("load", () => {
    window.turnstile.render("#challenge-slot", {
      sitekey: config.turnstileSiteKey,
      theme: "light",
      callback: () => {
        elements.formStatus.textContent = "";
      },
      "expired-callback": () => {
        elements.formStatus.textContent = "Human verification expired. Please complete it again.";
      },
      "error-callback": () => {
        elements.formStatus.textContent = "Human verification could not start. Check browser privacy blocking, then retry.";
      },
    });
  });
  document.head.append(script);
}
