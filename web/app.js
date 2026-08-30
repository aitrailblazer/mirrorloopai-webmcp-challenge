import { RESPONSE_GROUPS, resultCopy, scoreAnswers, supportingPattern } from "./lib/quiz-core.js?v=20260826-3";
import { createFunnelTracker } from "./lib/analytics.js?v=20260826-3";
import {
  installMirrorLoopWebMCP,
  MIRRORLOOP_WEBMCP_EVENTS,
} from "./lib/webmcp.js?v=20260830-5";
import { createReflectionStore } from "./lib/reflection-storage.js?v=20260830-1";

const $ = (selector) => document.querySelector(selector);
const state = {
  quiz: null,
  cards: null,
  shopCatalog: null,
  index: 0,
  answers: Array(12).fill(null),
  result: null,
  focusArea: "",
  started: false,
};
const config = window.MIRRORLOOP_CONFIG ?? { apiBaseURL: "" };
let analyticsStorage = null;
let reflectionStorage = null;
try {
  analyticsStorage = window.sessionStorage;
  reflectionStorage = window.localStorage;
} catch {
  // Some private browsing modes disable storage.
}
const reflectionStore = createReflectionStore(reflectionStorage);
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

function formatSafeInput(input) {
  const entries = Object.entries(input ?? {}).filter(([, value]) => value !== undefined);
  if (!entries.length) return "None";
  return entries
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${typeof value === "boolean" ? (value ? "yes" : "no") : value}`)
    .join(" · ");
}

function setConfirmationBadge(value) {
  const badge = $("#agent-confirmation");
  if (!badge) return;
  if (value === true) {
    badge.textContent = "HUMAN CONFIRMED";
    badge.dataset.state = "confirmed";
  } else if (value === false) {
    badge.textContent = "NOT CONFIRMED";
    badge.dataset.state = "missing";
  } else {
    badge.textContent = "NOT REQUIRED";
    badge.dataset.state = "neutral";
  }
}

function addAgentEvent(label, message, outcome = "") {
  const list = $("#agent-event-list");
  if (!list) return;
  const item = document.createElement("li");
  if (outcome) item.dataset.outcome = outcome;
  const kind = document.createElement("span");
  kind.textContent = label;
  const description = document.createElement("strong");
  description.textContent = message;
  item.append(kind, description);
  list.prepend(item);
  while (list.children.length > 5) list.lastElementChild.remove();
}

function updateAgentPhase(label, stateName) {
  const phase = $("#agent-phase");
  if (!phase) return;
  phase.textContent = label;
  phase.dataset.state = stateName;
}

function installAgentStateHUD() {
  window.addEventListener(MIRRORLOOP_WEBMCP_EVENTS.status, ({ detail }) => {
    const phase = detail?.phase;
    if (phase === "registering") {
      updateAgentPhase("REGISTERING", "registering");
      $("#agent-live-status").textContent = `Mounting ${detail.total} same-origin tools…`;
      addAgentEvent("STATUS", `Registering ${detail.total} tools`);
      return;
    }
    if (phase === "mounted") {
      updateAgentPhase(`${detail.total} TOOLS MOUNTED`, "mounted");
      $("#agent-live-status").textContent = "Ready for a browser agent. Human confirmation still controls every recorded answer.";
      addAgentEvent("READY", `${detail.mounted} tools mounted`, "success");
      return;
    }
    updateAgentPhase("DIRECT MODE", "direct");
    $("#agent-live-status").textContent = "No agent tools are active here. The complete reflection still works directly.";
    addAgentEvent("STATUS", "Direct reflection mode", phase === "registration_error" ? "error" : "");
  });

  window.addEventListener(MIRRORLOOP_WEBMCP_EVENTS.toolStart, ({ detail }) => {
    updateAgentPhase("RUNNING", "registering");
    $("#agent-active-tool").textContent = detail.tool;
    $("#agent-safe-input").textContent = formatSafeInput(detail.safe_input);
    $("#agent-duration").textContent = "In progress";
    setConfirmationBadge(detail.confirmed_by_user);
    $("#agent-live-status").textContent = `${detail.tool} is running in this page.`;
    addAgentEvent("START", detail.tool);
  });

  window.addEventListener(MIRRORLOOP_WEBMCP_EVENTS.toolComplete, ({ detail }) => {
    updateAgentPhase("8 TOOLS MOUNTED", "mounted");
    $("#agent-active-tool").textContent = detail.tool;
    $("#agent-safe-input").textContent = formatSafeInput(detail.safe_input);
    $("#agent-duration").textContent = Number.isFinite(detail.duration_ms)
      ? `${detail.duration_ms.toFixed(1)} ms observed`
      : "Measurement unavailable";
    setConfirmationBadge(detail.confirmed_by_user);
    const outcome = detail.outcome === "success" ? "Completed" : "Stopped with an error";
    $("#agent-live-status").textContent = `${detail.tool}: ${outcome.toLowerCase()}.`;
    addAgentEvent(
      detail.outcome === "success" ? "DONE" : "ERROR",
      `${detail.tool} · ${outcome}`,
      detail.outcome,
    );
  });
}

installAgentStateHUD();

if (!config.subscriberEnabled) {
  $("#email-card").hidden = true;
}

async function loadQuiz() {
  if (state.quiz) return state.quiz;
  const response = await fetch("/data/quiz.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("The quiz could not be loaded.");
  state.quiz = await response.json();
  return state.quiz;
}

async function loadCards() {
  if (state.cards) return state.cards;
  const response = await fetch("/data/cards.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("The public card registry could not be loaded.");
  const registry = await response.json();
  if (!Array.isArray(registry.cards) || registry.cards.length !== 144) {
    throw new Error("The public card registry is incomplete.");
  }
  state.cards = new Map(registry.cards.map((card) => [card.id, card]));
  return state.cards;
}

async function loadShopCatalog() {
  if (state.shopCatalog) return state.shopCatalog;
  const response = await fetch("/data/shop.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("The public edition catalog could not be loaded.");
  const catalog = await response.json();
  if (!Array.isArray(catalog.items) || catalog.items.length !== 28) {
    throw new Error("The public edition catalog is incomplete.");
  }
  state.shopCatalog = catalog.items;
  return state.shopCatalog;
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
    reflectionStore.save(state.quiz, state.answers);
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
  const shopLink = $("#result-shop-link");
  shopLink.href = `/shop.html?arc=${encodeURIComponent(state.result.dominant)}#arcs`;
  shopLink.textContent = `Explore ARC ${state.result.dominant} · ${primary.name}`;
  elements.panel.hidden = true;
  elements.result.hidden = false;
  elements.result.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#result-name").setAttribute("tabindex", "-1");
  $("#result-name").focus({ preventScroll: true });
  ensureTurnstile();
  return {
    status: "REFLECTION_COMPLETE",
    primary_lens: {
      code: state.result.dominant,
      name: primary.name,
      glyph: primary.glyph,
      domain: primary.domain,
      observed_count: primaryCount,
    },
    supporting_lens: support ? {
      code: support.code,
      name: state.quiz.archetypes[support.code].name,
      observed_count: support.count,
    } : null,
    reflection: copy.summary,
    bounded_action: copy.prompt,
    boundary: "A reflective snapshot, not a diagnosis, prediction, or fixed identity.",
  };
}

async function startReflection({ focusArea = "" } = {}) {
  await loadQuiz();
  state.answers = reflectionStore.load(state.quiz);
  const restoredAnswers = state.answers.filter(Boolean).length;
  state.index = 0;
  state.result = null;
  state.focusArea = focusArea;
  state.started = true;
  elements.start.hidden = true;
  elements.result.hidden = true;
  elements.panel.hidden = false;
  recordFunnelEvent("quiz_started");
  renderQuestion();
  $("#quiz-save-status").textContent = restoredAnswers
    ? `${restoredAnswers} saved ${restoredAnswers === 1 ? "choice" : "choices"} restored. Keep each one or select a different answer.`
    : "";
  elements.question.focus();
  window.dispatchEvent(new CustomEvent("mirrorloop:session_start"));
  return {
    status: "SESSION_INITIALIZED",
    total_questions: state.quiz.questions.length,
    current_question_id: 1,
    restored_answers: restoredAnswers,
    privacy: "Choice codes are saved only in this browser so the human can review, change, or clear them. They are sent only if the human separately requests email delivery.",
  };
}

async function currentQuestion() {
  await loadQuiz();
  if (!state.started) throw new Error("Start a reflection before requesting a question.");
  const question = state.quiz.questions[state.index];
  if (!question) throw new Error("The current reflection question is unavailable.");
  return {
    question_id: question.id,
    stage_name: question.sectionTitle,
    prompt: question.title,
    options: question.options.map((option) => ({
      code: option.arcCode,
      label: option.microIntent,
      glyph: option.glyph,
    })),
  };
}

async function explainChoice({ questionID, choiceCode }) {
  await loadQuiz();
  const question = state.quiz.questions[questionID - 1];
  const option = question?.options.find(({ arcCode }) => arcCode === choiceCode);
  const archetype = state.quiz.archetypes[choiceCode];
  if (!question || !option || !archetype) throw new Error("That choice is not available for this question.");
  const copy = resultCopy(choiceCode);
  return {
    question_id: questionID,
    choice_code: choiceCode,
    label: option.microIntent,
    lens: archetype.name,
    plain_language_meaning: copy.summary,
    reflection_prompt: copy.prompt,
    selection_status: "NOT_SELECTED",
  };
}

async function answerQuestion({ questionID, choiceCode }) {
  await loadQuiz();
  if (!state.started) throw new Error("Start a reflection before recording an answer.");
  const question = state.quiz.questions[questionID - 1];
  if (!question?.options.some(({ arcCode }) => arcCode === choiceCode)) {
    throw new Error("That choice is not available for this question.");
  }
  const expectedID = state.quiz.questions[state.index]?.id;
  const allComplete = state.answers.every(Boolean);
  const revisingRecordedAnswer = Boolean(state.answers[questionID - 1])
    && (questionID < expectedID || allComplete);
  if (revisingRecordedAnswer) {
    state.answers[questionID - 1] = choiceCode;
    reflectionStore.save(state.quiz, state.answers);
    renderQuestion();
    window.dispatchEvent(new CustomEvent("mirrorloop:step_transition", {
      detail: { question_id: questionID, choice_code: choiceCode, revised: true },
    }));
    return {
      recorded: true,
      revised: true,
      question_id: questionID,
      choice_code: choiceCode,
      completed_questions: state.answers.filter(Boolean).length,
      is_finished: allComplete,
      current_question_id: expectedID,
      next_action: allComplete
        ? "Call complete_reflection to refresh the result."
        : "Continue with the current question or review the recorded answers.",
    };
  }
  if (questionID !== expectedID) {
    throw new Error(`Question ${expectedID} is currently active; questions cannot be skipped.`);
  }
  state.answers[state.index] = choiceCode;
  reflectionStore.save(state.quiz, state.answers);
  const completed = state.answers.filter(Boolean).length;
  const finished = completed === state.quiz.questions.length;
  if (!finished) state.index += 1;
  renderQuestion();
  elements.question.focus();
  window.dispatchEvent(new CustomEvent("mirrorloop:step_transition", {
    detail: { question_id: questionID, choice_code: choiceCode },
  }));
  return {
    recorded: true,
    revised: false,
    question_id: questionID,
    choice_code: choiceCode,
    completed_questions: completed,
    is_finished: finished,
    next_action: finished ? "Call complete_reflection." : "Call get_current_question.",
  };
}

async function reviewAnswers() {
  await loadQuiz();
  return {
    total_answered: state.answers.filter(Boolean).length,
    total_questions: state.quiz.questions.length,
    answers: state.answers.flatMap((choiceCode, index) => (
      choiceCode ? [{ question_id: index + 1, choice_code: choiceCode }] : []
    )),
  };
}

async function completeReflection() {
  await loadQuiz();
  const answered = state.answers.filter(Boolean).length;
  if (answered !== state.quiz.questions.length) {
    throw new Error(`Complete all 12 questions first; ${answered} are currently answered.`);
  }
  const result = showResult();
  window.dispatchEvent(new CustomEvent("mirrorloop:reflection_complete", { detail: result }));
  return result;
}

async function getCard({ cardID }) {
  const cards = await loadCards();
  const card = cards.get(cardID);
  if (!card) throw new Error(`Card ${cardID} is not available in the public registry.`);
  return {
    found: true,
    card_id: cardID,
    code: card.code,
    arc: card.arc,
    arc_name: card.arcName,
    title: card.title,
    glyph: card.glyph,
    domain: card.domain,
    mirror: card.mirror,
    bounded_action: card.loop,
    source_scope: "Curated public MIRROR//LOOP card metadata; private source corpora are excluded.",
  };
}

async function recommendCardEdition({ arcCode, edition, collectionScope }) {
  const catalog = await loadShopCatalog();
  let sku;
  let basis;
  if (collectionScope === "arc") {
    const resolvedArcCode = arcCode || state.result?.dominant;
    if (!resolvedArcCode) {
      throw new Error("Provide arc_code or complete the reflection before requesting an ARC edition.");
    }
    sku = `arc-${resolvedArcCode}-${edition}`;
    basis = arcCode
      ? `ARC ${resolvedArcCode} was explicitly requested.`
      : `ARC ${resolvedArcCode} matches the completed reflection's primary lens.`;
  } else {
    const suffix = collectionScope === "complete_insight" ? "insight" : "visual";
    sku = `deck-${edition}-${suffix}`;
    basis = collectionScope === "complete_insight"
      ? "The complete edition includes all 144 cards and companion reflection prompts."
      : "The complete visual edition includes all 144 cards.";
  }
  const item = catalog.find((candidate) => candidate.sku === sku);
  if (!item) throw new Error("No matching public card edition is available.");
  return {
    found: true,
    sku: item.sku,
    title: item.title,
    subtitle: item.subtitle,
    description: item.description,
    edition: item.edition,
    scope: item.kind,
    arc_code: item.arcCode ?? null,
    domain: item.domain ?? null,
    image: item.image,
    fulfillment: "digital_download",
    recommendation_basis: basis,
    shop_path: "/shop.html",
    purchase_boundary: "Review the edition and Stripe-hosted price yourself. This tool cannot add items, start checkout, or make a purchase.",
  };
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
    consentVersion: "email-reflection-owner-review-v2-2026-08-30",
    website: formData.get("website"),
    source: "mirrorloopai.com/quiz",
    quizVersion: state.quiz.version,
    answers: state.answers,
    answerDetails: state.quiz.questions.map((question, index) => ({
      question: question.title,
      selection: question.options.find(
        (option) => option.arcCode === state.answers[index],
      )?.microIntent ?? state.answers[index],
    })),
    challengeToken: window.turnstile?.getResponse?.() ?? "",
  };
  try {
    const response = await fetch(`${config.apiBaseURL}/v1/subscribers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : {};
    if (!response.ok) {
      throw new Error(
        body.error
        ?? (response.status === 404
          ? "The email service is temporarily unavailable. Your reflection is still here—please try again shortly."
          : "We could not send the email. Please try again."),
      );
    }
    elements.formStatus.textContent = "Check your inbox and confirm your address to receive the reflection.";
    elements.form.reset();
  } catch (error) {
    elements.formStatus.textContent = error.message;
  } finally {
    elements.subscribe.disabled = false;
    elements.subscribe.textContent = "Email my reflection";
    window.turnstile?.reset?.();
    elements.formStatus.focus();
  }
}

$("#start-button").addEventListener("click", async () => {
  try {
    await startReflection();
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
  state.result = null;
  elements.result.hidden = true;
  elements.panel.hidden = false;
  renderQuestion();
  $("#quiz-save-status").textContent = "Your saved choices are selected. Keep each one or choose a different answer.";
  elements.question.focus();
});

$("#clear-answers-button").addEventListener("click", () => {
  reflectionStore.clear();
  state.index = 0;
  state.answers.fill(null);
  state.result = null;
  elements.result.hidden = true;
  elements.panel.hidden = false;
  renderQuestion();
  $("#quiz-save-status").textContent = "Saved choices cleared. Question 1 is ready for a fresh start.";
  elements.question.focus();
});

elements.form.addEventListener("submit", subscribe);

installMirrorLoopWebMCP({
  api: {
    startReflection,
    getCurrentQuestion: currentQuestion,
    explainChoice,
    answerQuestion,
    reviewAnswers,
    completeReflection,
    getCard,
    recommendCardEdition,
  },
  onLifecycle(type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  },
  onStatus({ supported, names }) {
    const status = $("#webmcp-status");
    if (!status) return;
    status.textContent = supported
      ? `WebMCP ready · ${names.length} tools`
      : "WebMCP unavailable · direct reflection ready";
    status.title = supported
      ? `${names.length} same-origin tools are registered for guided reflection.`
      : "The 12-question reflection remains fully available without WebMCP.";
    status.dataset.active = String(supported);
    document.body.classList.toggle("webmcp-active", supported);
    document.body.classList.toggle("direct-mode", !supported);
  },
});

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
