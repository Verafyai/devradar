import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { callTool, handle, readReport, runScan, summarize, tokenOf, TOOLS } from "../mcp/server.js";

const env = { DEVRADAR_URL: "https://devradar.test" };
const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";

function view(status, extra = {}) {
  return {
    token: TOKEN,
    status,
    domain: "example.com",
    docsUrl: "https://docs.example.com/",
    category: "api",
    headline: status === "done" ? "Agents can read the docs, but there is no llms.txt." : null,
    startedAt: "2026-11-12T22:00:00.000Z",
    completedAt: status === "done" ? "2026-11-12T22:01:30.000Z" : null,
    ceilingHit: false,
    email: "someone@example.com",
    banner: { headline: "robots.txt blocks GPTBot." },
    competitors: [{ name: "Other", docsUrl: "https://docs.other.com/" }],
    findings: [
      { probe: "P1", result: "fail", severity: "high", headline: "robots.txt blocks GPTBot.", url: "https://docs.example.com/robots.txt", evidence: { big: "x".repeat(50) } },
      { probe: "P5", result: "pass", severity: "info", headline: "llms.txt found.", url: "https://docs.example.com/llms.txt", evidence: {} },
    ],
    ...extra,
  };
}

function fakeFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET", body: init.body });
    const route = routes.shift();
    if (!route) throw new Error(`unexpected request ${url}`);
    return new Response(JSON.stringify(route.body), { status: route.status, headers: { "content-type": "application/json" } });
  };
  return { fetchImpl, calls };
}

test("tokens come from a bare token, a report link or an API link", () => {
  assert.equal(tokenOf(TOKEN), TOKEN);
  assert.equal(tokenOf(`https://devradar.rexstjohn.com/r/${TOKEN}`), TOKEN);
  assert.equal(tokenOf(`https://devradar.rexstjohn.com/api/report/${TOKEN}?view=json`), TOKEN);
  assert.throws(() => tokenOf("not a token!"), /not a DevRadar report/);
});

test("the summary keeps findings and drops the unlock email and raw evidence", () => {
  const summary = summarize(view("done"), "https://devradar.test");
  assert.equal(summary.reportUrl, `https://devradar.test/r/${TOKEN}`);
  assert.deepEqual(summary.totals, { checks: 2, pass: 1, fail: 1, info: 0, unknown: 0 });
  assert.equal(summary.mostSerious, "robots.txt blocks GPTBot.");
  assert.equal(JSON.stringify(summary).includes("someone@example.com"), false);
  assert.equal(summary.findings[0].evidence, undefined);
  assert.deepEqual(summarize(view("done"), "x", { includeEvidence: true }).findings[0].evidence, { big: "x".repeat(50) });
});

test("a scan starts, polls until done, and returns the report", async () => {
  const { fetchImpl, calls } = fakeFetch([
    { status: 202, body: { token: TOKEN, reportUrl: `/r/${TOKEN}` } },
    { status: 200, body: view("running") },
    { status: 200, body: view("done") },
  ]);
  const report = await runScan({ url: "docs.example.com" }, { fetchImpl, env, sleep: async () => {} });
  assert.equal(report.status, "done");
  assert.equal(report.headline, "Agents can read the docs, but there is no llms.txt.");
  assert.equal(calls[0].url, "https://devradar.test/api/scan");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(JSON.parse(calls[0].body), { url: "docs.example.com" });
  assert.equal(calls[1].url, `https://devradar.test/api/report/${TOKEN}`);
});

test("a domain scanned in the last day returns that report with a note", async () => {
  const { fetchImpl } = fakeFetch([
    { status: 200, body: { token: TOKEN, reportUrl: `/r/${TOKEN}`, reused: true } },
    { status: 200, body: view("done") },
  ]);
  const report = await runScan({ url: "example.com" }, { fetchImpl, env, sleep: async () => {} });
  assert.match(report.note, /last 24 hours/);
});

test("a used-up domain budget returns the last report, and no report means an error", async () => {
  const held = fakeFetch([
    { status: 409, body: { error: "Rescan available at Nov 13, 9:00 AM PT", reportUrl: `/r/${TOKEN}` } },
    { status: 200, body: view("done") },
  ]);
  const report = await runScan({ url: "example.com" }, { fetchImpl: held.fetchImpl, env, sleep: async () => {} });
  assert.match(report.note, /Rescan available/);

  const limited = fakeFetch([{ status: 429, body: { error: "This address has started 8 scans in the last hour.", reportUrl: null } }]);
  const result = await callTool("devradar_scan", { url: "example.com" }, { fetchImpl: limited.fetchImpl, env });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /8 scans/);
});

test("wait: false returns the link straight away", async () => {
  const { fetchImpl, calls } = fakeFetch([{ status: 202, body: { token: TOKEN, reportUrl: `/r/${TOKEN}` } }]);
  const result = await runScan({ url: "example.com", wait: false }, { fetchImpl, env });
  assert.deepEqual(result, { status: "running", token: TOKEN, reportUrl: `https://devradar.test/r/${TOKEN}`, note: null });
  assert.equal(calls.length, 1);
});

test("a scan still running at the timeout says so", async () => {
  let clock = 0;
  const { fetchImpl } = fakeFetch([
    { status: 202, body: { token: TOKEN, reportUrl: `/r/${TOKEN}` } },
    { status: 200, body: view("running") },
    { status: 200, body: view("running") },
  ]);
  const report = await runScan({ url: "example.com", timeoutSeconds: 10 }, { fetchImpl, env, sleep: async () => { clock += 20_000; }, now: () => clock });
  assert.equal(report.status, "running");
  assert.match(report.note, /Still running after 10 seconds/);
});

test("a missing report is a clear error", async () => {
  const { fetchImpl } = fakeFetch([{ status: 404, body: { error: "not_found" } }]);
  await assert.rejects(readReport(TOKEN, { fetchImpl, env }), /No DevRadar report/);
});

test("the server speaks MCP: initialize, tools/list, notifications", async () => {
  const init = await handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  assert.equal(init.result.serverInfo.name, "devradar");
  assert.deepEqual(init.result.capabilities, { tools: {} });
  const list = await handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.deepEqual(list.result.tools.map((tool) => tool.name), ["devradar_scan", "devradar_report"]);
  assert.equal(await handle({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  const unknown = await handle({ jsonrpc: "2.0", id: 3, method: "nope" });
  assert.equal(unknown.error.code, -32601);
  assert.equal(TOOLS.every((tool) => tool.inputSchema.type === "object"), true);
});

test("the server runs over stdio", async () => {
  const server = spawn(process.execPath, [fileURLToPath(new URL("../mcp/server.js", import.meta.url))], { stdio: ["pipe", "pipe", "inherit"] });
  const lines = [];
  server.stdout.on("data", (chunk) => lines.push(...chunk.toString().trim().split("\n")));
  server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
  server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`);
  for (let i = 0; i < 50 && lines.length < 2; i += 1) await new Promise((r) => setTimeout(r, 20));
  server.kill();
  assert.equal(JSON.parse(lines[0]).result.serverInfo.name, "devradar");
  assert.equal(JSON.parse(lines[1]).result.tools.length, 2);
});
