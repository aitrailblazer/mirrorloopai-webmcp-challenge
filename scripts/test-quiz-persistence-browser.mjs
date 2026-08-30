import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const baseURL = process.env.MIRRORLOOP_TEST_URL ?? "http://127.0.0.1:4173";
const output = new URL("../qa_evidence/quiz_answer_persistence/browser-retest.json", import.meta.url);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const evidence = { baseURL };

try {
  await page.goto(`${baseURL}/?f029-test=1`);
  await page.locator("#start-button").click();
  await page.locator(".answer").first().click();
  await page.locator("#next-button").click();
  await page.locator(".answer").nth(1).click();
  evidence.initial = await page.evaluate(() => ({
    progress: document.querySelector("#progress-label").textContent,
    saved: JSON.parse(localStorage.getItem("mirrorloop.reflection.answers.v1")),
  }));
  assert.deepEqual(evidence.initial.saved.answers.slice(0, 2), ["01", "02"]);

  await page.reload();
  await page.locator("#start-button").click();
  await page.locator(".answer").first().waitFor();
  evidence.restoredQuestion1 = await selectedState(page);
  assert.equal(evidence.restoredQuestion1.selectedCode, "01");
  assert.equal(evidence.restoredQuestion1.nextDisabled, false);
  assert.match(evidence.restoredQuestion1.saveStatus, /2 saved choices restored/);

  await page.locator("#next-button").click();
  evidence.restoredQuestion2 = await selectedState(page);
  assert.equal(evidence.restoredQuestion2.selectedCode, "02");
  await page.locator('.answer[data-code="03"]').click();

  for (let question = 2; question < 12; question += 1) {
    await page.locator("#next-button").click();
    await page.locator(".answer").first().click();
  }
  await page.locator("#next-button").click();
  assert.equal(await page.locator("#result-panel").isVisible(), true);

  await page.locator("#restart-button").click();
  evidence.review = await selectedState(page);
  assert.equal(evidence.review.selectedCode, "01");
  assert.match(evidence.review.saveStatus, /saved choices are selected/);
  await page.locator(".response-group").nth(1).locator("summary").click();
  await page.locator('.answer[data-code="04"]').click();
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem("mirrorloop.reflection.answers.v1")).answers[0]),
    "04",
  );

  for (let question = 0; question < 11; question += 1) {
    await page.locator("#next-button").click();
  }
  await page.locator("#next-button").click();
  await page.locator("#clear-answers-button").click();
  evidence.cleared = await selectedState(page);
  assert.equal(evidence.cleared.selectedCode, null);
  assert.equal(evidence.cleared.nextDisabled, true);
  assert.equal(await page.evaluate(() => localStorage.getItem("mirrorloop.reflection.answers.v1")), null);

  await page.evaluate(() => {
    localStorage.setItem("mirrorloop.reflection.answers.v1", JSON.stringify({
      schema: 1,
      quizVersion: "stale",
      answers: Array(12).fill("99"),
    }));
  });
  await page.reload();
  await page.locator("#start-button").click();
  await page.locator(".answer").first().waitFor();
  evidence.staleRejected = await selectedState(page);
  assert.equal(evidence.staleRejected.selectedCode, null);
  assert.equal(await page.evaluate(() => localStorage.getItem("mirrorloop.reflection.answers.v1")), null);

  evidence.status = "PASS";
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`quiz answer persistence browser test: PASS (${output.pathname})`);
} finally {
  await browser.close();
}

async function selectedState(activePage) {
  return activePage.evaluate(() => ({
    progress: document.querySelector("#progress-label").textContent,
    selectedCode: document.querySelector(".answer.selected")?.dataset.code ?? null,
    nextDisabled: document.querySelector("#next-button").disabled,
    saveStatus: document.querySelector("#quiz-save-status").textContent,
  }));
}
