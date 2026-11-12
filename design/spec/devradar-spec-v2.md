# DevRadar — build spec

**Surface:** `devradar.rexstjohn.com`
**Tagline:** Developer Relations Radar. Keep it current.
**Absorbs:** `agentready` ships as Stage 2. That domain redirects here.

---

## 0. What it is

You give it your docs URL. Ninety seconds later you have a report on how your developer
surface looks from outside — to agents, to competitors, to the people you're trying to reach.
Part of it is free. The rest is a subscription.

The free scan is three things at once: a lead magnet, a cold-outreach asset, and the authority
play. Every decision below serves one of those.

---

## 1. Invariants

### 1.1 Never paywall the first truth

If the scan finds a 403 to ClaudeBot, **show the 403**, with the raw status line, for free,
forever. Gating a finding you've already made reads as extortion and destroys the authority
play that makes the whole thing work.

Gate **breadth** and **recurrence** — more competitors, more events, the weekly re-run. Never
the first fact.

### 1.2 Every finding carries verbatim evidence

`{claim, evidence, url, captured_at, probe_version}` where evidence is the **raw artifact** —
actual status line, actual headers, actual snippet. Never a summary of it.

A finding with no evidence object is dropped, not softened. Same rule as the claim store in
the kin repo, same reason.

### 1.3 Verified and inferred are visually distinct, always

Stages 1–3 are mostly **verified** — we fetched it, here it is. Stages 4–6 are substantially
**inferred** — personas, messaging angles, market verticals. Those are judgments.

Every card carries a tier chip. An inferred finding never renders in the same style as a
verified one, and the report never implies otherwise. This is the single most important trust
decision in the product: a tool that blurs the two is indistinguishable from the SEO-audit
spam it's competing against.

### 1.4 No score out of 100

No grade, no letter, no "DevRel Score: 62." Scores invite arguments about methodology and move
the conversation off the finding that mattered. Rank by severity internally for ordering only.

### 1.5 Progress is real, never a timer

The stage indicator moves because a stage finished, not because time passed. A fake progress
bar is the one thing that will be noticed by this audience, and it poisons everything else on
the page.

If a stage finishes in 3 seconds, it ticks over in 3 seconds. Uneven is honest.

### 1.6 Politeness budget, global

Max **60 requests per target domain per 24h**, across the whole platform, serialized, with
backoff. Respect `Retry-After`. Honest User-Agent naming the scanner with a URL explaining it.

The one exception is Stage 2's UA-discrimination probe (§3.2), limited to a handful of
requests and never disguised as a real browser session beyond the UA string.

**Competitor domains get the same budget.** A user scanning five competitors must not cause
five aggressive crawls.

### 1.7 Reports are unlisted

Unguessable URL per scan. No public leaderboard, no published list of who failed, ever. The
companies being scanned are the companies being sold to. Aggregate anonymized stats may be
published; named ones never, without written consent.

### 1.8 A probe that cannot run returns `unknown`

Never `fail`. A false positive in a report that gets forwarded to a VP of Engineering is
unrecoverable.

---

## 2. The wizard

Seven stages, ~90 seconds, live. One input: a docs URL.

```
[1] Docs            ████████████  12s   done
[2] Agent readiness ████████████  18s   done  ← 2 findings
[3] Competitors     ███████░░░░░  14s   running
[4] Events          ░░░░░░░░░░░░        queued
[5] Personas        ░░░░░░░░░░░░        queued
[6] Targeting       ░░░░░░░░░░░░        queued
[7] Report          ░░░░░░░░░░░░        queued
```

### Budget

| Stage | Target | Must not exceed |
|---|---|---|
| 1 Docs | 10s | 20s |
| 2 Agent readiness | 15s | 25s |
| 3 Competitors | 15s | 25s |
| 4 Events | 20s | 30s |
| 5 Personas | 15s | 25s |
| 6 Targeting | 10s | 20s |
| 7 Report | 5s | 10s |

Stages 3–6 run **partially parallel** once Stage 1 has produced a category. Total wall clock
target 90s, hard ceiling 150s. Past 150s the report renders with the incomplete stages marked
`unknown` and a line offering to email the rest. Never spin past the ceiling.

### Findings surface as they land

A finding appears under its stage the moment it exists, while later stages are still running.
**The first finding must appear within 20 seconds.** That's what stops someone closing the tab.

### The interesting-finding promotion

When Stage 2 produces a high-severity finding, it's promoted to a banner at the top of the
running wizard immediately — not held for the report. *"Your docs return 403 to ClaudeBot."*
The scan continues underneath.

---

## 3. The stages

### 3.1 Docs scan

Structure and health of the documentation surface.

- Reachability, redirect chain, TLS
- JS dependency: raw HTML text length vs rendered text length (flag below ~20%)
- Sitemap presence; docs URLs listed vs discoverable by crawling two levels
- Page count, depth, orphan pages
- Quickstart located? Time-to-first-code-sample by scroll depth
- Code samples: count, languages, whether they carry version markers
- Search present and functional
- Last-updated signals: `lastmod`, visible dates, stale-page count
- Broken internal links in the docs tree

### 3.2 Agent readiness — this is `agentready`

Ships as-is from the existing build. The probes:

- `robots.txt` agent policy: `GPTBot`, `ClaudeBot`, `Claude-User`, `PerplexityBot`,
  `Google-Extended`, `CCBot`, wildcards
- **UA discrimination:** fetch landing + one deep page as Chrome, ClaudeBot, GPTBot, curl, and
  the scanner's own UA. Compare status, size, challenge pages. *Highest severity in the suite.*
- `llms.txt` / `llms-full.txt` / `.well-known/`
- OpenAPI discoverability and completeness
- MCP server advertised — and does it answer an `initialize` handshake
- Error self-description: trigger benign 4xx, assess recoverability
- Version signalling legible without JS

### 3.3 Competitors — inferred, then confirmed

Infer 3–5 from category, docs language, and the technology surface. **Show them immediately
with a one-click correction** — *"Not these? Tell us who."* Magic when right, recoverable when
wrong.

Per competitor, the light version of Stages 1–2 plus:
- Docs freshness and release cadence
- Which agent-readiness probes they pass that you fail (and vice versa)
- Public developer-program surface: ambassador program, community, office hours

### 3.4 Events and activations

Public data, and the most immediately useful artifact in the report.

- Conferences, meetups, podcasts, hackathons in their category, next 12 months
- CFP deadlines, with days remaining
- **Where competitors spoke and you didn't** — the finding that lands
- Filter by GEO (asked once, at the paywall, not before)

### 3.5 Persona inference — **inferred tier**

From docs language, job postings, GitHub issue authors, who stars the repo, who posts about
them.

- 2–4 personas: role, seniority, what they're building, where they read
- For each: the events they attend, the people they follow
- Explicitly marked inferred. Every persona card shows what it was inferred *from*.

### 3.6 Targeting and messaging — **inferred tier**

- Angles not currently being used, with reasoning
- Vocabulary gaps: terms the category uses that their docs don't
- Candidate market verticals with the signal that suggested each
- Three specific recommended actions, each tied to a finding above

### 3.7 Report

Assembly. See §4.

---

## 4. The teaser and the gate

The report renders in full structure, with the gated parts visible as locked rows showing
**real counts**. Never hide that something exists.

| Section | Free | Paid |
|---|---|---|
| Docs scan | **everything** | — |
| Agent readiness | **everything, with raw evidence** | — |
| Competitors | 1 of 5, fully | all 5 |
| Events | 3 of N, N shown | all, + CFP tracking, + GEO filter |
| Personas | 1 of 3, fully | all |
| Targeting & messaging | the 3 actions, locked reasoning | everything |

The lock pattern, always: **count + one real example.**

> *We found 38 events in your category over the next 12 months. Here are three.*
> *Your competitors spoke at 11 of them. [unlock]*

Email is requested **after** the teaser renders, to unlock the rest. Not before the scan, not
to start it. Fewer addresses, much warmer.

---

## 5. Pricing

### Subscriptions — the recurring sweep

| | **Watch** $149/mo | **Radar** $599/mo | **Program** $2,500/mo |
|---|---|---|---|
| Agent + docs scan | weekly, change alerts | weekly | weekly |
| Sample-code test run | weekly | weekly | weekly |
| Buzz scan | — | weekly | weekly |
| Events & CFP | — | weekly, your GEOs | weekly |
| Competitors tracked | — | 3 | unlimited |
| Monthly working session | — | — | **yes** |
| 3/6/9/12 roadmap | — | — | maintained |

**Program is the point.** It's the consulting engagement, packaged to recur. Watch and Radar
exist to build a ladder to it.

### Credits — the bursty

$25/credit. Extra domain scan (4), one-off competitive report (20), ad-hoc re-run outside
schedule (2), deep persona study (10).

### One-off

Deep manual audit by a human: **$4,500** · Single competitive intelligence report: **$500** ·
Platform extension / bridges / sample-code build: **$8–15K**

### The change-alert is the retention mechanic

Weekly re-scan, diff against last week, and email **only when something changed**.
*"Your docs went JS-only in the redesign — ClaudeBot now sees an empty page."* Never a weekly
"nothing changed" email; that trains people to filter you.

---

## 6. Data model

```ts
export const scan = pgTable('scan', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').references(() => account.id),   // null until email given
  token: text('token').notNull().unique(),                      // unguessable report URL
  docsUrl: text('docs_url').notNull(),
  domain: text('domain').notNull(),
  category: text('category'),                                   // inferred in stage 1
  geo: jsonb('geo').$type<string[]>(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  wallMs: integer('wall_ms'),
  emailCapturedAt: timestamp('email_captured_at'),
});

export const stageRun = pgTable('stage_run', {
  id: uuid('id').primaryKey().defaultRandom(),
  scanId: uuid('scan_id').notNull().references(() => scan.id, { onDelete: 'cascade' }),
  stage: integer('stage').notNull(),            // 1..7
  status: text('status').notNull(),             // queued|running|done|unknown|skipped
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  note: text('note'),                           // why unknown
});

export const finding = pgTable('finding', {
  id: uuid('id').primaryKey().defaultRandom(),
  scanId: uuid('scan_id').notNull().references(() => scan.id, { onDelete: 'cascade' }),
  stage: integer('stage').notNull(),
  probe: text('probe').notNull(),               // 'P2.ua-discrimination'
  severity: text('severity').notNull(),         // high|medium|low|clear
  tier: text('tier').notNull(),                 // 'verified' | 'inferred'   see §1.3
  gated: boolean('gated').notNull().default(false),
  headline: text('headline').notNull(),
  body: text('body'),
  evidence: jsonb('evidence').notNull(),        // raw artifact. see §1.2
  inferredFrom: jsonb('inferred_from'),         // required when tier = 'inferred'
  capturedAt: timestamp('captured_at').notNull().defaultNow(),
});

export const domainBudget = pgTable('domain_budget', {
  domain: text('domain').primaryKey(),
  windowStart: timestamp('window_start').notNull(),
  requestCount: integer('request_count').notNull().default(0),
  blockedUntil: timestamp('blocked_until'),
});

export const subscription = pgTable('subscription', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => account.id),
  tier: text('tier').notNull(),                 // watch|radar|program
  domains: jsonb('domains').$type<string[]>(),
  competitors: jsonb('competitors').$type<string[]>(),
  creditBalance: integer('credit_balance').notNull().default(0),
  stripeSubId: text('stripe_sub_id'),
});

export const weeklyDiff = pgTable('weekly_diff', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id').notNull().references(() => subscription.id),
  previousScanId: uuid('previous_scan_id').references(() => scan.id),
  scanId: uuid('scan_id').notNull().references(() => scan.id),
  changes: jsonb('changes').$type<string[]>(),  // finding ids that appeared or cleared
  notifiedAt: timestamp('notified_at'),         // null when nothing changed — see §5
});
```

`inferredFrom` is `notNull` in practice: enforce in the service layer that a finding with
`tier: 'inferred'` and no `inferredFrom` throws. §1.3 is only real if it's enforced in code.

---

## 7. Milestones

**M1 — Stage 2 standing alone.** Port `agentready`. Scan form, live stage indicator for one
stage, findings with raw evidence, unlisted report page.
*Done when:* scanning five real companies produces five reports whose evidence blocks a
skeptical engineer would accept.

**M2 — Stage 1 and the real progress rail.** Docs scan. Seven stages visible, two live, the
rest queued. Progress driven by completion, never a timer.
*Done when:* an unevenly-timed run looks correct rather than broken.

**M3 — Stage 3, competitors.** Inference plus the one-click correction.
*Done when:* inference is right for 4 of 5 known companies, and correcting it re-runs cleanly.

**M4 — Stage 4, events.** Including the competitor-spoke-here finding.
*Done when:* it finds the real CFP deadlines for three conferences you can verify by hand.

**M5 — Stages 5 and 6, inferred tier.** Visually distinct from verified, `inferredFrom`
populated and shown on every card.
*Done when:* a reader can tell at a glance which findings are facts and which are judgments.

**M6 — Report, teaser and email gate.** Lock rows with real counts.
*Done when:* the free report is genuinely useful standing alone, and the locked rows make the
paid version obvious without hiding that something exists.

**M7 — Accounts, Stripe, three tiers, credit ledger.**

**M8 — The weekly diff.** Re-scan, compare, notify **only on change**.
*Done when:* a week with no changes sends no email.

**Hard stop after M2.** Run twenty real companies through stages 1–2 and send eight cold
emails before building M3. If the findings don't produce replies, the rest is decoration.

---

## 8. Design

Dark instrument. Deliberately unlike Kin — this is a tool, not a document.

```
--ground  #0B0E13     --panel  #141A22     --line   #222C38
--ink     #E6EBF2     --muted  #8A97A8     --dim    #5A6676
--high    #FF6B5A     --med    #F0A830     --clear  #4ECB8F     --info #5B9BFF
```

Archivo for display and UI (600/700 tight). IBM Plex Mono for all data, evidence, labels,
counts and stage names. 3px radius. Evidence blocks in mono on `--panel` with a left rule.

Severity colors differ in lightness as well as hue — never hue alone.

Build to the five artboards on the DevRadar canvas: landing, wizard running, report teaser,
pricing, phone.

---

## 9. What not to build

- No score, grade or percentage.
- No public leaderboard or named shame list.
- No fake progress, no estimated-time-remaining, no spinner without a stage behind it.
- No email gate before the scan starts.
- No chatbot. No "ask our AI about your report."
- No weekly email when nothing changed.
- No dashboard with twelve widgets. The report is the product; a dashboard is what you build
  when you don't know what the product is.
- No security findings. This is not a pentest and must never look like one.
