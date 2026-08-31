import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const target = process.env.MIRRORLOOP_DEMO_URL ?? "https://mirrorloopai.com/";
const outputDir = resolve(process.env.MIRRORLOOP_DEMO_DIR ?? "docs/demo/output");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: {
    dir: outputDir,
    size: { width: 1440, height: 900 },
  },
});
const page = await context.newPage();
await page.route("**/mirrorloop-demo-overlay.css", async (route) => {
  await route.fulfill({
    contentType: "text/css",
    body: `
      #ml-demo-caption {
        position: fixed; z-index: 10000; left: 50%; bottom: 34px;
        width: min(800px, calc(100vw - 80px)); transform: translateX(-50%);
        padding: 18px 24px; border: 1px solid #efbd61; border-radius: 18px;
        background: rgba(7, 10, 18, .96); color: #f7f1e4;
        box-shadow: 0 22px 70px rgba(0,0,0,.6);
        font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
      }
      #ml-demo-caption strong {
        display: block; color: #efbd61; letter-spacing: .14em;
        font-size: 13px; margin-bottom: 7px;
      }
      #ml-demo-caption span { display: block; font-size: 24px; line-height: 1.25; }
    `,
  });
});

await page.addInitScript(() => {
  const tools = new Map();
  const context = {
    async registerTool(definition) {
      tools.set(definition.name, definition);
    },
  };
  Object.defineProperty(Document.prototype, "modelContext", {
    configurable: true,
    get: () => context,
  });
  window.__mirrorloopDemoTools = tools;
});

try {
  await page.goto(`${target}?webmcp-demo=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__mirrorloopDemoTools?.size === 11);
  await installDemoOverlay(page);

  await show(page, "LIVE WEBMCP NODE", "11 typed tools mounted on mirrorloopai.com", 6500);
  await page.locator("#agent-state-panel").evaluate((panel) => {
    panel.open = true;
  });
  await show(page, "VISIBLE AGENT STATE", "Tool lifecycle, timing, and confirmation are shown on-page.", 6500);

  await call(page, "start_reflection", { focus_area: "private demonstration context" });
  await call(page, "get_current_question", {});
  await show(page, "READ CURRENT STATE", "Question 1 of 12 · public choices only", 6500);

  const comparison = await call(page, "compare_choices", {
    question_id: 1,
    choice_a: "01",
    choice_b: "06",
  });
  await show(
    page,
    "COMPARE WITHOUT CHOOSING",
    `${comparison.choice_a.name} ↔ ${comparison.choice_b.name} · ${comparison.selection_status}`,
    9000,
  );

  const rejected = await call(page, "answer_reflection_question", {
    question_id: 1,
    choice_code: "01",
    confirmed_by_user: false,
  });
  await show(
    page,
    "HUMAN AUTHORITY GATE",
    rejected.error?.message ?? rejected.text ?? "Unconfirmed mutation rejected",
    7500,
  );

  await call(page, "answer_reflection_question", {
    question_id: 1,
    choice_code: "01",
    confirmed_by_user: true,
  });
  await show(page, "EXPLICITLY CONFIRMED", "Answer recorded · visible progress advanced", 6500);

  const remaining = ["01", "01", "01", "01", "01", "08", "08", "08", "08", "08", "02"];
  for (const [offset, choice_code] of remaining.entries()) {
    await call(page, "answer_reflection_question", {
      question_id: offset + 2,
      choice_code,
      confirmed_by_user: true,
    });
  }
  await show(page, "PREPARED HUMAN-CONFIRMED STATE", "12 of 12 choices recorded", 4500);

  const completed = await call(page, "complete_reflection", {});
  await show(
    page,
    "DETERMINISTIC RESULT",
    `${completed.primary_lens.name} · ${completed.primary_lens.observed_count} of 12 responses`,
    8500,
  );

  const preview = await call(page, "preview_answer_impact", {
    question_id: 4,
    hypothetical_choice: "08",
  });
  await show(
    page,
    "PROVISIONAL WHAT-IF",
    `${preview.current_dominant.name} → ${preview.projected_dominant.name} · nothing saved`,
    8500,
  );

  const card = await call(page, "get_card", { card_id: "004" });
  await show(
    page,
    "PUBLIC CARD 004",
    `${card.title} · ${card.domain}`,
    7500,
  );

  const edition = await call(page, "recommend_card_edition", {
    arc_code: "01",
    edition: "color",
    collection_scope: "arc",
  });
  await show(
    page,
    "READ-ONLY EDITION MATCH",
    `${edition.title} · no price, cart, checkout, or payment`,
    7500,
  );

  await show(
    page,
    "LOCAL DOSSIER EXPORT",
    "Markdown or JSON · explicit confirmation · no email required",
    7000,
  );

  await show(
    page,
    "HUMAN IN CONTROL",
    "mirrorloopai.com · github.com/aitrailblazer/mirrorloopai-webmcp-challenge",
    18000,
  );
} finally {
  const rawVideo = await page.video().path();
  await context.close();
  await browser.close();
  const finalVideo = resolve(outputDir, "mirrorloop-webmcp-demo-silent.webm");
  await rename(rawVideo, finalVideo);
  await writeFile(
    resolve(outputDir, "recording-receipt.json"),
    `${JSON.stringify(
      {
        target,
        tools: 11,
        recordedAt: new Date().toISOString(),
        video: finalVideo,
        boundary:
          "Production tool definitions executed through a local modelContext-compatible demo harness; no external model-selection claim.",
      },
      null,
      2,
    )}\n`,
  );
  console.log(finalVideo);
}

async function call(page, name, args) {
  const result = await page.evaluate(
    async ({ toolName, toolArgs }) => {
      const tool = window.__mirrorloopDemoTools.get(toolName);
      if (!tool) throw new Error(`Missing registered tool: ${toolName}`);
      const response = await tool.execute(toolArgs);
      const text = response.content[0].text;
      try {
        return JSON.parse(text);
      } catch {
        return { isError: response.isError === true, text };
      }
    },
    { toolName: name, toolArgs: args },
  );
  return result;
}

async function installDemoOverlay(page) {
  await page.evaluate(() => {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/mirrorloop-demo-overlay.css";
    document.head.append(stylesheet);
    const caption = document.createElement("div");
    caption.id = "ml-demo-caption";
    caption.setAttribute("role", "status");
    caption.innerHTML = "<strong>LIVE WEBMCP DEMO</strong><span>Preparing the production contract…</span>";
    document.body.append(caption);
  });
  await page.waitForFunction(() => (
    getComputedStyle(document.querySelector("#ml-demo-caption")).position === "fixed"
  ));
}

async function show(page, title, detail, duration) {
  await page.evaluate(
    ({ heading, body }) => {
      const caption = document.querySelector("#ml-demo-caption");
      caption.innerHTML = "";
      const strong = document.createElement("strong");
      strong.textContent = heading;
      const span = document.createElement("span");
      span.textContent = body;
      caption.append(strong, span);
    },
    { heading: title, body: detail },
  );
  await page.waitForTimeout(duration);
}
