# DevRadar 15 evening build: plan

Owner: Rex St. John. Set up Sun Nov 1 2026. Loop: `/workspace/loops/devradar-evening-build.md`.
Spec (source of truth): `docs/spec/DEVRADAR_APPS_SPEC.md` in the repo, copy of `/workspace/devradar-in/devradar-apps/DEVRADAR_APPS_SPEC.md`
(section 7 is the day plan; sections 3 to 6 and 8 to 10 are the per app detail, rubric, SEO, copy, golden set, pricing, open questions).
Visuals: the ten PNG mockups in `docs/mockups/apps/` plus their HTML in `docs/mockups/apps/html/`; header, home and onboarding from
`DEVRADAR_REDESIGN_SPEC.md` and `docs/mockups/redesign/`. All companies, people and numbers in mockups are invented sample data ("Plinth").

## Why evenings

Rex keeps mornings for his own coding. The loop fires once each evening at about 7:00 PM PT, writes that day's cloud agent brief,
and the agent works overnight. The next evening's fire evaluates what the agent pushed, folds the top 3 failures into the next brief,
and moves on.

## Where the work happens

- Repo: `Verafyai/devradar` (does not exist yet; D0 creates it). Today the site ships from tarballs with `/workspace/devradar-deploy/deploy.sh`.
- Import: `/workspace/devradar-build/import/devradar-import.bundle` (git bundle, one commit `482c915` on `main`) and
  `devradar-import-tree.tgz` (same tree, no git). Contents: the site exactly as live (version.json sha 8538def, verified identical to
  devradar.rexstjohn.com on Nov 1 2026) plus `docs/spec/` and `docs/mockups/`. `npm test` passes 7 of 7 on the import.
- Branch: all 15 days push to one branch `build/15day` with one draft PR "DevRadar 15 evening build" against `main`.
  The loop never merges it. Rex merges when he wants, in pieces or at the end.
- Production stays on the current tarball deploy until Rex says otherwise. Connecting the Vercel project to the repo is his call (QUESTIONS.md).

## Feature flag rule

- Every new or changed surface ships behind a flag. Flags live in `lib/flags.js` and `flags.json` (all false by default).
  `DEVRADAR_FLAGS` (comma list, or `all`) turns them on for local and preview runs. One flag per app (`app_deep_scan`, `app_event_scanner`,
  ..., `app_looper`) plus `foundations`, `plan`, `seo_v2`, `copy_v2`.
- With no flags set, every page a visitor sees must render as it does today. The eval checks this each evening by building the branch
  with flags off and comparing to the baseline (any mechanical check that passed at baseline and now fails is a regression).
- Turning a flag on in production is a production change: Rex's yes only.
- Moving an app from SOON or BETA to LIVE on the home page, and any pricing or plan change, are Rex's yes only, even on D15.

## Calendar

D0 is optional and can run tonight. Each day's brief is written the evening of its date; the agent's output is evaluated the next evening.

| Day | Evening (PT) | App | Scope (spec section 7) | Exit check | Needs from Rex first |
|---|---|---|---|---|---|
| D0 | Sun Nov 1 (optional) | Repo and baseline | Create Verafyai/devradar from the import, branch build/15day, draft PR, CI (npm test), README with flags rule | Repo has the import commit; CI green; local eval of main equals live baseline (54.6) | Yes to creating the repo |
| D1 | Mon Nov 2 | Foundations | Company profile reuse, app page shell, run engine with steps and failure states ("not charged"), credits, Plan list (/plan), flags, eval harness hooks, golden set fixtures | Harness runs and scores a stub app | Golden set approval (can start with the proposal) |
| D2 | Tue Nov 3 | Deep Scan | Report redesign, lenses, ranked fixes, share link, rescan diff | Score at least 75 on golden set; reruns within 2 points | None for the UI; live reruns need Deep Scan keys in a preview (his yes) |
| D3 | Wed Nov 4 | Event Scanner | Sources, normalization, CFP deadlines, fit score with reasons | 50 hand checked events at least 95% correct dates | Bright Data budget per run (Q2) |
| D4 | Thu Nov 5 | Event Scanner | Plan, budget, exports (.ics, CSV, Notion), CFP draft, weekly watch, /events directory | Exports open in Calendar, CSV, Notion | None |
| D5 | Fri Nov 6 | Docs and Code | Crawler, links, OpenAPI accuracy, agent readiness checklist, /tools/agent-readiness | Zero false broken links on golden set | None |
| D6 | Sat Nov 7 | Docs and Code | Sandbox sample runs, agent quickstart run, Open PR (GitHub app) | PRs pass CI on 3 test repos | Sandbox choice (Q3), GitHub app scope (Q4) |
| D7 | Sun Nov 8 | Competition | Grid from Deep Scan and Docs runs, pricing parse, battle cards, change alerts | Every grade has dated evidence | None |
| D8 | Mon Nov 9 | Social Trends | Collection, clustering, deltas, share of voice, angles, Monday email (draft only, never sent by the loop) | Topic coherence judged 3 of 4 | Social data access (Q5) |
| D9 | Tue Nov 10 | Developer Profiler | Signal collection, clustering, quotes, messaging matrix | Top 3 personas stable in 4 of 5 reruns | None |
| D10 | Wed Nov 11 | Influencers | Relevant reach, ranking, drawer, outreach drafts (never sent), opt-out | No private data; 2 linked posts per person | Q5 |
| D11 | Thu Nov 12 | Idea Generator | Inputs from all apps, outlines, starter repo spec, calendar | Every idea has evidence; no unsupported features | None |
| D12 | Fri Nov 13 | Looper (DevRadar app) | GitHub app, release webhooks, drift detection, seeded drift test repo | Detects seeded drift in test repo | Q4 |
| D13 | Sat Nov 14 | Looper (DevRadar app) | Fix PRs with sample runs, weekly report, guardrails (PRs only, stop after 2 failures) | PRs only; stops after 2 failures | Q4 |
| D14 | Sun Nov 15 | SEO and copy | Section 5 and 6 across all pages, free tools, programmatic pages (real data only), OG images | Lighthouse SEO 100; copy checklist passes; mechanical eval: titles, meta, schema, canonical, OG all pass | Keyword volumes are [UNVERIFIED] until checked |
| D15 | Mon Nov 16 | Re-score and launch prep | Full eval on all nine, fix regressions, regenerate scorecard image with measured scores, write the LIVE proposal (which apps pass the gate) and the pricing mapping proposal | Scorecard regenerated with measured scores; then the loop pauses itself and reports | Every LIVE flip, pricing change, merge and deploy |

If a day slips (brief not launched, agent failed), the loop does not skip ahead: it keeps working the oldest unfinished day.
The run on Mon Nov 16 is the last regardless; anything unfinished goes into the final report as a backlog for the nightly polish loop
(spec section 7, "After D15"), which stays paused until Rex turns it back on.

## Each evening (summary; full procedure in RUN.md)

1. Read STATE.json. Stop if status is paused or done.
2. Evaluate the previous day's push on `build/15day`: build on the box twice (flags on, flags off), mechanical eval, judged checks,
   score the app with the section 4 rubric, check the exit check.
3. Write `briefs/D<n>.md` for the next day: that day's scope, plus the top 3 failures from step 2 as "fix first" items.
4. Log, update STATE.json and score history, report to Rex only if a brief is ready or a decision is needed.

## Scores

- Mechanical (box, every run): `evals/mech.mjs` on 11 pages (home, pricing, 9 apps): HTTP, title 50 to 60 chars and not generic,
  meta 140 to 155, one H1, canonical, OG image, schema, no em or en dashes, 14px minimum text, axe with no serious issues,
  no horizontal overflow at 375, 768, 1440, run meta line on app pages. Score = share of checks passing. Site checks: sitemap, llms.txt,
  /plan, /tools/agent-readiness, /events.
- Baseline measured Nov 1 2026, 7:15 AM PT against the live site: overall 54.6 (home 57.1, pricing 57.1, deep-scan 60.0, other eight apps 53.3).
  Failing everywhere: titles, meta length, canonical, OG image, schema; seven apps lack the run meta line. Passing everywhere: HTTP 200,
  one H1, no dashes, 14px minimum, axe, no overflow. Sitemap, llms.txt, /plan, /tools/agent-readiness, /events all 404.
  Files: `evals/out/baseline-2026-11-01/` (with screenshots), `scores/mech-history.csv`.
- App score (spec section 4, nine categories, 0 to 100): `evals/score.py`; written to `scores/<date>/devradar.csv` and `scores/app-history.csv`.
  The "Now" numbers in spec section 3 are the spec's own estimates, not measurements; STATE.json keeps them as `spec_now`.
  A category the run could not measure is `nm` and counts as 0; Customer value stays judged until Rex names raters (Q7).
