import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { basename, extname, relative, resolve, sep } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(new URL("..", import.meta.url).pathname);
const webRoot = resolve(root, "web");
const artifactPath = resolve(
  process.env.WEBMCP_EVAL_OUTPUT
    ?? `${root}/artifacts/webmcp-eval/latest.json`,
);
const requestedURL = process.env.MIRRORLOOP_TEST_URL?.replace(/\/+$/, "");
const observedOutputs = [];
const checks = [];

function displayPath(path) {
  const local = relative(root, path);
  return local.startsWith("..") ? path : local;
}

function record(name, detail = {}) {
  checks.push({ name, status: "PASS", ...detail });
}

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.WEBMCP_CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    resolve(homedir(), ".codex/bin/google-chrome"),
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) {
    throw new Error(
      "Chrome was not found. Set CHROME_PATH to a Chrome or Chromium executable.",
    );
  }
  return executable;
}

function contentType(pathname) {
  return new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".ico", "image/x-icon"],
    [".jpeg", "image/jpeg"],
    [".jpg", "image/jpeg"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".txt", "text/plain; charset=utf-8"],
    [".webp", "image/webp"],
  ]).get(extname(pathname).toLowerCase()) ?? "application/octet-stream";
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const requestURL = new URL(request.url ?? "/", "http://127.0.0.1");
      const relativePath = requestURL.pathname === "/"
        ? "index.html"
        : decodeURIComponent(requestURL.pathname.slice(1));
      const candidate = resolve(webRoot, relativePath);
      if (candidate !== webRoot && !candidate.startsWith(`${webRoot}${sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const info = await stat(candidate);
      const file = info.isDirectory() ? resolve(candidate, "index.html") : candidate;
      response.writeHead(200, {
        "Content-Type": contentType(file),
        "Cache-Control": "no-store",
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  return {
    baseURL: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose, reject) => {
      server.close((error) => error ? reject(error) : resolveClose());
    }),
  };
}

async function installNavigatorModelContext(page) {
  await page.addInitScript(() => {
    const tools = new Map();
    const modelContext = {
      async registerTool(definition) {
        tools.set(definition.name, definition);
      },
    };
    Object.defineProperty(Navigator.prototype, "modelContext", {
      configurable: true,
      get: () => modelContext,
    });
    window.__webmcpEvalTools = tools;
    window.__webmcpEvalContextSurface = "navigator.modelContext";
  });
}

function assertToolResult(result, expectedError = false) {
  assert.ok(result && Array.isArray(result.content), "tool result must contain content");
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, "text");
  assert.equal(Boolean(result.isError), expectedError);
  const text = result.content[0].text;
  assert.equal(typeof text, "string");
  assert.ok(text.length <= 1500, `tool output exceeded 1500 characters (${text.length})`);
  observedOutputs.push(text.length);
  return text;
}

async function executeTool(page, name, input) {
  return page.evaluate(async ({ toolName, toolInput }) => {
    const tool = window.__webmcpEvalTools.get(toolName);
    if (!tool) throw new Error(`Tool not registered: ${toolName}`);
    return tool.execute(toolInput);
  }, { toolName: name, toolInput: input });
}

async function runBrowserEvaluation(baseURL, chromePath) {
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installNavigatorModelContext(page);
    await page.goto(`${baseURL}/?webmcp-ci-eval=1`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__webmcpEvalTools?.size === 11);

    const registration = await page.evaluate(() => ({
      surface: window.__webmcpEvalContextSurface,
      tools: [...window.__webmcpEvalTools.values()].map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        readOnlyHint: tool.annotations?.readOnlyHint ?? null,
      })),
    }));
    assert.equal(registration.surface, "navigator.modelContext");
    assert.equal(registration.tools.length, 11);
    assert.equal(new Set(registration.tools.map(({ name }) => name)).size, 11);
    for (const tool of registration.tools) {
      assert.ok(tool.name.length <= 30, `${tool.name}: name budget`);
      assert.ok(tool.description.length <= 500, `${tool.name}: description budget`);
      for (const [parameter, schema] of Object.entries(tool.inputSchema.properties ?? {})) {
        assert.ok(parameter.length <= 30, `${tool.name}.${parameter}: parameter-name budget`);
        assert.ok((schema.description ?? "").length <= 150, `${tool.name}.${parameter}: parameter-description budget`);
      }
    }
    record("navigator.modelContext registration and character budgets", {
      tool_count: registration.tools.length,
      surface: registration.surface,
    });

    assertToolResult(await executeTool(page, "start_reflection", {}));
    const denied = await executeTool(page, "answer_reflection_question", {
      question_id: 1,
      choice_code: "01",
      confirmed_by_user: false,
    });
    assert.match(assertToolResult(denied, true), /human must explicitly confirm/i);
    const afterDenied = JSON.parse(assertToolResult(
      await executeTool(page, "review_reflection_answers", {}),
    ));
    assert.equal(afterDenied.total_answered, 0);
    record("explicit human-confirmation rejection", {
      transport: "WebMCP structured tool result",
      rejected_contract: "isError=true",
      answers_after_rejection: 0,
    });

    const answers = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    for (const [index, choiceCode] of answers.slice(0, 11).entries()) {
      assertToolResult(await executeTool(page, "answer_reflection_question", {
        question_id: index + 1,
        choice_code: choiceCode,
        confirmed_by_user: true,
      }));
    }
    const premature = await executeTool(page, "complete_reflection", {});
    assert.match(assertToolResult(premature, true), /11 are currently answered/i);
    const prematureState = await page.evaluate(() => ({
      resultHidden: document.querySelector("#result-panel")?.hidden,
      answered: JSON.parse(localStorage.getItem("mirrorloop.reflection.answers.v1") ?? "{}").answers
        ?.filter(Boolean).length ?? 0,
    }));
    assert.equal(prematureState.resultHidden, true);
    assert.equal(prematureState.answered, 11);
    record("premature completion rejection", {
      answers_recorded: prematureState.answered,
      result_hidden: prematureState.resultHidden,
      rejected_contract: "isError=true",
    });

    const forbiddenToolPattern = /(add.*cart|cart.*add|checkout|payment|purchase)/i;
    assert.deepEqual(
      registration.tools.filter(({ name }) => forbiddenToolPattern.test(name)),
      [],
    );
    const commerceRequests = [];
    page.on("request", (request) => {
      if (page.__commerceActive) {
        commerceRequests.push({ method: request.method(), url: request.url() });
      }
    });
    const beforeCommerce = await page.evaluate(() => ({
      cart: localStorage.getItem("mirrorloop-cart-v1"),
      href: location.href,
    }));
    page.__commerceActive = true;
    const recommendation = await executeTool(page, "recommend_card_edition", {
      arc_code: "01",
      edition: "mono",
      collection_scope: "arc",
    });
    page.__commerceActive = false;
    const recommendationText = assertToolResult(recommendation);
    const recommendationPayload = JSON.parse(recommendationText);
    const afterCommerce = await page.evaluate(() => ({
      cart: localStorage.getItem("mirrorloop-cart-v1"),
      href: location.href,
    }));
    assert.deepEqual(afterCommerce, beforeCommerce);
    assert.equal(recommendationText.includes("stripe.com"), false);
    assert.equal(recommendationText.match(/\$\d/), null);
    assert.equal(recommendationPayload.purchase_boundary.includes("cannot add items"), true);
    const unsafeRequests = commerceRequests.filter(({ method, url }) => {
      const sameOrigin = new URL(url).origin === new URL(baseURL).origin;
      return !sameOrigin || !["GET", "HEAD"].includes(method);
    });
    assert.deepEqual(unsafeRequests, []);
    record("read-only commerce boundary", {
      prohibited_tool_count: 0,
      cart_unchanged: true,
      navigation_unchanged: true,
      observed_requests: commerceRequests,
      unsafe_requests: unsafeRequests,
    });

    assertToolResult(await executeTool(page, "answer_reflection_question", {
      question_id: 12,
      choice_code: answers[11],
      confirmed_by_user: true,
    }));
    const completed = JSON.parse(assertToolResult(
      await executeTool(page, "complete_reflection", {}),
    ));
    assert.equal(completed.status, "REFLECTION_COMPLETE");
    assert.equal(await page.locator("#result-panel").isVisible(), true);
    record("complete 12-answer browser flow", {
      result_status: completed.status,
      result_visible: true,
    });

    record("observed tool-output character budgets", {
      maximum_observed: Math.max(...observedOutputs),
      limit: 1500,
      observed_result_count: observedOutputs.length,
    });

    await context.close();
    return {
      browser: await browser.version(),
      registration,
      maximum_observed_output_characters: Math.max(...observedOutputs),
    };
  } finally {
    await browser.close();
  }
}

let localServer;
let baseURL = requestedURL;
try {
  const corpus = JSON.parse(await readFile(resolve(webRoot, "evals/webmcp-evals.json"), "utf8"));
  assert.equal(corpus.cases.length, 18, "the current deterministic corpus must contain 18 cases");
  const corpusOutput = execFileSync(process.execPath, [
    resolve(root, "scripts/validate-webmcp-evals.mjs"),
  ], { cwd: root, encoding: "utf8" }).trim();
  record("deterministic intent corpus", {
    case_count: corpus.cases.length,
    command: "node scripts/validate-webmcp-evals.mjs",
    output: corpusOutput,
  });

  if (!baseURL) {
    localServer = await startStaticServer();
    baseURL = localServer.baseURL;
  }
  const chromePath = resolveChromePath();
  const browserResult = await runBrowserEvaluation(baseURL, chromePath);
  const receipt = {
    schema_version: "mirrorloop.webmcp.ci-eval.v1",
    generated_at: new Date().toISOString(),
    target: requestedURL ? "production_or_external" : "temporary_local_server",
    base_url: baseURL,
    chrome_executable: basename(chromePath),
    status: "PASS",
    checks,
    ...browserResult,
  };
  await mkdir(resolve(artifactPath, ".."), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`WebMCP one-command evaluation: PASS (${checks.length} checks, 18 corpus cases, 11 tools)`);
  console.log(`Evidence: ${displayPath(artifactPath)}`);
} catch (error) {
  const receipt = {
    schema_version: "mirrorloop.webmcp.ci-eval.v1",
    generated_at: new Date().toISOString(),
    target: requestedURL ? "production_or_external" : "temporary_local_server",
    base_url: baseURL ?? null,
    status: "FAIL",
    checks,
    error: error instanceof Error ? error.message : String(error),
  };
  await mkdir(resolve(artifactPath, ".."), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.error(`WebMCP one-command evaluation: FAIL (${receipt.error})`);
  console.error(`Evidence: ${displayPath(artifactPath)}`);
  process.exitCode = 1;
} finally {
  await localServer?.close();
}
