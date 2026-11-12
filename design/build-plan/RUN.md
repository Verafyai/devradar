# DevRadar evening build: how each run works

One run per evening at about 7:00 PM PT, Nov 1 to Nov 16 2026. Working folder: `/workspace/devradar-build/`.
Times in logs and reports are PT. Copy rule for every file the run writes: no em or en dashes (`evals/dashcheck.sh <files>`).

## 0. Gate (first, every run)

- Read `STATE.json`. If `status` is `paused` or `done`, write one log line and stop.
- If today is after `window.last_run_date` (Nov 16), set `status` to `done`, log, report "DevRadar build window ended", stop.
- Pick the working day: the lowest day whose status is not `passed` or `skipped`. Never skip ahead because the calendar moved.

## 1. Check what happened since the last run (read only)

- Repo: does `Verafyai/devradar` exist; new commits on `build/15day`; the draft PR's checks. Read only: no pushes, no comments, no merges.
- Cloud agent: did the parent record a launch for the working day (`days.Dn.agent`)? If the brief is still `brief_ready` and was
  never launched, do not write another brief. Report "D<n> brief still waiting to launch" (once per day, not every run) and stop.
- If the repo does not exist yet, the only work is D0: make sure `briefs/D0.md` is current and report it ready.

## 2. Evaluate the working day's push (when the agent pushed)

1. `evals/run-local.sh <repo> build/15day D<n>-on` (flags on), then `FLAGS= evals/run-local.sh <repo> build/15day D<n>-off` (flags off).
   Both build on the box in sample mode with no secrets. Output: `evals/out/<label>/mech.md`, screenshots at 375, 768, 1440, `build.txt` (sha, tests).
2. Regression check: every mechanical check that passed in the baseline (`evals/out/baseline-2026-11-01/mech.json`) must still pass
   with flags off. Any new failure is a regression and goes first in the next brief.
3. The day's exit check (PLAN.md table). Mechanical when possible; otherwise a judged check that quotes what was seen and uses
   0 to 4 anchors (0 missing, 1 present but wrong, 2 partly meets, 3 meets, 4 meets with evidence on every item).
   Exit checks that need data or access Rex has not approved are marked `blocked` with the question id, not failed.
4. Compare screenshots with the day's mockup (`docs/mockups/apps/NN-*.png`): layout, sections present, 14px minimum, works at 375.
   Write differences as concrete fixes ("rail missing at 1440", "deadline chips render 12px").
5. Score the app: `evals/score.py D<n> <app> value=.. ttv=.. trust=.. action=.. ux=.. diff=.. feas=.. seo=.. copy=.. --note "<evidence>"`.
   Evidence for each category in the day report. `nm` for anything not measured; never raise a category without new evidence.
6. Golden set: until Rex approves it (`approvals.golden_set`), evals run on the proposed list and are labeled "proposed set".
   Never run paid scans (Bright Data, model APIs) from the box; the box eval is sample mode only.
7. Hard fails (spec section 7) block `passed`: a result claim with no evidence, private personal data anywhere, any automatic post,
   email or merge, a run that hangs without a visible error, charging for a failed run, invented sample data presented as real.

Day status after evaluation: `passed` (exit check met, no hard fail, no regression), `needs_fix` (write a fix brief for the same day),
`blocked` (needs Rex), or `failed` after 2 fix attempts that fail the same way (`repeat_failures`): then ask Rex instead of a third attempt
and move to the next day.

## 3. Write the next brief

- File: `briefs/D<n>.md` (or `briefs/D<n>-fix<k>.md`). Start from `briefs/TEMPLATE.md`.
- Contents: repo and branch, the day's scope from spec section 7 plus the matching section 3 app detail, the mockup and HTML files,
  the top 3 failures from step 2 as "fix first" with exact evidence, the flag name, the exit check, and the rules block (never merge,
  never deploy, no env, DNS, SQL, pricing or auth changes, no dashes, sample data labeled as sample, tests and screenshots in the PR).
- Set the day's status to `brief_ready`. The parent launches briefs, unless `approvals.launch_briefs` is true, in which case the run
  may launch the cloud agent itself on `build/15day` only.

## 4. Log and update

- `reports/<YYYY-MM-DD>.md`: day, what was evaluated (sha), mechanical score flags on and off, regressions, exit check result,
  app score with per category evidence, screenshots path, next brief path, decisions needed.
- `logs/LOG.md`: one line per run. `STATE.json`: day statuses, `mech_history`, `app_scores.<app>.measured`, `runs[]`, `backlog`.
- Loop file `/workspace/loops/devradar-evening-build.md`: one dated line under Run history. Do not change its front matter.
- Run `evals/dashcheck.sh` on every file written this run.

## 5. Report

- Message Rex in chat only when a brief is ready to launch or a decision is needed (open question, blocked exit check, repeat failure,
  regression with flags off). Otherwise the run ends with a one line status in its own log.
- Keep it short: day, score change, what is ready, what is needed from him.

## 6. D15 and the end

- On the D15 run (or the Nov 16 run, whichever comes first): full eval on all nine apps, regenerate the scorecard
  (`docs/mockups/apps/10-scorecard-and-build-plan.html` with measured numbers, or a new `reports/scorecard-<date>.html` and PNG),
  write the LIVE proposal (apps that pass the gate: score at least 75, trust at least 7, no hard fail) and the pricing mapping proposal.
- Then set `status` to `done`, write the final report (what shipped on the branch, scores, backlog), and ask Rex to pause the routine
  and to decide on merges, flag flips, LIVE statuses and pricing. Later fires exit at step 0.

## Never

Merge, deploy, run `deploy.sh`, flip a production flag, change DNS, env vars, Vercel settings, SQL or data, pricing, plans or auth,
send email, post anywhere, open PRs on other repos, edit routines, or touch other loops' files. Never present invented sample data as real.
Product names: when Verafy products appear, they are Verafy Inspector and Verafy Forecast.
