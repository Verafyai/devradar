# Brief D<n>: <app>, <scope title>

Evening: <weekday Mon D 2026>. Repo `Verafyai/devradar`, branch `build/15day` (push commits to it; the draft PR stays open). Flag: `<flag>`.

## Read first
- `docs/spec/DEVRADAR_APPS_SPEC.md`: section 2 (shared foundations), section <3.x> (this app), section 4 (rubric), section 7 row D<n>.
- Mockup `docs/mockups/apps/<NN-name>.png` and its HTML `docs/mockups/apps/html/<NN-name>.html` (source of truth for visuals).
- Last evaluation: `<report path>` (summary pasted below).

## Fix first (from the last evaluation, with evidence)
1. <regression or failing check, page, width, what was seen>
2. ...
3. ...

## Today's scope
<copied from spec section 7 row and section 3 "How it works", "Result", "Actions", "Quality bar">

## Exit check
<exact check from PLAN.md, and how it will be measured>

## Rules
- Push to `build/15day` only. Never merge, never deploy, no env, DNS, Vercel, SQL, pricing, plan or auth changes.
- Everything new is behind `<flag>`; with no flags set the site renders exactly as before (check the 11 pages).
- Sample data stays labeled "Sample" and uses the invented company from the mockups; never present it as real. Live data paths must
  degrade to a visible, honest error without keys.
- No em or en dashes in code comments, copy or docs. Minimum 14px text. Works at 375, 768, 1440.
- Tests for new logic; `npm test` green; screenshots at 375, 768, 1440 of every changed page attached to the PR as a comment.
