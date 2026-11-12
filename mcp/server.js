#!/usr/bin/env node
// DevRadar MCP server. Zero dependencies, Node 20+, stdio transport.
//
// Two tools, both thin wrappers over the public HTTP API:
//   devradar_scan    POST /api/scan, then poll /api/report/:token until done
//   devradar_report  GET  /api/report/:token
//
// Set DEVRADAR_URL to point at another deployment.

import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

export const VERSION = "0.1.0";
const PROTOCOL = "2025-06-18";

export const TOOLS = [
  {
    name: "devradar_scan",
    description:
      "Run a DevRadar scan of a company's docs or website: agent readiness, docs and sample code, competitors, developer personas, targeting, events, communities, buzz on X, and integrations. Free, no key. Takes about 90 seconds. A domain scanned in the last 24 hours returns that report instead of scanning again.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Docs or website to scan, for example docs.example.com" },
        wait: { type: "boolean", description: "Wait for the scan to finish and return the report. Default true." },
        timeoutSeconds: { type: "number", description: "How long to wait for the report. Default 180, at most 300." },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "devradar_report",
    description: "Read a DevRadar report by its token or link: status, headline, every finding, and the competitors found.",
    inputSchema: {
      type: "object",
      properties: {
        report: { type: "string", description: "The report token, or its link (https://devradar.rexstjohn.com/r/TOKEN)" },
        includeEvidence: { type: "boolean", description: "Include each finding's raw evidence. Default false; it can be large." },
      },
      required: ["report"],
      additionalProperties: false,
    },
  },
];

const baseUrl = (env = process.env) => (env.DEVRADAR_URL || "https://devradar.rexstjohn.com").replace(/\/+$/, "");

export function tokenOf(report) {
  const text = String(report || "").trim();
  const match = /\/r\/([^/?#]+)/.exec(text) || /\/api\/report\/([^/?#]+)/.exec(text);
  const token = match ? decodeURIComponent(match[1]) : text;
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(token)) throw new Error("That is not a DevRadar report token or link.");
  return token;
}

/** The report minus fields an agent should not see or does not need. */
export function summarize(view, base, { includeEvidence = false } = {}) {
  const findings = (Array.isArray(view.findings) ? view.findings : []).map((finding) => ({
    probe: finding.probe,
    result: finding.result,
    severity: finding.severity,
    headline: finding.headline,
    url: finding.url || undefined,
    ...(includeEvidence ? { evidence: finding.evidence } : {}),
  }));
  const count = (result) => findings.filter((finding) => finding.result === result).length;
  return {
    status: view.status,
    reportUrl: `${base}/r/${view.token}`,
    token: view.token,
    domain: view.domain,
    docsUrl: view.docsUrl,
    category: view.category ?? null,
    headline: view.headline ?? null,
    mostSerious: view.banner?.headline ?? null,
    notice: view.notice ?? null,
    startedAt: view.startedAt,
    completedAt: view.completedAt ?? null,
    cutShort: Boolean(view.ceilingHit),
    totals: { checks: findings.length, pass: count("pass"), fail: count("fail"), info: count("info"), unknown: count("unknown") },
    competitors: Array.isArray(view.competitors) ? view.competitors : [],
    findings,
  };
}

async function getJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, data };
}

export async function readReport(token, { fetchImpl = fetch, env = process.env, includeEvidence = false } = {}) {
  const base = baseUrl(env);
  const { status, data } = await getJson(fetchImpl, `${base}/api/report/${encodeURIComponent(token)}`, { headers: { accept: "application/json" } });
  if (status === 404) throw new Error(`No DevRadar report has the token ${token}.`);
  if (status !== 200) throw new Error(`DevRadar returned ${status} for that report.`);
  return summarize(data, base, { includeEvidence });
}

export async function runScan(args, { fetchImpl = fetch, env = process.env, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Date.now(), pollMs = 5000 } = {}) {
  const url = String(args.url || "").trim();
  if (!url) throw new Error("Give a docs or website URL to scan.");
  const base = baseUrl(env);
  const started = await getJson(fetchImpl, `${base}/api/scan`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ url }),
  });
  const { data } = started;
  if (!data.reportUrl && !data.token) throw new Error(data.error || `DevRadar could not start the scan (${started.status}).`);
  const token = data.token || tokenOf(data.reportUrl);
  const note = started.status === 409
    ? `${data.error || "This domain's daily request budget is used up."} Returning the last report.`
    : data.reused ? "This domain was scanned in the last 24 hours, so this is that report." : null;
  if (args.wait === false) return { status: "running", token, reportUrl: `${base}/r/${token}`, note };

  const limitMs = Math.min(Math.max(Number(args.timeoutSeconds) || 180, 10), 300) * 1000;
  const deadline = now() + limitMs;
  for (;;) {
    const report = await readReport(token, { fetchImpl, env });
    if (report.status === "done" || now() >= deadline) {
      if (report.status !== "done") report.note = `Still running after ${Math.round(limitMs / 1000)} seconds. Read it later with devradar_report.`;
      else if (note) report.note = note;
      return report;
    }
    await sleep(pollMs);
  }
}

function text(result) {
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

export async function callTool(name, args = {}, deps = {}) {
  try {
    if (name === "devradar_scan") return text(await runScan(args, deps));
    if (name === "devradar_report") return text(await readReport(tokenOf(args.report), { ...deps, includeEvidence: Boolean(args.includeEvidence) }));
    return { isError: true, content: [{ type: "text", text: `Unknown tool ${name}.` }] };
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
  }
}

export async function handle(message, deps = {}) {
  const { id, method, params } = message;
  if (id === undefined || id === null) return null; // notifications need no reply
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  if (method === "initialize") {
    return reply({
      protocolVersion: params?.protocolVersion || PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: { name: "devradar", version: VERSION },
      instructions: "Use devradar_scan to scan a company's docs or website, and devradar_report to read a report again.",
    });
  }
  if (method === "ping") return reply({});
  if (method === "tools/list") return reply({ tools: TOOLS });
  if (method === "tools/call") return reply(await callTool(params?.name, params?.arguments || {}, deps));
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

function serve() {
  const rl = createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`);
      return;
    }
    const response = await handle(message);
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href || process.argv[1]?.endsWith("devradar-mcp")) serve();
