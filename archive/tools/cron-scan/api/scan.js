// src/selfserve/job.ts
import { createHash as createHash2, randomBytes } from "node:crypto";

// src/constants.ts
var SCANNER_VERSION = "0.1.0";
var ABOUT_URL = "https://devradar.rexstjohn.com/";
var SCANNER_UA = `DevRadar/${SCANNER_VERSION} (+${ABOUT_URL}; read-only; docs and public metadata only)`;
var WALL_CEILING_MS = 15e4;
var STAGE_MAX_MS = {
  1: 2e4,
  2: 25e3,
  3: 25e3,
  4: 3e4,
  5: 25e3,
  6: 2e4,
  7: 1e4
};
var PROBE_VERSION = "0.1.0";
var POLITENESS_LIMIT = 60;
var POLITENESS_WINDOW_MS = 24 * 60 * 60 * 1e3;
var POLITENESS_GAP_MS = 400;
var PROBES_IN_BUILD = ["P1", "P2", "P3", "P4", "P5", "P7", "P8"];
var PROBES_NOT_IN_BUILD = ["P6", "P9", "P10", "P11", "P12"];
var P2_AGENTS = [
  {
    name: "chrome",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
  },
  {
    name: "claudebot",
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)"
  },
  {
    name: "gptbot",
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.3; +https://openai.com/gptbot)"
  },
  {
    name: "curl",
    ua: "curl/8.11.1"
  },
  {
    name: "scanner",
    ua: SCANNER_UA
  }
];
var ROBOTS_AGENTS = [
  "GPTBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "*"
];
var SEVERITY_RANK = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4
};
var RESULT_RANK = {
  fail: 0,
  unknown: 1,
  pass: 2
};

// src/client.ts
import { Agent, fetch as undiciFetch } from "undici";

// src/politeness.ts
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// src/domain.ts
import { isIP } from "node:net";
var MULTI_PART_SUFFIXES = /* @__PURE__ */ new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.jp",
  "co.nz",
  "com.br",
  "com.sg",
  "com.mx",
  "co.za",
  "com.tr"
]);
function registrableDomain(hostname) {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  if (!host) return host;
  if (isIP(host)) return host;
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}
function safeSlug(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`slug must be lowercase words separated by hyphens, got ${JSON.stringify(slug)}`);
  }
  return slug;
}

// src/politeness.ts
var BudgetExceededError = class extends Error {
  domain;
  constructor(domain) {
    super(`politeness budget exhausted for ${domain}: ${POLITENESS_LIMIT} requests / 24h`);
    this.name = "BudgetExceededError";
    this.domain = domain;
  }
};
var DomainAbortedError = class extends Error {
  domain;
  until;
  constructor(domain, until, reason) {
    super(reason);
    this.name = "DomainAbortedError";
    this.domain = domain;
    this.until = until;
  }
};
var gates = /* @__PURE__ */ new Map();
function gate(key, fn) {
  const prev = gates.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  gates.set(
    key,
    run.then(
      () => void 0,
      () => void 0
    )
  );
  return run;
}
var PolitenessBudget = class _PolitenessBudget {
  constructor(filePath, opts = {}) {
    this.filePath = filePath;
    this.limit = opts.limit ?? POLITENESS_LIMIT;
    this.windowMs = opts.windowMs ?? POLITENESS_WINDOW_MS;
    this.minGapMs = opts.minGapMs ?? POLITENESS_GAP_MS;
    this.now = opts.now ?? (() => Date.now());
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }
  limit;
  windowMs;
  minGapMs;
  now;
  sleep;
  io = null;
  /** Budget backed by a shared store instead of one JSON file. */
  static using(io, opts = {}) {
    const budget = new _PolitenessBudget(io.lockKey, opts);
    budget.io = io;
    return budget;
  }
  async acquire(targetUrl) {
    const domain = registrableDomain(new URL(targetUrl).hostname);
    for (; ; ) {
      const decision = await this.critical(async (ledger) => {
        const now = this.now();
        const abort = ledger.aborts.find((a) => a.domain === domain && a.until > now);
        if (abort) {
          return {
            type: "abort",
            until: abort.until,
            reason: abort.reason
          };
        }
        const recent = ledger.requests.filter((r) => r.domain === domain && now - r.at < this.windowMs);
        if (recent.length >= this.limit) {
          return { type: "budget" };
        }
        const last = recent.reduce((max, r) => Math.max(max, r.at), 0);
        const wait = last > 0 ? this.minGapMs - (now - last) : 0;
        if (wait > 0) return { type: "wait", wait };
        ledger.requests.push({ domain, at: now, url: targetUrl });
        return { type: "ok", at: now, domain };
      });
      if (decision.type === "wait") {
        await this.sleep(decision.wait);
        continue;
      }
      if (decision.type === "budget") throw new BudgetExceededError(domain);
      if (decision.type === "abort") throw new DomainAbortedError(domain, decision.until, decision.reason);
      return { domain: decision.domain, at: decision.at };
    }
  }
  /** Record the response. A 429 aborts the domain until Retry-After elapses. */
  async noteStatus(targetUrl, status, retryAfterMs) {
    const domain = registrableDomain(new URL(targetUrl).hostname);
    await this.critical(async (ledger) => {
      for (let i = ledger.requests.length - 1; i >= 0; i--) {
        const row = ledger.requests[i];
        if (row && row.domain === domain && row.url === targetUrl && row.status === void 0) {
          row.status = status;
          break;
        }
      }
      if (status === 429) {
        const wait = retryAfterMs === void 0 ? 6e4 : Math.max(0, retryAfterMs);
        const until = this.now() + wait;
        ledger.aborts = ledger.aborts.filter((a) => a.domain !== domain);
        ledger.aborts.push({
          domain,
          until,
          reason: `HTTP 429 from ${domain}; no further requests until ${new Date(until).toISOString()} (Retry-After)`
        });
      }
      return { type: "ok", at: 0, domain };
    });
  }
  async count(domainOrUrl) {
    const domain = domainOrUrl.includes("://") ? registrableDomain(new URL(domainOrUrl).hostname) : domainOrUrl.toLowerCase();
    return this.critical(async (ledger) => {
      const now = this.now();
      const n = ledger.requests.filter((r) => r.domain === domain && now - r.at < this.windowMs).length;
      return { type: "ok", at: n, domain };
    }).then((d) => d.at);
  }
  async critical(fn) {
    if (this.io) {
      const io = this.io;
      return gate(io.lockKey, async () => {
        const release = await io.lock();
        try {
          const ledger = normalizeLedger(await io.load(), this.now(), this.windowMs);
          const result = await fn(ledger);
          await io.save(pruneLedger(ledger, this.now(), this.windowMs));
          return result;
        } finally {
          await release();
        }
      });
    }
    return gate(path.resolve(this.filePath), async () => {
      const lockDir = `${this.filePath}.lock`;
      await this.acquireFileLock(lockDir);
      try {
        const ledger = await this.read();
        const result = await fn(ledger);
        await this.write(ledger);
        return result;
      } finally {
        await rm(lockDir, { recursive: true, force: true });
      }
    });
  }
  async acquireFileLock(lockDir) {
    await mkdir(path.dirname(lockDir), { recursive: true });
    const deadline = Date.now() + 3e4;
    for (; ; ) {
      try {
        await mkdir(lockDir, { recursive: false });
        await writeFile(path.join(lockDir, "owner"), String(process.pid));
        return;
      } catch (err) {
        const code = err.code;
        if (code !== "EEXIST") throw err;
        if (Date.now() > deadline) {
          throw new Error(`timed out waiting for politeness lock ${lockDir}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  }
  async read() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return normalizeLedger(JSON.parse(raw), this.now(), this.windowMs);
    } catch (err) {
      if (err.code === "ENOENT") {
        return { requests: [], aborts: [] };
      }
      throw err;
    }
  }
  async write(ledger) {
    const now = this.now();
    const pruned = {
      requests: ledger.requests.filter((r) => now - r.at < this.windowMs),
      aborts: ledger.aborts.filter((a) => a.until > now)
    };
    ledger.requests = pruned.requests;
    ledger.aborts = pruned.aborts;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(pruned, null, 2));
    await rename(tmp, this.filePath);
  }
};
function normalizeLedger(parsed, now, windowMs) {
  const requests = Array.isArray(parsed?.requests) ? parsed.requests : [];
  const aborts = Array.isArray(parsed?.aborts) ? parsed.aborts : [];
  return {
    requests: requests.filter((r) => r && typeof r.at === "number" && now - r.at < windowMs),
    aborts: aborts.filter((a) => a && typeof a.until === "number" && a.until > now)
  };
}
function pruneLedger(ledger, now, windowMs) {
  return {
    requests: ledger.requests.filter((r) => now - r.at < windowMs),
    aborts: ledger.aborts.filter((a) => a.until > now)
  };
}
function parseRetryAfter(header, now) {
  if (!header) return void 0;
  const trimmed = header.trim();
  if (!trimmed) return void 0;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Number(trimmed) * 1e3);
  }
  const dated = Date.parse(trimmed);
  if (Number.isFinite(dated)) return Math.max(0, dated - now);
  return void 0;
}

// src/client.ts
var OMIT_HEADERS = /* @__PURE__ */ new Set(["set-cookie", "cookie", "authorization", "proxy-authorization"]);
var dispatcher = new Agent({
  connectTimeout: 15e3,
  headersTimeout: 2e4,
  bodyTimeout: 2e4
});
var DEFAULT_TIMEOUT_MS = 2e4;
var DEFAULT_MAX_BODY = 1e6;
function headerMap(headers) {
  const out = {};
  headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (OMIT_HEADERS.has(name)) return;
    out[name] = value.length > 800 ? `${value.slice(0, 800)}` : value;
  });
  return out;
}
async function readBody(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  const reader = response.body?.getReader();
  if (!reader) {
    return { body: "", body_bytes: Number.isFinite(declared) ? declared : 0, body_truncated: false };
  }
  const chunks = [];
  let received = 0;
  let truncated = false;
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (received >= maxBytes) {
      truncated = true;
      await reader.cancel();
      break;
    }
    const room = maxBytes - received;
    if (value.byteLength > room) {
      chunks.push(value.slice(0, room));
      received += room;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    received += value.byteLength;
  }
  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  const body_bytes = truncated && Number.isFinite(declared) && declared > received ? declared : received;
  return { body, body_bytes, body_truncated: truncated };
}
function emptySnap(url, ua, error) {
  return {
    url,
    final_url: url,
    ua,
    status: null,
    status_line: null,
    headers: {},
    body_bytes: 0,
    body: "",
    body_truncated: false,
    hops: [],
    error
  };
}
async function fetchPolite(startUrl, budget, ua, options = {}, onReserve) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY;
  const hops = [];
  const seen = /* @__PURE__ */ new Set();
  let current = startUrl;
  for (let hop = 0; hop < 5; hop++) {
    if (seen.has(current)) {
      return {
        url: startUrl,
        final_url: current,
        ua,
        status: null,
        status_line: null,
        headers: {},
        body_bytes: 0,
        body: "",
        body_truncated: false,
        hops,
        error: { name: "RedirectLoop", message: `redirect loop at ${current}` }
      };
    }
    seen.add(current);
    let parsed;
    try {
      parsed = new URL(current);
    } catch (err) {
      return emptySnap(startUrl, ua, {
        name: "InvalidUrl",
        message: err instanceof Error ? err.message : String(err)
      });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return emptySnap(startUrl, ua, {
        name: "UnsupportedProtocol",
        message: parsed.protocol
      });
    }
    if (options.guard) {
      try {
        await options.guard(parsed);
      } catch (err) {
        const name = err instanceof Error ? err.name : "SsrfError";
        const message = err instanceof Error ? err.message : String(err);
        return emptySnap(startUrl, ua, { name, message: `refused ${current}: ${message}` });
      }
    }
    await budget.acquire(current);
    onReserve?.();
    let response;
    try {
      response = await undiciFetch(current, {
        method: "GET",
        redirect: "manual",
        dispatcher,
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "user-agent": ua,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,application/json;q=0.7,*/*;q=0.5",
          "accept-language": "en"
        }
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "Error";
      const message = err instanceof Error ? err.message : String(err);
      const mapped = name === "AbortError" || name === "TimeoutError" ? "TimeoutError" : name;
      return {
        url: startUrl,
        final_url: current,
        ua,
        status: null,
        status_line: null,
        headers: {},
        body_bytes: 0,
        body: "",
        body_truncated: false,
        hops,
        error: { name: mapped, message }
      };
    }
    const headers = headerMap(response.headers);
    const statusLine = `HTTP ${response.status} ${response.statusText}`.trim();
    hops.push({ url: current, status: response.status, status_line: statusLine });
    if (response.status === 429) {
      const retry = parseRetryAfter(headers["retry-after"], Date.now());
      await budget.noteStatus(current, 429, retry);
      const body2 = await readBody(response, maxBodyBytes);
      return {
        url: startUrl,
        final_url: current,
        ua,
        status: 429,
        status_line: statusLine,
        headers,
        ...body2,
        hops
      };
    }
    await budget.noteStatus(current, response.status);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = headers["location"];
      await response.body?.cancel().catch(() => void 0);
      if (!location) {
        return {
          url: startUrl,
          final_url: current,
          ua,
          status: response.status,
          status_line: statusLine,
          headers,
          body: "",
          body_bytes: 0,
          body_truncated: false,
          hops
        };
      }
      const next = new URL(location, current);
      current = next.href;
      continue;
    }
    const body = await readBody(response, maxBodyBytes);
    return {
      url: startUrl,
      final_url: current,
      ua,
      status: response.status,
      status_line: statusLine,
      headers,
      ...body,
      hops
    };
  }
  return {
    url: startUrl,
    final_url: current,
    ua,
    status: null,
    status_line: null,
    headers: {},
    body_bytes: 0,
    body: "",
    body_truncated: false,
    hops,
    error: { name: "RedirectLoop", message: "more than 5 redirects" }
  };
}
var Client = class {
  constructor(budget, guard) {
    this.budget = budget;
    this.guard = guard;
  }
  cache = /* @__PURE__ */ new Map();
  requestCount = 0;
  aborted = null;
  loadCache(entries) {
    for (const [key, snap] of entries) this.cache.set(key, snap);
  }
  exportCache() {
    return [...this.cache.entries()].map(([key, snap]) => [
      key,
      { ...snap, body: snap.body.slice(0, 2e5) }
    ]);
  }
  async get(url, ua = SCANNER_UA, options) {
    const key = `${ua}
${url}
${options?.maxBodyBytes ?? DEFAULT_MAX_BODY}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    if (this.aborted) {
      const snap = emptySnap(url, ua, { name: "DomainAbortedError", message: this.aborted.reason });
      this.cache.set(key, snap);
      return snap;
    }
    try {
      const snap = await fetchPolite(url, this.budget, ua, { ...options, guard: options?.guard ?? this.guard }, () => {
        this.requestCount += 1;
      });
      if (snap.status === 429) {
        this.aborted = {
          reason: `HTTP 429 from ${snap.final_url}. Scan stopped for this domain.`
        };
      }
      this.cache.set(key, snap);
      return snap;
    } catch (err) {
      if (err instanceof BudgetExceededError || err instanceof DomainAbortedError) {
        this.aborted = { reason: err.message };
        const snap = emptySnap(url, ua, { name: err.name, message: err.message });
        this.cache.set(key, snap);
        return snap;
      }
      throw err;
    }
  }
};
function transportFailure(snap) {
  if (snap.error) return `${snap.error.name}: ${snap.error.message}`;
  if (snap.status === null) return "no status line";
  if (snap.status === 429) return snap.status_line ?? "HTTP 429";
  if (snap.status >= 500) return snap.status_line ?? `HTTP ${snap.status}`;
  return null;
}
function evidenceSnap(snap, bodyLimit) {
  const body = snap.body.slice(0, bodyLimit);
  return {
    url: snap.url,
    final_url: snap.final_url,
    ua: snap.ua,
    status: snap.status,
    status_line: snap.status_line,
    headers: snap.headers,
    body_bytes: snap.body_bytes,
    body_stored_chars: body.length,
    body_truncated: snap.body_truncated || body.length < snap.body.length,
    body,
    hops: snap.hops,
    error: snap.error ?? null
  };
}

// src/findings.ts
function isEvidenceObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).length > 0;
}
function dropEvidenceLess(findings) {
  return findings.filter(
    (finding) => Boolean(finding) && typeof finding.claim === "string" && finding.claim.trim().length > 0 && typeof finding.url === "string" && finding.url.length > 0 && typeof finding.timestamp === "string" && finding.timestamp.length > 0 && typeof finding.probe_version === "string" && finding.probe_version.length > 0 && isEvidenceObject(finding.evidence)
  );
}
function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    const byResult = RESULT_RANK[a.result] - RESULT_RANK[b.result];
    if (byResult !== 0) return byResult;
    return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  });
}
function unknownProbes(findings) {
  const ids = [];
  for (const finding of findings) {
    if (finding.result === "unknown" && !ids.includes(finding.probe)) ids.push(finding.probe);
  }
  return ids;
}
function assertNoCompositeScore(file) {
  const blob = JSON.stringify(file);
  if (/"score"\s*:/.test(blob) || /\/\s*100\b/.test(blob) || /readiness score/i.test(blob)) {
    throw new Error("findings.json must not carry a composite score");
  }
}
function toUnknownFinding(probe, url, err) {
  const name = err instanceof Error ? err.name : "Error";
  const message = err instanceof Error ? err.message : String(err);
  return stamp({
    probe,
    result: "unknown",
    severity: "info",
    claim: `${probe} did not run for ${url}: ${name}: ${message}`,
    url,
    probe_version: PROBE_VERSION,
    evidence: { error_name: name, error_message: message }
  });
}
function buildFindingsFile(input) {
  const findings = sortFindings(dropEvidenceLess(input.findings));
  const file = {
    slug: input.company.slug,
    company: input.company.company,
    domain: input.company.domain,
    docs_url: input.docs_url,
    api_base: input.company.api_base ?? null,
    scanned_at: input.scanned_at,
    scanner_version: input.scanner_version,
    scanner_ua: input.scanner_ua,
    about_url: input.about_url,
    report_token: input.report_token,
    headline: input.headline ?? {
      metric: "agent_ttfc",
      result: "unknown",
      step: null,
      detail: "The first-call walkthrough (P9) is not part of scanner 0.1.0. No authenticated call was attempted, so this report does not say the path was reached or blocked."
    },
    probes_run: [...PROBES_IN_BUILD],
    probes_not_in_this_build: [...PROBES_NOT_IN_BUILD],
    findings,
    unknown: unknownProbes(findings),
    requests_made: input.requests_made
  };
  assertNoCompositeScore(file);
  return file;
}
function stamp(partial) {
  return {
    ...partial,
    timestamp: partial.timestamp ?? (/* @__PURE__ */ new Date()).toISOString()
  };
}

// src/html.ts
import { parse } from "node-html-parser";
var ASSET = /\.(png|jpe?g|gif|svg|webp|pdf|zip|gz|css|js|mjs|ico|woff2?|map)(\?|$)/i;
var SKIP = /\/(login|log-in|signin|sign-in|signup|sign-up|register|search|pricing|careers|blog|legal|privacy|terms|cookies)(\/|$)/i;
function extractVisibleText(html) {
  const root = parse(html);
  for (const node of root.querySelectorAll("script, style, noscript, svg, template")) {
    node.remove();
  }
  const body = root.querySelector("body");
  const text = (body ?? root).text || "";
  return text.replace(/\s+/g, " ").trim();
}
function extractBodyHtml(html) {
  const match = /<body\b[^>]*>[\s\S]*<\/body>/i.exec(html);
  return match ? match[0] : html;
}
function extractLinks(html, base) {
  const root = parse(html);
  const out = [];
  for (const anchor of root.querySelectorAll("a")) {
    const href = anchor.getAttribute("href");
    if (!href) continue;
    if (href.startsWith("#") || /^mailto:/i.test(href) || /^javascript:/i.test(href)) continue;
    try {
      const url = new URL(href, base);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      url.hash = "";
      out.push(url.href);
    } catch {
      continue;
    }
  }
  return out;
}
function extractOpenApiLinks(html, base) {
  const root = parse(html);
  const out = [];
  for (const link of root.querySelectorAll("link")) {
    const rel = (link.getAttribute("rel") || "").toLowerCase();
    const type = (link.getAttribute("type") || "").toLowerCase();
    const href = link.getAttribute("href");
    if (!href) continue;
    const rels = rel.split(/\s+/);
    const interesting = rels.includes("describedby") || type.includes("openapi") || type.includes("swagger");
    if (!interesting) continue;
    try {
      const url = new URL(href, base);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      out.push(url.href);
    } catch {
      continue;
    }
  }
  return [...new Set(out)];
}
function segments(pathname) {
  return pathname.split("/").filter(Boolean);
}
function isSkippablePath(pathname) {
  return ASSET.test(pathname) || SKIP.test(pathname);
}
function pickDeepDocsLink(html, docsUrl) {
  const base = new URL(docsUrl);
  const baseSegments = segments(base.pathname);
  const ranked = [];
  const seen = /* @__PURE__ */ new Set();
  for (const href of extractLinks(html, docsUrl)) {
    let url;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    if (url.host !== base.host) continue;
    if (isSkippablePath(url.pathname)) continue;
    const path3 = url.pathname.replace(/\/+$/, "") || "/";
    const depth = segments(path3).length - baseSegments.length;
    if (depth < 1) continue;
    const normalized = `${url.origin}${path3}`;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    let score = depth === 1 ? 4 : 1;
    if (/\/(api|reference|rest|guides?|docs)\b/i.test(path3)) score += 4;
    ranked.push({ url: normalized, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  return ranked[0]?.url ?? null;
}
function hostsMatch(left, right) {
  const bare = (host) => host.replace(/\.$/, "").toLowerCase().replace(/^www\./, "");
  return bare(left) === bare(right);
}
function isDocsUrl(candidate, docsRoot) {
  let url;
  let root;
  try {
    url = new URL(candidate);
    root = new URL(docsRoot);
  } catch {
    return false;
  }
  if (!hostsMatch(url.host, root.host)) return false;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (isSkippablePath(url.pathname)) return false;
  const rootPath = root.pathname.replace(/\/+$/, "");
  if (rootPath && rootPath !== "/") {
    const path3 = url.pathname.replace(/\/+$/, "") || "/";
    if (path3 !== rootPath && !path3.startsWith(`${rootPath}/`)) return false;
  }
  return true;
}
function looksLikeHtml(headers, body) {
  const type = (headers["content-type"] || "").toLowerCase();
  if (type.includes("text/html") || type.includes("application/xhtml")) return true;
  const head = body.slice(0, 300).trim().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html") || head.startsWith("<head");
}
function challengeMarkers(headers, bodyHead) {
  const found = [];
  if (headers["cf-mitigated"]) found.push(`header:cf-mitigated=${headers["cf-mitigated"]}`);
  if (headers["x-datadome"]) found.push("header:x-datadome");
  const head = bodyHead.toLowerCase();
  const phrases = [
    "just a moment",
    "attention required",
    "cf-browser-verification",
    "enable javascript and cookies",
    "checking your browser",
    "pardon our interruption",
    "px-captcha",
    "perimeterx",
    "access denied",
    "request rejected",
    "errors.edgesuite.net"
  ];
  for (const phrase of phrases) {
    if (head.includes(phrase)) found.push(`body:${phrase}`);
  }
  return found;
}

// src/robots.ts
function parseRobots(text) {
  const groups = [];
  let agents = [];
  let rules = [];
  const flush = () => {
    if (agents.length) groups.push({ agents: [...agents], rules: [...rules] });
    agents = [];
    rules = [];
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) {
      if (rules.length || agents.length) flush();
      continue;
    }
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (rules.length) flush();
      agents.push(value);
    } else if ((key === "allow" || key === "disallow") && agents.length) {
      rules.push({ type: key, path: value });
    }
  }
  if (agents.length) flush();
  return groups;
}
function sitemapDirectives(text) {
  const urls = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const match = /^sitemap:\s*(\S+)/i.exec(line);
    if (match?.[1]) urls.push(match[1]);
  }
  return urls;
}
function pathMatches(rulePath, requestPath) {
  if (rulePath === "") return false;
  let pattern = "^";
  for (let i = 0; i < rulePath.length; i++) {
    const char = rulePath[i];
    if (char === "*") {
      pattern += ".*";
    } else if (char === "$" && i === rulePath.length - 1) {
      pattern += "$";
    } else {
      pattern += char.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(pattern).test(requestPath);
}
function matchingRule(groups, agent, requestPath) {
  const agentName = agent.toLowerCase();
  const specificTokens = /* @__PURE__ */ new Set();
  for (const group of groups) {
    for (const token of group.agents) {
      const lowered = token.toLowerCase();
      if (lowered === "*") continue;
      if (agentName === lowered || agentName.startsWith(lowered)) specificTokens.add(lowered);
    }
  }
  let chosen;
  if (specificTokens.size) {
    const bestLen = Math.max(...[...specificTokens].map((token) => token.length));
    const best2 = new Set([...specificTokens].filter((token) => token.length === bestLen));
    chosen = groups.filter((group) => group.agents.some((token) => best2.has(token.toLowerCase())));
  } else if (agent === "*") {
    chosen = groups.filter((group) => group.agents.some((token) => token === "*"));
  } else {
    chosen = groups.filter((group) => group.agents.some((token) => token === "*"));
  }
  let best = null;
  for (const group of chosen) {
    for (const rule of group.rules) {
      if (rule.type === "disallow" && rule.path === "") continue;
      if (!pathMatches(rule.path, requestPath)) continue;
      const allow = rule.type === "allow";
      if (!best || rule.path.length > best.len || rule.path.length === best.len && allow && !best.allow) {
        best = { len: rule.path.length, allow, raw: `${rule.type === "allow" ? "Allow" : "Disallow"}: ${rule.path}` };
      }
    }
  }
  if (!best) return { disallowed: false, matched_rule: null };
  return { disallowed: !best.allow, matched_rule: best.raw };
}

// src/probes/common.ts
function unknownFromSnap(probe, snap, url, claim) {
  const reason = transportFailure(snap) ?? `HTTP ${snap.status}`;
  return stamp({
    probe,
    result: "unknown",
    severity: "info",
    claim: claim ?? `${probe} could not be completed for ${url}: ${reason}.`,
    url,
    probe_version: PROBE_VERSION,
    evidence: evidenceSnap(snap, 4e3)
  });
}
function observed(snap) {
  return transportFailure(snap) === null;
}

// src/probes/p1.ts
function evaluateRobots(body, docsPath) {
  const groups = parseRobots(body);
  return ROBOTS_AGENTS.map((agent) => {
    const match = matchingRule(groups, agent, docsPath);
    return { agent, disallowed: match.disallowed, matched_rule: match.matched_rule };
  });
}
function interpretP1(hosts, docsUrl) {
  const docs = hosts.find((host) => host.role === "docs") ?? hosts[0];
  if (!docs) {
    return stamp({
      probe: "P1",
      result: "unknown",
      severity: "info",
      claim: `P1 could not be completed: no robots.txt request was made for ${docsUrl}.`,
      url: docsUrl,
      probe_version: PROBE_VERSION,
      evidence: { hosts, docs_url: docsUrl }
    });
  }
  const evidence = { hosts, docs_url: docsUrl, captured_at: (/* @__PURE__ */ new Date()).toISOString() };
  if (docs.error || docs.status === null || docs.status === 429 || docs.status !== null && docs.status >= 500) {
    return stamp({
      probe: "P1",
      result: "unknown",
      severity: "info",
      claim: `Could not read robots.txt for the docs host (${docs.url}): ${docs.error?.message ?? docs.status_line}.`,
      url: docs.url,
      probe_version: PROBE_VERSION,
      evidence
    });
  }
  if (docs.status === 403 || docs.status === 401) {
    return stamp({
      probe: "P1",
      result: "unknown",
      severity: "info",
      claim: `GET ${docs.url} returned ${docs.status_line}. The docs robots.txt policy could not be read.`,
      url: docs.url,
      probe_version: PROBE_VERSION,
      evidence
    });
  }
  if (docs.unparseable) {
    return stamp({
      probe: "P1",
      result: "unknown",
      severity: "info",
      claim: `GET ${docs.url} returned ${docs.status_line} with an HTML body, which is not a robots.txt policy.`,
      url: docs.url,
      probe_version: PROBE_VERSION,
      evidence
    });
  }
  const root = hosts.find((host) => host.role === "root" && host.url !== docs.url);
  if (docs.status === 404 || docs.status === 410) {
    const rootBlockedEarly = root?.status === 200 && !root.unparseable ? root.agents.filter((agent) => agent.disallowed) : [];
    if (!rootBlockedEarly.length) {
      return stamp({
        probe: "P1",
        result: "pass",
        severity: "info",
        claim: `GET ${docs.url} returned ${docs.status_line}. There is no robots.txt on the docs host, so no agent is disallowed by one.`,
        url: docs.url,
        probe_version: PROBE_VERSION,
        evidence
      });
    }
  }
  const blocked2 = docs.agents.filter((agent) => agent.disallowed);
  if (blocked2.length) {
    const listed = blocked2.map((agent) => `${agent.agent} matched "${agent.matched_rule}"`).join("; ");
    const rootNote = root && root.status === 200 ? ` Root host ${root.url} was also fetched; its body is in the evidence.` : "";
    return stamp({
      probe: "P1",
      result: "fail",
      severity: "high",
      claim: `robots.txt at ${docs.final_url} disallows ${listed} for docs path ${docs.docs_path}.${rootNote}`,
      url: docs.final_url,
      probe_version: PROBE_VERSION,
      evidence
    });
  }
  const rootBlocked = root?.status === 200 && !root.unparseable ? root.agents.filter((agent) => agent.disallowed) : [];
  if (root && rootBlocked.length) {
    const listed = rootBlocked.map((agent) => `${agent.agent} matched "${agent.matched_rule}"`).join("; ");
    return stamp({
      probe: "P1",
      result: "fail",
      severity: "medium",
      claim: `robots.txt at ${root.final_url} disallows ${listed} for /. The docs host ${docs.final_url} does not disallow those agents from ${docs.docs_path}.`,
      url: root.final_url,
      probe_version: PROBE_VERSION,
      evidence
    });
  }
  return stamp({
    probe: "P1",
    result: "pass",
    severity: "info",
    claim: `robots.txt at ${docs.final_url} does not disallow GPTBot, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Google-Extended, CCBot, or * from ${docs.docs_path}.`,
    url: docs.final_url,
    probe_version: PROBE_VERSION,
    evidence
  });
}
async function probeP1(client, domain, docsUrl) {
  const docs = new URL(docsUrl);
  const docsRobots = new URL("/robots.txt", `${docs.protocol}//${docs.host}`).href;
  const rootRobots = `https://${domain}/robots.txt`;
  const urls = [.../* @__PURE__ */ new Set([docsRobots, rootRobots])];
  const hosts = [];
  for (const url of urls) {
    const snap = await client.get(url, SCANNER_UA);
    if (!observed(snap) || snap.status === 401 || snap.status === 403) {
      if (url === docsRobots && !observed(snap)) return unknownFromSnap("P1", snap, url);
    }
    const docsPath = url === docsRobots ? docs.pathname || "/" : "/";
    const unparseable = snap.status === 200 && looksLikeHtml(snap.headers, snap.body);
    const agents = snap.status === 200 && !unparseable && !snap.error ? evaluateRobots(snap.body, docsPath) : [];
    hosts.push({
      role: url === docsRobots ? "docs" : "root",
      url: snap.url,
      final_url: snap.final_url,
      status: snap.status,
      status_line: snap.status_line,
      headers: snap.headers,
      body: snap.body.slice(0, 1e5),
      error: snap.error ?? null,
      unparseable,
      docs_path: docsPath,
      agents
    });
  }
  return interpretP1(hosts, docsUrl);
}

// src/probes/p2.ts
var HEADER_KEYS = ["server", "cf-ray", "cf-mitigated", "content-type", "retry-after", "www-authenticate", "x-robots-tag"];
function responseFromSnap(name, snap) {
  const headers = {};
  for (const key of HEADER_KEYS) headers[key] = snap.headers[key] ?? null;
  for (const [key, value] of Object.entries(snap.headers)) {
    if (key.startsWith("cf-") || key.includes("datadome") || key.startsWith("x-akamai") || key.startsWith("x-px")) {
      headers[key] = value;
    }
  }
  const bodyHead = Buffer.from(snap.body).subarray(0, 500).toString("utf8");
  return {
    ua_name: name,
    ua: snap.ua,
    status: snap.status,
    status_line: snap.status_line,
    headers,
    body_bytes: snap.body_bytes,
    body_head: bodyHead,
    challenge_markers: challengeMarkers(headers, bodyHead),
    error: snap.error ?? null
  };
}
function completed(responses) {
  return responses.filter((response) => response.status !== null && !response.error);
}
function mediaType(value) {
  if (!value) return "unknown";
  return value.split(";")[0]?.trim().toLowerCase() || "unknown";
}
function opening(body) {
  return body.replace(/\s+/g, " ").trim().slice(0, 80);
}
function discrimination(page) {
  const ok = completed(page.responses);
  if (ok.length < 2) return null;
  const chrome = ok.find((response) => response.ua_name === "chrome");
  const others = ["claudebot", "gptbot", "curl", "scanner"].map((name) => ok.find((response) => response.ua_name === name)).filter((response) => Boolean(response));
  if (chrome) {
    for (const other of others) {
      if (other.status !== chrome.status) {
        return {
          severity: "highest",
          claim: `GET ${page.url} returned ${other.status_line} to ${other.ua_name} (${other.ua}) and ${chrome.status_line} to a Chrome UA string.`
        };
      }
      const otherChallenge = other.challenge_markers.length > 0;
      const chromeChallenge = chrome.challenge_markers.length > 0;
      if (otherChallenge !== chromeChallenge) {
        const side = otherChallenge ? other : chrome;
        return {
          severity: "highest",
          claim: `GET ${page.url} ${otherChallenge ? "returned a challenge to" : "did not challenge"} ${other.ua_name} while the Chrome UA string ${chromeChallenge ? "was challenged" : "was not"}. Markers on the challenged response: ${side.challenge_markers.join(", ")}.`
        };
      }
    }
  }
  const statuses = new Set(ok.map((response) => response.status));
  if (statuses.size > 1) {
    return {
      severity: "highest",
      claim: `GET ${page.url} returned different status lines by user-agent: ${ok.map((response) => `${response.ua_name} ${response.status_line}`).join("; ")}.`
    };
  }
  const challenged = ok.filter((response) => response.challenge_markers.length > 0);
  const clean = ok.filter((response) => response.challenge_markers.length === 0);
  if (challenged.length && clean.length) {
    return {
      severity: "highest",
      claim: `GET ${page.url} returned challenge markers to ${challenged.map((response) => response.ua_name).join(", ")} and not to ${clean.map((response) => response.ua_name).join(", ")}.`
    };
  }
  const families = /* @__PURE__ */ new Map();
  for (const response of ok) {
    const type = mediaType(response.headers["content-type"] ?? null);
    const group = families.get(type) ?? [];
    group.push(response);
    families.set(type, group);
  }
  const known = [...families.entries()].filter(([type]) => type !== "unknown");
  if (known.length > 1) {
    const parts = known.map(([type, group]) => {
      const sample = group[0];
      const names = group.map((response) => response.ua_name).join(", ");
      return `${type} for ${names} (${sample?.body_bytes ?? 0} bytes, starting ${JSON.stringify(opening(sample?.body_head ?? ""))})`;
    });
    return {
      severity: "high",
      claim: `GET ${page.url} returned ${ok[0]?.status_line} to every completed user-agent, in different representations: ${parts.join("; ")}.`
    };
  }
  return null;
}
function interpretP2(pages, note) {
  if (!pages.length) {
    return {
      result: "unknown",
      severity: "info",
      claim: "P2 made no requests, so user-agent discrimination could not be compared."
    };
  }
  const hits = pages.map((page) => discrimination(page)).filter((hit) => Boolean(hit));
  if (hits.length) {
    return {
      result: "fail",
      severity: hits.some((hit) => hit.severity === "highest") ? "highest" : "high",
      claim: hits.map((hit) => hit.claim).join(" ")
    };
  }
  const landing = pages.find((page) => page.role === "landing") ?? pages[0];
  if (!landing || completed(landing.responses).length < 2) {
    return {
      result: "unknown",
      severity: "info",
      claim: `P2 could not compare user-agents for ${landing?.url ?? "the docs page"}: fewer than two responses completed.`
    };
  }
  const deep = pages.find((page) => page.role === "deep");
  if (deep && completed(deep.responses).length < 2) {
    return {
      result: "unknown",
      severity: "info",
      claim: `The docs landing page showed no user-agent discrimination, but the deep page ${deep.url} did not return enough completed responses to compare.`
    };
  }
  const urls = pages.map((page) => page.url).join(" and ");
  const names = [...new Set(pages.flatMap((page) => completed(page.responses).map((response) => response.ua_name)))];
  const landingCompleted = completed(landing.responses);
  const uniformChallenge = landingCompleted.length > 0 && landingCompleted.every((response) => response.challenge_markers.length > 0) ? ` Every completed landing response carried challenge markers (${landingCompleted[0]?.challenge_markers.join(", ")}).` : "";
  const extra = note ? ` ${note}` : "";
  return {
    result: "pass",
    severity: "info",
    claim: `No user-agent discrimination on ${urls}. Status codes matched for ${names.join(", ")}.${uniformChallenge}${extra}`
  };
}
async function probeP2(client, docsUrl) {
  const scannerLanding = await client.get(docsUrl, SCANNER_UA);
  if (!observed(scannerLanding)) return unknownFromSnap("P2", scannerLanding, docsUrl);
  const pages = [
    {
      role: "landing",
      url: docsUrl,
      responses: [responseFromSnap("scanner", scannerLanding)]
    }
  ];
  for (const agent of P2_AGENTS) {
    if (agent.name === "scanner") continue;
    const snap = await client.get(docsUrl, agent.ua);
    pages[0]?.responses.push(responseFromSnap(agent.name, snap));
    if (client.aborted) break;
  }
  let note = null;
  const deepUrl = pickDeepDocsLink(scannerLanding.body, scannerLanding.final_url || docsUrl);
  if (!deepUrl) {
    note = "No same-host deep link was present in the landing HTML, so only the landing page was compared.";
  } else if (!client.aborted) {
    const deepResponses = [];
    for (const agent of P2_AGENTS) {
      const snap = await client.get(deepUrl, agent.ua);
      deepResponses.push(responseFromSnap(agent.name, snap));
      if (client.aborted) break;
    }
    const first = deepResponses[0];
    pages.push({
      role: "deep",
      url: first?.status ? deepUrl : deepUrl,
      responses: deepResponses
    });
  }
  const interpreted = interpretP2(pages, note);
  const primary = pages[0]?.url ?? docsUrl;
  return stamp({
    probe: "P2",
    result: interpreted.result,
    severity: interpreted.severity,
    claim: interpreted.claim,
    url: primary,
    probe_version: PROBE_VERSION,
    evidence: {
      pages,
      note,
      captured_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}

// src/render.ts
var TELEMETRY = /google-analytics|googletagmanager|doubleclick|googleadservices|segment\.(io|com)|sentry\.io|hotjar|mixpanel|amplitude|fullstory|facebook\.net|optimizely|intercom\.io|bat\.bing|clarity\.ms/i;
async function renderPage(url, budget) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (err) {
    return { ok: false, requests: 0, error: `playwright_unavailable: ${err instanceof Error ? err.message : String(err)}` };
  }
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
  } catch (err) {
    return {
      ok: false,
      requests: 0,
      error: `chromium_launch_failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
  let requests = 0;
  try {
    const context = await browser.newContext({ userAgent: SCANNER_UA });
    const page = await context.newPage();
    let budgetError = null;
    const docsHost = new URL(url).host;
    await page.route("**/*", async (route) => {
      const request = route.request();
      const type = request.resourceType();
      const requestUrl = request.url();
      if (!["document", "script", "xhr", "fetch"].includes(type) || TELEMETRY.test(requestUrl)) {
        await route.abort();
        return;
      }
      if (requests >= 15 || budgetError) {
        await route.abort();
        return;
      }
      try {
        await budget.acquire(requestUrl);
        requests += 1;
        const response = await route.fetch({ maxRedirects: 0 });
        if (response.status() === 429) {
          const retry = parseRetryAfter(response.headers()["retry-after"], Date.now());
          await budget.noteStatus(requestUrl, 429, retry);
          if (new URL(requestUrl).host === docsHost) {
            budgetError = `HTTP 429 from ${requestUrl}`;
          }
        } else {
          await budget.noteStatus(requestUrl, response.status());
        }
        await route.fulfill({ response });
      } catch (err) {
        budgetError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        await route.abort().catch(() => void 0);
      }
    });
    const navigation = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45e3 }).catch((err) => err);
    if (budgetError) {
      await context.close();
      return { ok: false, requests, error: budgetError };
    }
    if (navigation instanceof Error) {
      await context.close();
      return { ok: false, requests, error: `${navigation.name}: ${navigation.message}` };
    }
    await page.waitForTimeout(1200);
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    const finalUrl = page.url();
    await context.close();
    return { ok: true, text: text.replace(/\s+/g, " ").trim(), requests, final_url: finalUrl };
  } catch (err) {
    return { ok: false, requests, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  } finally {
    await browser.close().catch(() => void 0);
  }
}

// src/probes/p3.ts
function interpretP3(input) {
  if (input.chromium_error || input.rendered_text_chars === null) {
    return {
      result: "unknown",
      severity: "info",
      claim: `JavaScript dependency for ${input.url} is unknown: ${input.chromium_error ?? "no rendered text"}.`
    };
  }
  if (input.rendered_text_chars < 400) {
    return {
      result: "unknown",
      severity: "info",
      claim: `JavaScript dependency for ${input.url} is unknown: the headless render produced only ${input.rendered_text_chars} characters of text, which is too little to compare.`
    };
  }
  const ratio = input.raw_text_chars / input.rendered_text_chars;
  if (ratio < 0.2) {
    return {
      result: "fail",
      severity: "high",
      claim: `Raw HTML of ${input.url} contains ${input.raw_text_chars} characters of visible text; the same page rendered headless contains ${input.rendered_text_chars} (${ratio.toFixed(3)} of the rendered text). Agents that do not execute JavaScript see less than 20% of the page.`
    };
  }
  return {
    result: "pass",
    severity: "info",
    claim: `Raw HTML of ${input.url} contains ${input.raw_text_chars} characters of visible text against ${input.rendered_text_chars} rendered (${ratio.toFixed(3)}). The page is not a JavaScript shell.`
  };
}
async function probeP3(client, pageUrl) {
  const raw = await client.get(pageUrl, SCANNER_UA);
  if (!observed(raw)) return unknownFromSnap("P3", raw, pageUrl);
  if (client.aborted) {
    return unknownFromSnap("P3", raw, pageUrl, `P3 stopped before render: ${client.aborted.reason}`);
  }
  const rawText = extractVisibleText(raw.body);
  const rawBody = extractBodyHtml(raw.body);
  const storedBody = rawBody.slice(0, 6e4);
  let rendered;
  try {
    rendered = await renderPage(raw.final_url || pageUrl, client.budget);
  } catch (err) {
    rendered = { ok: false, requests: 0, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
  client.requestCount += rendered.requests;
  if (!rendered.ok && /BudgetExceeded|DomainAborted|429/.test(rendered.error)) {
    client.aborted = { reason: rendered.error };
  }
  const renderedChars = rendered.ok ? rendered.text.length : null;
  const interpreted = interpretP3({
    url: raw.final_url,
    raw_text_chars: rawText.length,
    rendered_text_chars: renderedChars,
    chromium_error: rendered.ok ? null : rendered.error
  });
  return stamp({
    probe: "P3",
    result: interpreted.result,
    severity: interpreted.severity,
    claim: interpreted.claim,
    url: raw.final_url,
    probe_version: PROBE_VERSION,
    evidence: {
      url: raw.final_url,
      raw_request: evidenceSnap(raw, 500),
      raw_text_chars: rawText.length,
      rendered_text_chars: renderedChars,
      ratio: renderedChars ? Number((rawText.length / renderedChars).toFixed(4)) : null,
      text_extraction: "body text with script, style, noscript, svg, and template removed; whitespace collapsed",
      raw_body: storedBody,
      raw_body_original_chars: rawBody.length,
      raw_body_truncated: storedBody.length < rawBody.length,
      rendered_text_excerpt: rendered.ok ? rendered.text.slice(0, 1500) : null,
      render_requests: rendered.requests,
      chromium_error: rendered.ok ? null : rendered.error,
      captured_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}

// src/openapi.ts
import { parse as parseYaml } from "yaml";
var METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function parseSpecDocument(body) {
  const trimmed = body.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return parseYaml(trimmed);
    } catch {
      return null;
    }
  }
}
function looksLikeSpec(doc) {
  if (!isRecord(doc)) return false;
  return typeof doc.openapi === "string" || typeof doc.swagger === "string" || isRecord(doc.paths);
}
function hasExample(value) {
  if (!isRecord(value)) return false;
  if ("example" in value || "examples" in value) return true;
  if (Array.isArray(value.parameters) && value.parameters.some((item) => isRecord(item) && ("example" in item || "examples" in item))) {
    return true;
  }
  if (isRecord(value.requestBody) && contentHasExample(value.requestBody)) return true;
  if (isRecord(value.responses)) {
    for (const response of Object.values(value.responses)) {
      if (isRecord(response) && contentHasExample(response)) return true;
    }
  }
  if ("x-codeSamples" in value || "x-code-samples" in value) return true;
  return false;
}
function contentHasExample(node) {
  if ("example" in node || "examples" in node) return true;
  if (!isRecord(node.content)) return false;
  for (const media of Object.values(node.content)) {
    if (isRecord(media) && ("example" in media || "examples" in media)) return true;
  }
  return false;
}
function summarizeOpenApi(doc) {
  if (!looksLikeSpec(doc) || !isRecord(doc)) return null;
  const paths = isRecord(doc.paths) ? doc.paths : {};
  let operationCount = 0;
  let withDescription = 0;
  let withExample = 0;
  for (const pathItem of Object.values(paths)) {
    if (!isRecord(pathItem)) continue;
    for (const method of METHODS) {
      const operation = pathItem[method];
      if (!isRecord(operation)) continue;
      operationCount += 1;
      if (typeof operation.description === "string" && operation.description.trim()) withDescription += 1;
      if (hasExample(operation)) withExample += 1;
    }
  }
  const schemes = /* @__PURE__ */ new Set();
  const components = isRecord(doc.components) ? doc.components : null;
  const securitySchemes = components && isRecord(components.securitySchemes) ? components.securitySchemes : null;
  if (securitySchemes) {
    for (const name of Object.keys(securitySchemes)) schemes.add(name);
  }
  if (isRecord(doc.securityDefinitions)) {
    for (const name of Object.keys(doc.securityDefinitions)) schemes.add(name);
  }
  return {
    path_count: Object.keys(paths).length,
    operation_count: operationCount,
    operations_with_description: withDescription,
    operations_with_example: withExample,
    security_schemes: [...schemes],
    auth_described: schemes.size > 0
  };
}

// src/probes/p4.ts
var DOCS_PATHS = ["/openapi.json", "/openapi.yaml", "/swagger.json", "/.well-known/openapi.json"];
function classify(snap) {
  if (!observed(snap)) return { classification: "not_observed", summary: null };
  if (snap.status === 401) return { classification: "unauthorized", summary: null };
  if (snap.status === 403) return { classification: "not_observed", summary: null };
  if (snap.status === 404 || snap.status === 410) return { classification: "absent", summary: null };
  if (!(snap.status && snap.status >= 200 && snap.status < 300)) {
    return { classification: "not_observed", summary: null };
  }
  if (looksLikeHtml(snap.headers, snap.body)) return { classification: "absent", summary: null };
  const parsed = parseSpecDocument(snap.body);
  if (!parsed) return { classification: "unparseable", summary: null };
  if (!looksLikeSpec(parsed)) return { classification: "absent", summary: null };
  const summary = summarizeOpenApi(parsed);
  if (!summary) return { classification: "unparseable", summary: null };
  return { classification: "spec", summary };
}
function interpretP4(probes) {
  if (!probes.length) {
    return { result: "unknown", severity: "info", claim: "OpenAPI discoverability is unknown because no candidate URLs were fetched." };
  }
  const specs = probes.filter((probe) => probe.classification === "spec" && probe.summary);
  if (specs.length) {
    const best = [...specs].sort((a, b) => (b.summary?.path_count ?? 0) - (a.summary?.path_count ?? 0))[0];
    const summary = best?.summary;
    if (!best || !summary) {
      return { result: "unknown", severity: "info", claim: "An OpenAPI body was fetched but could not be summarized." };
    }
    if (summary.path_count === 0) {
      return {
        result: "fail",
        severity: "medium",
        claim: `OpenAPI document at ${best.final_url} parsed and declares 0 paths.`
      };
    }
    const descriptionGap = summary.operation_count > 0 && summary.operations_with_description * 2 < summary.operation_count;
    const exampleGap = summary.operation_count > 0 && summary.operations_with_example === 0;
    if (!summary.auth_described || descriptionGap) {
      const parts = [
        `OpenAPI at ${best.final_url} lists ${summary.path_count} paths and ${summary.operation_count} operations.`,
        summary.auth_described ? `Security schemes: ${summary.security_schemes.join(", ")}.` : "It declares no security scheme.",
        `${summary.operations_with_description} operations have descriptions and ${summary.operations_with_example} have examples.`
      ];
      return { result: "fail", severity: "medium", claim: parts.join(" ") };
    }
    if (exampleGap) {
      return {
        result: "fail",
        severity: "low",
        claim: `OpenAPI at ${best.final_url} lists ${summary.path_count} paths and describes auth (${summary.security_schemes.join(", ")}), but 0 of ${summary.operation_count} operations include an example.`
      };
    }
    return {
      result: "pass",
      severity: "info",
      claim: `OpenAPI at ${best.final_url} lists ${summary.path_count} paths, ${summary.operations_with_description} of ${summary.operation_count} operations have descriptions, ${summary.operations_with_example} have examples, and auth is declared (${summary.security_schemes.join(", ")}).`
    };
  }
  const unauthorized = probes.find((probe) => probe.classification === "unauthorized");
  if (unauthorized && probes.every((probe) => probe.classification !== "not_observed" && probe.classification !== "unparseable")) {
    return {
      result: "fail",
      severity: "medium",
      claim: `GET ${unauthorized.final_url} returned ${unauthorized.status_line}. A spec URL answered, and it is not readable without credentials.`
    };
  }
  const unparsed = probes.filter((probe) => probe.classification === "unparseable");
  if (unparsed.length) {
    const first = unparsed[0];
    const begins = (first?.body_sample ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    return {
      result: "unknown",
      severity: "info",
      claim: `GET ${first?.final_url} returned ${first?.status_line} (${first?.content_type}, ${first?.body_bytes} bytes) but the body could not be parsed as OpenAPI. It begins: ${begins}`
    };
  }
  if (probes.some((probe) => probe.classification === "not_observed")) {
    const blocked2 = probes.filter((probe) => probe.classification === "not_observed");
    return {
      result: "unknown",
      severity: "info",
      claim: `OpenAPI discoverability is unknown because ${blocked2.map((probe) => `${probe.url} (${probe.error?.name ?? probe.status_line})`).join("; ")} could not be read as a completed check.`
    };
  }
  const lines = probes.map((probe) => `${probe.status_line} ${probe.url}`).join("; ");
  return {
    result: "fail",
    severity: "medium",
    claim: `No OpenAPI document at the well-known paths, and the docs HTML has no describedby or application/openapi+json link. ${lines}.`
  };
}
async function probeP4(client, docsUrl, apiBase, docsHtml) {
  const docs = new URL(docsUrl);
  const targets = DOCS_PATHS.map((path3) => ({
    url: new URL(path3, `${docs.protocol}//${docs.host}`).href,
    source: "well-known"
  }));
  if (apiBase) {
    const api = new URL(apiBase);
    const apiSpec = new URL("/openapi.json", `${api.protocol}//${api.host}`).href;
    if (!targets.some((target) => target.url === apiSpec)) {
      targets.push({ url: apiSpec, source: "api-origin" });
    }
  }
  if (docsHtml) {
    for (const link of extractOpenApiLinks(docsHtml, docsUrl).slice(0, 2)) {
      if (!targets.some((target) => target.url === link)) targets.push({ url: link, source: "link" });
    }
  }
  const probes = [];
  for (const target of targets) {
    if (client.aborted) break;
    const snap = await client.get(target.url, SCANNER_UA, { maxBodyBytes: 2e6 });
    const classified = classify(snap);
    probes.push({
      url: snap.url,
      final_url: snap.final_url,
      source: target.source,
      status: snap.status,
      status_line: snap.status_line,
      content_type: snap.headers["content-type"] ?? null,
      body_bytes: snap.body_bytes,
      body_sample: snap.body.slice(0, 1500),
      error: snap.error ?? null,
      classification: classified.classification,
      summary: classified.summary
    });
  }
  const interpreted = interpretP4(probes);
  const spec = probes.find((probe) => probe.classification === "spec");
  return stamp({
    probe: "P4",
    result: interpreted.result,
    severity: interpreted.severity,
    claim: interpreted.claim,
    url: spec?.final_url ?? probes[0]?.url ?? docsUrl,
    probe_version: PROBE_VERSION,
    evidence: { probes, captured_at: (/* @__PURE__ */ new Date()).toISOString() }
  });
}

// src/probes/p5.ts
var PATHS = ["/llms.txt", "/llms-full.txt", "/.well-known/llms.txt"];
function classifyManifest(snap) {
  if (!observed(snap) || snap.status === 401 || snap.status === 403) return "not_observed";
  if (snap.status === 404 || snap.status === 410) return "absent";
  if (snap.status && snap.status >= 200 && snap.status < 300) {
    if (!snap.body.trim()) return "absent";
    if (looksLikeHtml(snap.headers, snap.body)) return "absent";
    return "manifest";
  }
  return "not_observed";
}
function interpretP5(probes) {
  const found = probes.filter((probe) => probe.classification === "manifest");
  if (found.length) {
    const first = found[0];
    return {
      result: "pass",
      severity: "info",
      claim: `Found an agent manifest at ${first?.final_url} (${first?.status_line}, ${first?.body_bytes} bytes).`
    };
  }
  if (!probes.length) {
    return {
      result: "unknown",
      severity: "info",
      claim: "llms.txt presence is unknown because no manifest URLs were fetched."
    };
  }
  if (probes.some((probe) => probe.classification === "not_observed")) {
    const blocked2 = probes.filter((probe) => probe.classification === "not_observed");
    return {
      result: "unknown",
      severity: "info",
      claim: `llms.txt presence is unknown because ${blocked2.map((probe) => `${probe.url} (${probe.error?.name ?? probe.status_line})`).join("; ")} did not complete as an observation.`
    };
  }
  const lines = probes.map((probe) => `${probe.status_line} ${probe.url}`).join("; ");
  return {
    result: "fail",
    severity: "medium",
    claim: `No llms.txt, llms-full.txt, or .well-known/llms.txt is published. ${lines}.`
  };
}
async function probeP5(client, domain, docsUrl) {
  const docs = new URL(docsUrl);
  const origins = [.../* @__PURE__ */ new Set([`${docs.protocol}//${docs.host}`, `https://${domain}`])];
  const probes = [];
  for (const origin of origins) {
    for (const path3 of PATHS) {
      if (client.aborted) break;
      const snap = await client.get(new URL(path3, origin).href, SCANNER_UA);
      probes.push({
        url: snap.url,
        final_url: snap.final_url,
        status: snap.status,
        status_line: snap.status_line,
        headers: snap.headers,
        body_bytes: snap.body_bytes,
        body_head: snap.body.slice(0, 1500),
        error: snap.error ?? null,
        classification: classifyManifest(snap)
      });
    }
  }
  const interpreted = interpretP5(probes);
  return stamp({
    probe: "P5",
    result: interpreted.result,
    severity: interpreted.severity,
    claim: interpreted.claim,
    url: probes.find((probe) => probe.classification === "manifest")?.final_url ?? probes[0]?.url ?? docsUrl,
    probe_version: PROBE_VERSION,
    evidence: { probes, captured_at: (/* @__PURE__ */ new Date()).toISOString() }
  });
}

// src/sitemap.ts
function parseSitemapXml(xml) {
  const head = xml.slice(0, 4e3).toLowerCase();
  const locs = extractLocs(xml);
  if (head.includes("<sitemapindex")) return { kind: "index", locs };
  if (head.includes("<urlset")) return { kind: "urlset", locs };
  return { kind: "unknown", locs };
}
function extractLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match;
  while (match = re.exec(xml)) {
    const raw = match[1]?.replace(/&amp;/g, "&").trim();
    if (raw) locs.push(raw);
  }
  return locs;
}
function normalizeUrl(input) {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    let path3 = url.pathname;
    try {
      path3 = decodeURIComponent(path3);
    } catch {
      path3 = url.pathname;
    }
    path3 = path3.replace(/\/+$/, "");
    if (!path3) path3 = "/";
    return `${url.protocol}//${url.host.toLowerCase()}${path3}`;
  } catch {
    return null;
  }
}

// src/probes/p7.ts
var SITEMAP_FETCH_CAP = 5;
var LEVEL1_CAP = 6;
function interpretP7(input) {
  let docsHost = "";
  try {
    docsHost = new URL(input.docs_url).host;
  } catch {
    docsHost = "";
  }
  if (!input.incomplete && input.sitemap_docs_url_count === 0 && input.sitemap_fetches.length > 0) {
    const docsFetches = input.sitemap_fetches.filter((fetch2) => {
      try {
        return new URL(fetch2.url).host === docsHost;
      } catch {
        return false;
      }
    });
    const docsHostGone = docsFetches.length > 0 && docsFetches.every((fetch2) => fetch2.status === 404 || fetch2.status === 410);
    const allMissing = input.sitemap_fetches.every((fetch2) => fetch2.status === 404 || fetch2.status === 410);
    if (docsHostGone || allMissing) {
      const line = input.sitemap_fetches.map((fetch2) => {
        const hosts = (fetch2.loc_hosts ?? []).filter((host) => host && host !== docsHost);
        const detail = fetch2.loc_count > 0 ? ` (${fetch2.kind}, ${fetch2.loc_count} locs${hosts.length ? ` on ${hosts.join(", ")}` : ""}, none on ${docsHost})` : "";
        return `${fetch2.status_line ?? `status ${fetch2.status ?? "none"}`} ${fetch2.url}${detail}`;
      }).join("; ");
      return {
        result: "fail",
        severity: "medium",
        claim: `No sitemap lists documentation URLs on ${docsHost}. ${line}.`
      };
    }
  }
  if (input.incomplete || input.sitemap_docs_url_count === 0) {
    return {
      result: "unknown",
      severity: "info",
      claim: `Sitemap coverage for ${input.docs_url} is unknown: ${input.incomplete_reason ?? coverageGap(input)}. A partial sitemap is not treated as a miss.`
    };
  }
  if (input.crawled_urls.length < 4) {
    return {
      result: "unknown",
      severity: "info",
      claim: `Sitemap coverage for ${input.docs_url} is unknown: a two-level crawl found only ${input.crawled_urls.length} docs URLs, which is too small to compare.`
    };
  }
  const missing = input.missing_from_sitemap.length;
  const crawled = input.crawled_urls.length;
  const ratio = missing / crawled;
  if (ratio >= 0.3 && missing >= 3) {
    return {
      result: "fail",
      severity: ratio >= 0.5 && missing >= 5 ? "high" : "medium",
      claim: `Of ${crawled} documentation URLs discovered by a two-level crawl from ${input.docs_url}, ${missing} do not appear in the sitemap (${input.sitemap_docs_url_count} docs URLs listed).`
    };
  }
  return {
    result: "pass",
    severity: "info",
    claim: `Of ${crawled} documentation URLs discovered by a two-level crawl from ${input.docs_url}, ${missing} are absent from the sitemap (${input.sitemap_docs_url_count} docs URLs listed).`
  };
}
function coverageGap(input) {
  const fetches = input.sitemap_fetches;
  if (fetches.length === 0) return "no sitemap URL was fetched";
  const locCount = fetches.reduce((sum, fetch2) => sum + fetch2.loc_count, 0);
  const lines = fetches.map((fetch2) => {
    const status = fetch2.status_line ?? `status ${fetch2.status ?? "none"}`;
    return `${status} ${fetch2.url} (${fetch2.kind}, ${fetch2.loc_count} locs)`;
  });
  if (locCount > 0 && input.sitemap_docs_url_count === 0) {
    let docsHost = input.docs_url;
    try {
      docsHost = new URL(input.docs_url).host;
    } catch {
      docsHost = input.docs_url;
    }
    const hosts = [...new Set(fetches.flatMap((fetch2) => fetch2.loc_hosts ?? []))];
    const where = hosts.length ? ` on ${hosts.join(", ")}` : "";
    return `${fetches.length} sitemap responses listed ${locCount} URLs${where}, and none are on ${docsHost}. ${lines.join("; ")}`;
  }
  return lines.join("; ");
}
function docsHostLocs(locs, docsUrl) {
  const host = new URL(docsUrl).host;
  const out = [];
  for (const loc of locs) {
    const normalized = normalizeUrl(loc);
    if (!normalized) continue;
    if (!hostsMatch(new URL(normalized).host, host)) continue;
    out.push(normalized);
  }
  return out;
}
function comparisonKey(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  const parsed = new URL(normalized);
  const hostname = parsed.hostname.replace(/^www\./, "");
  const port = parsed.port ? `:${parsed.port}` : "";
  return `${parsed.protocol}//${hostname}${port}${parsed.pathname}`;
}
async function probeP7(client, docsUrl, robotsBodies, landingHtml) {
  const docs = new URL(docsUrl);
  const origin = `${docs.protocol}//${docs.host}`;
  const seeds = /* @__PURE__ */ new Set();
  for (const body of robotsBodies) {
    for (const directive of sitemapDirectives(body)) {
      try {
        const url = new URL(directive, origin);
        if (url.protocol === "http:" || url.protocol === "https:") seeds.add(url.href);
      } catch {
        continue;
      }
    }
  }
  seeds.add(new URL("/sitemap.xml", origin).href);
  const fetches = [];
  const queue = [...seeds];
  const queued = new Set(queue);
  const extraSeeds = queue.length > SITEMAP_FETCH_CAP;
  const urlLocs = [];
  let incomplete = false;
  let incompleteReason = null;
  let sawUrlset = false;
  while (queue.length) {
    if (fetches.length >= SITEMAP_FETCH_CAP) {
      incomplete = true;
      incompleteReason = `stopped after ${SITEMAP_FETCH_CAP} sitemap fetches with ${queue.length} still queued`;
      break;
    }
    const next = queue.shift();
    if (!next) break;
    if (client.aborted) {
      incomplete = true;
      incompleteReason = client.aborted.reason;
      break;
    }
    const snap = await client.get(next, SCANNER_UA, { maxBodyBytes: 5e6 });
    const record = describeSitemap(snap);
    fetches.push(record);
    if (!observed(snap) || snap.body_truncated || snap.status === 401 || snap.status === 403) {
      incomplete = true;
      incompleteReason = `${snap.final_url} ${snap.error?.message ?? snap.status_line}`;
      continue;
    }
    if (snap.status === 404 || snap.status === 410) continue;
    if (record.kind === "index") {
      const children = parseSitemapXml(snap.body).locs;
      const room = SITEMAP_FETCH_CAP - fetches.length - queue.length;
      if (children.length > room) {
        incomplete = true;
        incompleteReason = `sitemap index at ${snap.final_url} lists ${children.length} children; cap is ${SITEMAP_FETCH_CAP} fetches`;
        continue;
      }
      for (const child of children) {
        const normalized = normalizeUrl(child) ? new URL(child, snap.final_url).href : null;
        if (normalized && !queued.has(normalized)) {
          queued.add(normalized);
          queue.push(normalized);
        }
      }
      continue;
    }
    if (record.kind === "urlset") {
      sawUrlset = true;
      urlLocs.push(...parseSitemapXml(snap.body).locs);
      continue;
    }
    incomplete = true;
    incompleteReason = `${snap.final_url} returned ${snap.status_line} and was not a urlset or sitemap index`;
  }
  const sitemapDocs = [...new Set(docsHostLocs(urlLocs, docsUrl))];
  const crawled = await crawlTwoLevels(client, docsUrl, landingHtml);
  const sitemapKeys = new Set(sitemapDocs.map((url) => comparisonKey(url)).filter((key) => Boolean(key)));
  const missing = crawled.filter((url) => {
    const key = comparisonKey(url);
    return !key || !sitemapKeys.has(key);
  });
  const allGone = !extraSeeds && fetches.length > 0 && fetches.every((fetch2) => fetch2.status === 404 || fetch2.status === 410);
  if (extraSeeds) {
    incomplete = true;
    incompleteReason = `${seeds.size} sitemap URLs were advertised; only ${SITEMAP_FETCH_CAP} are fetched, so a URL cannot be called missing.`;
  }
  const interpreted = interpretP7({
    docs_url: docsUrl,
    sitemap_fetches: fetches,
    incomplete: allGone ? false : incomplete || !sawUrlset,
    incomplete_reason: allGone ? null : incompleteReason ?? (sawUrlset ? null : "no urlset was fully read"),
    sitemap_docs_url_count: sitemapDocs.length,
    crawled_urls: crawled,
    missing_from_sitemap: missing
  });
  return stamp({
    probe: "P7",
    result: interpreted.result,
    severity: interpreted.severity,
    claim: interpreted.claim,
    url: fetches[0]?.url ?? new URL("/sitemap.xml", origin).href,
    probe_version: PROBE_VERSION,
    evidence: {
      sitemap_fetches: fetches,
      sitemap_docs_url_count: sitemapDocs.length,
      sitemap_docs_url_sample: sitemapDocs.slice(0, 30),
      crawled_urls: crawled.slice(0, 300),
      crawled_url_count: crawled.length,
      missing_from_sitemap: missing.slice(0, 100),
      missing_count: missing.length,
      captured_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
function describeSitemap(snap) {
  let kind = "unknown";
  let locCount = 0;
  let locHosts = [];
  if (observed(snap) && snap.status && snap.status >= 200 && snap.status < 300 && !snap.body_truncated) {
    const parsed = parseSitemapXml(snap.body);
    kind = parsed.kind === "unknown" ? "not_xml" : parsed.kind;
    locCount = parsed.locs.length;
    locHosts = [...new Set(parsed.locs.flatMap((loc) => {
      try {
        return [new URL(loc).host.toLowerCase()];
      } catch {
        return [];
      }
    }))];
  }
  return {
    url: snap.final_url,
    status: snap.status,
    status_line: snap.status_line,
    body_bytes: snap.body_bytes,
    body_excerpt: snap.body.slice(0, 2e3),
    body_truncated: snap.body_truncated,
    error: snap.error ?? null,
    kind,
    loc_count: locCount,
    loc_hosts: locHosts
  };
}
async function crawlTwoLevels(client, docsUrl, landingHtml) {
  const root = normalizeUrl(docsUrl);
  if (!root) return [];
  let html = landingHtml;
  if (!html) {
    const snap = await client.get(docsUrl, SCANNER_UA);
    if (!observed(snap)) return root ? [root] : [];
    html = snap.body;
  }
  const level1 = rankLinks(extractLinks(html, docsUrl), docsUrl).slice(0, LEVEL1_CAP);
  const discovered = /* @__PURE__ */ new Set([root]);
  for (const link of level1) {
    const normalized = normalizeUrl(link);
    if (normalized) discovered.add(normalized);
  }
  for (const link of level1) {
    if (client.aborted) break;
    const snap = await client.get(link, SCANNER_UA);
    if (!observed(snap) || !snap.body) continue;
    const final = normalizeUrl(snap.final_url);
    if (final && isDocsUrl(final, docsUrl)) discovered.add(final);
    for (const child of extractLinks(snap.body, snap.final_url)) {
      if (!isDocsUrl(child, docsUrl)) continue;
      const normalized = normalizeUrl(child);
      if (normalized) discovered.add(normalized);
    }
  }
  return [...discovered];
}
function rankLinks(links, docsUrl) {
  const root = new URL(docsUrl);
  const rootDepth = segments(root.pathname).length;
  const ranked = [];
  const seen = /* @__PURE__ */ new Set();
  for (const link of links) {
    if (!isDocsUrl(link, docsUrl)) continue;
    const url = new URL(link);
    const path3 = url.pathname.replace(/\/+$/, "") || "/";
    const normalized = `${url.origin}${path3}`;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const depth = segments(path3).length - rootDepth;
    if (depth < 1) continue;
    let score = depth === 1 ? 3 : 1;
    if (/\/(api|reference|rest|guides?)\b/i.test(path3)) score += 2;
    ranked.push({ url: normalized, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  return ranked.map((item) => item.url);
}

// src/version.ts
function findVersionSignal(url, visibleText2) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const pathVersion = parsed.pathname.match(/\/(v\d+(?:\.\d+)?)(?:\/|$)/i);
  if (pathVersion?.[1] && pathVersion[0]) {
    return { version: pathVersion[1], match: pathVersion[0], where: "url" };
  }
  const pathDate = parsed.pathname.match(/\/(20\d{2}-\d{2}-\d{2})(?:\/|$)/);
  if (pathDate?.[1] && pathDate[0]) {
    return { version: pathDate[1], match: pathDate[0], where: "url" };
  }
  const labeled = /(?:API\s+version|version)\s*(?:is|of|:|=)?\s*["']?(\d{4}-\d{2}-\d{2}|v?\d+\.\d+(?:\.\d+)?)/i.exec(
    visibleText2
  );
  if (labeled?.[1] && labeled[0]) {
    return { version: labeled[1], match: labeled[0].trim(), where: "text" };
  }
  return null;
}

// src/probes/p8.ts
function interpretP8(pages) {
  if (pages.length < 3) {
    return {
      result: "unknown",
      severity: "info",
      claim: `Version signalling is unknown: ${pages.length} docs pages were sampled and the check needs three.`
    };
  }
  const withVersion = pages.filter((page) => page.version);
  if (withVersion.length >= 2) {
    const listed = withVersion.map((page) => `${page.url} states ${page.version} (${page.match})`).join("; ");
    const missing = pages.filter((page) => !page.version).map((page) => page.url);
    const missingNote = missing.length ? ` No version string on ${missing.join(", ")}.` : "";
    return {
      result: "pass",
      severity: "info",
      claim: `Readable API version on ${withVersion.length} of ${pages.length} sampled pages. ${listed}.${missingNote}`
    };
  }
  const details = pages.map((page) => page.version ? `${page.url} states ${page.version}` : `${page.url} has no version string in the URL or visible text`).join("; ");
  return {
    result: "fail",
    severity: "medium",
    claim: `Only ${withVersion.length} of 3 sampled docs pages state an API version in the URL or in readable text. ${details}.`
  };
}
async function probeP8(client, docsUrl, landingHtml) {
  const candidates = landingHtml ? rankSample(extractLinks(landingHtml, docsUrl), docsUrl) : [];
  const pages = [];
  const seen = /* @__PURE__ */ new Set();
  const consider = async (url) => {
    const key = normalizeUrl(url) ?? url;
    if (seen.has(key) || pages.length >= 3) return;
    seen.add(key);
    if (client.aborted) return;
    const snap = await client.get(url, SCANNER_UA);
    if (!observed(snap) || !(snap.status && snap.status >= 200 && snap.status < 300)) return;
    pages.push(pageFromSnap(snap));
  };
  for (const candidate of candidates) {
    if (pages.length >= 3 || client.aborted) break;
    await consider(candidate);
  }
  if (pages.length < 3 && !client.aborted) await consider(docsUrl);
  const interpreted = interpretP8(pages);
  return stamp({
    probe: "P8",
    result: interpreted.result,
    severity: interpreted.severity,
    claim: interpreted.claim,
    url: pages[0]?.url ?? docsUrl,
    probe_version: PROBE_VERSION,
    evidence: {
      pages: pages.map((page) => ({
        ...page,
        text_excerpt: page.text_excerpt.slice(0, 2e4)
      })),
      source: "raw response body with script, style, noscript, svg, and template removed",
      captured_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
function pageFromSnap(snap) {
  const text = extractVisibleText(snap.body);
  const hit = findVersionSignal(snap.final_url, text);
  return {
    url: snap.final_url,
    status: snap.status,
    status_line: snap.status_line,
    version: hit?.version ?? null,
    match: hit?.match ?? null,
    where: hit?.where ?? null,
    text_excerpt: text.slice(0, 2e4),
    error: snap.error ?? null
  };
}
function rankSample(links, docsUrl) {
  const rootDepth = segments(new URL(docsUrl).pathname).length;
  const ranked = [];
  const seen = /* @__PURE__ */ new Set();
  for (const link of links) {
    if (!isDocsUrl(link, docsUrl)) continue;
    const url = new URL(link);
    const path3 = url.pathname.replace(/\/+$/, "") || "/";
    const normalized = `${url.origin}${path3}`;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const depth = segments(path3).length - rootDepth;
    if (depth < 1) continue;
    let score = 0;
    if (/\/(api|reference|rest|openapi)\b/i.test(path3)) score += 8;
    if (/payment-intent|\/charges\b|\/resources\b/i.test(path3)) score += 4;
    if (/\/(guides?|docs)\b/i.test(path3)) score += 2;
    if (depth >= 2) score += 1;
    if (/how-|\/install\b|use-cases|no-code|what-is/i.test(path3)) score -= 4;
    ranked.push({ url: normalized, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  return ranked.map((item) => item.url);
}

// src/probes/docs.ts
import { connect as tlsConnect } from "node:tls";
import { parse as parse2 } from "node-html-parser";
var STALE_MS = 540 * 24 * 60 * 60 * 1e3;
var BROKEN_LINK_CAP = 6;
function analyzeLanding(html, base) {
  const root = parse2(html, { blockTextElements: { script: true, noscript: true, style: true } });
  let quickstart = null;
  for (const node of root.querySelectorAll("a, h1, h2, h3")) {
    const text = (node.text || "").replace(/\s+/g, " ").trim();
    if (!/quick\s*start|getting started|get started/i.test(text)) continue;
    const hrefAttr = node.getAttribute("href");
    let href = base;
    if (hrefAttr) {
      try {
        href = new URL(hrefAttr, base).href;
      } catch {
        href = hrefAttr;
      }
    }
    quickstart = { text: text.slice(0, 180), href, source: "link" };
    break;
  }
  if (!quickstart) {
    const title = (root.querySelector("title")?.text || "").replace(/\s+/g, " ").trim();
    if (/quick\s*start|getting started|get started/i.test(title)) {
      quickstart = { text: title.slice(0, 180), href: base, source: "title" };
    }
  }
  if (!quickstart) {
    try {
      const pathName = new URL(base).pathname;
      if (/\/(?:quick-?start|getting-started|get-started)(?:\/|$)/i.test(pathName)) {
        quickstart = { text: pathName, href: base, source: "url" };
      }
    } catch {
    }
  }
  const codeNode = root.querySelector("pre, code");
  let firstCode = null;
  if (codeNode) {
    const snippet = (codeNode.text || "").replace(/\s+/g, " ").trim().slice(0, 240);
    const at = snippet ? html.indexOf(snippet.slice(0, 40)) : -1;
    firstCode = {
      snippet,
      html_fraction: at >= 0 && html.length > 0 ? Number((at / html.length).toFixed(3)) : 0
    };
  }
  const languages = /* @__PURE__ */ new Set();
  const versions = /* @__PURE__ */ new Set();
  const snippets = [];
  const blocks = root.querySelectorAll("pre, code");
  for (const block of blocks) {
    const klass = block.getAttribute("class") || "";
    const lang = /(?:language|lang)-([a-z0-9#+]+)/i.exec(klass);
    if (lang?.[1]) languages.add(lang[1].toLowerCase());
    const text = (block.text || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (snippets.length < 3) snippets.push(text.slice(0, 180));
    for (const match of text.matchAll(/\b(?:v\d+\.\d+(?:\.\d+)?|20\d{2}-\d{2}-\d{2})\b/g)) {
      if (versions.size < 8 && match[0]) versions.add(match[0]);
    }
  }
  const searchNode = root.querySelector('input[type="search"]') || root.querySelector("input[name='q'], input[name='query']") || root.querySelector("[role='search']");
  let search = { present: false, snippet: null, method: null, action: null };
  if (searchNode) {
    const form = searchNode.closest("form");
    const actionAttr = form?.getAttribute("action") || searchNode.getAttribute("action");
    let action = null;
    if (actionAttr) {
      try {
        action = new URL(actionAttr, base).href;
      } catch {
        action = actionAttr;
      }
    }
    search = {
      present: true,
      snippet: (searchNode.toString() || "").slice(0, 300),
      method: (form?.getAttribute("method") || "get").toLowerCase(),
      action
    };
  }
  const dates = [];
  for (const time of root.querySelectorAll("time")) {
    const value = time.getAttribute("datetime") || (time.text || "").trim();
    if (value && dates.length < 8) dates.push(value.slice(0, 80));
  }
  for (const match of html.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)) {
    if (dates.length >= 8) break;
    if (!dates.includes(match[0])) dates.push(match[0]);
  }
  return {
    quickstart,
    first_code: firstCode,
    samples: { count: blocks.length, languages: [...languages], version_markers: [...versions], snippets },
    search,
    visible_dates: dates
  };
}
function interpretReachability(input) {
  if (input.error || input.status == null || input.status === 429 || input.status >= 500) {
    return {
      result: "unknown",
      severity: "info",
      claim: `Reachability of ${input.requested} is unknown: ${input.error?.message ?? input.status_line ?? "no response"}.`
    };
  }
  const hops = input.hops.length ? `${input.hops.length} response${input.hops.length === 1 ? "" : "s"}` : "no hop list";
  const tlsNote = input.tls && typeof input.tls.protocol === "string" ? ` TLS ${input.tls.protocol}${input.tls.authorized === false ? `, not authorized (${String(input.tls.authorization_error)})` : ""}.` : " TLS certificate details were not recorded.";
  if (input.status === 404 || input.status === 410) {
    return {
      result: "fail",
      severity: "medium",
      claim: `${input.status_line} for ${input.final_url} (${hops}). The docs URL is not there.${tlsNote}`
    };
  }
  if (input.status >= 400) {
    return {
      result: "fail",
      severity: "high",
      claim: `${input.status_line} for ${input.final_url} (${hops}).${tlsNote}`
    };
  }
  if (input.tls?.authorized === false) {
    return {
      result: "fail",
      severity: "high",
      claim: `${input.status_line} for ${input.final_url}, but the certificate was not authorized: ${String(input.tls.authorization_error)}.`
    };
  }
  return {
    result: "pass",
    severity: "info",
    claim: `${input.status_line} for ${input.final_url} (${hops}).${tlsNote}`
  };
}
function inspectTls(host) {
  return new Promise((resolve) => {
    const socket = tlsConnect({ host, port: 443, servername: host, timeout: 8e3 }, () => {
      const cert = socket.getPeerCertificate();
      const result = {
        protocol: socket.getProtocol(),
        authorized: socket.authorized,
        authorization_error: socket.authorizationError || null,
        subject_cn: cert.subject?.CN ?? null,
        valid_to: cert.valid_to ?? null,
        valid_from: cert.valid_from ?? null
      };
      socket.end();
      resolve(result);
    });
    socket.on("error", (err) => resolve({ error_name: err.name, error_message: err.message }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ error_name: "Timeout", error_message: "TLS handshake timed out" });
    });
  });
}
async function probeReachability(client, docsUrl) {
  const snap = await client.get(docsUrl, SCANNER_UA);
  let tls = null;
  const final = snap.final_url || docsUrl;
  if (final.startsWith("https://") && !client.aborted) {
    try {
      const host = new URL(final).hostname;
      await client.budget.acquire(`https://${host}/`);
      client.requestCount += 1;
      tls = await inspectTls(host);
    } catch (err) {
      tls = { error_name: err instanceof Error ? err.name : "Error", error_message: err instanceof Error ? err.message : String(err) };
    }
  }
  const interpreted = interpretReachability({
    requested: docsUrl,
    status: snap.status,
    status_line: snap.status_line,
    final_url: final,
    hops: snap.hops,
    error: snap.error ?? null,
    tls
  });
  return stamp({
    probe: "D1",
    result: interpreted.result,
    severity: interpreted.severity,
    claim: interpreted.claim,
    url: final,
    probe_version: PROBE_VERSION,
    evidence: {
      requested: docsUrl,
      final_url: final,
      status_line: snap.status_line,
      hops: snap.hops,
      headers: snap.headers,
      tls,
      error: snap.error ?? null
    }
  });
}
async function probeQuickstart(client, docsUrl, landingHtml) {
  if (landingHtml == null) {
    return stamp({
      probe: "D3",
      result: "unknown",
      severity: "info",
      claim: `Quickstart for ${docsUrl} is unknown: the docs HTML was not available.`,
      url: docsUrl,
      probe_version: PROBE_VERSION,
      evidence: { quickstart: null, first_code: null, scroll_depth: "unknown" }
    });
  }
  const read = analyzeLanding(landingHtml, docsUrl);
  let quickstartPage = null;
  if (read.quickstart && read.quickstart.href !== docsUrl && !client.aborted) {
    quickstartPage = await client.get(read.quickstart.href, SCANNER_UA);
  }
  const pageRead = quickstartPage && observed(quickstartPage) ? analyzeLanding(quickstartPage.body, quickstartPage.final_url) : null;
  const code = pageRead?.first_code ?? read.first_code;
  const where = code ? `The first code element in raw HTML is at ${code.html_fraction} of the document. Scroll depth is unknown without a headless browser.` : "No code element was in the raw HTML. Scroll depth is unknown without a headless browser.";
  const located = read.quickstart ? read.quickstart.source === "title" ? `Quickstart page: the document title is "${read.quickstart.text}".` : read.quickstart.source === "url" ? `Quickstart page: the URL is ${read.quickstart.href}.` : `Quickstart link: ${read.quickstart.text} \u2192 ${read.quickstart.href}.` : "No quickstart or getting-started link, heading, or title was in the raw HTML.";
  const result = read.quickstart ? "pass" : "fail";
  return stamp({
    probe: "D3",
    result,
    severity: result === "fail" ? "medium" : "info",
    claim: `${located} ${where}`,
    url: read.quickstart?.href ?? docsUrl,
    probe_version: PROBE_VERSION,
    evidence: {
      quickstart: read.quickstart,
      first_code: code,
      quickstart_status_line: quickstartPage?.status_line ?? null,
      scroll_depth: "unknown",
      scroll_depth_note: "Scroll position needs a headless browser. This build records document order only."
    }
  });
}
function probeCodeSamples(docsUrl, html) {
  const read = analyzeLanding(html, docsUrl);
  const { count, languages, version_markers, snippets } = read.samples;
  const result = count > 0 ? "pass" : "fail";
  return stamp({
    probe: "D4",
    result,
    severity: result === "fail" ? "medium" : "info",
    claim: count > 0 ? `${count} code elements on ${docsUrl}. Languages: ${languages.join(", ") || "none marked"}. Version markers: ${version_markers.join(", ") || "none"}.` : `No code elements on ${docsUrl}.`,
    url: docsUrl,
    probe_version: PROBE_VERSION,
    evidence: { count, languages, version_markers, snippets }
  });
}
async function probeSearch(client, docsUrl, landingHtml) {
  const read = analyzeLanding(landingHtml ?? "", docsUrl);
  if (!read.search.present) {
    return stamp({
      probe: "D5",
      result: "fail",
      severity: "medium",
      claim: `No search control in the raw HTML of ${docsUrl}.`,
      url: docsUrl,
      probe_version: PROBE_VERSION,
      evidence: { search: read.search }
    });
  }
  if (read.search.method !== "get" || !read.search.action) {
    return stamp({
      probe: "D5",
      result: "unknown",
      severity: "info",
      claim: `A search control is in the HTML of ${docsUrl}, but whether it runs is unknown without a headless browser. The scanner does not submit POST forms.`,
      url: docsUrl,
      probe_version: PROBE_VERSION,
      evidence: { search: read.search, functional: "unknown" }
    });
  }
  const target = new URL(read.search.action);
  if (!target.searchParams.has("q") && !target.searchParams.has("query")) target.searchParams.set("q", "devradar");
  const snap = await client.get(target.href, SCANNER_UA);
  if (!observed(snap)) {
    return stamp({
      probe: "D5",
      result: "unknown",
      severity: "info",
      claim: `Search at ${target.href} is unknown: ${snap.error?.message ?? snap.status_line}.`,
      url: target.href,
      probe_version: PROBE_VERSION,
      evidence: { search: read.search, status_line: snap.status_line, error: snap.error ?? null }
    });
  }
  return stamp({
    probe: "D5",
    result: snap.status && snap.status < 400 ? "pass" : "fail",
    severity: snap.status && snap.status < 400 ? "info" : "medium",
    claim: `Search GET ${target.href} returned ${snap.status_line}.`,
    url: target.href,
    probe_version: PROBE_VERSION,
    evidence: { search: read.search, status_line: snap.status_line, final_url: snap.final_url, body_excerpt: snap.body.slice(0, 400) }
  });
}
function extractLastmods(xml) {
  const out = [];
  const re = /<url>\s*([\s\S]*?)<\/url>/gi;
  let match;
  while (match = re.exec(xml)) {
    const block = match[1] ?? "";
    const loc = /<loc>\s*([^<]+?)\s*<\/loc>/i.exec(block)?.[1]?.replace(/&amp;/g, "&").trim();
    const lastmod = /<lastmod>\s*([^<]+?)\s*<\/lastmod>/i.exec(block)?.[1]?.trim();
    if (loc && lastmod && out.length < 80) out.push({ url: loc, lastmod });
  }
  return out;
}
function interpretFreshness(input) {
  const parsed = input.lastmods.map((row) => ({ ...row, at: Date.parse(row.lastmod) })).filter((row) => Number.isFinite(row.at));
  const visible = input.visibleDates.map((value) => ({ value, at: Date.parse(value) })).filter((row) => Number.isFinite(row.at));
  if (parsed.length === 0 && visible.length === 0) {
    return {
      result: "unknown",
      severity: "info",
      claim: `Last-updated signals for ${input.docsUrl} are unknown: no sitemap lastmod and no parseable visible date.`
    };
  }
  const stale = [...parsed, ...visible].filter((row) => input.now - row.at > STALE_MS);
  const oldest = [...parsed].sort((a, b) => a.at - b.at)[0];
  if (stale.length > 0) {
    return {
      result: "fail",
      severity: "medium",
      claim: `${stale.length} dates are older than 18 months.${oldest ? ` Oldest lastmod ${oldest.lastmod} on ${oldest.url}.` : ""}`
    };
  }
  return {
    result: "pass",
    severity: "info",
    claim: `${parsed.length} sitemap lastmod values and ${visible.length} visible dates.${oldest ? ` Oldest lastmod ${oldest.lastmod}.` : ""} ${stale.length} are older than 18 months.`
  };
}
function probeFreshness(input) {
  const lastmods = input.sitemapXml.flatMap((xml) => extractLastmods(xml));
  const visible = analyzeLanding(input.landingHtml ?? "", input.docsUrl).visible_dates;
  const interpreted = interpretFreshness({ docsUrl: input.docsUrl, lastmods, visibleDates: visible, now: input.now });
  return stamp({
    probe: "D6",
    result: interpreted.result,
    severity: interpreted.severity,
    claim: interpreted.claim,
    url: input.docsUrl,
    probe_version: PROBE_VERSION,
    evidence: { lastmods: lastmods.slice(0, 40), visible_dates: visible }
  });
}
function interpretStructure(input) {
  if (input.sitemapCount == null) {
    return {
      result: "unknown",
      severity: "info",
      claim: `Page count and depth for ${input.docsUrl} are unknown: the sitemap was not read.`,
      depth: null,
      orphans: []
    };
  }
  const rootSegments = new URL(input.docsUrl).pathname.split("/").filter(Boolean).length;
  let depth = 0;
  for (const url of input.sampleUrls) {
    try {
      const segments2 = new URL(url).pathname.split("/").filter(Boolean).length - rootSegments;
      if (segments2 > depth) depth = segments2;
    } catch {
      continue;
    }
  }
  const crawledKeys = new Set(input.crawled.map(siteKey).filter((key) => Boolean(key)));
  const orphans = input.sampleComplete ? input.sampleUrls.filter((url) => {
    const key = siteKey(url);
    return key && !crawledKeys.has(key);
  }) : [];
  const orphanNote = input.sampleComplete ? `${orphans.length} sitemap URLs were not in the two-level crawl.` : "Orphan pages are unknown because the sitemap sample was truncated.";
  return {
    result: "pass",
    severity: "info",
    claim: `${input.sitemapCount} docs URLs in the sitemap. Deepest sampled path is ${depth} level${depth === 1 ? "" : "s"} under the docs root. ${orphanNote}`,
    depth,
    orphans: orphans.slice(0, 30)
  };
}
function siteKey(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  const parsed = new URL(normalized);
  const hostname = parsed.hostname.replace(/^www\./, "");
  const port = parsed.port ? `:${parsed.port}` : "";
  return `${parsed.protocol}//${hostname}${port}${parsed.pathname}`;
}
function probeStructure(docsUrl, p7Evidence) {
  if (!p7Evidence) {
    const interpreted2 = interpretStructure({
      docsUrl,
      sitemapCount: null,
      sampleUrls: [],
      crawled: [],
      sampleComplete: false
    });
    return stamp({
      probe: "D2",
      result: interpreted2.result,
      severity: interpreted2.severity,
      claim: interpreted2.claim,
      url: docsUrl,
      probe_version: PROBE_VERSION,
      evidence: { sitemap_docs_url_count: null }
    });
  }
  const count = typeof p7Evidence.sitemap_docs_url_count === "number" ? p7Evidence.sitemap_docs_url_count : null;
  const sample = Array.isArray(p7Evidence.sitemap_docs_url_sample) ? p7Evidence.sitemap_docs_url_sample.filter((item) => typeof item === "string") : [];
  const crawled = Array.isArray(p7Evidence.crawled_urls) ? p7Evidence.crawled_urls.filter((item) => typeof item === "string") : [];
  const interpreted = interpretStructure({
    docsUrl,
    sitemapCount: count,
    sampleUrls: sample,
    crawled,
    sampleComplete: count != null && sample.length >= count
  });
  return stamp({
    probe: "D2",
    result: interpreted.result,
    severity: interpreted.severity,
    claim: interpreted.claim,
    url: docsUrl,
    probe_version: PROBE_VERSION,
    evidence: {
      sitemap_docs_url_count: count,
      depth: interpreted.depth,
      orphans: interpreted.orphans,
      sample_complete: count != null && sample.length >= count
    }
  });
}
async function probeBrokenLinks(client, docsUrl, landingHtml) {
  const links = extractLinks(landingHtml ?? "", docsUrl).filter((href) => {
    if (!isDocsUrl(href, docsUrl)) return false;
    const key = siteKey(href);
    const root = siteKey(docsUrl);
    return key && key !== root;
  });
  const unique = [];
  const seen = /* @__PURE__ */ new Set();
  for (const link of links) {
    const key = siteKey(link);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(link);
    if (unique.length >= BROKEN_LINK_CAP) break;
  }
  if (unique.length === 0) {
    return stamp({
      probe: "D7",
      result: "unknown",
      severity: "info",
      claim: `Broken-link check for ${docsUrl} is unknown: the landing HTML had no further docs links.`,
      url: docsUrl,
      probe_version: PROBE_VERSION,
      evidence: { checked: [] }
    });
  }
  const checked = [];
  for (const link of unique) {
    if (client.aborted) break;
    const snap = await client.get(link, SCANNER_UA);
    checked.push({ url: snap.final_url || link, status_line: snap.status_line, error: snap.error ?? null });
  }
  if (client.aborted && checked.length < unique.length) {
    return stamp({
      probe: "D7",
      result: "unknown",
      severity: "info",
      claim: `Broken-link check stopped: ${client.aborted.reason}`,
      url: docsUrl,
      probe_version: PROBE_VERSION,
      evidence: { checked }
    });
  }
  const broken = checked.filter((row) => /HTTP 404|HTTP 410/.test(row.status_line ?? ""));
  return stamp({
    probe: "D7",
    result: broken.length ? "fail" : "pass",
    severity: broken.length ? "medium" : "info",
    claim: broken.length ? `${broken.length} of ${checked.length} sampled docs links returned 404 or 410. ${broken.map((row) => `${row.status_line} ${row.url}`).join("; ")}.` : `${checked.length} sampled docs links responded without a 404 or 410.`,
    url: docsUrl,
    probe_version: PROBE_VERSION,
    evidence: { checked, broken }
  });
}

// src/probes/later.ts
var CATEGORIES = [
  {
    id: "payments",
    label: "payments",
    topic: "javascript",
    phrases: ["payment intent", "checkout session"],
    terms: ["payments", "billing", "invoice", "subscription"],
    competitors: [
      { name: "Adyen", docsUrl: "https://docs.adyen.com/" },
      { name: "Braintree", docsUrl: "https://developer.paypal.com/braintree/docs" },
      { name: "Square", docsUrl: "https://developer.squareup.com/docs" }
    ]
  },
  {
    id: "vector",
    label: "vector and retrieval",
    topic: "data",
    phrases: ["vector database", "vector search"],
    terms: ["embedding", "embeddings", "retrieval", "rag"],
    competitors: [
      { name: "Pinecone", docsUrl: "https://docs.pinecone.io/" },
      { name: "Weaviate", docsUrl: "https://docs.weaviate.io/" },
      { name: "Qdrant", docsUrl: "https://qdrant.tech/documentation/" }
    ]
  },
  {
    id: "auth",
    label: "authentication",
    topic: "javascript",
    phrases: ["single sign-on", "oauth 2"],
    terms: ["authentication", "oauth", "saml", "passkey"],
    competitors: [
      { name: "Auth0", docsUrl: "https://auth0.com/docs" },
      { name: "Stytch", docsUrl: "https://stytch.com/docs" },
      { name: "WorkOS", docsUrl: "https://workos.com/docs" }
    ]
  },
  {
    id: "database",
    label: "databases",
    topic: "data",
    phrases: ["row level security", "connection pooling"],
    terms: ["postgres", "postgresql", "database", "sql"],
    competitors: [
      { name: "Neon", docsUrl: "https://neon.com/docs/introduction" },
      { name: "PlanetScale", docsUrl: "https://planetscale.com/docs" },
      { name: "MongoDB", docsUrl: "https://www.mongodb.com/docs/" }
    ]
  },
  {
    id: "communications",
    label: "communications",
    topic: "javascript",
    phrases: ["programmable sms", "send an sms"],
    terms: ["sms", "messaging", "voice api", "webhook"],
    competitors: [
      { name: "Vonage", docsUrl: "https://developer.vonage.com/" },
      { name: "MessageBird", docsUrl: "https://developers.messagebird.com/docs" },
      { name: "Sinch", docsUrl: "https://developers.sinch.com/docs" }
    ]
  },
  {
    id: "hosting",
    label: "hosting and edge",
    topic: "devops",
    phrases: ["edge network", "serverless function"],
    terms: ["cdn", "workers", "deploy", "serverless"],
    competitors: [
      { name: "Netlify", docsUrl: "https://docs.netlify.com/" },
      { name: "Vercel", docsUrl: "https://vercel.com/docs" },
      { name: "Fastly", docsUrl: "https://www.fastly.com/documentation/" }
    ]
  }
];
var PROGRAM_PHRASES = ["ambassador", "office hours", "community"];
function visibleText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function excerptAround(text, needle) {
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return null;
  const start = Math.max(0, at - 48);
  return text.slice(start, at + needle.length + 48).trim();
}
function inferCompetitors(text, selfDomain) {
  let best = null;
  for (const category of CATEGORIES) {
    const hits = [];
    let score = 0;
    for (const phrase of category.phrases) {
      const excerpt = excerptAround(text, phrase);
      if (!excerpt) continue;
      hits.push({ term: phrase, excerpt });
      score += 2;
    }
    for (const term of category.terms) {
      const excerpt = excerptAround(text, term);
      if (!excerpt) continue;
      hits.push({ term, excerpt });
      score += 1;
    }
    if (score >= 2 && (!best || score > best.score)) best = { category, hits, score };
  }
  if (!best) return null;
  const competitors = best.category.competitors.map((row) => ({ name: row.name, docsUrl: row.docsUrl, domain: registrableDomain(new URL(row.docsUrl).hostname) })).filter((row) => row.domain !== selfDomain).slice(0, 3);
  if (competitors.length === 0) return null;
  return { category: best.category, hits: best.hits.slice(0, 6), competitors };
}
function competitorsFromCorrection(urls, selfDomain) {
  const out = [];
  for (const raw of urls) {
    try {
      const url = new URL(raw);
      const domain = registrableDomain(url.hostname);
      if (domain === selfDomain || out.some((row) => row.domain === domain)) continue;
      out.push({ name: url.hostname, docsUrl: url.href, domain });
    } catch {
      continue;
    }
    if (out.length >= 3) break;
  }
  return out;
}
function tagged(probe, result, severity, claim, url, evidence, tier, inferredFrom) {
  const finding = stamp({ probe, result, severity, claim, url, probe_version: PROBE_VERSION, evidence });
  if (tier === "inferred") finding.inferredFrom = inferredFrom;
  finding.tier = tier;
  return finding;
}
function probeCategory(docsUrl, text, selfDomain, correction) {
  const inferred = inferCompetitors(text, selfDomain);
  const corrected = correction?.length ? competitorsFromCorrection(correction, selfDomain) : [];
  const competitors = corrected.length ? corrected : inferred?.competitors ?? [];
  const category = inferred?.category.id ?? null;
  const topic = inferred?.category.topic ?? "javascript";
  if (competitors.length === 0) {
    return {
      category,
      topic,
      competitors,
      finding: tagged(
        "C1",
        "unknown",
        "info",
        `Competitors for ${docsUrl} are unknown: the docs text did not match a category we can source from public pages.`,
        docsUrl,
        { docs_url: docsUrl, text_sample: text.slice(0, 400), categories_checked: CATEGORIES.map((row) => row.id) },
        "verified"
      )
    };
  }
  const fromCorrection = corrected.length > 0;
  const hits = inferred?.hits ?? [];
  return {
    category,
    topic,
    competitors,
    finding: tagged(
      "C1",
      "pass",
      "info",
      fromCorrection ? `Using ${competitors.map((row) => row.name).join(", ")} because those docs URLs were submitted for this scan.` : `Inferred ${inferred?.category.label} from the docs text. Public docs to compare: ${competitors.map((row) => row.name).join(", ")}.`,
      docsUrl,
      {
        category: inferred?.category.label ?? null,
        terms: hits,
        competitors,
        correction: fromCorrection ? correction : null
      },
      "inferred",
      fromCorrection ? ["visitor submitted competitor docs URLs", ...hits.map((hit) => hit.excerpt)] : hits.map((hit) => `${hit.term}: ${hit.excerpt}`)
    )
  };
}
async function probeOneCompetitor(client, subjectUrl, competitor, index) {
  const probe = ["C2", "C3", "C4"][index] ?? "C4";
  if (!competitor) {
    return tagged(probe, "unknown", "info", `${probe} is unknown: fewer than ${index + 1} competitors were inferred.`, subjectUrl, { index }, "verified");
  }
  const docs = await client.get(competitor.docsUrl, SCANNER_UA);
  let robots = null;
  let llms = null;
  if (observed(docs)) {
    const origin = new URL(docs.final_url || competitor.docsUrl);
    const robotsUrl = new URL("/robots.txt", origin).href;
    const llmsUrl = new URL("/llms.txt", origin).href;
    const robotsSnap = await client.get(robotsUrl, SCANNER_UA);
    const llmsSnap = await client.get(llmsUrl, SCANNER_UA);
    robots = { url: robotsUrl, status_line: robotsSnap.status_line, error: robotsSnap.error?.message ?? null };
    llms = { url: llmsUrl, status_line: llmsSnap.status_line, error: llmsSnap.error?.message ?? null };
  }
  if (!observed(docs)) {
    return tagged(
      probe,
      "unknown",
      "info",
      `${competitor.name} docs are unknown: ${docs.error?.message ?? docs.status_line ?? "no response"}.`,
      competitor.docsUrl,
      { competitor, status_line: docs.status_line, error: docs.error ?? null },
      "verified"
    );
  }
  const text = visibleText(docs.body);
  const program = PROGRAM_PHRASES.flatMap((phrase) => {
    const excerpt = excerptAround(text, phrase);
    return excerpt ? [{ phrase, excerpt }] : [];
  });
  return tagged(
    probe,
    "pass",
    "info",
    `${competitor.name} docs returned ${docs.status_line}. llms.txt ${llms?.status_line ?? "was not fetched"}. ${program.length ? `The page mentions ${program.map((row) => row.phrase).join(", ")}.` : "The fetched page does not mention an ambassador program, office hours, or a community."}`,
    competitor.docsUrl,
    {
      competitor,
      status_line: docs.status_line,
      final_url: docs.final_url,
      body_excerpt: docs.body.slice(0, 400),
      robots,
      llms,
      program_mentions: program
    },
    "verified"
  );
}
function selectConferences(rows, now) {
  const start = now;
  const end = now + 365 * 24 * 60 * 60 * 1e3;
  const upcoming = rows.filter((row) => {
    const at = Date.parse(row.startDate ?? "");
    return Number.isFinite(at) && at >= start && at <= end;
  });
  const openCfp = upcoming.filter((row) => {
    const at = Date.parse(row.cfpEndDate ?? "");
    return Number.isFinite(at) && at >= start;
  });
  return { upcoming, openCfp };
}
async function probeEvents(client, docsUrl, topic, now) {
  const years = [new Date(now).getUTCFullYear(), new Date(now).getUTCFullYear() + 1];
  const fetched = [];
  const rows = [];
  for (const year of years) {
    const url = `https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/${year}/${topic}.json`;
    const snap = await client.get(url, SCANNER_UA);
    fetched.push({ url, status_line: snap.status_line, error: snap.error?.message ?? null });
    if (!observed(snap) || snap.status !== 200) continue;
    try {
      const parsed = JSON.parse(snap.body);
      if (Array.isArray(parsed)) rows.push(...parsed);
    } catch {
      fetched[fetched.length - 1].error = "the body was not a JSON array";
    }
  }
  if (rows.length === 0) {
    return tagged(
      "E1",
      "unknown",
      "info",
      `Events for ${docsUrl} are unknown: the public conference files for ${topic} did not return a list.`,
      docsUrl,
      { topic, fetched },
      "verified"
    );
  }
  const selected = selectConferences(rows, now);
  const sample = selected.openCfp[0] ?? selected.upcoming[0] ?? null;
  const names = selected.upcoming.slice(0, 3).map((row) => row.name).filter(Boolean);
  return tagged(
    "E1",
    "pass",
    selected.openCfp.length ? "medium" : "info",
    `${selected.upcoming.length} ${topic} conferences in the public dataset start in the next 12 months. ${selected.openCfp.length} list a cfpEndDate that is still ahead.${names.length ? ` First: ${names.join(", ")}.` : ""}`,
    sample?.url || docsUrl,
    {
      topic,
      fetched,
      upcoming_count: selected.upcoming.length,
      open_cfp_count: selected.openCfp.length,
      upcoming: selected.upcoming.slice(0, 40),
      open_cfp: selected.openCfp.slice(0, 20),
      dataset_fields: rows[0] ? Object.keys(rows[0]) : []
    },
    "verified"
  );
}
function probeSpeakers(docsUrl, fields) {
  const hasSpeakers = fields.some((field) => /speaker|talk|presenter/i.test(field));
  if (hasSpeakers) {
    return tagged("E2", "unknown", "info", "Speaker fields exist on the dataset but this build does not compare them yet.", docsUrl, { dataset_fields: fields }, "verified");
  }
  return tagged(
    "E2",
    "unknown",
    "info",
    "Where competitors spoke is unknown: the public conference dataset has no speaker or talk fields, so that comparison was not invented.",
    docsUrl,
    { dataset_fields: fields, source: "https://github.com/tech-conferences/conference-data" },
    "verified"
  );
}
function githubRepoFromText(text) {
  const match = /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/.exec(text);
  if (!match?.[1] || !match[2]) return null;
  const repo = match[2].replace(/\.git$/, "");
  if (["topics", "orgs", "features", "customer-stories", "about"].includes(match[1])) return null;
  if (["issues", "pulls", "blob", "tree"].includes(repo)) return null;
  return { owner: match[1], repo };
}
async function probePersona(client, docsUrl, text) {
  const quotes = ["quickstart", "getting started", "for developers", "for enterprises"].flatMap((phrase) => {
    const excerpt = excerptAround(text, phrase);
    return excerpt ? [`${phrase}: ${excerpt}`] : [];
  }).slice(0, 4);
  const repo = githubRepoFromText(text);
  if (!repo) {
    if (quotes.length === 0) {
      return tagged(
        "N1",
        "unknown",
        "info",
        `Personas for ${docsUrl} are unknown: the docs text has no GitHub repository link and no audience phrase this probe recognizes.`,
        docsUrl,
        { text_sample: text.slice(0, 400) },
        "verified"
      );
    }
    return tagged(
      "N1",
      "pass",
      "info",
      "One persona is inferred from the docs wording alone. No GitHub issue sample was available.",
      docsUrl,
      { quotes, github: null },
      "inferred",
      quotes
    );
  }
  const issuesUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/issues?state=all&per_page=20`;
  const snap = await client.get(issuesUrl, SCANNER_UA);
  if (!observed(snap) || snap.status !== 200) {
    return tagged(
      "N1",
      "unknown",
      "info",
      `Personas for ${docsUrl} are unknown: GitHub issues for ${repo.owner}/${repo.repo} returned ${snap.status_line ?? snap.error?.message}.`,
      issuesUrl,
      { repo, status_line: snap.status_line, error: snap.error ?? null, quotes },
      "verified"
    );
  }
  let issues = [];
  try {
    const parsed = JSON.parse(snap.body);
    if (Array.isArray(parsed)) issues = parsed;
  } catch {
    return tagged("N1", "unknown", "info", `Personas for ${docsUrl} are unknown: GitHub returned a body that was not a JSON array.`, issuesUrl, { status_line: snap.status_line, body_excerpt: snap.body.slice(0, 200) }, "verified");
  }
  const logins = issues.map((issue) => issue.user?.login).filter((login) => Boolean(login));
  const once = logins.filter((login) => logins.filter((item) => item === login).length === 1);
  const titles = issues.map((issue) => issue.title).filter((title) => Boolean(title)).slice(0, 5);
  const inferredFrom = [
    ...quotes,
    `${once.length} of ${logins.length} sampled issue authors appear once in https://api.github.com/repos/${repo.owner}/${repo.repo}/issues`,
    ...titles.map((title) => `issue title: ${title}`)
  ];
  return tagged(
    "N1",
    "pass",
    "info",
    `Inferred reader: someone who files or reads GitHub issues on ${repo.owner}/${repo.repo}. ${once.length} of ${logins.length} sampled authors appear once. Docs phrases: ${quotes.length ? quotes.map((quote) => quote.split(":")[0]).join(", ") : "none matched"}.`,
    issuesUrl,
    { repo, quotes, titles, authors: logins, once_count: once.length, sample_size: logins.length, status_line: snap.status_line },
    "inferred",
    inferredFrom
  );
}
function probeTargeting(docsUrl, subjectText, competitorText, prior) {
  const gaps = [];
  const vocab = ["quickstart", "sdk", "webhook", "changelog", "migration", "deprecat", "openapi", "llms.txt"];
  const subject = subjectText.toLowerCase();
  for (const term of vocab) {
    if (subject.includes(term)) continue;
    for (const competitor of competitorText) {
      const excerpt = excerptAround(competitor.text, term);
      if (!excerpt) continue;
      gaps.push({ term, name: competitor.name, url: competitor.url, excerpt });
      break;
    }
  }
  const actions = [];
  for (const finding of prior) {
    if (actions.length >= 3) break;
    if (finding.probe === "P2" && finding.result === "fail") {
      actions.push({ action: "Make the ClaudeBot and GPTBot responses match the browser response, or say why they differ.", because: finding.claim });
    } else if (finding.probe === "P5" && finding.result === "fail") {
      actions.push({ action: "Publish llms.txt at the docs origin.", because: finding.claim });
    } else if (finding.probe === "D7" && finding.result === "fail") {
      actions.push({ action: "Fix the broken docs links named in the stage 1 finding.", because: finding.claim });
    } else if (finding.probe === "P1" && finding.result === "fail") {
      actions.push({ action: "Revisit the robots.txt agent rules quoted in the stage 2 finding.", because: finding.claim });
    }
  }
  if (gaps[0] && actions.length < 3) {
    actions.push({ action: `Consider the term \u201C${gaps[0].term}\u201D, which appears on ${gaps[0].name} and not in this docs text.`, because: gaps[0].excerpt });
  }
  if (actions.length === 0 && gaps.length === 0) {
    return tagged(
      "T1",
      "unknown",
      "info",
      `Targeting for ${docsUrl} is unknown: no vocabulary gap and no failed check to tie an action to.`,
      docsUrl,
      { gaps, prior_probes: prior.map((row) => row.probe) },
      "verified"
    );
  }
  return tagged(
    "T1",
    "pass",
    "info",
    `${actions.length} action${actions.length === 1 ? "" : "s"} inferred from findings and docs text already fetched. ${gaps.length} category terms show up on a competitor page and not in this docs text.`,
    docsUrl,
    { actions, gaps: gaps.slice(0, 8) },
    "inferred",
    [...actions.map((action) => action.because), ...gaps.slice(0, 4).map((gap) => `${gap.term} on ${gap.url}: ${gap.excerpt}`)]
  );
}
function probeAssembly(docsUrl, findings, ceiling) {
  const byStage = {};
  for (const finding of findings) {
    const row = byStage[finding.stage] ?? { pass: 0, fail: 0, unknown: 0 };
    if (finding.result === "fail") row.fail += 1;
    else if (finding.result === "unknown") row.unknown += 1;
    else row.pass += 1;
    byStage[finding.stage] = row;
  }
  return tagged(
    "R1",
    ceiling ? "unknown" : "pass",
    "info",
    ceiling ? `The report was assembled after the 150 second ceiling. Checks that had not finished are unknown.` : `Assembled ${findings.length} findings across stages 1\u20137.`,
    docsUrl,
    { ceiling, counts: byStage, finding_ids: findings.map((row) => `${row.stage}:${row.probe}:${row.result}`) },
    "verified"
  );
}

// src/model.ts
import { createHash } from "node:crypto";
var STAGE_PLAN = [
  { stage: 1, name: "Docs", live: true },
  { stage: 2, name: "Agent readiness", live: true },
  { stage: 3, name: "Competitors", live: true },
  { stage: 4, name: "Events", live: true },
  { stage: 5, name: "Personas", live: true },
  { stage: 6, name: "Targeting", live: true },
  { stage: 7, name: "Report", live: true }
];
var InferredFindingError = class extends Error {
  constructor() {
    super("an inferred finding requires inferred_from");
    this.name = "InferredFindingError";
  }
};
function inferredFromPresent(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}
function assertFindingRecord(record) {
  if (!record.evidence || typeof record.evidence !== "object" || Array.isArray(record.evidence)) {
    throw new Error("finding requires an evidence object");
  }
  if (Object.keys(record.evidence).length === 0) {
    throw new Error("finding requires a non-empty evidence object");
  }
  if (record.tier === "inferred" && !inferredFromPresent(record.inferred_from)) {
    throw new InferredFindingError();
  }
}
function schemaSeverity(result, severity) {
  if (result === "pass") return "clear";
  if (result === "unknown") return "low";
  if (severity === "highest" || severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}
function toFindingRecord(input) {
  const record = {
    id: createHash("sha256").update(`${input.scanId}:${input.stage}:${input.finding.probe}:${input.finding.timestamp}:${input.finding.claim}`).digest("hex").slice(0, 24),
    scan_id: input.scanId,
    stage: input.stage,
    probe: input.finding.probe,
    severity: schemaSeverity(input.finding.result, input.finding.severity),
    tier: input.tier ?? "verified",
    gated: input.gated ?? false,
    headline: input.finding.claim,
    body: null,
    evidence: input.finding.evidence,
    inferred_from: input.inferredFrom ?? null,
    captured_at: input.finding.timestamp,
    result: input.finding.result,
    url: input.finding.url,
    probe_version: input.finding.probe_version
  };
  assertFindingRecord(record);
  return record;
}

// src/report/page.ts
var CSS = `
:root {
  --ground: #0B0E13;
  --panel: #141A22;
  --line: #222C38;
  --ink: #E6EBF2;
  --muted: #8A97A8;
  --dim: #5A6676;
  --high: #FF6B5A;
  --med: #F0A830;
  --clear: #4ECB8F;
  --info: #5B9BFF;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html { background: var(--ground); color: var(--ink); }
body {
  margin: 0;
  font-family: Archivo, "Helvetica Neue", sans-serif;
  font-weight: 600;
  font-size: 16px;
  line-height: 1.45;
}
a { color: var(--info); }
.wrap { max-width: 760px; margin: 0 auto; padding: 22px 24px 48px; }
.screen > .wrap { max-width: 980px; }
.wrap.wide { max-width: 1080px; }
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
}
.top nav { display: flex; gap: 22px; align-items: center; }
.top nav a { color: var(--muted); text-decoration: none; font-weight: 600; font-size: 15px; }
.top .host, .top .meta {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-weight: 400;
  font-size: 13px;
  color: var(--muted);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  text-decoration: none;
  font-weight: 700;
  letter-spacing: -0.03em;
  font-size: 20px;
}
.brand img { width: 28px; height: 28px; border-radius: 3px; display: block; }
.brand span em { font-style: normal; color: var(--info); }
.screen { min-height: 100vh; display: flex; flex-direction: column; }
.screen .grow { flex: 1; }
.hero { text-align: center; padding: 64px 0 8px; }
.kicker {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-weight: 500;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 14px;
}
.hero h1, .report-head h1 {
  font-weight: 700;
  font-size: 64px;
  letter-spacing: -0.045em;
  line-height: 0.98;
  margin: 0 0 18px;
}
.lede { color: var(--muted); font-weight: 500; max-width: 38em; margin: 0 auto 28px; font-size: 18px; }
.scan { margin: 0 auto 10px; max-width: 640px; }
.scan-row { display: flex; gap: 8px; }
.scan input {
  flex: 1;
  min-width: 0;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-weight: 400;
  font-size: 16px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--panel);
  color: var(--ink);
}
.scan input::placeholder { color: var(--dim); }
.scan button, a.go, button.go {
  font-family: Archivo, "Helvetica Neue", sans-serif;
  font-weight: 700;
  font-size: 16px;
  background: var(--clear);
  color: var(--ground);
  border: 0;
  border-radius: 3px;
  padding: 14px 18px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  white-space: nowrap;
}
a.go.quiet, button.go.quiet { background: transparent; color: var(--ink); border: 1px solid var(--line); }
.hint { color: var(--dim); font-weight: 500; font-size: 14px; margin: 10px 0 26px; }
.scan-error { color: var(--ink); background: var(--panel); border-radius: 3px; padding: 10px 12px; border: 1px solid var(--high); text-align: left; }
.stage-row {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 0 16px;
  margin: 8px auto 36px;
  padding: 0;
  list-style: none;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-weight: 400;
  font-size: 12px;
  color: var(--muted);
  max-width: 920px;
}
.callout {
  max-width: 640px;
  margin: 0 auto;
  text-align: left;
  background: var(--panel);
  border-radius: 3px;
  border-left: 3px solid var(--clear);
  padding: 16px 18px 14px;
}
.callout .kicker { margin-bottom: 8px; }
.callout .find { margin: 0 0 8px; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
.callout .quote { margin: 0; color: var(--muted); font-weight: 500; }
.phone { display: none; }
.bar-foot {
  margin-top: auto;
  border-top: 1px solid var(--line);
}
.bar-foot .wrap { padding-top: 16px; padding-bottom: 16px; }
.foot-row { display: flex; justify-content: space-between; gap: 16px; color: var(--dim); font-size: 13px; font-weight: 500; }
.foot-row p { margin: 0; }
.how { padding-top: 28px; }
.how h2 { font-size: 22px; letter-spacing: -0.03em; margin: 0 0 8px; }
.prose { color: var(--muted); font-weight: 500; max-width: 62ch; }
.banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 8px 0 18px;
  padding: 12px 14px;
  background: #2A1412;
  border-radius: 3px;
  color: var(--ink);
  font-weight: 600;
}
.banner p { margin: 0; flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.banner a { color: var(--ink); white-space: nowrap; font-weight: 600; }
.wizard { display: grid; grid-template-columns: 300px 1fr; gap: 28px; align-items: start; }
.rail-head, .findings-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin: 0 0 10px;
}
.rail-head h2, .findings-head h2 { margin: 0; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; font-family: "IBM Plex Mono", ui-monospace, monospace; font-weight: 500; color: var(--muted); }
.rail { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.rail li {
  display: grid;
  grid-template-columns: 22px 1fr auto;
  gap: 8px;
  align-items: baseline;
  padding: 7px 0;
  font-size: 15px;
}
.rail .idx { font-family: "IBM Plex Mono", ui-monospace, monospace; color: var(--dim); font-size: 12px; }
.rail .name { color: var(--ink); font-weight: 600; }
.rail .status { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 12px; color: var(--muted); text-transform: lowercase; }
.rail li.done .status { color: var(--clear); }
.rail li.running .status { color: var(--info); }
.rail li.unknown .status { color: var(--info); }
.rail li.queued .name, .rail li.queued .status { color: var(--dim); }
.honest { color: var(--dim); font-weight: 500; font-size: 13px; margin: 14px 0 0; }
.finding {
  margin: 0 0 12px;
  padding: 14px 14px 12px 16px;
  background: var(--panel);
  border-radius: 3px;
  border-left: 4px solid var(--info);
}
.finding.fail.high, .finding.fail.highest { border-left-color: var(--high); }
.finding.fail.medium { border-left-color: var(--med); }
.finding.fail.low { border-left-color: var(--med); }
.finding.pass { border-left-color: var(--clear); }
.finding.unknown { border-left-color: var(--info); }
.finding.tier-inferred { border-style: dashed; background: transparent; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
.chip { border-radius: 3px; padding: 2px 6px; }
.chip.sev-high, .chip.sev-highest { background: var(--high); color: #1A0C0A; }
.chip.sev-unknown { background: var(--info); color: #061426; }
.chip.sev-medium, .chip.sev-low { background: var(--med); color: #1A1204; }
.chip.sev-clear, .chip.result-pass { background: var(--clear); color: #062116; }
.chip.result-unknown, .chip.sev-info { background: var(--info); color: #061426; }
.chip.tier { background: transparent; color: var(--muted); border: 1px solid var(--line); }
.finding.tier-inferred .chip.tier { border-style: dashed; color: var(--med); }
.finding h2 {
  margin: 8px 0;
  font-weight: 600;
  font-size: 18px;
  letter-spacing: -0.02em;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ev { margin: 0; padding: 0; list-style: none; font-family: "IBM Plex Mono", ui-monospace, monospace; font-weight: 400; font-size: 12px; color: var(--muted); }
.ev li { margin: 2px 0; }
.when { color: var(--dim); font-family: "IBM Plex Mono", ui-monospace, monospace; font-weight: 400; font-size: 12px; margin: 8px 0 0; }
pre, .mono { font-family: "IBM Plex Mono", ui-monospace, monospace; font-weight: 400; }
pre {
  font-size: 12px;
  line-height: 1.45;
  background: var(--ground);
  color: var(--ink);
  border-radius: 3px;
  padding: 12px 14px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.ua {
  font-size: 12px;
  background: var(--panel);
  border-left: 3px solid var(--line);
  border-radius: 3px;
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--muted);
}
details summary { cursor: pointer; color: var(--info); font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 12px; font-weight: 400; margin-top: 8px; }
.report-head { padding-top: 28px; }
.report-head h1 {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-weight: 500;
  font-size: 28px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin: 0 0 8px;
}
.report-head .count { font-size: 40px; letter-spacing: -0.04em; margin: 0 0 28px; font-weight: 700; }
.section-label {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 8px 0 12px;
}
.section-label strong { color: var(--clear); font-weight: 500; }
.later {
  margin-top: 28px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}
.later p { color: var(--muted); font-weight: 500; }
.later .links { display: grid; gap: 8px; }
.note { color: var(--dim); font-size: 13px; font-weight: 500; }
.pricing h1 { font-size: 48px; letter-spacing: -0.04em; line-height: 1.02; margin: 28px 0 12px; max-width: 16ch; text-align: left; }
.pricing .lede { margin-left: 0; margin-right: 0; text-align: left; max-width: 42em; }
.tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 28px 0; }
.tier-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 18px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tier-card.featured { border-color: var(--clear); }
.tier-card h2 { margin: 0; font-size: 14px; letter-spacing: 0.12em; text-transform: uppercase; }
.tier-card .price { margin: 0; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 28px; font-weight: 500; }
.tier-card .price span { font-size: 14px; color: var(--muted); }
.badge { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 11px; letter-spacing: 0.08em; color: var(--clear); }
.tier-card .blurb { margin: 0; color: var(--ink); font-weight: 600; }
.tier-card ul { margin: 0 0 12px; padding: 0 0 0 16px; color: var(--muted); font-weight: 500; flex: 1; }
.tier-card li { margin: 4px 0; }
.tier-card .go { text-align: center; }
.sheets { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin: 12px 0 28px; }
.sheets h2 { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); font-weight: 500; }
.sheets table { width: 100%; border-collapse: collapse; }
.sheets td { padding: 8px 0; border-bottom: 1px solid var(--line); font-weight: 500; }
.sheets td:last-child { text-align: right; font-family: "IBM Plex Mono", ui-monospace, monospace; color: var(--muted); }
.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
@media (max-width: 800px) {
  .hero h1 { font-size: 42px; }
  .wizard, .tiers, .sheets { grid-template-columns: 1fr; }
  .pricing h1 { font-size: 36px; }
  .banner { flex-wrap: wrap; }
  .banner a { white-space: normal; }
}
@media (max-width: 640px) {
  .desk { display: none; }
  .phone { display: block; }
  .top nav { display: none; }
  .scan-row { flex-direction: column; }
  .scan button, .tier-card .go { width: 100%; }
  .hero { padding-top: 36px; }
  .hero h1 { font-size: 36px; }
  .lede { font-size: 16px; }
  .foot-row { flex-direction: column; }
  .stage-row { display: none; }
}
`;
var WIZARD_NAMES = {
  1: "Docs",
  2: "Agent readiness",
  3: "Competitors",
  4: "Events & activations",
  5: "Personas",
  6: "Targeting & messaging",
  7: "Report"
};
var PROBE_LABEL = {
  D1: "Reachability",
  D2: "Structure",
  D3: "Quickstart",
  D4: "Code samples",
  D5: "Search",
  D6: "Freshness",
  D7: "Broken links",
  P1: "robots.txt",
  P2: "UA discrimination",
  P3: "JavaScript",
  P4: "OpenAPI",
  P5: "llms.txt",
  P7: "Sitemap",
  P8: "Version",
  C1: "Category",
  C2: "Competitor",
  C3: "Competitor",
  C4: "Competitor",
  E1: "Events",
  E2: "Speakers",
  N1: "Persona",
  T1: "Targeting",
  R1: "Assembly"
};
var COUNT_WORDS = ["No failed checks in this scan.", "One thing to fix.", "Two things to fix.", "Three things to fix.", "Four things to fix.", "Five things to fix.", "Six things to fix.", "Seven things to fix.", "Eight things to fix.", "Nine things to fix."];
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fontLinks() {
  return `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap">`;
}
function brand() {
  return `<a class="brand" href="/"><img src="/mark.svg" alt=""><span>Dev<em>Radar</em></span></a>`;
}
function shell(title, body, opts) {
  const robots = opts.noindex ? `<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">` : `<meta name="robots" content="index, follow">`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${robots}
${fontLinks()}
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}
function hostLabel(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
function formatDay(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
function thingsToFix(findings) {
  if (findings.length === 0 || findings.every((card) => card.result === "unknown")) {
    return "These checks could not run.";
  }
  const fails = findings.filter((card) => card.result === "fail").length;
  const unknowns = findings.filter((card) => card.result === "unknown").length;
  if (fails === 0 && unknowns > 0) {
    const word = unknowns === 1 ? "check" : "checks";
    return `No failed checks in this scan. ${unknowns} ${word} could not run.`;
  }
  return COUNT_WORDS[fails] ?? `${fails} things to fix.`;
}
function severityWord(card) {
  if (card.result === "unknown") return "unknown";
  if (card.result === "pass") return "clear";
  if (card.severity === "high" || card.severity === "highest") return "high";
  if (card.severity === "medium") return "medium";
  return "low";
}
function evidenceLines(evidence) {
  const lines = [];
  const push = (line) => {
    const clean = line.replace(/\s+/g, " ").trim();
    if (clean && lines.length < 6) lines.push(clean.slice(0, 220));
  };
  const pages = evidence.pages;
  if (Array.isArray(pages)) {
    for (const page of pages) {
      if (!page || typeof page !== "object") continue;
      const responses = page.responses;
      if (!Array.isArray(responses)) continue;
      for (const row of responses) {
        if (!row || typeof row !== "object") continue;
        const rec = row;
        const headers = rec.headers && typeof rec.headers === "object" ? rec.headers : {};
        const mitigated = typeof headers["cf-mitigated"] === "string" ? headers["cf-mitigated"] : "";
        const bytes = typeof rec.body_bytes === "number" ? `${rec.body_bytes} bytes` : "";
        push(["UA", String(rec.ua_name ?? "request"), "\u2192", String(rec.status_line ?? rec.status ?? ""), mitigated, bytes].filter(Boolean).join(" "));
      }
    }
  }
  if (lines.length > 0) return lines;
  for (const value of Object.values(evidence)) {
    if (typeof value === "string" && value.length <= 200) push(value);
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.length <= 200) push(item);
      }
    }
  }
  return lines;
}
function stageAside(stage, findings) {
  if (stage.status === "queued") return "queued";
  if (stage.status === "running") return "running";
  if (stage.status === "unknown") return "unknown";
  if (stage.elapsed_ms != null && Number.isFinite(stage.elapsed_ms)) {
    return `${Math.max(1, Math.round(stage.elapsed_ms / 1e3))}s`;
  }
  const count = findings.filter((card) => card.stage === stage.stage).length;
  if (stage.status === "done" && count > 0) return count === 1 ? "1 finding" : `${count} findings`;
  return stage.status;
}
function railHtml(stages, findings) {
  return `<ol class="rail">${stages.map((stage) => {
    const name = WIZARD_NAMES[stage.stage] ?? stage.name;
    return `<li class="${escapeHtml(stage.status)}">
<span class="idx">${stage.stage}</span>
<span class="name">${escapeHtml(name)}</span>
<span class="status">${escapeHtml(stageAside(stage, findings))}</span>
</li>`;
  }).join("")}</ol>`;
}
function renderFindingCard(card, index = 0) {
  if (card.tier === "inferred") {
    const from = card.inferredFrom;
    const present = from != null && !(typeof from === "string" && from.trim() === "") && !(Array.isArray(from) && from.length === 0) && !(typeof from === "object" && !Array.isArray(from) && Object.keys(from).length === 0);
    if (!present) throw new Error("an inferred finding requires inferred_from");
  }
  const word = severityWord(card);
  const label = PROBE_LABEL[card.probe] ?? card.probe;
  const lines = evidenceLines(card.evidence);
  const evidence = escapeHtml(JSON.stringify(card.evidence, null, 2));
  const open = "";
  const captured = card.capturedAt ? `<p class="when">captured ${escapeHtml(card.capturedAt)}</p>` : "";
  const inferred = card.tier === "inferred" ? `<p class="when">inferred from ${escapeHtml(Array.isArray(card.inferredFrom) ? card.inferredFrom.map(String).join(" \xB7 ") : JSON.stringify(card.inferredFrom))}</p>` : "";
  const list = lines.length ? `<ul class="ev">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "";
  return `<article class="finding ${escapeHtml(card.result)} ${escapeHtml(card.severity)} tier-${escapeHtml(card.tier)}" id="f-${index}">
<div class="chips">
<span class="chip sev-${escapeHtml(word)}">${escapeHtml(word)}</span>
<span class="chip tier">${escapeHtml(card.tier)}</span>
<span>${escapeHtml(card.probe)} \xB7 ${escapeHtml(label)}</span>
</div>
<h2>${escapeHtml(card.claim)}</h2>
${list}
${inferred}
${captured}
<details${open}>
<summary>Raw evidence</summary>
<pre>${evidence}</pre>
</details>
</article>`;
}
function cardsHtml(findings) {
  return findings.map((card, index) => renderFindingCard(card, index)).join("\n");
}
function mailto(subject) {
  return `mailto:rex@verafy.ai?subject=${encodeURIComponent(subject)}`;
}
function pollScript(token, step) {
  return `<p><a class="continue" href="/api/scan/?token=${escapeHtml(token)}&amp;watch=1">Refresh</a></p>
<script>
(async function () {
  const link = document.querySelector(".continue");
  if (link) link.hidden = true;
  const token = ${JSON.stringify(token)};
  const step = ${JSON.stringify(step)};
  let response;
  let data;
  try {
    response = await fetch("/api/scan/?token=" + encodeURIComponent(token) + "&watch=1", { headers: { accept: "application/json" } });
    data = await response.json();
  } catch (err) {
    if (link) link.hidden = false;
    return;
  }
  if (!response.ok) {
    if (link) link.hidden = false;
    return;
  }
  if (data.status === "done" || data.step !== step) location.reload();
  else setTimeout(function () { location.reload(); }, 1500);
})();
</script>`;
}
function bannerHtml(claim, findings) {
  if (!claim) return "";
  const index = findings.findIndex(
    (card) => card.stage === 2 && card.result === "fail" && (card.severity === "high" || card.severity === "highest")
  );
  const link = index >= 0 ? `<a href="#f-${index}">See the response \u2192</a>` : "";
  return `<div class="banner" role="status"><span class="chip sev-high">High</span><p>${escapeHtml(claim)}</p>${link}</div>`;
}
function wizardBody(input) {
  const elapsed = input.wallMs != null && Number.isFinite(input.wallMs) ? ` <span class="status">${Math.max(0, Math.round(input.wallMs / 1e3))}s elapsed</span>` : "";
  const ceiling = input.ceiling ? `<p class="note">This run hit the 150 second ceiling. Unfinished checks are unknown.</p>` : "";
  const findings = input.findings.length ? cardsHtml(input.findings) : `<p class="prose">Findings appear here as each check finishes.</p>`;
  return `<div class="wrap wide">
<header class="top">${brand()}<span class="host">${escapeHtml(hostLabel(input.docsUrl))}</span></header>
${bannerHtml(input.banner, input.findings)}
${ceiling}
<div class="wizard">
<section>
<div class="rail-head"><h2>Stages</h2>${elapsed}</div>
${railHtml(input.stages, input.findings)}
<p class="honest">Stages advance when they finish, not on a clock. Uneven timing is the scan working, not stalling.</p>
</section>
<section>
<div class="findings-head"><h2>Findings so far</h2></div>
${findings}
</section>
</div>
${input.token ? pollScript(input.token, input.step ?? 0) : ""}
</div>`;
}
function reportBody(input) {
  const day = formatDay(input.scannedAt);
  const seconds = input.wallMs != null && Number.isFinite(input.wallMs) ? `${Math.max(1, Math.round(input.wallMs / 1e3))}s` : null;
  const meta = ["Unlisted report", day, seconds].filter(Boolean).join(" \xB7 ");
  const review = input.automated ? `<p class="note">Automated scan. Reviewed reports available from <a href="https://www.rexstjohn.com">Rex St John</a>.</p>` : "";
  const ceiling = input.ceiling ? `<p class="note">This run hit the 150 second ceiling. Unfinished checks are unknown.</p>` : "";
  return `<div class="wrap">
<header class="top">${brand()}<span class="meta">${escapeHtml(meta)}</span></header>
${bannerHtml(input.banner, input.findings)}
<div class="report-head">
<h1>${escapeHtml(hostLabel(input.docsUrl))}</h1>
<p class="count">${escapeHtml(thingsToFix(input.findings))}</p>
</div>
${input.stages.map((stage) => {
    const mine = input.findings.filter((card) => card.stage === stage.stage);
    const body = mine.length ? mine.map((card) => renderFindingCard(card, input.findings.indexOf(card))).join("\n") : `<p class="prose">${escapeHtml(stage.note || "No findings were stored for this stage.")}</p>`;
    return `<section>
<div class="section-label"><span>${String(stage.stage).padStart(2, "0")} ${escapeHtml(WIZARD_NAMES[stage.stage] ?? stage.name)}</span><strong>${escapeHtml(stage.status)}</strong></div>
${body}
</section>`;
  }).join("\n")}
${ceiling}
<section class="later">
<p>Every finding this scan made is on this page, with the response that was captured. Breadth past a single run, and the weekly re-scan, are the paid plan.</p>
<div class="links">
<p><a href="/pricing/">Subscribe for a weekly re-scan \u2192</a></p>
<p><a href="${mailto("DevRadar")}">Talk to us about building something \u2192</a></p>
</div>
<form class="correct" action="/api/scan/" method="post">
<input type="hidden" name="url" value="${escapeHtml(input.docsUrl)}">
<label class="kicker" for="competitor-url">Not these? Tell us who.</label>
<div class="scan-row">
<input id="competitor-url" name="competitors" type="url" placeholder="https://docs.competitor.com" required>
<button type="submit">Re-run with this competitor</button>
</div>
</form>
<script>
document.querySelector(".correct")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const docs = form.querySelector("input[name=url]");
  const competitor = form.querySelector("input[name=competitors]");
  const response = await fetch("/api/scan/", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ url: docs.value, competitors: [competitor.value] }),
  });
  const data = await response.json();
  if (data.report_url) location.href = data.report_url;
});
</script>
</section>
<footer>
<p class="note">Agent time-to-first-call was not walked. It is Unknown.</p>
<p class="note">Reports are unlisted. We never publish who failed.</p>
${review}
${input.extra ?? ""}
<p class="note">A project by Verafy</p>
</footer>
</div>`;
}
function renderScanPage(input) {
  const body = input.polling ? wizardBody({
    docsUrl: input.docsUrl,
    stages: input.stages,
    findings: input.findings,
    banner: input.banner,
    ceiling: input.ceiling,
    wallMs: input.wallMs,
    token: input.polling.token,
    step: input.polling.step
  }) : reportBody({
    docsUrl: input.docsUrl,
    stages: input.stages,
    findings: input.findings,
    banner: input.banner,
    ceiling: input.ceiling,
    automated: input.automated,
    scannedAt: input.scannedAt,
    wallMs: input.wallMs,
    extra: input.extra
  });
  return shell(input.title, body, { noindex: true });
}

// src/ssrf.ts
import { lookup } from "node:dns/promises";
import { BlockList, isIP as isIP2 } from "node:net";
var SsrfError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "SsrfError";
  }
};
var blocked = new BlockList();
var v4 = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
];
for (const [net, prefix] of v4) blocked.addSubnet(net, prefix, "ipv4");
blocked.addSubnet("::", 128, "ipv6");
blocked.addSubnet("::1", 128, "ipv6");
blocked.addSubnet("fc00::", 7, "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");
blocked.addSubnet("fec0::", 10, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addAddress("255.255.255.255", "ipv4");
var BLOCKED_HOSTS = /* @__PURE__ */ new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.com"
]);
function isBlockedIp(address) {
  const ip = unwrapMapped(address);
  if (!ip || !isIP2(ip)) return true;
  const family = isIP2(ip) === 6 ? "ipv6" : "ipv4";
  if (family === "ipv6" && ip.toLowerCase().startsWith("::ffff:")) return true;
  return blocked.check(ip, family);
}
function unwrapMapped(address) {
  const lower = address.toLowerCase();
  if (lower.startsWith("::ffff:")) {
    const tail = address.slice(7);
    if (isIP2(tail) === 4) return tail;
  }
  return address;
}
function normalizeDocsUrl(input) {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2e3) {
    throw new SsrfError("Enter a docs URL.");
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new SsrfError("That URL could not be parsed.");
  }
  if (url.username || url.password) {
    throw new SsrfError("URLs with a username or password are refused.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError(`Only http and https are fetched, not ${url.protocol}`);
  }
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (port !== "80" && port !== "443") {
    throw new SsrfError(`Port ${port} is refused. Only 80 and 443 are fetched.`);
  }
  url.hash = "";
  return url;
}
function hostnameBlocked(hostname) {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  if (!host || BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  return false;
}
async function defaultResolve(hostname) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}
async function assertPublicHttpUrl(url, resolve = defaultResolve) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError(`Only http and https are fetched, not ${url.protocol}`);
  }
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (port !== "80" && port !== "443") {
    throw new SsrfError(`Port ${port} is refused. Only 80 and 443 are fetched.`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (hostnameBlocked(host)) {
    throw new SsrfError(`${host} is not a public host.`);
  }
  const literal = isIP2(host);
  const addresses = literal ? [host] : await resolve(host).catch(() => []);
  if (addresses.length === 0) {
    throw new SsrfError(`${host} did not resolve to a public address.`);
  }
  for (const address of addresses) {
    if (isBlockedIp(address)) {
      throw new SsrfError(`${host} resolves to ${address}, which is not a public address.`);
    }
  }
}

// src/storage.ts
import { mkdir as mkdir2, readdir, readFile as readFile2, rm as rm2, writeFile as writeFile2 } from "node:fs/promises";
import path2 from "node:path";
function safeKey(key) {
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new Error(`refused storage key ${JSON.stringify(key)}`);
  }
  return key;
}
var FileStore = class {
  constructor(root) {
    this.root = root;
  }
  file(key) {
    return path2.join(this.root, safeKey(key));
  }
  async get(key) {
    try {
      return await readFile2(this.file(key), "utf8");
    } catch (err) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }
  async put(key, body) {
    const file = this.file(key);
    await mkdir2(path2.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile2(tmp, body);
    const { rename: rename2 } = await import("node:fs/promises");
    await rename2(tmp, file);
  }
  async delete(key) {
    await rm2(this.file(key), { force: true });
  }
  async list(prefix) {
    const clean = safeKey(prefix.replace(/\/$/, ""));
    const out = [];
    const walk = async (current, key) => {
      let entries;
      try {
        entries = await readdir(current, { withFileTypes: true });
      } catch (err) {
        if (err.code === "ENOENT") return;
        throw err;
      }
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const childKey = `${key}/${entry.name}`;
        if (entry.isDirectory()) await walk(path2.join(current, entry.name), childKey);
        else out.push(childKey);
      }
    };
    await walk(path2.join(this.root, clean), clean);
    return out;
  }
  async lock(name) {
    const dir = path2.join(this.root, ".locks", safeKey(name));
    await mkdir2(path2.dirname(dir), { recursive: true });
    const deadline = Date.now() + 3e4;
    for (; ; ) {
      try {
        await mkdir2(dir, { recursive: false });
        return async () => {
          await rm2(dir, { recursive: true, force: true });
        };
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
        if (Date.now() > deadline) throw new Error(`timed out waiting for lock ${name}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
  }
};
var LEDGER_KEY = "ledger/politeness.json";
function ledgerIO(store) {
  return {
    lockKey: `store:${LEDGER_KEY}`,
    async load() {
      const raw = await store.get(LEDGER_KEY);
      if (!raw) return { requests: [], aborts: [] };
      return normalizeLedger(JSON.parse(raw), Date.now(), POLITENESS_WINDOW_MS);
    },
    async save(ledger) {
      await store.put(LEDGER_KEY, JSON.stringify(ledger));
    },
    lock: () => store.lock("ledger")
  };
}
function blobStoreFromEnv(token = process.env.BLOB_READ_WRITE_TOKEN) {
  if (!token) return null;
  return new BlobStore(token);
}
var BlobStore = class {
  constructor(token) {
    this.token = token;
  }
  async api() {
    return import("@vercel/blob");
  }
  async get(key) {
    const { get } = await this.api();
    const result = await get(safeKey(key), { access: "private", token: this.token, useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return await new Response(result.stream).text();
  }
  async put(key, body) {
    const { put } = await this.api();
    await put(safeKey(key), body, {
      access: "private",
      token: this.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: key.endsWith(".html") ? "text/html; charset=utf-8" : "application/json"
    });
  }
  async delete(key) {
    const { del } = await this.api();
    await del(safeKey(key), { token: this.token }).catch(() => void 0);
  }
  async list(prefix) {
    const { list } = await this.api();
    const keys = [];
    let cursor;
    const normalized = safeKey(prefix.replace(/\/$/, "")) + "/";
    for (; ; ) {
      const page = await list({ prefix: normalized, token: this.token, cursor, limit: 1e3 });
      for (const blob of page.blobs) keys.push(blob.pathname.replace(/^\//, ""));
      if (!page.hasMore || !page.cursor) break;
      cursor = page.cursor;
    }
    return keys;
  }
  async lock(name) {
    const key = `.locks/${safeKey(name)}`;
    const owner = `${process.pid}-${Math.random().toString(16).slice(2)}`;
    const deadline = Date.now() + 2e4;
    for (; ; ) {
      const current = await this.get(key);
      let held = false;
      if (current) {
        try {
          const parsed = JSON.parse(current);
          held = typeof parsed.until === "number" && parsed.until > Date.now();
        } catch {
          held = false;
        }
      }
      if (!held) {
        await this.put(key, JSON.stringify({ owner, until: Date.now() + 15e3 }));
        const check = await this.get(key);
        if (check && JSON.parse(check).owner === owner) {
          return async () => {
            const now = await this.get(key);
            if (now && JSON.parse(now).owner === owner) await this.delete(key);
          };
        }
      }
      if (Date.now() > deadline) throw new Error(`timed out waiting for blob lock ${name}`);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }
};
function openStore(root = "data/selfserve") {
  const blob = blobStoreFromEnv();
  if (blob) return blob;
  if (process.env.VERCEL) return new FileStore("/tmp/devradar");
  return new FileStore(root);
}

// src/selfserve/job.ts
var RateLimitError = class extends Error {
  constructor() {
    super("This address has started 5 scans in the last hour.");
    this.name = "RateLimitError";
  }
};
var LIVE_STEPS = [
  { stage: 1, probe: "D1" },
  { stage: 1, probe: "D3" },
  { stage: 1, probe: "D5" },
  { stage: 1, probe: "P7" },
  { stage: 1, probe: "D2" },
  { stage: 1, probe: "D4" },
  { stage: 1, probe: "D6" },
  { stage: 1, probe: "D7" },
  { stage: 1, probe: "P3" },
  { stage: 2, probe: "P1" },
  { stage: 2, probe: "P2" },
  { stage: 2, probe: "P5" },
  { stage: 2, probe: "P4" },
  { stage: 2, probe: "P8" },
  { stage: 3, probe: "C1" },
  { stage: 3, probe: "C2" },
  { stage: 3, probe: "C3" },
  { stage: 3, probe: "C4" },
  { stage: 4, probe: "E1" },
  { stage: 4, probe: "E2" },
  { stage: 5, probe: "N1" },
  { stage: 6, probe: "T1" },
  { stage: 7, probe: "R1" }
];
var IP_LIMIT = 5;
var IP_WINDOW_MS = 60 * 60 * 1e3;
var STEP_TRIES = 2;
function jobKey(token) {
  return `jobs/${token}.json`;
}
function indexKey(domain) {
  return `index/domain/${domain}.json`;
}
function ipKey(ip) {
  return `rate/${createHash2("sha256").update(ip).digest("hex")}.json`;
}
function initialStages(now) {
  const iso = new Date(now).toISOString();
  return STAGE_PLAN.map((stage) => ({
    stage: stage.stage,
    name: stage.name,
    status: stage.stage === 1 ? "running" : "queued",
    started_at: stage.stage === 1 ? iso : null,
    ended_at: null,
    note: null
  }));
}
async function readJson(store, key) {
  const raw = await store.get(key);
  if (!raw) return null;
  return JSON.parse(raw);
}
async function assertRateLimit(store, ip, now) {
  const key = ipKey(ip || "unknown");
  const release = await store.lock(`rate-${key}`);
  try {
    const current = await readJson(store, key) ?? { hits: [] };
    const hits = current.hits.filter((at) => now - at < IP_WINDOW_MS);
    if (hits.length >= IP_LIMIT) throw new RateLimitError();
    hits.push(now);
    await store.put(key, JSON.stringify({ hits }));
  } finally {
    await release();
  }
}
function companyFromUrl(url) {
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  const slug = safeSlug(host.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site");
  return {
    slug,
    company: host,
    domain: registrableDomain(host),
    docs_url: url.href
  };
}
async function startScan(input) {
  const now = input.now ?? Date.now();
  const url = normalizeDocsUrl(input.rawUrl);
  await assertPublicHttpUrl(url, input.resolve);
  const domain = registrableDomain(url.hostname);
  const release = await input.store.lock(`domain-${domain}`);
  try {
    const correction = (input.competitors ?? []).map((value) => value.trim()).filter(Boolean).slice(0, 3);
    const existing = await readJson(input.store, indexKey(domain));
    if (correction.length === 0 && existing && freshEnough(existing, now)) {
      return { token: existing.token, report_url: `/r/${existing.token}/`, deduped: true, status: existing.status };
    }
    await assertRateLimit(input.store, input.ip, now);
    const company = companyFromUrl(url);
    const token = randomBytes(16).toString("base64url");
    const iso = new Date(now).toISOString();
    const job = {
      token,
      status: "running",
      input_url: input.rawUrl.trim(),
      docs_url: url.href,
      domain,
      company: company.company,
      slug: company.slug,
      created_at: iso,
      updated_at: iso,
      scanned_at: null,
      started_ms: now,
      step: 0,
      step_tries: 0,
      findings: [],
      requests_made: 0,
      cache: [],
      aborted: null,
      message: `Reading ${url.href}`,
      stages: initialStages(now),
      banner: null,
      ceiling_hit: false,
      category: null,
      event_topic: "javascript",
      competitors: [],
      correction: correction.length ? correction : null,
      event_fields: []
    };
    await input.store.put(jobKey(token), JSON.stringify(job));
    await input.store.put(indexKey(domain), JSON.stringify(job));
    await trackRunning(input.store, token, "add");
    return { token, report_url: `/r/${token}/`, deduped: false, status: "running" };
  } finally {
    await release();
  }
}
function freshEnough(job, now) {
  const stampAt = Date.parse(job.status === "done" ? job.scanned_at || job.updated_at : job.updated_at);
  if (!Number.isFinite(stampAt)) return false;
  if (job.status === "done") return now - stampAt < POLITENESS_WINDOW_MS;
  return now - stampAt < 6 * 60 * 60 * 1e3;
}
async function chromiumStatus() {
  const enabled = process.env.DEVRADAR_ENABLE_CHROMIUM === "1" || process.env.AGENTREADY_ENABLE_CHROMIUM === "1";
  if (process.env.VERCEL === "1" && !enabled) {
    return {
      ok: false,
      error: "chromium_unavailable: this serverless runtime has no headless Chromium. The JavaScript comparison is unknown, not a failure."
    };
  }
  try {
    const specifier = "playwright";
    const { chromium } = await import(specifier);
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    await browser.close();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return { ok: false, error: `chromium_unavailable: ${message}` };
  }
}
function landingOf(client, docsUrl) {
  const landing = [...client.cache.values()].find((snap) => (snap.url === docsUrl || snap.final_url === docsUrl) && snap.ua === SCANNER_UA);
  if (!landing || !observed(landing)) return { html: null, finalUrl: docsUrl };
  return { html: landing.body, finalUrl: landing.final_url || docsUrl };
}
async function defaultStep(probe, client, job) {
  const company = {
    slug: job.slug,
    company: job.company,
    domain: job.domain,
    docs_url: job.docs_url
  };
  if (probe === "D1") return probeReachability(client, job.docs_url);
  const landing = landingOf(client, job.docs_url);
  if (probe === "D3") return probeQuickstart(client, landing.finalUrl, landing.html);
  if (probe === "D5") return probeSearch(client, landing.finalUrl, landing.html);
  if (probe === "D4") return probeCodeSamples(landing.finalUrl, landing.html ?? "");
  if (probe === "D2") {
    const prior = [...job.findings].reverse().find((finding) => finding.probe === "P7");
    return probeStructure(job.docs_url, prior?.evidence ?? null);
  }
  if (probe === "D6") {
    const xml = [...client.cache.values()].filter((snap) => observed(snap) && /<urlset|<sitemapindex/i.test(snap.body)).map((snap) => snap.body);
    return probeFreshness({ docsUrl: job.docs_url, sitemapXml: xml, landingHtml: landing.html, now: Date.now() });
  }
  if (probe === "D7") return probeBrokenLinks(client, landing.finalUrl, landing.html);
  if (probe === "P1") return probeP1(client, company.domain, job.docs_url);
  if (probe === "P5") return probeP5(client, company.domain, job.docs_url);
  if (probe === "P2") return probeP2(client, job.docs_url);
  if (probe === "P7") {
    const docs = new URL(job.docs_url);
    const robotsUrl = new URL("/robots.txt", `${docs.protocol}//${docs.host}`).href;
    const rootRobots = `https://${company.domain}/robots.txt`;
    await client.get(robotsUrl, SCANNER_UA);
    if (rootRobots !== robotsUrl) await client.get(rootRobots, SCANNER_UA);
    const robotsBodies = [...client.cache.values()].filter((snap) => snap.url.endsWith("/robots.txt") && snap.status === 200 && !snap.error).map((snap) => snap.body);
    const fresh = landingOf(client, job.docs_url);
    return probeP7(client, fresh.finalUrl, robotsBodies, fresh.html);
  }
  if (probe === "P4") return probeP4(client, landing.finalUrl, void 0, landing.html);
  if (probe === "P8") return probeP8(client, landing.finalUrl, landing.html);
  if (probe === "C1") {
    const read = probeCategory(job.docs_url, visibleText(landing.html ?? ""), job.domain, job.correction);
    job.category = read.category;
    job.event_topic = read.topic;
    job.competitors = read.competitors;
    return read.finding;
  }
  if (probe === "C2" || probe === "C3" || probe === "C4") {
    const index = probe === "C2" ? 0 : probe === "C3" ? 1 : 2;
    return probeOneCompetitor(client, job.docs_url, job.competitors[index], index);
  }
  if (probe === "E1") return probeEvents(client, job.docs_url, job.event_topic || "javascript", Date.now());
  if (probe === "E2") {
    const prior = [...job.findings].reverse().find((item) => item.probe === "E1");
    const fields = Array.isArray(prior?.evidence.dataset_fields) ? prior?.evidence.dataset_fields : job.event_fields;
    return probeSpeakers(job.docs_url, fields);
  }
  if (probe === "N1") return probePersona(client, job.docs_url, visibleText(landing.html ?? ""));
  if (probe === "T1") {
    const competitorText = job.competitors.flatMap((competitor) => {
      const snap = [...client.cache.values()].find((item) => item.url === competitor.docsUrl || item.final_url === competitor.docsUrl);
      if (!snap || !observed(snap)) return [];
      return [{ name: competitor.name, url: competitor.docsUrl, text: visibleText(snap.body) }];
    });
    return probeTargeting(
      job.docs_url,
      visibleText(landing.html ?? ""),
      competitorText,
      job.findings.map((item) => ({ probe: item.probe, result: item.result, claim: item.claim }))
    );
  }
  if (probe === "R1") {
    return probeAssembly(
      job.docs_url,
      job.findings.map((item) => ({ stage: item.stage, probe: item.probe, result: item.result })),
      job.ceiling_hit
    );
  }
  const chrome = await chromiumStatus();
  if (!chrome.ok) {
    return stamp({
      probe: "P3",
      result: "unknown",
      severity: "info",
      claim: `JavaScript dependency for ${job.docs_url} is unknown: ${chrome.error}`,
      url: job.docs_url,
      probe_version: PROBE_VERSION,
      evidence: { chromium_available: false, error_name: "ChromiumUnavailable", error_message: chrome.error }
    });
  }
  return probeP3(client, job.docs_url);
}
function skipped(probe, url, reason) {
  return stamp({
    probe,
    result: "unknown",
    severity: "info",
    claim: `${probe} is unknown: ${reason}`,
    url,
    probe_version: PROBE_VERSION,
    evidence: { skipped: true, reason }
  });
}
function remember(job, finding, stage) {
  job.findings.push({ ...finding, stage });
  if (stage === 2 && finding.result === "fail" && (finding.severity === "high" || finding.severity === "highest") && !job.banner) {
    job.banner = { headline: finding.claim, probe: finding.probe, severity: finding.severity };
  }
}
async function persist(store, job) {
  await store.put(jobKey(job.token), JSON.stringify(job));
  await store.put(indexKey(job.domain), JSON.stringify(job));
}
async function advanceJob(input) {
  if (!/^[A-Za-z0-9_-]{16,}$/.test(input.token)) return null;
  const now = input.now ?? Date.now();
  const release = await input.store.lock(`job-${input.token}`);
  try {
    const job = await readJson(input.store, jobKey(input.token));
    if (!job) return null;
    if (job.status === "done") return job;
    if (job.step >= LIVE_STEPS.length) {
      await finalize(input.store, job, now);
      return job;
    }
    if (now - job.started_ms >= WALL_CEILING_MS) {
      closeUnfinished(job, now, "the 150 second ceiling was reached", true);
      job.message = "Ceiling reached. Writing the report.";
      await finalize(input.store, job, now);
      return job;
    }
    const step = LIVE_STEPS[job.step];
    if (!step) {
      await finalize(input.store, job, now);
      return job;
    }
    const stageRow = job.stages.find((stage) => stage.stage === step.stage);
    if (stageRow?.started_at) {
      const elapsed = now - Date.parse(stageRow.started_at);
      const max = STAGE_MAX_MS[step.stage];
      if (elapsed > max) {
        closeStage(job, step.stage, now, `stage ${step.stage} exceeded ${max}ms`);
        job.message = `Stage ${step.stage} stopped at its time ceiling.`;
        if (job.step >= LIVE_STEPS.length) await finalize(input.store, job, now);
        else await persist(input.store, job);
        return job;
      }
    }
    if (job.step_tries >= STEP_TRIES) {
      remember(job, toUnknownFinding(step.probe, job.docs_url, new Error("the probe did not finish inside the function time limit")), step.stage);
      job.step += 1;
      job.step_tries = 0;
      finishStageIfNeeded(job, step.stage, now);
      job.updated_at = new Date(now).toISOString();
      job.message = job.step >= LIVE_STEPS.length ? "Writing the report." : `Retry limit reached. Next is ${LIVE_STEPS[job.step]?.probe}.`;
      if (job.step >= LIVE_STEPS.length) await finalize(input.store, job, now);
      else await persist(input.store, job);
      return job;
    }
    if (stageRow && stageRow.status !== "running") {
      stageRow.status = "running";
      stageRow.started_at = stageRow.started_at ?? new Date(now).toISOString();
    }
    job.step_tries += 1;
    job.message = `Running ${step.probe}.`;
    job.updated_at = new Date(now).toISOString();
    await persist(input.store, job);
    const budget = PolitenessBudget.using(ledgerIO(input.store));
    const client = new Client(budget, (url) => assertPublicHttpUrl(url, input.resolve));
    client.loadCache(job.cache ?? []);
    client.requestCount = job.requests_made;
    if (job.aborted) client.aborted = { reason: job.aborted };
    let finding;
    try {
      const run = input.runStep ?? defaultStep;
      finding = await run(step.probe, client, job);
    } catch (err) {
      finding = toUnknownFinding(step.probe, job.docs_url, err);
    }
    remember(job, finding, step.stage);
    job.requests_made = client.requestCount;
    job.cache = client.exportCache();
    job.aborted = client.aborted?.reason ?? job.aborted;
    job.step += 1;
    job.step_tries = 0;
    finishStageIfNeeded(job, step.stage, now);
    job.updated_at = new Date(now).toISOString();
    job.message = job.step >= LIVE_STEPS.length ? "Writing the report." : `Finished ${step.probe}. Next is ${LIVE_STEPS[job.step]?.probe}.`;
    if (job.step >= LIVE_STEPS.length) await finalize(input.store, job, now);
    else await persist(input.store, job);
    return job;
  } finally {
    await release();
  }
}
function finishStageIfNeeded(job, stage, now) {
  const more = LIVE_STEPS.slice(job.step).some((step) => step.stage === stage);
  if (more) return;
  const row = job.stages.find((item) => item.stage === stage);
  if (!row || row.status === "unknown") return;
  row.status = "done";
  row.ended_at = new Date(now).toISOString();
}
function closeStage(job, stage, now, reason) {
  while (job.step < LIVE_STEPS.length && LIVE_STEPS[job.step]?.stage === stage) {
    const step = LIVE_STEPS[job.step];
    if (!step) break;
    remember(job, skipped(step.probe, job.docs_url, reason), step.stage);
    job.step += 1;
  }
  const row = job.stages.find((item) => item.stage === stage);
  if (row) {
    row.status = "unknown";
    row.ended_at = new Date(now).toISOString();
    row.note = reason;
    row.started_at = row.started_at ?? row.ended_at;
  }
  job.step_tries = 0;
  job.updated_at = new Date(now).toISOString();
}
function closeUnfinished(job, now, reason, ceiling) {
  const stages = /* @__PURE__ */ new Set();
  while (job.step < LIVE_STEPS.length) {
    const step = LIVE_STEPS[job.step];
    if (!step) break;
    stages.add(step.stage);
    if (step.probe === "R1") {
      remember(
        job,
        probeAssembly(
          job.docs_url,
          job.findings.map((item) => ({ stage: item.stage, probe: item.probe, result: item.result })),
          true
        ),
        step.stage
      );
    } else {
      remember(job, skipped(step.probe, job.docs_url, reason), step.stage);
    }
    job.step += 1;
  }
  for (const stage of stages) {
    const row = job.stages.find((item) => item.stage === stage);
    if (!row || row.status === "done") continue;
    row.status = "unknown";
    row.ended_at = new Date(now).toISOString();
    row.note = reason;
  }
  job.ceiling_hit = ceiling || job.ceiling_hit;
  job.step_tries = 0;
  job.updated_at = new Date(now).toISOString();
}
async function domainBudget(store, domain, now) {
  const raw = await store.get("ledger/politeness.json");
  const parsed = raw ? JSON.parse(raw) : {};
  const recent = (parsed.requests ?? []).filter((row) => row.domain === domain && now - row.at < POLITENESS_WINDOW_MS);
  const oldest = recent.reduce((min, row) => Math.min(min, row.at), now);
  const blocked2 = (parsed.aborts ?? []).find((row) => row.domain === domain && row.until > now);
  return {
    domain,
    window_start: new Date(recent.length ? oldest : now).toISOString(),
    request_count: recent.length,
    blocked_until: blocked2 ? new Date(blocked2.until).toISOString() : null
  };
}
async function finalize(store, job, now) {
  const scannedAt = new Date(now).toISOString();
  for (const stage of job.stages) {
    if (stage.status === "running") {
      stage.status = "done";
      stage.ended_at = scannedAt;
    } else if (stage.status === "queued") {
      stage.status = "unknown";
      stage.note = stage.note ?? "the stage did not start";
      stage.started_at = stage.started_at ?? scannedAt;
      stage.ended_at = scannedAt;
    }
  }
  job.status = "done";
  job.scanned_at = scannedAt;
  job.updated_at = scannedAt;
  job.message = "Report ready.";
  job.cache = [];
  const findings = job.findings.map(
    (finding) => toFindingRecord({
      scanId: job.token,
      stage: finding.stage,
      finding,
      tier: finding.tier,
      inferredFrom: finding.inferredFrom ?? null,
      gated: finding.gated
    })
  );
  const stageRun = job.stages.map((stage) => ({
    id: `${job.token}-stage-${stage.stage}`,
    scan_id: job.token,
    stage: stage.stage,
    status: stage.status,
    started_at: stage.started_at,
    ended_at: stage.ended_at,
    note: stage.note
  }));
  const document2 = {
    scan: {
      id: job.token,
      account_id: null,
      token: job.token,
      docs_url: job.docs_url,
      domain: job.domain,
      category: job.category,
      geo: null,
      started_at: job.created_at,
      completed_at: scannedAt,
      wall_ms: now - job.started_ms,
      email_captured_at: null
    },
    stage_run: stageRun,
    finding: findings,
    domain_budget: await domainBudget(store, job.domain, now)
  };
  const legacy = buildFindingsFile({
    company: { slug: job.slug, company: job.company, domain: job.domain, docs_url: job.docs_url },
    docs_url: job.docs_url,
    scanned_at: scannedAt,
    scanner_version: SCANNER_VERSION,
    scanner_ua: SCANNER_UA,
    about_url: ABOUT_URL,
    report_token: job.token,
    findings: job.findings,
    requests_made: job.requests_made
  });
  const view = wizardView(job);
  const html = renderScanPage({
    title: `${job.company} \u2014 DevRadar`,
    company: job.company,
    docsUrl: job.docs_url,
    stages: view.stages,
    findings: view.findings,
    banner: job.banner?.headline ?? null,
    ceiling: job.ceiling_hit,
    automated: true,
    scannedAt,
    wallMs: now - job.started_ms,
    extra: `<p class="mono">${SCANNER_UA}</p>`
  });
  await store.put(`reports/${job.token}.json`, JSON.stringify({ ...document2, legacy }));
  await store.put(`reports/${job.token}.html`, html);
  await persist(store, job);
  await trackRunning(store, job.token, "settle");
}
async function loadJob(store, token) {
  if (!/^[A-Za-z0-9_-]{16,}$/.test(token)) return null;
  const raw = await store.get(jobKey(token));
  if (!raw) return null;
  return JSON.parse(raw);
}
function wizardView(job) {
  const stages = job.stages.map((stage) => {
    const total = LIVE_STEPS.filter((step) => step.stage === stage.stage).length;
    const done = job.findings.filter((finding) => finding.stage === stage.stage).length;
    const elapsed = stage.started_at && stage.ended_at ? Date.parse(stage.ended_at) - Date.parse(stage.started_at) : null;
    return {
      stage: stage.stage,
      name: stage.name,
      status: stage.status,
      elapsed_ms: Number.isFinite(elapsed) ? elapsed : null,
      done_steps: done,
      total_steps: total,
      note: stage.note
    };
  });
  const findings = job.findings.map((finding) => ({
    stage: finding.stage,
    probe: finding.probe,
    result: finding.result,
    severity: finding.severity,
    claim: finding.claim,
    evidence: finding.evidence,
    url: finding.url,
    tier: finding.tier ?? "verified",
    inferredFrom: finding.inferredFrom,
    capturedAt: finding.timestamp
  }));
  return { stages, findings };
}
function toPublicState(job) {
  const view = wizardView(job);
  return {
    token: job.token,
    status: job.status,
    report_url: `/r/${job.token}/`,
    step: job.step,
    message: job.message,
    domain: job.domain,
    wall_ms: (job.scanned_at ? Date.parse(job.scanned_at) : Date.parse(job.updated_at)) - job.started_ms,
    ceiling_hit: job.ceiling_hit,
    banner: job.banner,
    stages: view.stages
  };
}
var SLICE_MS = 6e3;
var CONTINUE_ATTEMPTS = 3;
var RUNNING_KEY = "index/running.json";
var SETTLED_KEY = "index/settled.json";
async function trackRunning(store, token, action) {
  const release = await store.lock("running-index");
  try {
    const running = new Set(((await readJson(store, RUNNING_KEY))?.tokens ?? []).filter(Boolean));
    const settled = new Set(((await readJson(store, SETTLED_KEY))?.tokens ?? []).filter(Boolean));
    if (action === "add") {
      settled.delete(token);
      running.add(token);
    } else {
      running.delete(token);
      settled.add(token);
    }
    await store.put(RUNNING_KEY, JSON.stringify({ tokens: [...running] }));
    await store.put(SETTLED_KEY, JSON.stringify({ tokens: [...settled] }));
  } finally {
    await release();
  }
}
async function requestContinue(token, options = {}) {
  const origin = process.env.DEVRADAR_CONTINUE_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!origin && !options.fetchImpl) {
    console.error("continue skipped", JSON.stringify({ token, reason: "DEVRADAR_CONTINUE_ORIGIN is unset" }));
    return false;
  }
  const url = `${(origin || "http://127.0.0.1").replace(/\/$/, "")}/api/scan/?token=${encodeURIComponent(token)}&continue=1`;
  const fetchImpl = options.fetchImpl ?? fetch;
  const delay = options.retryDelayMs ?? 250;
  for (let attempt = 1; attempt <= CONTINUE_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8e3);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        headers: { "x-devradar-continue": "1", accept: "application/json" },
        signal: controller.signal
      });
      await response.body?.cancel?.().catch(() => void 0);
      if (response.status >= 200 && response.status < 300) return true;
      console.error("continue rejected", JSON.stringify({ token, attempt, status: response.status }));
      if (response.status === 404) return false;
    } catch (err) {
      console.error("continue failed", JSON.stringify({ token, attempt, error: err instanceof Error ? err.message : String(err) }));
    } finally {
      clearTimeout(timer);
    }
    if (attempt < CONTINUE_ATTEMPTS && delay > 0) await new Promise((resolve) => setTimeout(resolve, delay * attempt));
  }
  console.error("continue gave up", JSON.stringify({ token, attempts: CONTINUE_ATTEMPTS }));
  return false;
}
async function runScanInBackground(input) {
  const sliceStart = Date.now();
  const sliceMs = input.sliceMs ?? SLICE_MS;
  const handoff = input.handoff ?? process.env.VERCEL === "1";
  for (; ; ) {
    const job = await advanceJob({ store: input.store, token: input.token, now: input.now, resolve: input.resolve, runStep: input.runStep });
    if (!job || job.status === "done") return;
    if (handoff && Date.now() - sliceStart >= sliceMs) {
      await requestContinue(input.token, { fetchImpl: input.continueFetch, retryDelayMs: input.retryDelayMs });
      return;
    }
  }
}
function scheduleScan(input) {
  return runScanInBackground(input).catch((err) => {
    console.error("scan background failed", err instanceof Error ? err.message : err);
  });
}

// src/selfserve/http.ts
function json(status, body, extra = {}) {
  return {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
    body: JSON.stringify(body)
  };
}
function clientIp(headers) {
  const raw = headers["x-forwarded-for"] ?? headers["x-real-ip"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return "unknown";
  return value.split(",")[0]?.trim() || "unknown";
}
function wantsJson(headers, url) {
  if (url.searchParams.get("format") === "json") return true;
  const accept = headers.accept;
  const value = Array.isArray(accept) ? accept.join(",") : accept || "";
  return value.includes("application/json");
}
async function handleScan(input) {
  const method = input.method.toUpperCase();
  try {
    if (method === "GET") {
      const token = input.url.searchParams.get("token") || "";
      const watch = input.url.searchParams.get("watch") === "1" || input.url.searchParams.get("continue") === "1";
      if (input.url.searchParams.get("advance") !== "1" && !watch) {
        return json(400, { error: "advance_required" });
      }
      if (watch) {
        const existing = await loadJob(input.store, token);
        if (!existing) return json(404, { error: "not_found" });
        const stale = existing.status === "running" && input.now == null && Date.now() - Date.parse(existing.updated_at) > 15e3;
        const background2 = input.now == null && (input.url.searchParams.get("continue") === "1" || stale) ? scheduleScan({ store: input.store, token, resolve: input.resolve }) : void 0;
        if (!wantsJson(input.headers, input.url)) {
          return { status: 302, headers: { location: `/r/${existing.token}/`, "cache-control": "no-store" }, body: "", background: background2 };
        }
        return { ...json(200, publicJob(existing)), background: background2 };
      }
      const job = await advanceJob({ store: input.store, token, now: input.now });
      if (!job) return json(404, { error: "not_found" });
      if (!wantsJson(input.headers, input.url)) {
        return {
          status: 302,
          headers: { location: `/r/${job.token}/`, "cache-control": "no-store" },
          body: ""
        };
      }
      return json(200, publicJob(job));
    }
    if (method !== "POST") return json(405, { error: "method_not_allowed" });
    const parsed = parsedBody(input.body, input.headers);
    const started = await startScan({
      store: input.store,
      rawUrl: parsed.url,
      ip: clientIp(input.headers),
      now: input.now,
      resolve: input.resolve,
      competitors: parsed.competitors
    });
    const background = input.now == null && !started.deduped && started.status === "running" ? scheduleScan({ store: input.store, token: started.token, resolve: input.resolve }) : void 0;
    if (wantsJson(input.headers, input.url) || isJson(input.headers)) {
      return { ...json(started.deduped ? 200 : 202, started), background };
    }
    return {
      status: 303,
      headers: { location: started.report_url, "cache-control": "no-store" },
      body: "",
      background
    };
  } catch (err) {
    if (err instanceof SsrfError) return json(400, { error: "ssrf", message: err.message });
    if (err instanceof RateLimitError) return json(429, { error: "rate_limit", message: err.message });
    const message = err instanceof Error ? err.message : String(err);
    return json(500, { error: "scan_failed", message });
  }
}
function publicJob(job) {
  return toPublicState(job);
}
function isJson(headers) {
  const type = headers["content-type"];
  const value = Array.isArray(type) ? type.join(",") : type || "";
  return value.includes("application/json");
}
function parsedBody(body, headers) {
  const trimmed = body.trim();
  if (!trimmed) throw new SsrfError("Enter a docs URL.");
  if (isJson(headers) || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    if (!parsed.url || typeof parsed.url !== "string") throw new SsrfError("Enter a docs URL.");
    const competitors = Array.isArray(parsed.competitors) ? parsed.competitors.filter((value) => typeof value === "string") : void 0;
    return { url: parsed.url, competitors };
  }
  const params = new URLSearchParams(trimmed);
  const listed = params.getAll("competitors").filter(Boolean);
  return { url: params.get("url") || "", competitors: listed.length ? listed : void 0 };
}
function vercelSend(res, result) {
  res.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  res.end(result.body);
}
async function readIncomingBody(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return JSON.stringify(req.body);
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

// api/scan.ts
async function handler(req, res) {
  const host = (Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host) || "localhost";
  const url = new URL(req.url || "/", `http://${host}`);
  const body = await readIncomingBody(req);
  const result = await handleScan({
    method: req.method || "GET",
    url,
    headers: req.headers,
    body,
    store: openStore()
  });
  if (result.background) {
    try {
      const specifier = "@vercel/functions";
      const mod = await import(specifier);
      if (typeof mod.waitUntil === "function") mod.waitUntil(result.background);
    } catch (err) {
      console.error("waitUntil unavailable", err instanceof Error ? err.message : err);
    }
  }
  vercelSend(res, result);
}
export {
  handler as default
};
