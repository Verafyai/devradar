# DevRadar artboards (claude.ai artifact MdrpyFkBDPR4VG2pvZcFTJ)
Canvas headings: "One input, seven stages, ninety seconds" (boards 1-3); "What they pay for" (boards 4-5). Dark UI, green accent (#3fc98a-ish), red/orange/blue severity tags, monospace for data.

## 01 Landing (01-landing.png)
Layout: top nav bar (logo + "DevRadar" left; "How it works", "Pricing", "Sign in" (blue) right). Centered hero column. Footer bar.
Text: DevRadar | How it works | Pricing | Sign in
DEVELOPER RELATIONS RADAR
Keep it current.
Enter your docs page. We scan it the way an agent, a competitor and a developer would — and tell you what they find.
[input: docs.yourcompany.com] [Run the scan] (green button)
No signup. ~90 seconds. You keep the report.
Stage chips: 1 · Docs | 2 · Agent readiness | 3 · Competitors | 4 · Events | 5 · Personas | 6 · Targeting | 7 · Report
Callout card: WHAT WE USUALLY FIND FIRST — "Docs that return 403 to ClaudeBot while returning 200 to Chrome." Quote: "A meaningful share of dev-tool companies block the exact agents their customers point at them. Nobody has told them."
Footer: "Reports are unlisted. We never publish who failed." (left) / "A project by Verafy" (right)

## 02 Live scan / wizard running (02-wizard.png)
Layout: top bar with logo and "docs.llamaindex.ai" right; red alert banner full width; two columns: left STAGES rail, right FINDINGS SO FAR cards.
Text: DevRadar — docs.llamaindex.ai
Banner: [HIGH] Your docs return 403 to ClaudeBot and return 200 to Chrome.   "See the response →"
STAGES (44s elapsed): 1 Docs 12s done; 2 Agent readiness "2 findings" done; 3 Competitors running; 4 Events & activations running; 5 Personas queued; 6 Targeting & messaging queued; 7 Report queued.
Note: "Stages advance when they finish, not on a clock. Uneven timing is the scan working, not stalling."
FINDINGS SO FAR:
- [HIGH][VERIFIED] P2 · UA discrimination — "Docs return 403 to ClaudeBot, 200 to Chrome"
  UA ClaudeBot/1.0 → HTTP/2 403 cf-mitigated: challenge
  UA GPTBot/1.2 → HTTP/2 403 cf-mitigated: challenge
  UA Chrome/141.0 → HTTP/2 200 48,112 bytes
  captured 2026-10-20T14:21:08Z
- [MEDIUM][VERIFIED] P5 · llms.txt — "No llms.txt on either domain"
  /llms.txt → 404; /llms-full.txt → 404; /.well-known/llms.txt → 404
- [CLEAR] P4 · OpenAPI — "Complete OpenAPI spec at /openapi.json — 118 paths, examples populated"
- (dashed) ● Inferring competitors from category: vector / retrieval infrastructure…

## 03 Report + locks / report teaser (03-report-teaser.png, plus 03-report-teaser-b-scrolled.png for the lower half)
Layout: single centered column, scrolls vertically; top bar logo left, "Unlisted report · 20 Oct 2026 · 88s" right.
Text: DOCS.LLAMAINDEX.AI
Four things to fix, and 38 places you aren't.
01–02 Docs & agent readiness — COMPLETE · FREE
 [HIGH][VERIFIED] Docs return 403 to ClaudeBot, 200 to Chrome; UA ClaudeBot/1.0 → 403 cf-mitigated: challenge; UA Chrome/141.0 → 200 48,112 bytes
 [MEDIUM] No llms.txt on either domain | [MEDIUM] Quickstart samples pin a deprecated import path
03 Competitors — 1 of 5 shown
 Chroma — "passes 3 probes you fail"; llms.txt present · ClaudeBot 200 · MCP server responds; docs updated 2 days ago · 14 releases this quarter
 Locked: "4 more competitors scanned — LanceDB, Pinecone, Weaviate, Qdrant." [Unlock →]
04 Events & activations — 3 of 38 shown
 AI Engineer World's Fair — CFP closes in 19 days; RAG & Retrieval Summit — Chroma spoke · you didn't; Latent Space podcast — open to pitches
 Locked: "35 more in the next 12 months. Competitors spoke at 11 of them." [Unlock →]
05–06 Personas & targeting — INFERRED
 [INFERRED] The solo builder shipping a RAG prototype — "Reaches you through a coding agent, not a search engine. Evaluates in one sitting and abandons on the first broken sample." inferred from: 61% of GitHub issue authors are first-time contributors · quickstart is the most-linked page · docs language assumes no infra team
 Locked: "2 more personas, 3 messaging angles you aren't using, and 4 candidate verticals." [Unlock →]
Unlock the rest — "Everything above stays yours either way — including the 403 and its raw response. The rest of the report takes an email." [you@company.com] [Unlock report]
Links: "Subscribe for a weekly re-scan →"  "Talk to us about building something →"

## 04 Tiers / pricing (04-pricing.png)
Layout: top bar (logo; "Run a free scan →" blue right); headline left-aligned; three pricing cards (middle highlighted green); two tables below (credits, one-off); footnote.
Text: The scan is free. Staying current isn't.
Everything we find on the first pass stays yours. What you pay for is breadth — and a re-scan every week that only emails you when something actually changed.
WATCH $149/mo — Don't let it break without knowing. Weekly agent + docs scan; Change alerts only — no quiet-week email; Weekly sample-code test run; 1 domain. [Start Watch]
RADAR $599/mo [MOST TEAMS] — Stay relevant, not just unbroken. Everything in Watch; Buzz scan — trends and angles, weekly; Events & CFP tracking in your regions; 3 competitors tracked; Full personas and messaging. [Start Radar] (green)
PROGRAM $2,500/mo — The scan, plus someone who has run this before. Everything in Radar; Unlimited competitors; Monthly working session (bold); 3/6/9/12-month roadmap, maintained; Docs-fix prompts and specs. [Talk to us]
CREDITS · $25 EACH: Extra domain scan 4; One-off competitive report 20; Re-run outside schedule 2; Deep persona study 10
ONE-OFF, DONE BY A HUMAN: Deep manual audit $4,500; Competitive intelligence report $500; Platform extension / bridges build $8–15K
Footnote: We scan each domain at a global rate limit, shared across every customer. Reports are unlisted. We never publish who failed.

## 05 Phone (05-phone.png)
Layout: narrow mobile frame (~260px wide) centered on grey; single column version of landing.
Text: DevRadar | Sign in
DEVELOPER RELATIONS RADAR
Keep it current.
Enter your docs page. We scan it the way an agent, a competitor and a developer would.
[docs.yourcompany.com] [Run the scan]
No signup. ~90 seconds.
WHAT WE USUALLY FIND FIRST — Docs that return 403 to ClaudeBot while returning 200 to Chrome. "Blocking the exact agents your customers point at you."
Footer: Reports are unlisted. We never publish who failed.

## Sticky notes (right of board 3)
1 (blue): "Progress is real, never a timer. A stage ticks over because it finished. If stage 1 takes 3 seconds and stage 4 takes 28, that is what the rail shows. Uneven is honest, and this audience will notice a fake bar."
2 (orange): "Verified and inferred never share a style. Stages 1–3 are things we fetched. Stages 5–6 are judgments. Every inferred card shows what it was inferred FROM, or it does not ship."
3 (green): "Never paywall the first truth. The 403 is free, forever, with its raw status line. Gate breadth and recurrence — more competitors, more events, the weekly re-run."
