import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const baseURL = process.env.MIRRORLOOP_TEST_URL ?? "http://127.0.0.1:4173";
const evidenceDir = new URL("../qa_evidence/webmcp_glass_cockpit/", import.meta.url);
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const evidence = { baseURL };

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await installModelContextHarness(desktop);
  await desktop.goto(`${baseURL}/?wm014-test=1`);
  await desktop.locator("#agent-state-panel").waitFor();
  await invokeLifecycleSequence(desktop);
  evidence.desktop = await hudState(desktop);
  assert.equal(evidence.desktop.phase, "8 TOOLS MOUNTED");
  assert.equal(evidence.desktop.activeTool, "answer_reflection_question");
  assert.match(evidence.desktop.safeInput, /question id: 1/);
  assert.match(evidence.desktop.safeInput, /confirmed by user: yes/);
  assert.equal(evidence.desktop.confirmation, "HUMAN CONFIRMED");
  assert.equal(evidence.desktop.confirmationState, "confirmed");
  assert.match(evidence.desktop.duration, /^\d+\.\d ms observed$/);
  assert.equal(evidence.desktop.events.length <= 5, true);
  assert.equal(evidence.desktop.privateFocusVisible, false);
  assert.equal(evidence.desktop.horizontalOverflow, false);

  const summary = desktop.locator("#agent-state-panel > summary");
  await summary.click();
  assert.equal(await desktop.locator("#agent-state-panel").getAttribute("open"), null);
  await summary.focus();
  await desktop.keyboard.press("Enter");
  assert.notEqual(await desktop.locator("#agent-state-panel").getAttribute("open"), null);
  await desktop.screenshot({
    path: new URL("desktop-retest.png", evidenceDir).pathname,
    fullPage: true,
  });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await installModelContextHarness(mobile);
  await mobile.goto(`${baseURL}/?wm014-mobile-test=1`);
  await mobile.locator("#agent-state-panel").waitFor();
  await invokeLifecycleSequence(mobile);
  evidence.mobile = await hudState(mobile);
  assert.equal(evidence.mobile.phase, "8 TOOLS MOUNTED");
  assert.equal(evidence.mobile.horizontalOverflow, false);
  assert.equal(evidence.mobile.position, "relative");
  await mobile.screenshot({
    path: new URL("mobile-retest.png", evidenceDir).pathname,
    fullPage: true,
  });

  evidence.status = "PASS";
  await writeFile(
    new URL("browser-retest.json", evidenceDir),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  console.log(`WebMCP Agent State HUD browser test: PASS (${evidenceDir.pathname})`);
} finally {
  await browser.close();
}

async function installModelContextHarness(page) {
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
    window.__mirrorloopTestTools = tools;
  });
}

async function invokeLifecycleSequence(page) {
  await page.waitForFunction(() => window.__mirrorloopTestTools?.size === 8);
  await page.evaluate(() => {
    return window.__mirrorloopTestTools.get("start_reflection").execute({
      focus_area: "private founder dispute",
    });
  });
  await page.evaluate(() => {
    return window.__mirrorloopTestTools.get("answer_reflection_question").execute({
      question_id: 1,
      choice_code: "01",
      confirmed_by_user: true,
    });
  });
}

async function hudState(page) {
  return page.evaluate(() => {
    const hud = document.querySelector(".agent-state-hud");
    return {
      phase: document.querySelector("#agent-phase").textContent,
      activeTool: document.querySelector("#agent-active-tool").textContent,
      safeInput: document.querySelector("#agent-safe-input").textContent,
      confirmation: document.querySelector("#agent-confirmation").textContent,
      confirmationState: document.querySelector("#agent-confirmation").dataset.state,
      duration: document.querySelector("#agent-duration").textContent,
      events: [...document.querySelectorAll("#agent-event-list li")].map((item) => item.textContent),
      privateFocusVisible: document.body.textContent.includes("private founder dispute"),
      position: getComputedStyle(hud).position,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}
