import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// What the one scan covers. Each row reuses an icon from icons/apps and
// describes only what api/scan.js and api/report.js actually do.
const COVERS = [
  ["deep-scan", "Agent readiness", "#5CD68C", "Whether AI agents can use your docs: robots.txt rules for GPTBot, ClaudeBot and other AI crawlers, what Chrome, ClaudeBot, GPTBot and curl each get back, llms.txt, OpenAPI specs, an advertised MCP server, and whether a missing page returns a real 404."],
  ["docs-scanner", "Docs and sample code", "#9C8CFF", "Your docs the way a new developer meets them: whether they load over valid TLS, a quickstart, code samples, working search, how fresh the pages are, and broken links."],
  ["competition", "Competitors", "#FF8A6B", "The companies in your category, found from your own site and search, with their docs run through the same checks as yours."],
  ["developer-profiler", "Developer personas", "#7FB2FF", "Who your developers are likely to be: roles, stacks and what each of them needs from your docs."],
  ["ideas", "Targeting and messaging", "#F5D76E", "Where to reach those developers and what to say to them, drawn from the personas and your category."],
  ["event-scanner", "Events and speakers", "#5CD68C", "Upcoming conferences, meetups and hackathons that match your platform, from public calendars, and who is speaking about your space."],
  ["influencers", "Communities", "#F28FB0", "Your official community channels, and the meetups and user groups around your category."],
  ["social-trends", "Buzz on X", "#F2B45C", "What developers are saying about you and your competitors on X, compared side by side."],
  ["looper", "Integrations and adoption", "#4FD1D9", "Where you show up in the places agents and developers install from: MCP registries, Claude connectors, IDE marketplaces and agent frameworks, plus adoption on GitHub."],
].map(([icon, name, color, text]) => ({ icon, name, color, text }));

function page({ title, description, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/app.css">
</head>
<body>
<header class="site-header">
  <div class="shell header-inner">
    <a class="brand" href="/">
      <img src="/favicon.svg" width="36" height="36" alt="">
      <span class="brand-name">DevRadar</span>
      <span class="brand-by">by Rex St. John</span>
    </a>
    <div class="header-actions">
      <nav class="nav-links" aria-label="Primary">
        <a href="/how-it-works">How it works</a>
        <a href="/docs">Docs</a>
        <a href="/pricing">Pricing</a>
      </nav>
    </div>
  </div>
</header>
${body}
<footer class="site-footer"><div class="shell"><p>© 2026 DevRadar by Rex St. John · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p></div></footer>
<script src="/scan-form.js" type="module"></script>
</body>
</html>
`;
}

function radar() {
  const cx = 520;
  const cy = 300;
  const circles = [70, 130, 190, 250, 320, 390].map((radius, index) => `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#1d4a34" stroke-width="1.2" opacity="${(0.9 - index * 0.12).toFixed(2)}"/>`).join("");
  const lines = [0, 45, 90, 135].map((deg) => {
    const angle = (deg * Math.PI) / 180;
    const x2 = cx + Math.cos(angle) * 400;
    const y2 = cy + Math.sin(angle) * 400;
    const x1 = cx - Math.cos(angle) * 400;
    const y1 = cy - Math.sin(angle) * 400;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#1d4a34" stroke-width="1.1" opacity="0.85"/>`;
  }).join("");
  const points = [
    [410, 78, "API", 0],
    [500, 128, "DevConf", 0],
    [650, 96, "Discord", 1],
    [790, 72, "GitHub", 1],
    [300, 214, "npm", 0],
    [372, 274, "Reddit", 0],
    [710, 214, "docs/", 1],
    [830, 286, "SDK", 0],
    [690, 372, "Meetup", 0],
    [448, 410, "Hackathon", 0],
    [560, 500, "X", 0],
  ];
  const dots = points.map(([x, y, label, lit]) => `<g class="${lit ? "lit" : ""}"><circle cx="${x}" cy="${y}" r="${lit ? 5 : 3.5}" fill="${lit ? "#5CD68C" : "#143526"}"/><text x="${x + 12}" y="${y + 5}">${label}</text></g>`).join("");
  return `<div class="radar-wrap"><svg class="radar" viewBox="0 0 900 640" role="img" aria-label="Radar of developer touchpoints: GitHub, Discord, docs, npm, SDK, API, meetups, hackathons, X and Reddit">${lines}${circles}${dots}<circle cx="${cx}" cy="${cy}" r="4" fill="#F2F5F8"/></svg><div class="radar-sweep"></div></div>`;
}

function scanForm() {
  return `<form class="hero-form" data-scan-form>
          <input class="field" name="url" placeholder="docs.yourcompany.com" aria-label="Docs or website" autocomplete="url" autocapitalize="off" spellcheck="false">
          <button class="btn-primary btn-lg" type="submit" disabled>Run the scan</button>
        </form>
        <p class="hero-error" data-scan-status hidden></p>`;
}

function covers() {
  return COVERS.map((item) => `<article class="app-card cover">
      <span class="icon-tile" style="--app:${item.color}"><img src="/icons/apps/${item.icon}.svg" alt=""></span>
      <h3>${item.name}</h3>
      <p>${item.text}</p>
    </article>`).join("\n");
}

const home = page({
  title: "DevRadar",
  description: "One scan of your developer program: agent readiness, docs, competitors, personas, events, communities, buzz and integrations, in one report.",
  body: `<main>
  <section class="hero">
    ${radar()}
    <div class="shell"><div class="hero-copy">
      <p class="eyebrow">DevRadar</p>
      <h1>One scan of your whole developer program</h1>
      <p class="lede">Developers now meet your product through agents, search and other people's code as often as through your own site. DevRadar reads your docs the way an agent, a developer and a competitor would, and puts everything it finds in one report.</p>
      <div id="hero-action">
        ${scanForm()}
        <p class="hint">Free. No account. About 90 seconds. Search powered by Bright Data.</p>
      </div>
    </div>
    </div>
  </section>
  <section class="section" id="covers"><div class="shell">
    <p class="eyebrow">What the scan checks</p>
    <h2>Everything in one report</h2>
    <p class="lede">Every scan covers all of this. There is nothing to pick and nothing to install.</p>
    <div class="apps">${covers()}</div>
  </div></section>
</main>`,
});

const how = page({
  title: "How it works · DevRadar",
  description: "Paste your docs or website. DevRadar reads it politely and returns one report.",
  body: `<main class="page"><div class="shell narrow">
    <p class="eyebrow">How it works</p>
    <h1>Paste a URL. Get one report.</h1>
    <p class="lede">The scan reads only public pages, identifies itself, and respects robots.txt.</p>
    <div class="steps">
      <article class="step-card"><h2>1. Paste your docs or website</h2><p>No account. DevRadar finds your docs, API reference, GitHub and community links from there.</p></article>
      <article class="step-card"><h2>2. DevRadar reads it</h2><p>It fetches pages as <code>DevRadar/0.1.0</code>, then as Chrome, ClaudeBot, GPTBot and curl to compare what each one gets. Requests are spaced out and every domain has a shared daily budget, so no site gets hammered.</p></article>
      <article class="step-card"><h2>3. It looks outward</h2><p>It finds your competitors and runs their docs through the same checks, then gathers personas, events, communities, buzz on X, integrations and GitHub adoption.</p></article>
      <article class="step-card"><h2>4. You get the report</h2><p>About 90 seconds, never more than 150. The report has an unlisted link you can share. Scanning the same domain again within 24 hours returns the same report.</p></article>
    </div>
    <p class="fine">Everything the scan checks is listed on the <a href="/">home page</a>. The API and the MCP server are in the <a href="/docs">docs</a>.</p>
  </div></main>`,
});

const docs = page({
  title: "Docs · DevRadar",
  description: "Run DevRadar from the HTTP API or from an agent through the DevRadar MCP server.",
  body: `<main class="page"><div class="shell narrow prose docs">
    <p class="eyebrow">Docs</p>
    <h1>DevRadar docs</h1>
    <p class="lede">Run the scan from the site, from the HTTP API, or from any agent that speaks MCP.</p>

    <h2 id="scan">Run a scan</h2>
    <p>Paste a docs or website URL on the <a href="/">home page</a>. The report opens when the scan finishes, in about 90 seconds. Reports are unlisted: anyone with the link can read one, and nothing links to it.</p>

    <h2 id="api">HTTP API</h2>
    <h3>Start a scan</h3>
    <pre><code>curl -X POST https://devradar.rexstjohn.com/api/scan \\
  -H 'content-type: application/json' \\
  -d '{"url": "docs.example.com"}'</code></pre>
    <table><tbody>
      <tr><td><code>202</code></td><td>Started. Returns <code>token</code> and <code>reportUrl</code>.</td></tr>
      <tr><td><code>200</code></td><td>This domain was scanned in the last 24 hours. Returns that report, with <code>reused: true</code>.</td></tr>
      <tr><td><code>409</code></td><td>The domain's daily request budget is used up. Returns an <code>error</code> naming the reset time, and the last report if there is one.</td></tr>
      <tr><td><code>429</code></td><td>This address started 8 scans in the last hour.</td></tr>
      <tr><td><code>400</code></td><td>The URL cannot be scanned.</td></tr>
    </tbody></table>
    <h3>Read a report</h3>
    <pre><code>curl https://devradar.rexstjohn.com/api/report/TOKEN</code></pre>
    <p>Returns the report as JSON. <code>status</code> is <code>running</code> until the scan finishes, then <code>done</code>, so poll every few seconds. The main fields:</p>
    <table><tbody>
      <tr><td><code>headline</code></td><td>The one-line summary, once the scan is done.</td></tr>
      <tr><td><code>findings</code></td><td>One entry per check: <code>probe</code>, <code>result</code> (pass, fail, info or unknown), <code>severity</code>, <code>headline</code>, the <code>url</code> it looked at, and the <code>evidence</code> behind it.</td></tr>
      <tr><td><code>competitors</code></td><td>The competitors the scan found, with their docs URLs.</td></tr>
      <tr><td><code>banner</code></td><td>The most serious problem, if there is one.</td></tr>
      <tr><td><code>ceilingHit</code></td><td>True when the 150-second limit cut the scan short. Checks it did not reach come back as <code>unknown</code>.</td></tr>
    </tbody></table>

    <h2 id="mcp">MCP server</h2>
    <p>The DevRadar MCP server lets Claude Code, Cursor, Codex and other agents run the scan and read the report. It needs Node 20 or later and no API key. Add it to your agent's MCP settings:</p>
    <pre><code>{
  "mcpServers": {
    "devradar": {
      "command": "npx",
      "args": ["-y", "github:Verafyai/devradar"]
    }
  }
}</code></pre>
    <p>In Claude Code: <code>claude mcp add devradar -- npx -y github:Verafyai/devradar</code></p>
    <p>The server is one file with no dependencies. To run it without npx, download <a href="/mcp/server.js"><code>server.js</code></a> and use <code>node /path/to/server.js</code> as the command.</p>
    <table><tbody>
      <tr><td><code>devradar_scan</code></td><td>Scan a docs or website URL. Waits for the report by default and returns its summary and link.</td></tr>
      <tr><td><code>devradar_report</code></td><td>Read a report by token or link: headline, every finding, and the competitors found.</td></tr>
    </tbody></table>
    <p>Set <code>DEVRADAR_URL</code> to point the server at another deployment.</p>

    <h2 id="limits">How it treats your site</h2>
    <ul class="plain-list">
      <li>Every request identifies itself as <code>DevRadar/0.1.0</code>, with a link back to this site.</li>
      <li>It respects robots.txt and fetches only public pages.</li>
      <li>Requests to a host are spaced at least 400 ms apart.</li>
      <li>Each domain has one request budget per 24 hours, shared by everyone who scans it.</li>
      <li>We never publish who failed a check.</li>
    </ul>
    <p>Questions: <a href="mailto:rex@verafy.ai">rex@verafy.ai</a>.</p>
  </div></main>`,
});

const pricing = page({
  title: "Pricing · DevRadar",
  description: "The scan is free. Staying current is a subscription.",
  body: `<main class="page"><div class="shell">
    <p class="eyebrow">Pricing</p>
    <h1>The scan is free. Staying current isn't.</h1>
    <p class="lede">Everything we find on the first pass stays yours. What you pay for is breadth, and a re-scan every week that only emails you when something actually changed.</p>
    <div class="tiers">
      <article class="tier"><p class="name">Watch</p><p class="price-n">$149<span> /mo</span></p><p>Don't let it break without knowing.</p><ul><li>Weekly agent and docs scan</li><li>Change alerts only. No quiet-week email</li><li>Weekly sample-code test run</li><li>1 domain</li></ul><a class="btn btn-outline" href="mailto:rex@verafy.ai?subject=DevRadar%20Watch">Start Watch</a></article>
      <article class="tier featured"><p class="name">Radar</p><p class="price-n">$599<span> /mo</span></p><p>Stay relevant, not just unbroken.</p><ul><li>Everything in Watch</li><li>Buzz scan: trends and angles, weekly</li><li>Events and CFP tracking in your regions</li><li>3 competitors tracked</li><li>Full personas and messaging</li></ul><a class="btn-primary" href="mailto:rex@verafy.ai?subject=DevRadar%20Radar">Start Radar</a></article>
      <article class="tier"><p class="name">Program</p><p class="price-n">$2,500<span> /mo</span></p><p>The scan, plus someone who has run this before.</p><ul><li>Everything in Radar</li><li>Unlimited competitors</li><li>Monthly working session</li><li>3, 6, 9 and 12 month roadmap, maintained</li><li>Docs-fix prompts and specs</li></ul><a class="btn btn-outline" href="mailto:rex@verafy.ai?subject=DevRadar%20Program">Talk to us</a></article>
    </div>
    <div class="tables">
      <section class="panel"><h2>Credits · $25 each</h2><table><tbody><tr><td>Extra domain scan</td><td>4</td></tr><tr><td>One-off competitive report</td><td>20</td></tr><tr><td>Re-run outside schedule</td><td>2</td></tr><tr><td>Deep persona study</td><td>10</td></tr></tbody></table></section>
      <section class="panel"><h2>One-off, done by a human</h2><table><tbody><tr><td>Deep manual audit</td><td>$4,500</td></tr><tr><td>Competitive intelligence report</td><td>$500</td></tr><tr><td>Platform extension or bridges build</td><td>$8K to $15K</td></tr></tbody></table></section>
    </div>
    <p class="fine">We scan each domain at a global rate limit, shared across every customer. Reports are unlisted. We never publish who failed.</p>
  </div></main>`,
});

const privacy = page({
  title: "Privacy · DevRadar",
  description: "What DevRadar stores about you and the public companies you track.",
  body: `<main class="page"><div class="shell narrow prose"><p class="eyebrow">Privacy</p><h1>Privacy</h1>
    <p>The scan needs no account. It stores the URL you scanned and what it found on public pages, so the report can be read again from its link.</p>
    <p>Scans identify themselves as DevRadar, respect robots.txt, and stay within a request budget for each domain. We do not collect private contact details of developers.</p>
    <p>If you give an email to unlock a full report, we store that email with the report.</p>
    <p>Reports stay unlisted. We do not publish who failed a scan.</p>
    <p>Questions: <a href="mailto:rex@verafy.ai">rex@verafy.ai</a>.</p>
  </div></main>`,
});

const terms = page({
  title: "Terms · DevRadar",
  description: "Terms for using DevRadar.",
  body: `<main class="page"><div class="shell narrow prose"><p class="eyebrow">Terms</p><h1>Terms</h1>
    <p>DevRadar is a project by Rex St. John. The free scan is provided as available. Paid plans are agreed by email before billing starts.</p>
    <p>You may scan any public company. Do not use DevRadar to break another site's rules, to collect private contact details, or to send mail people did not ask for.</p>
    <p>Event listings come from public calendars such as confs.tech and from search. Dates and calls for papers can change. Check the event site before you buy a ticket or submit a talk.</p>
    <p>Questions: <a href="mailto:rex@verafy.ai">rex@verafy.ai</a>.</p>
  </div></main>`,
});

const notFound = page({
  title: "Not found · DevRadar",
  description: "That page is not on DevRadar.",
  body: `<main class="page"><div class="shell narrow"><p class="eyebrow">404</p><h1>That page is not here.</h1><p class="lede">The scan is on the home page.</p><p><a class="btn-primary" href="/">Back to DevRadar</a></p></div></main>`,
});

function emDash(html, file) {
  if (html.includes("—") || html.includes("–")) throw new Error(`Em or en dash in ${file}`);
  return html;
}

await writeFile(path.join(root, "index.html"), emDash(home, "index"));
await mkdir(path.join(root, "how-it-works"), { recursive: true });
await writeFile(path.join(root, "how-it-works/index.html"), emDash(how, "how"));
await mkdir(path.join(root, "docs"), { recursive: true });
await writeFile(path.join(root, "docs/index.html"), emDash(docs, "docs"));
await writeFile(path.join(root, "pricing/index.html"), emDash(pricing, "pricing"));
await mkdir(path.join(root, "privacy"), { recursive: true });
await writeFile(path.join(root, "privacy/index.html"), emDash(privacy, "privacy"));
await mkdir(path.join(root, "terms"), { recursive: true });
await writeFile(path.join(root, "terms/index.html"), emDash(terms, "terms"));
await writeFile(path.join(root, "404.html"), emDash(notFound, "404"));
console.log("rendered pages");
