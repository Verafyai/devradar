import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const APPS = [
  ["event-scanner", "Event Scanner", "#5CD68C", "", "Find the conferences, meetups and hackathons where your target developers will be, by market and location.", "Find the conferences, meetups and hackathons where your target developers will be."],
  ["developer-profiler", "Developer Profiler", "#7FB2FF", "soon", "Profiles of the developers who use tools like yours: roles, stacks, languages and where they spend time.", "Profiles of the developers who use tools like yours."],
  ["social-trends", "Social Trends", "#F2B45C", "soon", "What developers in your space are talking about on X, Reddit, Hacker News and GitHub, this week.", "What developers in your space are talking about on X, Reddit, Hacker News and GitHub, this week."],
  ["influencers", "Influencers & Innovators", "#F28FB0", "soon", "The builders, creators and maintainers who shape opinion in your category, ranked by real reach.", "The builders, creators and maintainers who shape opinion in your category."],
  ["docs-scanner", "Docs & Code Scanner", "#9C8CFF", "soon", "A one-time audit of your docs, API reference and sample code for errors, gaps and agent readiness.", "A one-time audit of your docs, API reference and sample code."],
  ["looper", "Looper", "#4FD1D9", "soon", "Keeps docs, API and sample code in sync as your product changes. Finds breakages and drifted wording on every release.", "Keeps docs, API and sample code in sync as your product changes."],
  ["competition", "Competition", "#FF8A6B", "soon", "Maps your competitors in a grid and grades each one against you on docs, DX, pricing and community.", "Maps your competitors and grades each one against you."],
  ["deep-scan", "DevRadar Deep Scan", "#5CD68C", "live", "A full analysis of your site and docs, read the way an agent, a competitor and a developer would.", "A full analysis of your site and docs, read the way an agent, a competitor and a developer would."],
  ["ideas", "Idea Generator", "#F5D76E", "soon", "App, demo and content ideas generated from what developers in your space are building right now.", "App, demo and content ideas generated from what developers in your space are building right now."],
].map(([slug, name, color, status, descriptor, blurb]) => ({ slug, name, color, status, descriptor, blurb }));

const PLANNED = {
  "developer-profiler": ["Target market, prefilled from your company", "Region"],
  "social-trends": ["Topics and keywords from your company", "Sources: X, Reddit, Hacker News, GitHub", "Time window"],
  "influencers": ["Category, prefilled from your company", "Region"],
  "docs-scanner": ["Docs URL", "API reference", "Sample-code repositories"],
  "looper": ["Repositories", "Docs URL", "Release feed"],
  "competition": ["Competitors, suggested from your category and editable"],
  ideas: ["Focus area, prefilled from your company"],
};

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
        <a href="/pricing">Pricing</a>
      </nav>
      <div id="account-slot">
        <button class="btn btn-outline" type="button" data-action="sign-in">Sign in</button>
      </div>
    </div>
  </div>
</header>
${body}
<footer class="site-footer"><div class="shell"><p>© 2026 DevRadar by Rex St. John · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p></div></footer>
<script src="/site.js" type="module"></script>
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

function cards() {
  return APPS.map((app) => {
    const pill = app.status === "live" ? `<span class="pill pill-live">LIVE</span>` : app.status === "soon" ? `<span class="pill pill-soon">SOON</span>` : "";
    return `<a class="app-card" href="/apps/${app.slug}">
      <span class="icon-tile" style="--app:${app.color}"><img src="/icons/apps/${app.slug}.svg" alt=""></span>
      <h3>${app.name} ${pill}</h3>
      <p>${app.descriptor}</p>
      <span class="open">Open ${app.name} →</span>
    </a>`;
  }).join("\n");
}

function profileLine(fallback) {
  return `<span data-profile-line data-signed-out="${fallback}" data-signed-in="Starting from {name}'s profile.">${fallback}</span>`;
}

function appPage(app) {
  const pill = app.status === "live" ? `<span class="pill pill-live">LIVE</span>` : app.status === "soon" ? `<span class="pill pill-soon">SOON</span>` : "";
  let panel = "";
  if (app.slug === "event-scanner") {
    panel = `<form id="event-form" class="panel">
      <div class="input-grid">
        <label>Target market<input class="field" name="market" data-prefill="market" placeholder="AI application developers" autocomplete="off"></label>
        <label>Target location<input class="field" name="location" placeholder="New York, NY · 50 mi" autocomplete="off"></label>
        <label>When<select class="field" name="window"><option value="1">Next month</option><option value="3" selected>Next 3 months</option><option value="6">Next 6 months</option><option value="12">Next 12 months</option></select></label>
        <button class="btn-primary btn-lg" type="submit" disabled>Find events</button>
      </div>
    </form>
    <p class="loading" id="event-status" hidden></p>
    <div id="event-results"></div>`;
  } else if (app.slug === "deep-scan") {
    panel = `<form id="deep-form" class="panel stack">
      <label>Docs or website<input class="field" id="deep-url" data-prefill="docs" placeholder="docs.yourcompany.com" autocomplete="url"></label>
      <button class="btn-primary btn-lg" id="deep-submit" type="submit" disabled>Run Deep Scan</button>
      <p class="fine">Same scan as today. It reads the site the way an agent, a competitor and a developer would, then opens your report. About 90 seconds.</p>
    </form>
    <p class="loading" id="deep-status" hidden></p>`;
  } else {
    const planned = (PLANNED[app.slug] || []).map((item) => `<li>${item}</li>`).join("");
    panel = `<form class="waitlist-form panel stack" data-app="${app.slug}">
      <h2>Join the waitlist</h2>
      <p class="sub">${app.name} is not ready to run yet. Leave your email and we will tell you when it opens.</p>
      <label>Email<input class="field" type="email" name="email" placeholder="you@company.com" autocomplete="email"></label>
      <button class="btn-primary" type="submit" disabled>Join the waitlist</button>
      <p class="fine" data-waitlist-note></p>
    </form>
    <section class="panel" style="margin-top:16px">
      <h2>What it will ask</h2>
      <ul class="plain-list">${planned}</ul>
    </section>`;
  }
  const body = `<main class="page"><div class="shell">
    <p class="crumbs"><a href="/#apps">Apps</a> <span aria-hidden="true">›</span> ${app.name}</p>
    <div class="app-head">
      <span class="icon-tile" style="--app:${app.color}"><img src="/icons/apps/${app.slug}.svg" width="28" height="28" alt=""></span>
      <div>
        <h1>${app.name} ${pill}</h1>
        <p class="lede">${app.blurb} ${profileLine("Sign in to start from a saved company profile.")}</p>
      </div>
    </div>
    ${panel}
  </div></main>`;
  return page({ title: `${app.name} · DevRadar`, description: app.descriptor, body });
}

const home = page({
  title: "DevRadar",
  description: "Agentic DevRel. Automate, streamline, optimize and schedule your developer relations and community work.",
  body: `<main>
  <section class="hero">
    ${radar()}
    <div class="shell"><div class="hero-copy">
      <p class="eyebrow">DevRadar</p>
      <h1>Agentic DevRel</h1>
      <p class="lede">Automate, streamline, optimize and schedule your developer relations and community work with DevRadar's apps, plugins and extensions.</p>
      <div id="hero-action">
        <form id="hero-form" class="hero-form">
          <input class="field" id="hero-url" name="url" placeholder="yourcompany.com" aria-label="Company website" autocomplete="url" autocapitalize="off" spellcheck="false">
          <button class="btn-primary btn-lg" id="hero-submit" type="submit" disabled>Scan your company</button>
        </form>
        <p class="hint">Sign in to save your company. Takes about 90 seconds. · Search powered by Bright Data</p>
        <p class="hero-error" id="hero-error" hidden></p>
      </div>
    </div>
    </div>
  </section>
  <section class="section" id="apps"><div class="shell">
    <p class="eyebrow">Apps</p>
    <h2>Everything a DevRel team runs, on autopilot</h2>
    <p class="lede">Pick an app. Each one starts from your saved company profile.</p>
    <div class="apps">${cards()}</div>
  </div></section>
</main>`,
});

const how = page({
  title: "How it works · DevRadar",
  description: "Save your company once. Every DevRadar app starts from that profile.",
  body: `<main class="page"><div class="shell narrow">
    <p class="eyebrow">How it works</p>
    <h1>Save the company once. Run the work from there.</h1>
    <p class="lede">DevRadar is a home for DevRel apps. Sign in, pin a company, and each app starts from the same profile.</p>
    <div class="steps">
      <article class="step-card"><h2>1. Sign in</h2><p>GitHub, Google, or a magic link to your work email. No password. We never post on your behalf.</p></article>
      <article class="step-card"><h2>2. Scan your company</h2><p>Paste a landing page. DevRadar reads the public site, respects robots.txt, and finds docs, API reference, GitHub and community links.</p></article>
      <article class="step-card"><h2>3. Confirm the profile</h2><p>Fix anything we got wrong, then save. Saving a company does not claim ownership. Anyone can track any public company.</p></article>
      <article class="step-card"><h2>4. Open an app</h2><p>Event Scanner and Deep Scan run today. The other apps are on the way. Join a waitlist and we will email you when one opens.</p></article>
    </div>
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

const companies = page({
  title: "Companies · DevRadar",
  description: "Manage the companies pinned to your DevRadar profile.",
  body: `<main class="page"><div class="shell narrow"><p class="eyebrow">Companies</p><h1>Your companies</h1><div id="companies-root"><p class="lede">Loading your profile.</p></div></div></main>`,
});

const privacy = page({
  title: "Privacy · DevRadar",
  description: "What DevRadar stores about you and the public companies you track.",
  body: `<main class="page"><div class="shell narrow prose"><p class="eyebrow">Privacy</p><h1>Privacy</h1>
    <p>DevRadar stores the account you sign in with (email, name, and the avatar a provider sends) and the company profiles you save. A company profile is built from public pages. Saving one does not claim that you own that company.</p>
    <p>Company scans identify themselves as DevRadar, respect robots.txt, and stay within a page cap. We do not collect private contact details of developers. People-related apps, when they ship, use public professional profiles only.</p>
    <p>Waitlist emails are stored so we can tell you when an app opens. Magic links expire after 30 minutes. Session cookies are httpOnly.</p>
    <p>Reports from Deep Scan stay unlisted. We do not publish who failed a scan.</p>
    <p>Questions: <a href="mailto:rex@verafy.ai">rex@verafy.ai</a>.</p>
  </div></main>`,
});

const terms = page({
  title: "Terms · DevRadar",
  description: "Terms for using DevRadar.",
  body: `<main class="page"><div class="shell narrow prose"><p class="eyebrow">Terms</p><h1>Terms</h1>
    <p>DevRadar is a project by Rex St. John. The free scan and the apps on this site are provided as available. Paid plans are agreed by email before billing starts.</p>
    <p>You may track any public company. Do not use DevRadar to break another site's rules, to collect private contact details, or to send mail people did not ask for.</p>
    <p>Event listings come from the public confs.tech calendar and are ranked for your market and location. Dates and calls for papers can change. Check the event site before you buy a ticket or submit a talk.</p>
    <p>Questions: <a href="mailto:rex@verafy.ai">rex@verafy.ai</a>.</p>
  </div></main>`,
});

const notFound = page({
  title: "Not found · DevRadar",
  description: "That page is not on DevRadar.",
  body: `<main class="page"><div class="shell narrow"><p class="eyebrow">404</p><h1>That page is not here.</h1><p class="lede">The scan, the apps, and your companies are still on the home page.</p><p><a class="btn-primary" href="/">Back to DevRadar</a></p></div></main>`,
});

function emDash(html, file) {
  if (html.includes("—") || html.includes("–")) throw new Error(`Em or en dash in ${file}`);
  return html;
}

await writeFile(path.join(root, "index.html"), emDash(home, "index"));
await mkdir(path.join(root, "how-it-works"), { recursive: true });
await writeFile(path.join(root, "how-it-works/index.html"), emDash(how, "how"));
await writeFile(path.join(root, "pricing/index.html"), emDash(pricing, "pricing"));
await mkdir(path.join(root, "companies"), { recursive: true });
await writeFile(path.join(root, "companies/index.html"), emDash(companies, "companies"));
await mkdir(path.join(root, "privacy"), { recursive: true });
await writeFile(path.join(root, "privacy/index.html"), emDash(privacy, "privacy"));
await mkdir(path.join(root, "terms"), { recursive: true });
await writeFile(path.join(root, "terms/index.html"), emDash(terms, "terms"));
await writeFile(path.join(root, "404.html"), emDash(notFound, "404"));
for (const app of APPS) {
  const dir = path.join(root, "apps", app.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), emDash(appPage(app), app.slug));
}
console.log("rendered pages");
