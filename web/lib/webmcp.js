const EMPTY_OBJECT_SCHEMA = Object.freeze({
  type: "object",
  properties: {},
  additionalProperties: false,
});

const CHOICE_CODE_SCHEMA = Object.freeze({
  type: "string",
  enum: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"],
  description: "Two-digit response code shown for the current question.",
});

const READ_ONLY = Object.freeze({
  readOnlyHint: true,
  untrustedContentHint: false,
});

const LOCAL_MUTATION = Object.freeze({
  readOnlyHint: false,
  untrustedContentHint: false,
});

export const WEBMCP_CHARACTER_BUDGETS = Object.freeze({
  toolName: 30,
  parameterName: 30,
  toolDescription: 500,
  parameterDescription: 150,
  toolOutput: 1500,
});

export const MIRRORLOOP_WEBMCP_TOOL_NAMES = Object.freeze([
  "start_reflection",
  "get_current_question",
  "explain_choice",
  "answer_reflection_question",
  "review_reflection_answers",
  "complete_reflection",
  "get_card",
  "recommend_card_edition",
]);

function asToolResult(value) {
  const text = JSON.stringify(value);
  if (text.length > WEBMCP_CHARACTER_BUDGETS.toolOutput) {
    throw new Error("Tool output exceeded the 1500-character WebMCP budget.");
  }
  return {
    content: [{ type: "text", text }],
  };
}

function asToolError(error) {
  return {
    content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  };
}

function checkedObject(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tool input must be an object.");
  }
  return value;
}

function checkedKeys(value, allowed) {
  const input = checkedObject(value);
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`Unknown input field: ${unknown[0]}.`);
  return input;
}

function requiredMethod(api, name) {
  if (typeof api?.[name] !== "function") {
    throw new Error(`MIRROR//LOOP WebMCP adapter is missing ${name}().`);
  }
  return api[name].bind(api);
}

function boundedFocusArea(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new Error("focus_area must be text.");
  const trimmed = value.trim();
  if (trimmed.length > 300) throw new Error("focus_area must be 300 characters or fewer.");
  return trimmed;
}

function checkedQuestionID(value) {
  if (!Number.isInteger(value) || value < 1 || value > 12) {
    throw new Error("question_id must be a whole number from 1 to 12.");
  }
  return value;
}

function checkedChoiceCode(value) {
  if (!CHOICE_CODE_SCHEMA.enum.includes(value)) {
    throw new Error("choice_code must be a two-digit code from 01 to 12.");
  }
  return value;
}

function checkedCardID(value) {
  if (typeof value !== "string" || !/^\d{3}$/.test(value)) {
    throw new Error("card_id must be a three-digit identifier.");
  }
  const number = Number(value);
  if (number < 1 || number > 144) {
    throw new Error("card_id must be between 001 and 144.");
  }
  return value;
}

function checkedArcCode(value) {
  if (value === undefined) return "";
  if (!CHOICE_CODE_SCHEMA.enum.includes(value)) {
    throw new Error("arc_code must be a two-digit code from 01 to 12.");
  }
  return value;
}

function checkedEdition(value) {
  if (!["mono", "color"].includes(value)) {
    throw new Error("edition must be mono or color.");
  }
  return value;
}

function checkedCollectionScope(value) {
  if (value === undefined) return "arc";
  if (!["arc", "complete_visual", "complete_insight"].includes(value)) {
    throw new Error("collection_scope must be arc, complete_visual, or complete_insight.");
  }
  return value;
}

function defineTools(api) {
  const startReflection = requiredMethod(api, "startReflection");
  const getCurrentQuestion = requiredMethod(api, "getCurrentQuestion");
  const explainChoice = requiredMethod(api, "explainChoice");
  const answerQuestion = requiredMethod(api, "answerQuestion");
  const reviewAnswers = requiredMethod(api, "reviewAnswers");
  const completeReflection = requiredMethod(api, "completeReflection");
  const getCard = requiredMethod(api, "getCard");
  const recommendCardEdition = requiredMethod(api, "recommendCardEdition");

  return [
    {
      name: "start_reflection",
      description: "Start or reset the private 12-question MIRROR//LOOP reflection in this page.",
      inputSchema: {
        type: "object",
        properties: {
          focus_area: {
            type: "string",
            maxLength: 300,
            description: "Optional private focus for this browser session.",
          },
        },
        additionalProperties: false,
      },
      annotations: LOCAL_MUTATION,
      run: (value) => {
        const input = checkedKeys(value, ["focus_area"]);
        return startReflection({ focusArea: boundedFocusArea(input.focus_area) });
      },
    },
    {
      name: "get_current_question",
      description: "Read the current reflection question and its available choices.",
      inputSchema: EMPTY_OBJECT_SCHEMA,
      annotations: READ_ONLY,
      run: (value) => {
        checkedKeys(value, []);
        return getCurrentQuestion();
      },
    },
    {
      name: "explain_choice",
      description: "Explain one choice from a reflection question in plain language without selecting it.",
      inputSchema: {
        type: "object",
        properties: {
          question_id: {
            type: "integer",
            minimum: 1,
            maximum: 12,
            description: "Question number from 1 to 12.",
          },
          choice_code: CHOICE_CODE_SCHEMA,
        },
        required: ["question_id", "choice_code"],
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      run: (value) => {
        const input = checkedKeys(value, ["question_id", "choice_code"]);
        return explainChoice({
          questionID: checkedQuestionID(input.question_id),
          choiceCode: checkedChoiceCode(input.choice_code),
        });
      },
    },
    {
      name: "answer_reflection_question",
      description: "Record or revise a choice the human explicitly confirmed; new answers advance the visible reflection and revisions preserve the current position.",
      inputSchema: {
        type: "object",
        properties: {
          question_id: {
            type: "integer",
            minimum: 1,
            maximum: 12,
            description: "Current question number from 1 to 12.",
          },
          choice_code: CHOICE_CODE_SCHEMA,
          confirmed_by_user: {
            type: "boolean",
            description: "Must be true only after the human confirms the choice.",
          },
        },
        required: ["question_id", "choice_code", "confirmed_by_user"],
        additionalProperties: false,
      },
      annotations: LOCAL_MUTATION,
      run: (value) => {
        const input = checkedKeys(value, ["question_id", "choice_code", "confirmed_by_user"]);
        if (input.confirmed_by_user !== true) {
          throw new Error("The human must explicitly confirm the choice before it can be recorded.");
        }
        return answerQuestion({
          questionID: checkedQuestionID(input.question_id),
          choiceCode: checkedChoiceCode(input.choice_code),
        });
      },
    },
    {
      name: "review_reflection_answers",
      description: "Review choices already recorded in the current private browser session.",
      inputSchema: EMPTY_OBJECT_SCHEMA,
      annotations: READ_ONLY,
      run: (value) => {
        checkedKeys(value, []);
        return reviewAnswers();
      },
    },
    {
      name: "complete_reflection",
      description: "Calculate and display the reflection after all 12 human-confirmed choices are recorded.",
      inputSchema: EMPTY_OBJECT_SCHEMA,
      annotations: LOCAL_MUTATION,
      run: (value) => {
        checkedKeys(value, []);
        return completeReflection();
      },
    },
    {
      name: "get_card",
      description: "Read bounded public metadata for a MIRROR//LOOP card identifier.",
      inputSchema: {
        type: "object",
        properties: {
          card_id: {
            type: "string",
            pattern: "^[0-9]{3}$",
            description: "Three-digit card identifier from 001 to 144.",
          },
        },
        required: ["card_id"],
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      run: (value) => {
        const input = checkedKeys(value, ["card_id"]);
        return getCard({ cardID: checkedCardID(input.card_id) });
      },
    },
    {
      name: "recommend_card_edition",
      description: "Find a matching digital card edition in the public catalog without showing prices, creating a cart, or starting checkout.",
      inputSchema: {
        type: "object",
        properties: {
          arc_code: {
            type: "string",
            enum: CHOICE_CODE_SCHEMA.enum,
            description: "Optional ARC code. When omitted for an ARC edition, use the completed reflection's primary lens.",
          },
          edition: {
            type: "string",
            enum: ["mono", "color"],
            description: "Preferred visual edition.",
          },
          collection_scope: {
            type: "string",
            enum: ["arc", "complete_visual", "complete_insight"],
            description: "Recommend one 12-card ARC, the complete visual deck, or the complete deck with companion reflections.",
          },
        },
        required: ["edition"],
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      run: (value) => {
        const input = checkedKeys(value, ["arc_code", "edition", "collection_scope"]);
        return recommendCardEdition({
          arcCode: checkedArcCode(input.arc_code),
          edition: checkedEdition(input.edition),
          collectionScope: checkedCollectionScope(input.collection_scope),
        });
      },
    },
  ];
}

export async function registerMirrorLoopWebMCP(modelContext, api, options = {}) {
  if (!modelContext || typeof modelContext.registerTool !== "function") {
    throw new Error("A WebMCP model context with registerTool() is required.");
  }

  const controller = options.controller ?? new AbortController();
  const tools = defineTools(api);
  try {
    for (const tool of tools) {
      const { run, ...definition } = tool;
      await modelContext.registerTool({
        ...definition,
        async execute(input) {
          try {
            return asToolResult(await run(input));
          } catch (error) {
            return asToolError(error);
          }
        },
      }, { signal: controller.signal });
    }
  } catch (error) {
    controller.abort();
    throw error;
  }

  return {
    names: tools.map(({ name }) => name),
    unregister: () => controller.abort(),
  };
}

export function findModelContext(documentRef = globalThis.document, navigatorRef = globalThis.navigator) {
  if (documentRef?.modelContext?.registerTool) return documentRef.modelContext;
  if (navigatorRef?.modelContext?.registerTool) return navigatorRef.modelContext;
  return null;
}

export function installMirrorLoopWebMCP({
  api,
  documentRef = globalThis.document,
  navigatorRef = globalThis.navigator,
  attempts = 20,
  intervalMs = 500,
  onStatus = () => {},
} = {}) {
  let cancelled = false;
  let timer = null;
  let registration = null;
  let remaining = attempts;

  const tryInstall = async () => {
    if (cancelled) return;
    const modelContext = findModelContext(documentRef, navigatorRef);
    if (modelContext) {
      try {
        registration = await registerMirrorLoopWebMCP(modelContext, api);
        if (!cancelled) onStatus({ supported: true, names: registration.names });
      } catch (error) {
        if (!cancelled) onStatus({ supported: false, names: [], error });
      }
      return;
    }
    remaining -= 1;
    if (remaining > 0) {
      timer = setTimeout(tryInstall, intervalMs);
    } else {
      onStatus({ supported: false, names: [] });
    }
  };

  tryInstall();
  return () => {
    cancelled = true;
    if (timer !== null) clearTimeout(timer);
    registration?.unregister();
  };
}
