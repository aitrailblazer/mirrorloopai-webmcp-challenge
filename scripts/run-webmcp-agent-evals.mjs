#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CORPUS_PATH = path.join(ROOT, "web/evals/webmcp-evals.json");
const corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));

const extensionDir = process.env.WEBMCP_INSPECTOR_EXTENSION_DIR;
const profileDir = process.env.WEBMCP_EVAL_PROFILE_DIR;
assert.ok(extensionDir, "WEBMCP_INSPECTOR_EXTENSION_DIR is required");
assert.ok(profileDir, "WEBMCP_EVAL_PROFILE_DIR is required");
const extensionManifest = JSON.parse(readFileSync(
  path.join(extensionDir, "manifest.json"),
  "utf8",
));
const targetURL = process.env.WEBMCP_EVAL_TARGET_URL || "https://mirrorloopai.com/";
const requestedModel = process.env.WEBMCP_EVAL_MODEL || "";
const useInstalledExtension = process.env.WEBMCP_USE_INSTALLED_EXTENSION === "1";
const browserProfileName = process.env.WEBMCP_BROWSER_PROFILE_NAME || "";
const chromePath = process.env.WEBMCP_EVAL_CHROME_PATH
  || "/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev";
const agentBackend = process.env.WEBMCP_AGENT_BACKEND || "inspector";
const vertexProject = process.env.WEBMCP_VERTEX_PROJECT
  || (agentBackend === "vertex"
    ? execFileSync("gcloud", ["config", "get-value", "project"], { encoding: "utf8" }).trim()
    : "");
const vertexRegion = process.env.WEBMCP_VERTEX_REGION || "us-central1";
const vertexModel = process.env.WEBMCP_VERTEX_MODEL || "gemini-2.5-flash";
const caseLimit = Number(process.env.WEBMCP_EVAL_CASE_LIMIT || corpus.cases.length);

assert.equal(corpus.cases.length, 15, "the canonical corpus must contain 15 cases");

const timestamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const evidenceDir = path.join(ROOT, "qa_evidence/webmcp_agent_eval", timestamp);
mkdirSync(evidenceDir, { recursive: true });

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function equalJSON(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function extensionIdFromKey(key) {
  return createHash("sha256")
    .update(Buffer.from(key, "base64"))
    .digest()
    .subarray(0, 16)
    .toString("hex")
    .replace(/[0-9a-f]/g, (nibble) => String.fromCharCode(97 + Number.parseInt(nibble, 16)));
}

function isSubsequence(expected, actual) {
  let cursor = 0;
  for (const item of actual) {
    if (item === expected[cursor]) cursor += 1;
  }
  return cursor === expected.length;
}

function parseCalls(log) {
  const calls = [];
  const pattern = /AI calling tool "([^"]+)" with (.+)$/gm;
  for (const match of log.matchAll(pattern)) {
    let args;
    try {
      args = JSON.parse(match[2]);
    } catch {
      args = { __parse_error: match[2] };
    }
    calls.push({ name: match[1], arguments: args });
  }
  return calls;
}

async function vertexGenerate(accessToken, contents, tools) {
  const endpoint = [
    `https://${vertexRegion}-aiplatform.googleapis.com/v1`,
    `projects/${vertexProject}/locations/${vertexRegion}`,
    `publishers/google/models/${vertexModel}:generateContent`,
  ].join("/");
  const body = {
    contents,
    tools: [{
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parametersJsonSchema: tool.inputSchema,
      })),
    }],
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    generationConfig: { temperature: 0 },
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (response.ok) return response.json();
    const errorText = await response.text();
    if (response.status !== 429 || attempt === 3) {
      throw new Error(`Vertex generateContent failed (${response.status}): ${errorText}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
  throw new Error("Vertex generateContent exhausted retries");
}

function scoreCase(entry, actualCalls) {
  const expectedNames = entry.expectedCalls.map((call) => call.name);
  const actualNames = actualCalls.map((call) => call.name);
  const toolSelectionExact = equalJSON(expectedNames, actualNames);
  const requiredToolsInOrder = isSubsequence(expectedNames, actualNames);
  const comparable = Math.min(entry.expectedCalls.length, actualCalls.length);
  let argumentMatches = 0;
  for (let index = 0; index < comparable; index += 1) {
    if (
      entry.expectedCalls[index].name === actualCalls[index].name
      && equalJSON(entry.expectedCalls[index].arguments, actualCalls[index].arguments)
    ) {
      argumentMatches += 1;
    }
  }
  const argumentsExact = entry.expectedCalls.length === actualCalls.length
    && argumentMatches === entry.expectedCalls.length;
  return {
    toolSelectionExact,
    requiredToolsInOrder,
    argumentsExact,
    exactCase: toolSelectionExact && argumentsExact,
    expectedCallCount: entry.expectedCalls.length,
    actualCallCount: actualCalls.length,
    argumentMatches,
  };
}

function sanitizeModelResponse(response) {
  return {
    candidates: (response.candidates || []).map((candidate) => ({
      content: {
        role: candidate.content?.role,
        parts: (candidate.content?.parts || []).map((part) => ({
          ...(part.text ? { text: part.text } : {}),
          ...(part.functionCall ? { functionCall: part.functionCall } : {}),
        })),
      },
      finishReason: candidate.finishReason,
    })),
    usageMetadata: response.usageMetadata,
    modelVersion: response.modelVersion,
    createTime: response.createTime,
    responseId: response.responseId,
  };
}

const context = await chromium.launchPersistentContext(profileDir, {
  executablePath: chromePath,
  headless: true,
  ignoreDefaultArgs: ["--disable-extensions"],
  args: [
    ...(browserProfileName ? [`--profile-directory=${browserProfileName}`] : []),
    ...(!useInstalledExtension ? [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ] : []),
    "--enable-features=WebMCP,WebMCPTesting,DevToolsWebMCPSupport",
    "--enable-blink-features=WebMCP",
    "--no-sandbox",
  ],
});

try {
  const extensionId = process.env.WEBMCP_INSPECTOR_EXTENSION_ID
    || extensionIdFromKey(extensionManifest.key);
  const bootstrap = await context.newPage();
  await bootstrap.goto(`chrome-extension://${extensionId}/sidebar.html`);
  let serviceWorker = context.serviceWorkers().find(
    (worker) => new URL(worker.url()).host === extensionId,
  );
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", {
      timeout: 20_000,
      predicate: (worker) => new URL(worker.url()).host === extensionId,
    });
  }
  await bootstrap.close();
  const manifest = extensionManifest;

  const pages = context.pages();
  const target = pages[0] || await context.newPage();
  await target.goto(targetURL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await target.waitForFunction(
    () => document.querySelector("#webmcp-status")?.textContent?.toLowerCase().includes("ready"),
    null,
    { timeout: 30_000 },
  );

  const targetTabId = await serviceWorker.evaluate(
    async (pattern) => (await chrome.tabs.query({ url: pattern }))[0]?.id,
    `${new URL(targetURL).origin}/*`,
  );
  assert.ok(targetTabId, `could not resolve target tab for ${targetURL}`);

  const sidebar = await context.newPage();
  await sidebar.addInitScript((tabId) => {
    if (location.protocol !== "chrome-extension:") return;
    const realQuery = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (query, callback) => {
      if (query?.active && query?.currentWindow) {
        const result = chrome.tabs.get(tabId).then((tab) => [tab]);
        if (callback) {
          result.then(callback);
          return undefined;
        }
        return result;
      }
      return realQuery(query, callback);
    };
  }, targetTabId);
  await sidebar.goto(`chrome-extension://${extensionId}/sidebar.html`);
  await sidebar.waitForLoadState("load");

  await sidebar.evaluate((model) => {
    localStorage.suggestUserPrompt = "false";
    if (model) localStorage.model = model;
  }, requestedModel);
  await sidebar.reload();
  await sidebar.waitForLoadState("load");
  await sidebar.waitForFunction(
    () => document.querySelectorAll("#toolNames option").length === 8,
    null,
    { timeout: 30_000, polling: 150 },
  );

  const runtime = await sidebar.evaluate(() => {
    const headers = [...document.querySelectorAll("#tableHeaderRow th")]
      .map((header) => header.textContent.trim());
    const tools = [...document.querySelectorAll("#tableBody tr")].map((row) => {
      const values = [...row.querySelectorAll("td")].map((cell) => cell.textContent.trim());
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    }).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: JSON.parse(tool.inputSchema || "{\"type\":\"object\",\"properties\":{}}"),
    }));
    return {
    model: localStorage.model,
    hasApiKey: Boolean(localStorage.apiKey),
    promptEnabled: !document.querySelector("#promptBtn").disabled,
      tools,
    };
  });
  if (agentBackend === "inspector") {
    assert.equal(runtime.hasApiKey, true, "Gemini API key is unavailable in the isolated inspector profile");
    assert.equal(runtime.promptEnabled, true, "the inspector agent prompt is disabled");
  }
  assert.equal(runtime.tools.length, 8, "the browser-discovered WebMCP contract must expose eight tools");

  const browserVersion = await context.browser().version();
  const results = [];
  const accessToken = agentBackend === "vertex"
    ? execFileSync("gcloud", ["auth", "application-default", "print-access-token"], {
      encoding: "utf8",
    }).trim()
    : "";

  async function executeWebMCPTool(call) {
    await sidebar.selectOption("#toolNames", { value: call.name });
    await sidebar.fill("#inputArgsText", JSON.stringify(call.arguments || {}));
    await sidebar.evaluate(() => {
      document.querySelector("#toolResults").textContent = "";
    });
    await sidebar.click("#executeBtn");
    await sidebar.waitForFunction(
      () => document.querySelector("#toolResults")?.textContent !== "",
      null,
      { timeout: 30_000, polling: 100 },
    );
    return sidebar.textContent("#toolResults");
  }

  for (const [index, entry] of corpus.cases.slice(0, caseLimit).entries()) {
    process.stdout.write(`[${index + 1}/${Math.min(caseLimit, corpus.cases.length)}] ${entry.id} ... `);
    await target.goto(`${targetURL}?agent-eval=${encodeURIComponent(entry.id)}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await target.waitForFunction(
      () => document.querySelector("#webmcp-status")?.textContent?.toLowerCase().includes("ready"),
      null,
      { timeout: 30_000 },
    );
    await sidebar.waitForFunction(
      () => document.querySelectorAll("#toolNames option").length === 8,
      null,
      { timeout: 30_000, polling: 150 },
    );
    const startedAt = new Date().toISOString();
    let log = "";
    const modelTrace = [];
    if (agentBackend === "inspector") {
      await sidebar.click("#resetBtn");
      await sidebar.fill("#userPromptText", entry.prompt);
      await sidebar.click("#promptBtn");
      await sidebar.waitForFunction(
        () => {
          const text = document.querySelector("#promptResults")?.textContent || "";
          return text.includes("\nAI result:")
            || text.startsWith("AI result:")
            || text.includes("⚠️ Error: \"");
        },
        null,
        { timeout: 180_000, polling: 250 },
      );
      log = await sidebar.textContent("#promptResults");
    } else {
      const contents = [{ role: "user", parts: [{ text: entry.prompt }] }];
      for (let turn = 0; turn < 8; turn += 1) {
        const response = await vertexGenerate(accessToken, contents, runtime.tools);
        modelTrace.push(sanitizeModelResponse(response));
        const candidate = response.candidates?.[0]?.content;
        assert.ok(candidate?.parts, `Vertex returned no candidate parts for ${entry.id}`);
        contents.push(candidate);
        const functionCalls = candidate.parts
          .filter((part) => part.functionCall)
          .map((part) => ({
            name: part.functionCall.name,
            arguments: part.functionCall.args || {},
          }));
        if (functionCalls.length === 0) {
          const text = candidate.parts.map((part) => part.text || "").join("").trim();
          log += `AI result: ${text}\n`;
          break;
        }
        const responseParts = [];
        for (const call of functionCalls) {
          log += `AI calling tool "${call.name}" with ${JSON.stringify(call.arguments)}\n`;
          const toolResult = await executeWebMCPTool(call);
          log += `Tool "${call.name}" result: ${toolResult}\n`;
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { result: toolResult },
            },
          });
        }
        contents.push({ role: "user", parts: responseParts });
        if (turn === 7) throw new Error(`agent exceeded eight tool turns for ${entry.id}`);
      }
    }
    const finishedAt = new Date().toISOString();
    const actualCalls = parseCalls(log);
    const score = scoreCase(entry, actualCalls);
    const record = {
      id: entry.id,
      prompt: entry.prompt,
      boundary: entry.boundary || null,
      expectedCalls: entry.expectedCalls,
      actualCalls,
      score,
      startedAt,
      finishedAt,
      agentFinalText: log.match(/AI result: ([\s\S]*?)\n?$/)?.[1]?.trim() || null,
      rawLog: log,
      modelTrace,
    };
    results.push(record);
    writeFileSync(
      path.join(evidenceDir, `${String(index + 1).padStart(2, "0")}-${entry.id}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
    );
    console.log(score.exactCase ? "PASS" : "FAIL");
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  const expectedCallTotal = results.reduce((sum, result) => sum + result.score.expectedCallCount, 0);
  const actualCallTotal = results.reduce((sum, result) => sum + result.score.actualCallCount, 0);
  const summary = {
    schemaVersion: "mirrorloop.webmcp.agent-eval.v1",
    generatedAt: new Date().toISOString(),
    corpus: {
      path: "web/evals/webmcp-evals.json",
      schemaVersion: corpus.schemaVersion,
      cases: results.length,
      expectedCalls: expectedCallTotal,
      noToolBoundaryCases: results.filter((result) => result.expectedCalls.length === 0).length,
    },
    runtime: {
      agent: manifest.name,
      extensionVersion: manifest.version,
      extensionId,
      backend: agentBackend,
      model: agentBackend === "vertex" ? vertexModel : runtime.model,
      vertexProject: agentBackend === "vertex" ? vertexProject : null,
      vertexRegion: agentBackend === "vertex" ? vertexRegion : null,
      browser: browserVersion,
      targetURL,
      exposedTools: runtime.tools.map((tool) => tool.name),
      apiCredentialPresent: agentBackend === "vertex" ? Boolean(accessToken) : runtime.hasApiKey,
      apiCredentialRecorded: false,
    },
    metrics: {
      exactCaseAccuracy: results.filter((result) => result.score.exactCase).length / results.length,
      exactToolSelectionAccuracy:
        results.filter((result) => result.score.toolSelectionExact).length / results.length,
      requiredToolsInOrderAccuracy:
        results.filter((result) => result.score.requiredToolsInOrder).length / results.length,
      exactArgumentCaseAccuracy:
        results.filter((result) => result.score.argumentsExact).length / results.length,
      noToolBoundaryAccuracy:
        results.filter(
          (result) => result.expectedCalls.length === 0 && result.actualCalls.length === 0,
        ).length / results.filter((result) => result.expectedCalls.length === 0).length,
      expectedArgumentMatchRate:
        results.reduce((sum, result) => sum + result.score.argumentMatches, 0) / expectedCallTotal,
      expectedCallTotal,
      actualCallTotal,
    },
    results,
  };

  const summaryPath = path.join(evidenceDir, "agent-eval-results.json");
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  const latestPath = path.join(ROOT, "qa_evidence/webmcp_agent_eval/latest.json");
  copyFileSync(summaryPath, latestPath);
  console.log(JSON.stringify({ evidenceDir, metrics: summary.metrics }, null, 2));
} finally {
  await context.close();
}
