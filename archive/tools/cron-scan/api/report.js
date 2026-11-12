// src/constants.ts
var SCANNER_VERSION = "0.1.0";
var ABOUT_URL = "https://devradar.rexstjohn.com/";
var SCANNER_UA = `DevRadar/${SCANNER_VERSION} (+${ABOUT_URL}; read-only; docs and public metadata only)`;
var POLITENESS_WINDOW_MS = 24 * 60 * 60 * 1e3;

// src/client.ts
import { Agent, fetch as undiciFetch } from "undici";
var dispatcher = new Agent({
  connectTimeout: 15e3,
  headersTimeout: 2e4,
  bodyTimeout: 2e4
});

// src/html.ts
import { parse } from "node-html-parser";

// src/openapi.ts
import { parse as parseYaml } from "yaml";

// src/probes/docs.ts
import { parse as parse2 } from "node-html-parser";
var STALE_MS = 540 * 24 * 60 * 60 * 1e3;

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
function renderProgress(input) {
  return renderScanPage({
    ...input,
    automated: false,
    wallMs: input.wallMs,
    polling: { token: input.token, step: input.step }
  });
}

// src/ssrf.ts
import { BlockList, isIP } from "node:net";
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

// src/storage.ts
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
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
    return path.join(this.root, safeKey(key));
  }
  async get(key) {
    try {
      return await readFile(this.file(key), "utf8");
    } catch (err) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }
  async put(key, body) {
    const file = this.file(key);
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, body);
    const { rename } = await import("node:fs/promises");
    await rename(tmp, file);
  }
  async delete(key) {
    await rm(this.file(key), { force: true });
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
        if (entry.isDirectory()) await walk(path.join(current, entry.name), childKey);
        else out.push(childKey);
      }
    };
    await walk(path.join(this.root, clean), clean);
    return out;
  }
  async lock(name) {
    const dir = path.join(this.root, ".locks", safeKey(name));
    await mkdir(path.dirname(dir), { recursive: true });
    const deadline = Date.now() + 3e4;
    for (; ; ) {
      try {
        await mkdir(dir, { recursive: false });
        return async () => {
          await rm(dir, { recursive: true, force: true });
        };
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
        if (Date.now() > deadline) throw new Error(`timed out waiting for lock ${name}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
  }
};
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
var IP_WINDOW_MS = 60 * 60 * 1e3;
function jobKey(token) {
  return `jobs/${token}.json`;
}
async function loadReportHtml(store, token) {
  return store.get(`reports/${token}.html`);
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
function progressHtml(job) {
  const view = wizardView(job);
  return renderProgress({
    title: `Scanning ${job.company} \u2014 DevRadar`,
    company: job.company,
    docsUrl: job.docs_url,
    token: job.token,
    stages: view.stages,
    findings: view.findings,
    banner: job.banner?.headline ?? null,
    ceiling: job.ceiling_hit,
    wallMs: Date.parse(job.updated_at) - job.started_ms,
    step: job.step
  });
}

// src/selfserve/http.ts
async function handleReport(input) {
  const token = input.url.searchParams.get("token") || "";
  if (!/^[A-Za-z0-9_-]{16,}$/.test(token)) {
    return { status: 404, headers: { "content-type": "text/plain; charset=utf-8" }, body: "Not found" };
  }
  const done = await loadReportHtml(input.store, token);
  if (done) {
    return htmlResult(done);
  }
  const job = await loadJob(input.store, token);
  if (!job) {
    return { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" }, body: "Not found" };
  }
  if (job.status === "done") {
    return htmlResult(await loadReportHtml(input.store, token) ?? progressHtml(job));
  }
  return htmlResult(progressHtml(job));
}
function htmlResult(body) {
  return {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer"
    },
    body
  };
}
function vercelSend(res, result) {
  res.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  res.end(result.body);
}

// api/report.ts
async function handler(req, res) {
  const host = (Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host) || "localhost";
  const url = new URL(req.url || "/", `http://${host}`);
  const result = await handleReport({ url, store: openStore() });
  vercelSend(res, result);
}
export {
  handler as default
};
