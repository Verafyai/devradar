# DevRadar apps: full spec v1

> For Cursor and Grok Bot. Site: **devradar.rexstjohn.com**. Covers all nine apps on the home page, one at a time: what a DevRel or developer marketing person is trying to get done, the "click and get a great result in a few minutes" version of each, the screen, how it works, scoring, an SEO pass, a copy pass, and a 15 day build-out that checks and improves each app systematically.
> Designs (source of truth for visuals), in this folder: `01-event-scanner.png` · `02-developer-profiler.png` · `03-social-trends.png` · `04-influencers.png` · `05-docs-code-scanner.png` · `06-looper.png` · `07-competition.png` · `08-deep-scan.png` · `09-idea-generator.png` · `10-scorecard-and-build-plan.png`. HTML sources in `html/`.
> All companies, people, events, numbers and quotes in the mockups are **invented sample data** (the sample customer is "Plinth", a vector search product). Never ship sample data as real.
> Builds on `DEVRADAR_REDESIGN_SPEC.md` (header, home, sign-in, company onboarding, tokens) and `LOOPER_REDESIGN_SPEC.md`. Where this file covers an app page, it wins.
> Copy rules for every page: no em or en dashes; no invented numbers on marketing pages; claims link to evidence; public information only about people.

---

## 0. The job, in one paragraph

A DevRel or developer marketing lead has too many jobs and no team: know who the developers are, be where they are, say something worth hearing this week, keep the docs from rotting, know what competitors just did, and show leadership it is working. Each DevRadar app does one of those jobs end to end from the saved company profile, in minutes, and ends with something they can **act on** (a plan, a draft, a pull request, a calendar entry), not a report to read. Every app feeds the others: personas sharpen events and influencers, trends and gaps feed ideas, docs findings feed Looper.

```
             Company profile (saved once)
                         │
  Developer Profiler ──► personas ──► Event Scanner · Influencers · Social Trends · Idea Generator
  Social Trends ───────► rising topics ─────────────────────────────────────────► Idea Generator
  Competition ─────────► gaps, battle cards ──► Idea Generator · Deep Scan
  Deep Scan ───────────► top fixes ──► Docs & Code Scanner ──► Looper (keeps them fixed)
  Event Scanner ───────► CFP deadlines ──► Idea Generator (talk ideas)
```

---

## 1. Audit of the live site (Nov 1, 2026)

| Page | What is there | Problem |
|---|---|---|
| Home | "Agentic DevRel", nine app cards, Scan your company | Good shell. Seven of nine apps are SOON; nothing shows what a result looks like |
| Event Scanner | Form: Target market, Target location, When; Find events | No preview of results, no deadlines, no "why", no export. `[UNVERIFIED: result quality; not run in this audit]` |
| Deep Scan (LIVE) | One field, Run Deep Scan, "About 90 seconds" | No sample report on the page; the strongest proof is hidden behind the click |
| Seven SOON apps | Waitlist form and "What it will ask" | No promise of the output; waitlist gives nothing back |
| Pricing | Watch $149, Radar $599, Program $2,500, credits $25 | Plans map to Deep Scan, Event Scanner, Competition; apps are not named in plans |
| SEO | Each app has a title and meta description | Titles are "App · DevRadar" (no search intent); no schema, no sample content, waitlist pages are thin |

Fix pattern used everywhere below: **show the result first.** Every app page shows a real-looking sample result for an example company before the user runs anything, and the waitlist apps show the sample with "Get notified" instead of an empty form.

---

## 2. Shared foundations (build once)

**Tokens and type** as `DEVRADAR_REDESIGN_SPEC.md` §1: bg `#0A0D12`, surfaces `#11161D` / `#151B23`, borders `#222B36` / `#2D3845`, green `#5CD68C` (button text `#06210F`), text `#F2F5F8` / `#C3CCD6` / `#8C97A4` / `#5F6B78`, Inter, **minimum 14px**, body 16px. App colors and icons as the home grid. Status chips: LIVE green, BETA blue `#7FB2FF`, SOON amber.

**App page pattern** (every mockup):
1. Header (76px) with company switcher showing the pinned company.
2. Breadcrumb "Apps › Name".
3. 60px icon tile, H1 44px/800, status chip, one-line promise ending "Starting from {Company}'s profile."
4. **Input card**: 2 to 4 fields prefilled from the profile, one green run button, and above it the honest time and credit cost ("About 60 seconds · 2 credits").
5. **Summary strip** of 3 to 4 numbers when the app has them.
6. **Result**, main column, plus a right rail for the next action (plan, draft, export).
7. Every result row can be expanded to its **evidence** (links, dates, what was measured).

**Run engine**: step list with real progress (same as Verafy runs: step rows, heartbeat, visible failure, "not charged" on failure). Results are saved per company and versioned so every app can show "changed since last run".

**Plan** (`/plan`): one list per company that collects everything "Add to plan" creates across apps (events, content, outreach, fixes, tasks), with owner, date and export to calendar, CSV, Notion, Linear. This is what turns nine apps into one product.

**Evidence rule**: any number, quote or claim in a result links to where it came from. Quotes from public posts are paraphrased and short, attributed to a platform, never to a private person by name unless they are a public figure in the Influencers app.

**Privacy**: public information only; respect robots.txt and platform terms; no private emails or phone numbers; people data limited to public professional profiles; opt-out link on every profile.

---

## 3. The nine apps

Format for each: **Day in the life** · **Dream outcome** · **Inputs** · **How it works** · **Result** (see mockup) · **Actions** · **Quality bar and evals** · **Scorecard** · **SEO** · **Copy**.

Scores are 0 to 10 per category (rubric §4). "Now" is today's public page; "Target" is the design.

---

### 3.1 Event Scanner (`01-event-scanner.png`)

**Day in the life.** It is planning season. The DevRel lead has a budget and needs a Q1 event plan by Friday: which conferences, which CFPs are still open, where competitors will be, what it costs. Today that is 2 days of tabs and spreadsheets.

**Dream outcome.** One click: "Here are the 5 events worth it for you in the next 6 months, ranked, with every CFP deadline, what to do at each, what it costs, and which competitors will be there." Add three to a plan, get a budget, export to the calendar, and get a first CFP draft.

**Inputs** (prefilled): target market (from personas), where (cities, radius, Online), when (1, 3, 6, 12 months). Advanced: event types, max cost, size range.

**How it works.**
1. Collect candidates from event listings, meetup and hackathon platforms, CFP boards and conference sites via Bright Data search (`[UNVERIFIED: exact source list; respect each site's terms]`).
2. Normalize: dates, city, format, size, CFP open and close, sponsor deck dates, ticket and sponsor price ranges.
3. Enrich: past agendas and talk titles (topic overlap with the company's docs and personas), sponsors and speakers from competitors.
4. Score fit 0 to 100: audience match with personas (35%), topic overlap (25%), size in range (15%), cost vs budget (10%), CFP or sponsor slot open (10%), competitor presence (5%). Show the breakdown on click.
5. Recommend an action per event (Talk, Talk + booth, Lightning talk, Sponsor a prize, Attend) with an estimated cost.

**Result.** Summary strip (events found, CFPs open, competitors present, top 5 plan cost); **Deadlines in the next 90 days** timeline; ranked rows (date block, name, type, deadline chip, location and audience, one-line why, competitors there, fit %, recommended action, estimated cost, + Add to plan); rail with **Your Q1 plan**, budget, **Draft my CFP for {event}**, exports, weekly watch.

**Actions.** Add to plan · Draft CFP (uses the event's past talk topics, the company's docs and personas; output is an abstract, title options and a bio; never auto-submitted) · .ics with CFP deadlines as reminders · CSV · Notion · Watch (email when a new 80%+ event or CFP appears).

**Quality bar and evals.** Dates and CFP deadlines correct on a hand-checked set of 50 events (≥ 95%); no past events; duplicates merged; every event links to its source page; fit explanations reference real evidence.

**Scorecard.** Now 42 → Target **80**. Biggest jumps: actionability (2 → 9), trust (3 → 7), SEO (4 → 9).

**SEO.** Title "Find developer conferences, meetups and CFPs | DevRadar" · Meta "Find the developer events where your users will be, with every CFP deadline, what to do at each and what it costs. Ranked for your company in 60 seconds." · H1 "Event Scanner" + promise · **Programmatic pages**: `/events/{topic}` and `/events/{topic}/{city}` (for example "AI developer conferences 2027", "open CFPs for database talks"), built from the public event index, updated daily, each with real listings, deadlines and a CTA to rank them for your company. Schema `Event` items on those pages, `SoftwareApplication` on the app page, `FAQPage` for the FAQ. This is the site's best SEO asset.

**Copy.**
| | Before | After |
|---|---|---|
| Promise | "Find the conferences, meetups and hackathons where your target developers will be, by market and location." | "Find the conferences, meetups and hackathons where your developers will be, with the deadlines that matter." |
| Button | Find events | Find events (keep) |
| Empty state | (none) | Sample result for an example company with "Run it for {Company}" |
| Proof line | (none) | "About 60 seconds · 2 credits" above the button |

---

### 3.2 Developer Profiler (`02-developer-profiler.png`)

**Day in the life.** A new launch, a new hire, or a board deck asks "who is our developer?" The team has opinions, not evidence. Messaging is written for everyone and lands with no one.

**Dream outcome.** "Here are the 3 to 5 kinds of developers who use tools like ours, how big each group looks, their stack, where they spend time, what they complain about in their own words, and what to say to each." Export persona cards and a messaging matrix the whole team uses.

**Inputs**: target market, competitors to compare with, region.

**How it works.** Collect public signals: repos that depend on the company's and competitors' SDKs, issue and discussion threads, Stack Overflow tags, Reddit and HN threads, public job posts mentioning the tools. Extract role, stack, languages, tools, company size hints, pains and goals. Cluster into personas; size by share of signals (not a market size claim); pick representative paraphrased quotes with links; draft "what lands" and "what to avoid" per persona; build the messaging matrix (homepage hero, first tutorial, channel).

**Result.** Signal count and sources; 4 persona cards (name, share of signals bar, who they are, stack chips, where they spend time, a paraphrased quote with platform and "3 similar", lands and avoid); messaging matrix.

**Actions.** Export cards (PDF), send personas to Social Trends, Influencers and Idea Generator, set as the company's default personas.

**Quality bar.** Every persona backed by at least 50 signals; quotes paraphrased under 25 words and linked; no individual is identifiable from a persona; personas stable across reruns on the golden set (same top 3 in 4 of 5 runs).

**Scorecard.** Now 16 → Target **68** (stays BETA until trust reaches 7; persona quality is the hardest thing to prove).

**SEO.** Title "Developer persona generator from real community data | DevRadar" · Meta "Evidence-backed developer personas for your product: roles, stacks, where they spend time and what to say to each, built from public GitHub, Reddit and HN signals." · Free tool: public persona template and one sample persona set.

**Copy.** Promise "Evidence-backed profiles of the developers who use tools like yours, and what to say to each." Button "Build profiles". Replace "Profiles of the developers who use tools like yours" (says what it is, not what you get).

---

### 3.3 Social Trends (`03-social-trends.png`)

**Day in the life.** Monday morning. The lead needs something to post, write or reply to this week, and wants to know if a competitor or a bug is blowing up. Today: scrolling X, Reddit and HN for an hour and guessing.

**Dream outcome.** A Monday brief in their inbox: one headline sentence about the week, the 5 rising topics with change and sentiment, share of voice against competitors, mentions that need a reply, and 3 angles with **Draft it** buttons that produce a post, a tutorial outline or a reply.

**Inputs**: topics (prefilled from docs and personas), sources, window.

**How it works.** Pull posts for the topics and company and competitor names from X, Reddit, HN and GitHub within the window (official APIs where required; `[UNVERIFIED: plan limits per source]`); dedupe; cluster into topics; compute volume change vs the previous window, sentiment, share of voice; find mentions needing a reply (questions, bug reports); generate angles that match personas and the company's actual capabilities (check against docs so it never suggests a feature that does not exist).

**Result.** Headline ("Hybrid search is the conversation. You are 21% of it."), rising topics (sparkline, change, positive share bar, sources, one-line note), share of voice, mentions with replies needed, three angle cards.

**Actions.** Draft it (post in the user's voice, outline or reply; copy, never auto-post), Sources, Monday email, spike alerts.

**Quality bar.** Topics coherent (judged 3 of 4 on the golden set); deltas computed from counts shown on hover; angles never claim unsupported features (checked against docs); every topic links to at least 5 example posts.

**Scorecard.** Now 15 → Target **76**.

**SEO.** Title "Weekly developer trends for your category | DevRadar" · Meta "What developers in your space are talking about this week, your share of voice, and three angles to post about. Delivered every Monday." · Public weekly pages `/trends/{category}/{week}` (aggregate topics only, no personal data) as programmatic SEO.

**Copy.** Promise "What developers in your space are talking about this week, and what you should say about it." Button "Get this week's brief". Lead every brief with a one-sentence headline, not a chart.

---

### 3.4 Influencers & Innovators (`04-influencers.png`)

**Day in the life.** The team wants an ambassador program, a podcast tour or early-access testers, and keeps reaching out to people with big follower counts who do not care about the category.

**Dream outcome.** "The 25 people whose opinion actually moves your category, ranked by engaged reach, what they talk about, whether they already mention you or a competitor, and the right way to work with each," with a specific, useful outreach draft for the first one.

**Inputs**: category, platforms, region, size range.

**How it works.** Find people who post about the category across X, GitHub, YouTube, newsletters, LinkedIn, talks and community servers (public only). Score **relevant reach**: engaged audience on category posts (replies and reposts from accounts who themselves post in the category), not followers; filter bots and engagement pods; add topic match, recency, growth, and affinity (mentions of you or competitors). Suggest a play per person (early access, guest post, podcast, office hours, sponsored and disclosed content). Draft outreach from their recent public work.

**Result.** Ranked table (rank, person, handle, one-line who, topics, relevant reach and platforms, score bar, affinity chip, suggested play); profile drawer (why ranked, recent relevant posts, outreach draft, actions); privacy line.

**Actions.** Copy draft, open profile, add to plan, export to CRM (CSV). Never sends.

**Quality bar.** No private contact data; ranking stable across reruns; at least 2 linked relevant posts per person; opt-out honored within 7 days; drafts reference something the person actually did.

**Scorecard.** Now 16 → Target **72** (BETA until trust and feasibility improve; platform data access is the main risk).

**SEO.** Title "Find developer influencers in your category | DevRadar" · Meta "The builders, creators and maintainers who shape opinion in your developer category, ranked by engaged reach, with a plan to work with each." · No public people lists (privacy); publish a methodology page instead.

**Copy.** Promise "The builders, creators and maintainers who shape opinion in your category, ranked by real reach, with a plan to work with each." Button "Find people". Outreach drafts: specific, useful, no ask for promotion.

---

### 3.5 Docs & Code Scanner (`05-docs-code-scanner.png`)

**Day in the life.** Support tickets say the quickstart is broken. The docs team does not know which samples fail, which pages disagree with the API, or why AI coding tools give users wrong answers about the product.

**Dream outcome.** "Your docs scored 74. Here are the 5 fixes that matter, ranked, each with evidence, and most as a ready pull request." Plus: we ran every code sample, checked every link, compared docs to the OpenAPI spec, and watched an AI agent try the quickstart from a blank machine.

**Inputs**: docs URL, API reference (OpenAPI URL), sample code repos. Prefilled from the company profile.

**How it works.**
1. Crawl docs (sitemap first; cap and politeness rules as onboarding).
2. Extract code blocks; run them in a sandbox per language with test credentials the user provides or a mock server (`[UNVERIFIED: sandbox runner choice]`).
3. Check every link.
4. Compare documented endpoints, parameters, limits and errors with the OpenAPI spec and live responses where allowed.
5. Coverage: compare the page tree to competitors' docs and to rising topics.
6. **Agent readiness** checklist: llms.txt, markdown versions of pages, OpenAPI published, MCP server, copy buttons, auth in the quickstart, errors that explain the fix.
7. **Agent run**: an AI coding agent follows the quickstart in a clean container; record time, retries and where it got stuck.

**Result.** Docs health dial and one-line verdict; six category cards (Code samples run, Accuracy, Links, Coverage, Agent readiness, Time to hello world); **Fix these first** list (severity, issue with the real error, location, fix, Open PR or Send to Ideas); agent readiness checklist; "Watched an agent try" with replay.

**Actions.** Open PR (GitHub app; one PR per fix; never merges), export Markdown, send to Looper (keep it fixed), share report.

**Quality bar.** Zero false "broken" on the golden set for links; sample runs reproducible; every accuracy issue shows both the doc text and the API evidence; PRs pass the repo's CI before being offered.

**Scorecard.** Now 19 → Target **83**. This is the most defensible app and the bridge to the paid Watch plan.

**SEO.** Title "Docs and code sample checker: is your API documentation agent ready? | DevRadar" · Meta "Run every code sample, check every link, compare docs to your OpenAPI spec and see if AI agents can use your docs. Free first scan." · **Free tool**: `/tools/agent-readiness` (llms.txt and markdown check in 10 seconds, no sign-in) as the top-of-funnel; plus a guide "How to make your docs agent ready".

**Copy.** Promise "An audit of your docs, API reference and sample code that runs every sample and hands you fixes as pull requests." Button "Scan my docs". Verdict line in plain words ("Good docs, weak for agents.").

---

### 3.6 Looper (`06-looper.png`)

**Day in the life.** Every release breaks something in the docs, and nobody notices until a user does. The docs scanner found the problems once; they come back.

**Dream outcome.** "Connect your repos once. On every release, Looper finds what drifted and opens the fixes." The lead sees docs in sync percentage rising and approves PRs.

**Inputs**: product repo (release source), docs repo, samples repo. GitHub app install.

**How it works.** Release webhook → diff the changelog and code (renamed symbols, changed signatures, new limits) → find affected docs pages and samples → run affected samples → write fixes → run them → open PRs with evidence; file issues when the fix needs a human; weekly report. Guardrails: PRs only, never merges; stop after 2 failed fixes and ask; per-run time and cost caps. Loop internals, spec, goals and run posts as `LOOPER_REDESIGN_SPEC.md`.

**Result.** Stats (docs in sync, samples passing, fix PRs merged with median time to merge, drift caught before users); release feed (per release: drift summary chip, PRs and issues with status); docs in sync over 90 days; rules; weekly report.

**Scorecard.** Now 20 → Target **82**. Lowest time to value (needs install and a release), highest actionability.

**SEO.** Title "Keep docs and code samples in sync with every release | DevRadar Looper" · Meta "Looper watches your releases, finds the docs and samples that drifted, and opens the fixes as pull requests." Content: "docs drift" guide, changelog-to-docs checklist.

**Copy.** Promise "Keeps your docs, API reference and samples in sync with every release, and opens the fixes for you." Button "Start watching". Price shown at the button ("Every release · from $149 a month").

---

### 3.7 Competition (`07-competition.png`)

**Day in the life.** Leadership asks "how do we stack up?" before a planning meeting. Sales asks for a battle card. The lead has a stale slide.

**Dream outcome.** A grid you can show leadership in 5 minutes, **measured not guessed**: grades on docs, time to hello world, pricing clarity, community, agent readiness, content pace and events; where you win and lose in plain words; a battle card per competitor; alerts when something changes.

**Inputs**: competitors (suggested from the profile and Deep Scan, editable), dimensions.

**How it works.** For each company: Deep Scan lenses, Docs Scanner light pass, an agent runs each quickstart (time to hello world), pricing page parse (public price at standard usage points), community activity (public forum or Discord response times where visible, GitHub activity), content cadence (blog, video, docs changelog), events (from Event Scanner). Grades from rubric thresholds, each grade linked to evidence. Change detection monthly.

**Result.** Grid with letter grades (you highlighted), overall grade, where you win, where you lose (each linking to the app that fixes it), battle card (when they say, you say, proof), changes this month.

**Actions.** Export grid (PNG, PDF, slides), battle cards (PDF), alerts, send gaps to Idea Generator.

**Quality bar.** Every grade has dated evidence; pricing comparisons state the usage assumption; no disparaging claims; reruns produce the same grades unless something changed.

**Scorecard.** Now 18 → Target **74**.

**SEO.** Title "Developer experience competitive analysis | DevRadar" · Meta "Grade your competitors on docs, time to hello world, pricing, community and agent readiness. Measured by an agent, with evidence." · Do not publish other companies' grades publicly (legal and goodwill risk); publish methodology.

**Copy.** Promise "Your competitors on one grid, graded against you on what developers actually feel, with what to do about it." Button "Grade the field".

---

### 3.8 DevRadar Deep Scan (`08-deep-scan.png`) · LIVE

**Day in the life.** The first touch: a VP or the DevRel lead wants to know "how do we look?" before talking to anyone.

**Dream outcome.** In 90 seconds, a score and one sentence that names the real problem ("Developers trust you. Agents cannot find you."), three lens scores, and the 5 fixes that move the score most per hour of work, in a report they can forward to the CEO.

**Inputs**: website or docs URL.

**How it works.** As today's scan (agent, developer, competitor reads) `[UNVERIFIED: current internals]`, plus: score per lens with the checks behind it, fixes ranked by expected score gain per hour, rescan diff, shareable unlisted report link.

**Result.** Big score with change since last scan, headline and two-sentence summary, actions (Share, PDF, Compare); three lens cards with checks; top 5 fixes (moves, effort, Make a task); upsell to Watch at the bottom.

**Actions.** Share with team (unlisted link), PDF, make tasks (to Plan), compare scans, start Watch.

**Quality bar.** Same site twice in a day gives the same score ±2; every check explains itself; the headline is specific to the site (judged).

**Scorecard.** Now 54 → Target **80**.

**SEO.** Title "Free developer experience and agent readiness scan | DevRadar" · Meta "See how an AI agent, a developer and a competitor read your site and docs. Get a score and the 5 fixes that matter. Free, about 90 seconds." · Opt-in public sample reports for 3 invented or consenting companies.

**Copy.** Promise "Your site and docs, read the way an agent, a developer and a competitor would, with the fixes that move each score." Replace "Same scan as today." (internal language) with "About 90 seconds · free first scan".

---

### 3.9 Idea Generator (`09-idea-generator.png`)

**Day in the life.** The content calendar is empty, the team has capacity for 2 to 4 pieces a month, and every idea meeting produces the same three ideas.

**Dream outcome.** "Here are this month's best demos, tutorials and talks for you, each tied to evidence (a rising topic, a competitor gap, a persona's pain, a CFP deadline), with an outline, effort, and a starter repo," dropped onto a calendar.

**Inputs**: focus (persona or goal), formats, capacity.

**How it works.** Pull inputs from the other apps (personas, rising topics, competitor gaps, docs coverage gaps, open CFPs). Generate candidate ideas; reject any that need a feature the product does not have (checked against docs); score by impact (evidence strength × persona fit) per day of effort; write outlines; generate a starter repo spec on request; place the top N into the calendar by capacity and deadlines.

**Result.** "Grounded in" chips showing which apps fed it; idea cards (format, persona, impact, title, WHY with evidence, outline, effort, Draft, Starter repo, Add to calendar); month calendar.

**Actions.** Draft (outline to first draft), starter repo (creates a template repo in the user's GitHub on click), add to calendar, export to Notion or Google Calendar.

**Quality bar.** Every idea has at least one linked evidence item; no duplicate of existing docs or blog posts (checked); outlines technically correct for the product (judged).

**Scorecard.** Now 17 → Target **74**.

**SEO.** Title "Developer content ideas grounded in what developers are building | DevRadar" · Meta "Demo, tutorial and talk ideas for your developer product, tied to this week's trends, competitor gaps and open CFPs, with outlines and starter repos."

**Copy.** Promise "Demo, tutorial and talk ideas grounded in what your developers are building this week, ready to draft." Button "Generate ideas".

---

## 4. Scoring rubric

| Category | Weight | 10 means |
|---|---|---|
| Customer value | 20 | A DevRel lead would pay for this output alone |
| Time to value | 15 | Great result in under 3 minutes from one click, no setup |
| Output trust | 15 | Every claim links to evidence; reruns agree; spot checks pass |
| Actionability | 15 | Ends in a plan, draft, PR or calendar entry, not a report |
| UX clarity | 10 | A first-time user understands the result without help; 14px minimum; works at 375 |
| Differentiation | 10 | Not reproducible with a general chatbot in 10 minutes |
| Feasibility | 5 | Data access, cost and reliability are under control (PM view) |
| SEO | 5 | The page can win search traffic and has a public, useful surface |
| Copy | 5 | Benefit-first promise, specific numbers, one CTA, no jargon |

Score = Σ(category × weight) / 10, out of 100.

**Gate to LIVE:** score ≥ 75, Output trust ≥ 7, no hard-fail eval. On the targets, Developer Profiler (68), Influencers (72), Competition (74) and Idea Generator (74) stay BETA until trust improves; that is intentional.

**How each category is measured in the build-out:**
- Customer value: 5 DevRel practitioners rate sample outputs 0 to 10 `[needs Rex: recruit]`; until then, a judged rubric.
- Time to value: p50 and p90 run time from click to result, plus number of required fields.
- Output trust: % of claims with valid evidence links; rerun agreement on the golden set; hand spot check of 10 items per run.
- Actionability: does the result offer at least one action that creates a real artifact; % of runs where users take it (once live).
- UX clarity: scripted first-use test, axe with no serious issues, visual check at 375, 768, 1440.
- Differentiation: judged against a "plain chatbot" baseline answer for the same input.
- Feasibility: source API limits and cost per run vs price.
- SEO and Copy: §5 and §6 checklists.

---

## 5. SEO pass (site-wide)

1. **Titles**: change every app title from "App · DevRadar" to the search phrase plus brand (§3 per app). 50 to 60 characters.
2. **Meta descriptions**: outcome + proof + time, 140 to 155 characters (§3).
3. **H1** stays the app name; the promise line is the first paragraph.
4. **Schema**: `SoftwareApplication` (name, applicationCategory "BusinessApplication", offers) on every app page; `FAQPage` where there is an FAQ; `Event` on event directory pages; `Organization` on home.
5. **Sample results on every app page** so pages are not thin and searchers see value without signing in.
6. **Programmatic pages** with real data and daily updates: `/events/{topic}`, `/events/{topic}/{city}`, `/cfps/{topic}`; `/trends/{category}/{week}` (aggregate only).
7. **Free tools** (no sign-in, linkable): `/tools/agent-readiness` (llms.txt, markdown, OpenAPI, MCP checks), `/tools/cfp-deadlines`.
8. **Guides** that match the apps: "How to make your docs agent ready", "DevRel event planning template", "How to find developer influencers without buying followers", "Docs drift: why samples break on every release".
9. **Internal links**: each app links to the two apps it feeds; each guide links to its app.
10. **Technical**: canonical URLs, sitemap.xml including programmatic pages, OG images per app (sample result screenshot), fast LCP (results render server-side for sample data).
11. **Waitlist pages** become sample-result pages with "Get notified"; no thin forms.
12. Keyword research is `[UNVERIFIED]`: confirm volumes with a keyword tool before committing programmatic templates.

---

## 6. Copy pass (site-wide)

Principles applied to every page: lead with the outcome the user gets, not the feature; be specific (numbers, time, cost); say "you" and name the company; one primary CTA per view; show proof before asking; remove internal language ("Same scan as today"); sentence case; no em or en dashes; minimum 14px.

| Place | Before | After |
|---|---|---|
| Home hero lede | "Automate, streamline, optimize and schedule your developer relations and community work with DevRadar's apps, plugins and extensions." | "Nine apps that do the DevRel work you never have time for: event plans, personas, trends, docs fixes and competitive intel, from one company profile." |
| Apps heading | "Everything a DevRel team runs, on autopilot" | "Everything a DevRel team runs, on autopilot" (keep; it is good) |
| App card CTA | "Open {App} →" | Verb + outcome: "Plan my events →", "Fix my docs →", "Grade my competitors →" |
| Waitlist | "Developer Profiler is not ready to run yet. Leave your email and we will tell you when it opens." | "Here is what Developer Profiler gives you (sample below). Want it for {Company}? We will email you the day it opens." |
| Pricing headline | "The scan is free. Staying current isn't." | Keep; add which apps each plan includes |
| Run button meta | (none) | "About N seconds · N credits" above every run button |
| Errors | (generic) | Say what failed, that nothing was charged, and the one thing to try |

Each app's promise, button and empty state are in §3.

---

## 7. 15 day build-out (`10-scorecard-and-build-plan.png`)

Order follows value and dependencies (Deep Scan and Docs feed Competition; everything feeds Ideas; Looper builds on Docs).

| Day | App | Scope | Exit check |
|---|---|---|---|
| D1 | Foundations | Company profile reuse, app page shell, run engine with steps and failure states, credits, Plan list, eval harness, **golden set of 10 public dev-tool companies** `[Rex approves the list]` | Harness runs and scores a stub app |
| D2 | Deep Scan | Report redesign, lenses, ranked fixes, share link, rescan diff | Score ≥ 75 on golden set; reruns within ±2 |
| D3 | Event Scanner | Sources, normalization, CFP deadlines, fit score with reasons | 50 hand-checked events ≥ 95% correct dates |
| D4 | Event Scanner | Plan, budget, exports, CFP draft, weekly watch, `/events` directory | Exports open in Calendar, CSV, Notion |
| D5 | Docs & Code | Crawler, links, OpenAPI accuracy, agent readiness checklist | Zero false broken links on golden set |
| D6 | Docs & Code | Sandbox sample runs, agent quickstart run, Open PR (GitHub app) | PRs pass CI on 3 test repos |
| D7 | Competition | Grid from Deep Scan and Docs runs, pricing parse, battle cards, change alerts | Every grade has dated evidence |
| D8 | Social Trends | Collection, clustering, deltas, share of voice, angles, Monday email | Topic coherence judged 3 of 4 |
| D9 | Developer Profiler | Signal collection, clustering, quotes, messaging matrix | Top 3 personas stable in 4 of 5 reruns |
| D10 | Influencers | Relevant reach, ranking, drawer, outreach drafts, opt-out | No private data; 2 linked posts per person |
| D11 | Idea Generator | Inputs from all apps, outlines, starter repo, calendar | Every idea has evidence; no unsupported features |
| D12 | Looper | GitHub app, release webhooks, drift detection | Detects seeded drift in test repo |
| D13 | Looper | Fix PRs with sample runs, weekly report, guardrails | PRs only; stops after 2 failures |
| D14 | SEO + copy | §5 and §6 across all pages, free tools, programmatic pages, OG images | Lighthouse SEO 100; copy checklist passes |
| D15 | Re-score + launch | Full eval on all nine, fix regressions, move passing apps to LIVE, update home statuses and pricing | Scorecard image regenerated with measured scores |

**The daily loop** (every day, same order):
1. **Build** the day's scope behind a feature flag.
2. **Eval** against the 10 golden companies (mechanical checks + judged checks with 0 to 4 anchors).
3. **Score** all 9 categories for that app; write to `scores/{date}/devradar.csv`.
4. **Fix** the top 3 failures the same day.
5. **Check** screens at 375, 768, 1440 (`node scripts/visual-check.mjs <url> --widths=375,768,1440`), axe with no serious issues.
6. **Log** score history and a LOG entry; regressions become backlog rows.

After D15 the nightly polish loop takes over: per night, re-run evals for 3 apps on rotation, fix up to 2 low-risk items per app, never auto-ship pricing, auth, data or taste changes (needs Rex).

**Hard fails** (block LIVE): a result claim with no evidence; private personal data anywhere; any automatic post, email or merge; a run that hangs without a visible error; charging for a failed run.

---

## 8. Golden set and fixtures

- 10 public developer-tool companies across categories (database, auth, payments API, AI SDK, observability, CLI tool, open-source framework, cloud platform, devtool startup, hardware SDK) `[Rex approves]`.
- For each: hand-checked expectations per app (5 real upcoming events, known docs issues, 3 competitors, 2 known rising topics) stored in `evals/devradar/golden/`.
- Test repos for Docs and Looper with seeded breakages (renamed import, changed limit, broken link).
- Judged checks quote what they saw and use 0 to 4 anchors; mechanical checks are pass or fail.

---

## 9. Pricing alignment

| Plan | Apps included |
|---|---|
| Free | Deep Scan (first scan), Event Scanner (top 5), one sample of every other app |
| Watch $149/mo | Deep Scan weekly, Docs & Code Scanner monthly, Looper for 1 repo set |
| Radar $599/mo | Watch + Event Scanner with weekly watch, Social Trends Monday brief, Competition (3), Developer Profiler, Idea Generator |
| Program $2,500/mo | Radar + Influencers, unlimited competitors, working session, roadmap |

Credits stay for one-offs (`[needs Rex]` final mapping; numbers shown in mockups are proposals).

---

## 10. Open questions for Rex

1. Approve the golden set of 10 companies.
2. Event data sources and Bright Data budget per run.
3. Sandbox for running code samples (hosted runner vs containers on the box).
4. GitHub app scope for Docs and Looper PRs.
5. Social data access for X and Reddit (plan limits and cost).
6. Plan mapping and credit costs in §9.
7. Who are 5 DevRel practitioners to rate sample outputs (Customer value measurement)?
