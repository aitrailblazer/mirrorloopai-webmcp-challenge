import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const baseURL = process.env.MIRRORLOOP_TEST_URL ?? "http://127.0.0.1:4173";
const evidenceDir = process.env.MIRRORLOOP_EVIDENCE_DIR
  ? pathToFileURL(`${resolve(process.env.MIRRORLOOP_EVIDENCE_DIR)}/`)
  : new URL("../qa_evidence/webmcp_glass_cockpit/", import.meta.url);
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
  evidence.desktopPreview = await invokeLifecycleSequence(desktop);
  evidence.desktop = await hudState(desktop);
  assert.equal(evidence.desktop.phase, "11 TOOLS MOUNTED");
  assert.equal(evidence.desktop.activeTool, "export_reflection_dossier");
  assert.match(evidence.desktop.safeInput, /format: markdown/);
  assert.match(evidence.desktop.safeInput, /card id: representative/);
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
  evidence.mobilePreview = await invokeLifecycleSequence(mobile);
  evidence.mobile = await hudState(mobile);
  assert.equal(evidence.mobile.phase, "11 TOOLS MOUNTED");
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
  await page.waitForFunction(() => window.__mirrorloopTestTools?.size === 11);
  await page.evaluate(() => {
    return window.__mirrorloopTestTools.get("start_reflection").execute({
      focus_area: "private founder dispute",
    });
  });
  const comparison = await page.evaluate(async () => {
    const before = {
      progress: document.querySelector("#progress-label").textContent,
      selected: document.querySelectorAll('input[name="answer"]:checked').length,
    };
    const result = await window.__mirrorloopTestTools.get("compare_choices").execute({
      question_id: 1,
      choice_a: "01",
      choice_b: "06",
    });
    const after = {
      progress: document.querySelector("#progress-label").textContent,
      selected: document.querySelectorAll('input[name="answer"]:checked').length,
    };
    return { before, after, payload: JSON.parse(result.content[0].text) };
  });
  assert.deepEqual(comparison.before, comparison.after);
  assert.equal(comparison.payload.selection_status, "NEITHER_SELECTED");
  assert.match(comparison.payload.boundary, /does not rank, select, or record/i);
  const answers = ["01", "01", "01", "01", "01", "01", "08", "08", "08", "08", "08", "02"];
  for (const [index, choiceCode] of answers.entries()) {
    await page.evaluate(({ questionID, choiceCode: selectedChoice }) => {
      return window.__mirrorloopTestTools.get("answer_reflection_question").execute({
        question_id: questionID,
        choice_code: selectedChoice,
        confirmed_by_user: true,
      });
    }, { questionID: index + 1, choiceCode });
  }
  await page.evaluate(() => {
    return window.__mirrorloopTestTools.get("complete_reflection").execute({});
  });
  const preview = await page.evaluate(async () => {
    const reviewTool = window.__mirrorloopTestTools.get("review_reflection_answers");
    const before = JSON.parse((await reviewTool.execute({})).content[0].text);
    const visibleBefore = {
      resultHidden: document.querySelector("#result-panel").hidden,
      resultText: document.querySelector("#result-panel").textContent,
    };
    const result = await window.__mirrorloopTestTools.get("preview_answer_impact").execute({
      question_id: 4,
      hypothetical_choice: "08",
    });
    const after = JSON.parse((await reviewTool.execute({})).content[0].text);
    const visibleAfter = {
      resultHidden: document.querySelector("#result-panel").hidden,
      resultText: document.querySelector("#result-panel").textContent,
    };
    await window.__mirrorloopTestTools.get("preview_answer_impact").execute({
      question_id: 4,
      hypothetical_choice: "08",
    });
    return {
      before,
      after,
      visibleBefore,
      visibleAfter,
      payload: JSON.parse(result.content[0].text),
    };
  });
  assert.deepEqual(preview.before, preview.after);
  assert.deepEqual(preview.visibleBefore, preview.visibleAfter);
  assert.equal(preview.payload.status, "PROVISIONAL_PREVIEW");
  assert.equal(preview.payload.current_dominant.code, "01");
  assert.equal(preview.payload.projected_dominant.code, "08");
  assert.equal(preview.payload.dominant_changed, true);
  assert.deepEqual(preview.payload.frequency_delta, { "01": -1, "08": 1 });
  assert.match(preview.payload.boundary, /does not save, select, or revise/i);
  await page.evaluate(() => {
    window.__exportEgressCalls = [];
    window.__originalExportFetch = window.fetch;
    window.fetch = (...args) => {
      window.__exportEgressCalls.push({ type: "fetch", target: String(args[0]) });
      return window.__originalExportFetch(...args);
    };
    window.__originalExportXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function trackedOpen(method, target, ...rest) {
      window.__exportEgressCalls.push({ type: "xhr", method, target: String(target) });
      return window.__originalExportXHROpen.call(this, method, target, ...rest);
    };
    window.__originalExportBeacon = navigator.sendBeacon?.bind(navigator);
    if (window.__originalExportBeacon) {
      navigator.sendBeacon = (...args) => {
        window.__exportEgressCalls.push({ type: "beacon", target: String(args[0]) });
        return window.__originalExportBeacon(...args);
      };
    }
  });
  const downloadPromise = page.waitForEvent("download");
  const exportResult = await page.evaluate(() => {
    return window.__mirrorloopTestTools.get("export_reflection_dossier").execute({
      format: "markdown",
      confirmed_by_user: true,
    });
  });
  const download = await downloadPromise;
  const downloadPath = new URL(`download-${Date.now()}.md`, evidenceDir).pathname;
  await download.saveAs(downloadPath);
  const content = await readFile(downloadPath, "utf8");
  const exportEgressCalls = await page.evaluate(() => {
    const calls = [...window.__exportEgressCalls];
    window.fetch = window.__originalExportFetch;
    XMLHttpRequest.prototype.open = window.__originalExportXHROpen;
    if (window.__originalExportBeacon) navigator.sendBeacon = window.__originalExportBeacon;
    return calls;
  });
  const exportPayload = JSON.parse(exportResult.content[0].text);
  assert.equal(exportPayload.status, "DOWNLOAD_REQUESTED");
  assert.equal(exportPayload.egress, "NONE_DURING_EXPORT");
  assert.equal(exportPayload.included_answers, 12);
  assert.equal(exportPayload.card.relationship, "representative_of_primary_arc");
  assert.match(download.suggestedFilename(), /^mirrorloop-reflection-\d{4}-\d{2}-\d{2}\.md$/);
  assert.match(content, /# MIRROR\/\/LOOP Reflection Dossier/);
  assert.equal((content.match(/^### \d+\./gm) ?? []).length, 12);
  assert.deepEqual(exportEgressCalls, []);
  return {
    comparison,
    preview,
    dossier: {
      payload: exportPayload,
      suggestedFilename: download.suggestedFilename(),
      bytes: Buffer.byteLength(content),
      exportEgressCalls,
    },
  };
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
