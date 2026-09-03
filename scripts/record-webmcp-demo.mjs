import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const target = process.env.MIRRORLOOP_DEMO_URL ?? "https://mirrorloopai.com/";
const outputDir = resolve(process.env.MIRRORLOOP_DEMO_DIR ?? "docs/demo/output");
const timelinePath = resolve(outputDir, "narration-receipt.json");
const timeline = JSON.parse(await readFile(timelinePath, "utf8"));
const scenes = new Map(timeline.scenes.map((scene) => [scene.id, scene]));
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
  recordVideo: {
    dir: outputDir,
    size: { width: 1440, height: 900 },
  },
});
const recordingStartedAt = Date.now();
const page = await context.newPage();
await page.route("**/mirrorloop-demo-overlay.css", async (route) => {
  await route.fulfill({
    contentType: "text/css",
    body: `
      #ml-demo-caption {
        position: fixed; z-index: 10002; right: 30px; top: 86px;
        width: min(580px, calc(100vw - 96px));
        padding: 14px 20px; border: 1px solid rgba(239,189,97,.9);
        border-radius: 16px; background: rgba(7,10,18,.94); color: #f7f1e4;
        box-shadow: 0 18px 60px rgba(0,0,0,.58), inset 0 1px rgba(255,255,255,.04);
        font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
        backdrop-filter: blur(12px); transition: opacity .2s ease, transform .2s ease;
      }
      #ml-demo-caption strong {
        display: block; color: #efbd61; letter-spacing: .15em;
        font-size: 12px; line-height: 1.2; margin-bottom: 6px;
      }
      #ml-demo-caption span { display: block; color: #ffe07a; font-size: 19px; line-height: 1.32; }
      #ml-demo-spotlight {
        position: fixed; z-index: 10001; pointer-events: none; border-radius: 18px;
        border: 2px solid rgba(239,189,97,.96);
        box-shadow: 0 0 0 9999px rgba(2,4,12,.22), 0 0 0 7px rgba(239,189,97,.12),
          0 0 32px rgba(239,189,97,.42);
        transition: left .35s ease, top .35s ease, width .35s ease, height .35s ease;
        animation: ml-demo-pulse 2.4s ease-in-out infinite;
      }
      @keyframes ml-demo-pulse {
        0%, 100% { box-shadow: 0 0 0 9999px rgba(2,4,12,.22), 0 0 0 7px rgba(239,189,97,.10), 0 0 25px rgba(239,189,97,.34); }
        50% { box-shadow: 0 0 0 9999px rgba(2,4,12,.22), 0 0 0 11px rgba(239,189,97,.16), 0 0 40px rgba(239,189,97,.55); }
      }
      #ml-demo-stage {
        position: fixed; z-index: 10003; inset: 0; display: grid; place-items: center;
        padding: 9vw; text-align: center; overflow: hidden;
        background:
          radial-gradient(circle at 50% 24%, rgba(111,56,153,.34), transparent 34%),
          radial-gradient(circle at 50% 88%, rgba(239,189,97,.14), transparent 35%),
          linear-gradient(145deg, #050712 0%, #101024 48%, #080b16 100%);
        color: #f7f1e4; opacity: 0; pointer-events: none;
        transition: opacity .28s ease;
      }
      #ml-demo-stage::before, #ml-demo-stage::after {
        content: ""; position: absolute; inset: 28px; border: 1px solid rgba(239,189,97,.32);
        border-radius: 26px; pointer-events: none;
      }
      #ml-demo-stage::after { inset: 38px; border-color: rgba(239,189,97,.10); }
      #ml-demo-stage[data-visible="true"] { opacity: 1; }
      #ml-demo-stage .stage-inner { width: min(1050px, 84vw); transform: translateY(-16px); }
      #ml-demo-stage .stage-mark {
        width: 76px; height: 76px; margin: 0 auto 24px; display: grid; place-items: center;
        border: 1px solid rgba(239,189,97,.72); border-radius: 50%; color: #efbd61;
        font: 34px/1 Georgia, serif; box-shadow: 0 0 38px rgba(239,189,97,.16);
      }
      #ml-demo-stage .stage-mark img { width: 58px; height: 58px; display: block; }
      #ml-demo-stage .stage-eyebrow {
        color: #efbd61; font: 800 14px/1.3 Inter, -apple-system, sans-serif;
        letter-spacing: .24em; text-transform: uppercase; margin-bottom: 18px;
      }
      #ml-demo-stage h1 {
        margin: 0 auto 22px; max-width: 1050px; color: #f7f1e4;
        font: 600 clamp(48px, 6.2vw, 92px)/.98 Georgia, serif; letter-spacing: -.035em;
      }
      #ml-demo-stage p {
        margin: 0 auto; max-width: 850px; color: #c9c6d2;
        font: 500 clamp(20px, 2vw, 29px)/1.42 Inter, -apple-system, sans-serif;
      }
      #ml-demo-stage .stage-rule {
        width: 160px; height: 1px; margin: 30px auto 0;
        background: linear-gradient(90deg, transparent, #efbd61, transparent);
      }
      #ml-demo-stage .stage-copyright {
        position: absolute; left: 0; right: 0; bottom: 24px;
        color: rgba(247,241,228,.62); font: 600 12px/1.3 Inter, -apple-system, sans-serif;
        letter-spacing: .12em; text-transform: uppercase;
      }
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

const observed = [];
let contentStartedAt = 0;
try {
  await page.goto(`${target}?webmcp-demo=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__mirrorloopDemoTools?.size === 11);
  await installDemoOverlay(page);
  contentStartedAt = Date.now();

  await runScene("identity");
  await runScene("mirrorloop");
  await runScene("website-challenge");
  await runScene("webmcp");
  await runScene("entry");
  await runScene("registration", async () => {
    await page.locator("#agent-state-panel").evaluate((panel) => {
      panel.open = true;
    });
  });
  await runScene("current-question", async () => {
    await call(page, "start_reflection", { focus_area: "private demonstration context" });
    await call(page, "get_current_question", {});
  });
  await runScene("compare", async () => {
    const comparison = await call(page, "compare_choices", {
      question_id: 1,
      choice_a: "01",
      choice_b: "06",
    });
    await updateDetail(
      `${comparison.choice_a.name} ↔ ${comparison.choice_b.name} · ${comparison.selection_status}`,
    );
  });
  await runScene("rejection", async () => {
    const rejected = await call(page, "answer_reflection_question", {
      question_id: 1,
      choice_code: "01",
      confirmed_by_user: false,
    });
    await updateDetail(rejected.error?.message ?? rejected.text ?? "Unconfirmed mutation rejected.");
  });
  await runScene("confirmation", async () => {
    await call(page, "answer_reflection_question", {
      question_id: 1,
      choice_code: "01",
      confirmed_by_user: true,
    });
  });
  await runScene("result", async () => {
    const remaining = ["01", "01", "01", "01", "01", "08", "08", "08", "08", "08", "02"];
    for (const [offset, choice_code] of remaining.entries()) {
      await call(page, "answer_reflection_question", {
        question_id: offset + 2,
        choice_code,
        confirmed_by_user: true,
      });
    }
    const completed = await call(page, "complete_reflection", {});
    await updateDetail(
      `${completed.primary_lens.name} · ${completed.primary_lens.observed_count} of 12 responses`,
    );
  });
  await runScene("preview", async () => {
    const preview = await call(page, "preview_answer_impact", {
      question_id: 4,
      hypothetical_choice: "08",
    });
    await updateDetail(
      `${preview.current_dominant.name} → ${preview.projected_dominant.name} · nothing saved`,
    );
  });
  await runScene("card", async () => {
    const card = await call(page, "get_card", { card_id: "004" });
    await updateDetail(`${card.title} · ${card.domain}`);
  });
  await runScene("edition", async () => {
    const edition = await call(page, "recommend_card_edition", {
      arc_code: "01",
      edition: "color",
      collection_scope: "arc",
    });
    await updateDetail(`${edition.title} · no price, cart, Checkout, or payment`);
  });
  await runScene("export", async () => {
    const downloadPromise = page.waitForEvent("download");
    await call(page, "export_reflection_dossier", {
      format: "markdown",
      card_id: "004",
      confirmed_by_user: true,
    });
    const download = await downloadPromise;
    await updateDetail(`${download.suggestedFilename()} · downloaded locally after confirmation`);
  });
  await runScene("close");
} finally {
  const rawVideo = await page.video().path();
  await context.close();
  await browser.close();
  const finalVideo = resolve(outputDir, "mirrorloop-webmcp-demo-silent.webm");
  await rename(rawVideo, finalVideo);
  const receipt = {
    target,
    tools: 11,
    voiceTimeline: timelinePath,
    recordedAt: new Date().toISOString(),
    video: finalVideo,
    trimStartSeconds: Math.max(0, (contentStartedAt - recordingStartedAt) / 1000),
    expectedContentSeconds: timeline.durationSeconds,
    observedScenes: observed,
    boundary:
      "Production tool definitions executed through a local modelContext-compatible demo harness; no external model-selection claim.",
  };
  await writeFile(
    resolve(outputDir, "recording-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  console.log(JSON.stringify(receipt, null, 2));
}

async function runScene(id, action = async () => {}) {
  const scene = scenes.get(id);
  if (!scene) throw new Error(`Missing scene timeline: ${id}`);
  const startedAt = Date.now();
  await showScene(scene);
  await action();
  await focus(scene.focus_selector);
  const actionMilliseconds = Date.now() - startedAt;
  const targetMilliseconds = scene.duration_seconds * 1000;
  if (actionMilliseconds > targetMilliseconds) {
    throw new Error(
      `Scene ${id} action exceeded its synchronized duration: ${actionMilliseconds}ms > ${targetMilliseconds}ms.`,
    );
  }
  await page.waitForTimeout(targetMilliseconds - actionMilliseconds);
  observed.push({
    id,
    target_seconds: scene.duration_seconds,
    observed_seconds: round((Date.now() - startedAt) / 1000),
    action_seconds: round(actionMilliseconds / 1000),
  });
}

async function call(pageRef, name, args) {
  return pageRef.evaluate(
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
}

async function installDemoOverlay(pageRef) {
  await pageRef.evaluate(() => {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/mirrorloop-demo-overlay.css";
    document.head.append(stylesheet);
    const spotlight = document.createElement("div");
    spotlight.id = "ml-demo-spotlight";
    spotlight.setAttribute("aria-hidden", "true");
    const caption = document.createElement("div");
    caption.id = "ml-demo-caption";
    caption.setAttribute("role", "status");
    caption.innerHTML = "<strong>LIVE WEBMCP DEMO</strong><span>Preparing the production contract…</span>";
    const stage = document.createElement("section");
    stage.id = "ml-demo-stage";
    stage.setAttribute("aria-hidden", "true");
    stage.innerHTML = `
      <div class="stage-inner">
        <div class="stage-mark"><img src="/favicon.svg" alt=""></div>
        <div class="stage-eyebrow"></div>
        <h1></h1>
        <p></p>
        <div class="stage-rule"></div>
      </div>
      <div class="stage-copyright">© 2026 AITrailblazer · MIRROR//LOOP</div>`;
    document.body.append(spotlight, caption, stage);
  });
  await pageRef.waitForFunction(() => (
    getComputedStyle(document.querySelector("#ml-demo-caption")).position === "fixed"
  ));
}

async function showScene(scene) {
  await page.evaluate((data) => {
    const stage = document.querySelector("#ml-demo-stage");
    const isTitle = data.mode === "title";
    stage.dataset.visible = String(isTitle);
    stage.setAttribute("aria-hidden", String(!isTitle));
    document.querySelector("#ml-demo-caption").style.opacity = isTitle ? "0" : "1";
    if (isTitle) {
      stage.querySelector(".stage-eyebrow").textContent = data.eyebrow ?? "";
      stage.querySelector("h1").textContent = data.title;
      stage.querySelector("p").textContent = data.detail;
    }
  }, scene);
  if (scene.focus_selector) {
    const locator = page.locator(scene.focus_selector);
    if (await locator.count() && await locator.first().isVisible()) {
      await locator.first().scrollIntoViewIfNeeded();
    }
  }
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
    { heading: scene.title, body: scene.detail },
  );
  if (scene.mode === "title") {
    await page.evaluate(() => {
      document.querySelector("#ml-demo-spotlight").style.opacity = "0";
    });
  } else {
    await focus(scene.focus_selector);
  }
}

async function updateDetail(detail) {
  await page.evaluate((value) => {
    document.querySelector("#ml-demo-caption span").textContent = value;
  }, detail);
}

async function focus(selector) {
  if (selector) {
    const locator = page.locator(selector);
    if (await locator.count() && await locator.first().isVisible()) {
      await locator.first().scrollIntoViewIfNeeded();
    }
  }
  await page.evaluate((targetSelector) => {
    const spotlight = document.querySelector("#ml-demo-spotlight");
    const targetNode = targetSelector ? document.querySelector(targetSelector) : null;
    if (!targetNode || targetNode.hidden) {
      spotlight.style.opacity = "0";
      return;
    }
    const rect = targetNode.getBoundingClientRect();
    const margin = 10;
    spotlight.style.opacity = "1";
    spotlight.style.left = `${Math.max(8, rect.left - margin)}px`;
    spotlight.style.top = `${Math.max(8, rect.top - margin)}px`;
    spotlight.style.width = `${Math.min(innerWidth - 16, rect.width + margin * 2)}px`;
    spotlight.style.height = `${Math.min(innerHeight - 16, rect.height + margin * 2)}px`;
  }, selector);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
