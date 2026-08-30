import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const htmlPath =
  process.env.MIRRORLOOP_CONFIRMATION_PREVIEW ??
  "/tmp/mirrorloop-confirmation-valid.html";
const evidenceDir = path.join(
  root,
  "qa_evidence",
  "confirmation_page_style_regression",
);
const evidencePrefix =
  process.env.MIRRORLOOP_CONFIRMATION_EVIDENCE_PREFIX ?? "";
const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const [html, css] = await Promise.all([
  readFile(htmlPath),
  readFile(path.join(root, "web", "confirmation.css")),
]);

const csp =
  "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const server = createServer((request, response) => {
  response.setHeader("Content-Security-Policy", csp);
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.url?.startsWith("/confirmation.css")) {
    response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
    response.end(css);
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
});

await mkdir(evidenceDir, { recursive: true });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("test server did not expose a TCP port");
}

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});

const results = [];
try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const response = await page.goto(
      `http://127.0.0.1:${address.port}/confirmation-preview`,
      { waitUntil: "networkidle" },
    );
    const state = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const card = document.querySelector(".card");
      const button = document.querySelector(".button");
      if (!card) throw new Error("confirmation card missing");
      return {
        bodyBackground: body.backgroundImage,
        bodyColor: body.color,
        cardRadius: getComputedStyle(card).borderRadius,
        buttonRadius: button ? getComputedStyle(button).borderRadius : null,
        resultVisible: Boolean(document.querySelector(".result")),
        stylesheetCount: document.styleSheets.length,
        horizontalOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      };
    });

    const passed =
      response?.status() === 200 &&
      state.stylesheetCount === 1 &&
      state.bodyBackground.includes("radial-gradient") &&
      state.cardRadius !== "0px" &&
      state.buttonRadius !== "0px" &&
      !state.horizontalOverflow &&
      consoleErrors.length === 0;
    if (!passed) {
      throw new Error(
        `${viewport.name} confirmation render failed: ${JSON.stringify({
          status: response?.status(),
          state,
          consoleErrors,
        })}`,
      );
    }

    await page.screenshot({
      path: path.join(
        evidenceDir,
        `${evidencePrefix}${viewport.name}_local_verified.png`,
      ),
      fullPage: true,
    });
    results.push({ viewport, status: response.status(), ...state, consoleErrors });
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

await writeFile(
  path.join(evidenceDir, `${evidencePrefix}browser_local_results.json`),
  `${JSON.stringify({ csp, results }, null, 2)}\n`,
);
console.log(`PASS confirmation browser render (${results.length} viewports)`);
