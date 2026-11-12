import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { cleanText, newId } from "./http.js";
import { brightDataConfigured, serpSearch } from "./brightdata.js";

export const USER_AGENT = "DevRadar/1.0 (+https://devradar.rexstjohn.com; company-profile)";
export const PAGE_CAP = 50;

const MULTI_PART = new Set(["co.uk", "org.uk", "ac.uk", "com.au", "net.au", "org.au", "co.jp", "co.nz", "com.br", "com.sg", "com.mx", "co.za", "com.tr"]);
const LINK_KEYS = ["website", "docs", "apiReference", "developerPortal", "github", "community", "blog", "changelog", "status", "pricing"];

export function registrableDomain(hostname) {
  const host = String(hostname || "").replace(/\.$/, "").toLowerCase().replace(/^www\./, "");
  if (!host) return "";
  if (isIP(host)) return host;
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART.has(lastTwo) && parts.length >= 3) return parts.slice(-3).join(".");
  return lastTwo;
}

export function sameCompanyHost(a, b) {
  const left = registrableDomain(a);
  const right = registrableDomain(b);
  return Boolean(left && right && left === right);
}

export function isPrivateAddress(ip) {
  const value = String(ip).toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "::1" || value === "0.0.0.0") return true;
  if (value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  const v4 = value.startsWith("::ffff:") ? value.slice(7) : value;
  const parts = v4.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return value.includes(":") ? false : true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export async function assertPublicUrl(url) {
  if (!(url instanceof URL)) throw new Error("Enter a company website.");
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https websites can be scanned.");
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "metadata.google.internal") {
    throw new Error("That address cannot be scanned.");
  }
  if (url.username || url.password) throw new Error("That address cannot be scanned.");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((row) => row.address);
  if (!ips.length) throw new Error("We could not find that website. Check the URL and try again.");
  if (ips.some((ip) => isPrivateAddress(ip))) throw new Error("That address cannot be scanned.");
  return url;
}

export function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ allow: key === "allow", path: value });
    }
  }
  return groups;
}

function ruleMatches(pathname, rulePath) {
  if (!rulePath) return false;
  const end = rulePath.endsWith("$");
  const body = end ? rulePath.slice(0, -1) : rulePath;
  const pattern = `^${body.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}${end ? "$" : ""}`;
  return new RegExp(pattern).test(pathname || "/");
}

export function robotsAllows(groups, pathname, ua = USER_AGENT) {
  const agent = ua.toLowerCase();
  const specific = groups.filter((group) => group.agents.some((name) => name !== "*" && agent.includes(name)));
  const chosen = specific.length ? specific : groups.filter((group) => group.agents.includes("*"));
  let winner = null;
  for (const group of chosen) {
    for (const rule of group.rules) {
      if (!rule.path || !ruleMatches(pathname, rule.path)) continue;
      if (!winner || rule.path.length > winner.path.length || (rule.path.length === winner.path.length && rule.allow && !winner.allow)) {
        winner = rule;
      }
    }
  }
  return winner ? winner.allow : true;
}

export function classifyLink(url, text = "") {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  const hay = `${host} ${path} ${text}`.toLowerCase();
  if (host === "github.com" || host === "www.github.com") return "github";
  if (/(discord\.|slack\.com|join\.slack|community\.|forum\.|discourse)/.test(hay) || /\/(community|discord|slack|forum)(\/|$)/.test(path)) return "community";
  if (host.startsWith("status.") || path === "/status" || path.startsWith("/status/")) return "status";
  if (/changelog|\/releases(\/|$)|\/whats-new/.test(path)) return "changelog";
  if (path === "/pricing" || path.startsWith("/pricing/") || path === "/plans") return "pricing";
  if (host.startsWith("blog.") || path === "/blog" || path.startsWith("/blog/")) return "blog";
  if (host.startsWith("api.") || /\/(api-reference|api-docs|reference)(\/|$)/.test(path) || path === "/api" || path.startsWith("/api/")) return "apiReference";
  if (host.startsWith("docs.") || host.startsWith("developer.") || host.startsWith("developers.") || /\/(docs|documentation|developers|developer)(\/|$)/.test(path) || host.includes("readthedocs") || host.includes("gitbook")) {
    if (/api|reference/.test(path)) return "apiReference";
    if (/developer/.test(host) || /\/developers?(\/|$)/.test(path)) return "developerPortal";
    return "docs";
  }
  return null;
}

function decode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) return decode(match[1]);
  }
  return "";
}

export function extractPage(html, baseUrl) {
  const title = decode((/<title[^>]*>([^<]*)<\/title>/i.exec(html) || [])[1] || "");
  const description = meta(html, "og:description") || meta(html, "description");
  const siteName = meta(html, "og:site_name");
  const icons = [];
  const iconRe = /<link\b[^>]*>/gi;
  let iconMatch;
  while ((iconMatch = iconRe.exec(html))) {
    const tag = iconMatch[0];
    const rel = (/rel=["']([^"']+)["']/i.exec(tag) || [])[1] || "";
    if (!/icon|apple-touch-icon/i.test(rel)) continue;
    const href = (/href=["']([^"']+)["']/i.exec(tag) || [])[1];
    if (!href) continue;
    try {
      const sizes = (/sizes=["'](\d+)/i.exec(tag) || [])[1];
      icons.push({ url: new URL(href, baseUrl).toString(), score: sizes ? Number(sizes) : /apple-touch/i.test(rel) ? 180 : 16 });
    } catch {
      /* ignore bad icon urls */
    }
  }
  icons.sort((a, b) => b.score - a.score);
  const links = [];
  const anchorRe = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let anchor;
  while ((anchor = anchorRe.exec(html)) && links.length < 400) {
    const raw = decode(anchor[1]);
    if (!raw || raw.startsWith("#") || /^(mailto:|javascript:|tel:)/i.test(raw)) continue;
    try {
      const url = new URL(raw, baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      url.hash = "";
      const text = decode(anchor[2].replace(/<[^>]+>/g, " "));
      links.push({ url, text });
    } catch {
      /* ignore */
    }
  }
  return { title, description, siteName, icon: icons[0]?.url || "", links };
}

function emptyLinks() {
  return Object.fromEntries(LINK_KEYS.map((key) => [key, ""]));
}

function preferGithub(current, next) {
  if (!current) return next;
  try {
    const a = new URL(current).pathname.split("/").filter(Boolean);
    const b = new URL(next).pathname.split("/").filter(Boolean);
    if (b.length >= 1 && b.length <= 2 && (a.length > 2 || a.length === 0)) return next;
  } catch {
    return next;
  }
  return current;
}

function rememberLink(state, key, value) {
  if (!key || !value || !state.profile.links) return;
  if (key === "github") state.profile.links.github = preferGithub(state.profile.links.github, value);
  else if (!state.profile.links[key]) state.profile.links[key] = value;
}

function inferMarket(name, description) {
  const text = `${name} ${description}`.toLowerCase();
  if (/\b(ai|llm|machine learning|artificial intelligence)\b/.test(text)) return "AI application developers";
  if (/security|authentication|devtools|developer platform|api|sdk/.test(text)) return "Application developers";
  return "Application developers";
}

function niceName(extracted, hostname) {
  const fromSite = extracted.siteName;
  if (fromSite && fromSite.length < 40) return fromSite;
  const title = (extracted.title || "").split(/\s+[|\-–—:]\s+/)[0].trim();
  if (title && title.length < 40 && !/home|welcome/i.test(title)) return title;
  const label = hostname.replace(/^www\./, "").split(".")[0] || hostname;
  return label.slice(0, 1).toUpperCase() + label.slice(1);
}

function skipPath(pathname) {
  return /\.(png|jpe?g|gif|svg|webp|ico|css|js|mjs|map|pdf|zip|gz|mp4|mp3|woff2?|ttf|xml)$/i.test(pathname);
}

function summary(state) {
  const phase = state.phase;
  const order = ["landing", "docs", "links", "profile", "done"];
  const steps = [
    { id: "landing", label: "Reading the landing page", count: state.pagesRead, unit: "page" },
    { id: "docs", label: "Finding docs, API and developer portal", count: state.sitesFound, unit: "site" },
    { id: "links", label: "Collecting links: GitHub, community, blog", count: state.linksCollected, unit: "link" },
    { id: "profile", label: "Building your company profile", count: null, unit: null },
  ].map((step) => {
    const si = order.indexOf(step.id);
    const pi = order.indexOf(phase);
    let status = "pending";
    if (phase === "done" || (pi > si && phase !== "error")) status = "done";
    else if (phase === "error" && si === 0) status = "error";
    else if (si === pi) status = "active";
    else if (pi > si) status = "done";
    const countLabel = step.unit && step.count != null ? `${step.count} ${step.unit}${step.count === 1 ? "" : "s"}` : "";
    return { id: step.id, label: step.label, status, count: countLabel };
  });
  return {
    id: state.id,
    status: state.status,
    phase: state.phase,
    startedAt: state.startedAt,
    pagesRead: state.pagesRead,
    sitesFound: state.sitesFound,
    linksCollected: state.linksCollected,
    error: state.error,
    profile: state.status === "done" || state.phase === "profile" ? state.profile : null,
    steps,
  };
}

async function fetchText(url, accept) {
  let current = url;
  const seen = new Set();
  for (let hop = 0; hop < 5; hop += 1) {
    const key = current.toString();
    if (seen.has(key)) throw new Error("The website redirected in a loop.");
    seen.add(key);
    await assertPublicUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, accept: accept || "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "accept-language": "en" },
      signal: AbortSignal.timeout(10000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The website returned a broken redirect.");
      current = new URL(location, current);
      continue;
    }
    const type = response.headers.get("content-type") || "";
    const text = await response.text();
    return { url: current, status: response.status, type, text: text.slice(0, 1_200_000) };
  }
  throw new Error("The website redirected too many times.");
}

async function robotsFor(state, url) {
  const host = url.hostname.toLowerCase();
  if (state.robots[host]) return state.robots[host];
  try {
    const robotsUrl = new URL("/robots.txt", `${url.protocol}//${url.host}`);
    const result = await fetchText(robotsUrl, "text/plain,*/*");
    state.robots[host] = result.status === 200 ? parseRobots(result.text) : [];
  } catch {
    state.robots[host] = [];
  }
  return state.robots[host];
}

async function allowed(state, url) {
  const groups = await robotsFor(state, url);
  return robotsAllows(groups, url.pathname || "/");
}

function noteCounts(state) {
  const hosts = new Set();
  for (const key of ["docs", "apiReference", "developerPortal"]) {
    if (!state.profile.links[key]) continue;
    try { hosts.add(new URL(state.profile.links[key]).hostname); } catch { /* ignore */ }
  }
  state.sitesFound = hosts.size;
  state.linksCollected = LINK_KEYS.filter((key) => key !== "website" && state.profile.links[key]).length;
}

function absorb(state, pageUrl, extracted) {
  if (!state.profile.name) {
    state.profile.name = niceName(extracted, pageUrl.hostname);
    state.profile.description = cleanText(extracted.description, 180);
    state.profile.logoUrl = extracted.icon || "";
    state.profile.domain = pageUrl.hostname.replace(/^www\./, "");
    state.profile.links.website = `${pageUrl.protocol}//${pageUrl.host}/`;
    state.profile.market = inferMarket(state.profile.name, state.profile.description);
  }
  if (!state.profile.logoUrl && extracted.icon) state.profile.logoUrl = extracted.icon;
  if (!state.profile.description && extracted.description) state.profile.description = cleanText(extracted.description, 180);
  const baseHost = state.rootHost;
  for (const link of extracted.links) {
    const kind = classifyLink(link.url, link.text);
    if (kind) rememberLink(state, kind, link.url.toString());
    enqueue(state, link.url, baseHost, kind ? "classified" : "link");
  }
  noteCounts(state);
}

function enqueue(state, url, baseHost, source) {
  if (state.queue.length > 80) return;
  let normalized;
  try {
    normalized = new URL(url instanceof URL ? url.toString() : url);
  } catch {
    return;
  }
  normalized.hash = "";
  if (normalized.protocol !== "http:" && normalized.protocol !== "https:") return;
  if (skipPath(normalized.pathname)) return;
  const key = normalized.toString();
  if (state.seen.includes(key)) return;
  const kind = classifyLink(normalized);
  const own = sameCompanyHost(normalized.hostname, baseHost);
  const externalDocs = kind === "docs" || kind === "apiReference" || kind === "developerPortal";
  const externalRecord = kind === "github" || kind === "community";
  if (!own && !externalDocs && !externalRecord) return;
  if (!own) {
    const hostCount = state.externalHosts[normalized.hostname] || 0;
    if (hostCount >= (externalRecord ? 1 : 2)) return;
  }
  let priority = 3;
  if (source === "probe" || kind === "docs" || kind === "apiReference" || kind === "developerPortal") priority = 2;
  else if (kind === "github" || kind === "community") priority = 4;
  state.seen.push(key);
  state.queue.push({ url: key, priority });
  state.queue.sort((a, b) => a.priority - b.priority);
}

async function fetchPage(state, target) {
  const url = new URL(target);
  if (!(await allowed(state, url))) {
    state.blocked += 1;
    return null;
  }
  const result = await fetchText(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8");
  if (result.status >= 400) {
    const error = new Error(result.status === 403 || result.status === 401
      ? `The site refused DevRadar (HTTP ${result.status}).`
      : `The website returned HTTP ${result.status}.`);
    error.status = result.status;
    throw error;
  }
  if (!/html|xml|text\/plain/i.test(result.type) && !result.text.includes("<html") && !result.text.includes("<a ")) {
    return null;
  }
  state.pagesRead += 1;
  if (!sameCompanyHost(result.url.hostname, state.rootHost)) {
    state.externalHosts[result.url.hostname] = (state.externalHosts[result.url.hostname] || 0) + 1;
  }
  return { url: result.url, extracted: extractPage(result.text, result.url) };
}

function probeUrls(origin) {
  const paths = ["/docs", "/documentation", "/developers", "/developer", "/api", "/api-docs", "/reference", "/pricing", "/blog", "/changelog", "/status", "/community", "/llms.txt"];
  return paths.map((path) => new URL(path, origin).toString());
}

async function finish(state) {
  state.phase = "profile";
  if (brightDataConfigured() && (!state.profile.links.docs || !state.profile.links.github)) {
    const query = `${state.profile.domain} documentation github`;
    const search = await serpSearch(query).catch(() => ({ hits: [] }));
    for (const hit of search.hits || []) {
      try {
        const url = new URL(hit.url);
        const kind = classifyLink(url, hit.title);
        if (kind) rememberLink(state, kind, url.toString());
      } catch {
        /* ignore */
      }
    }
    noteCounts(state);
  }
  if (!state.profile.links.website) state.profile.links.website = state.url;
  state.profile.market = state.profile.market || inferMarket(state.profile.name, state.profile.description);
  state.status = "done";
  state.phase = "done";
}

export async function createScan(rawUrl) {
  const input = String(rawUrl || "").trim();
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new Error("Enter a company website.");
  }
  await assertPublicUrl(url);
  const state = {
    id: newId(12),
    url: url.toString(),
    rootHost: url.hostname,
    status: "running",
    phase: "landing",
    startedAt: Date.now(),
    pagesRead: 0,
    sitesFound: 0,
    linksCollected: 0,
    blocked: 0,
    error: "",
    queue: [],
    seen: [],
    robots: {},
    externalHosts: {},
    profile: { name: "", domain: "", description: "", logoUrl: "", market: "", links: emptyLinks() },
  };
  let page;
  try {
    if (!(await allowed(state, url))) {
      state.status = "error";
      state.phase = "error";
      state.error = "That site's robots.txt disallows DevRadar from reading the landing page. You can enter the links manually.";
      return summary(state);
    }
    page = await fetchPage(state, url.toString());
  } catch (err) {
    state.status = "error";
    state.phase = "error";
    const message = err instanceof Error ? err.message : "The website could not be read.";
    state.error = /refused|robots|cannot be scanned|could not find|redirect/i.test(message)
      ? message
      : "We could not reach that website. Check the URL and try again.";
    return summary(state);
  }
  if (!page) {
    state.status = "error";
    state.phase = "error";
    state.error = "The landing page did not return a page we could read.";
    return summary(state);
  }
  state.rootHost = page.url.hostname;
  state.seen.push(page.url.toString());
  state.profile.links.website = `${page.url.protocol}//${page.url.host}/`;
  absorb(state, page.url, page.extracted);
  if (!state.profile.name) state.profile.name = state.rootHost.replace(/^www\./, "");
  for (const probe of probeUrls(`${page.url.protocol}//${page.url.host}/`)) enqueue(state, probe, state.rootHost, "probe");
  state.phase = state.queue.length ? "docs" : "profile";
  if (!state.queue.length) await finish(state);
  return { ...summary(state), _state: state };
}

export async function advanceScan(state, batch = 3) {
  if (state.status !== "running") return summary(state);
  let fetched = 0;
  while (state.queue.length && fetched < batch && state.pagesRead < PAGE_CAP) {
    const next = state.queue.shift();
    state.phase = next.priority <= 2 ? "docs" : "links";
    try {
      const page = await fetchPage(state, next.url);
      if (page) absorb(state, page.url, page.extracted);
      fetched += 1;
    } catch {
      fetched += 1;
    }
  }
  if (!state.queue.length || state.pagesRead >= PAGE_CAP) await finish(state);
  return summary(state);
}

export function viewScan(state) {
  return summary(state);
}

export function attachState(view, state) {
  return { ...view, _state: state };
}
