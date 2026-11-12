# DevRadar 15 evening build: questions for Rex

Spec section 10, plus the setup decisions this loop needs. Each has a recommended answer; a short "yes" takes the recommendation.

| # | Question | Needed by | Recommended answer |
|---|---|---|---|
| A | Create the private repo Verafyai/devradar from the live site and launch D0? | D0 (tonight) | Yes. It imports the live site unchanged; nothing deploys from it. |
| B | May the evening run launch each day's cloud agent itself on `build/15day`, or should each brief come to you first? | D1 | Let it launch on `build/15day` only. Still no merges or deploys without you. |
| 1 | Approve the golden set: Supabase, Clerk, Stripe, LangChain, Sentry, Pulumi, Astro, Netlify, Convex, Arduino? | D1 | Approve as proposed; swap in Turso, Hasura, Appwrite, Neon or PostHog for any you want out. |
| 2 | Event data sources and Bright Data budget per run? | D3 | Start free: confs.tech data (already in the site), public CFP pages, Meetup and Luma public pages. Cap Bright Data at $0.50 a run and $25 for the 15 days. |
| 3 | Sandbox for running code samples: hosted runner or containers on the box? | D6 | GitHub Actions in a throwaway test repo for D6; decide on a hosted runner after it works. |
| 4 | GitHub app scope for Docs and Looper PRs? | D6, D12 | A new "DevRadar" GitHub app: contents and pull requests write, metadata read, webhooks on release and push, installed only on test repos during the build. |
| 5 | Social data access for X and Reddit (plan limits and cost)? | D8, D10 | Build D8 and D10 on HN and GitHub (free APIs) first; add X through the API access you already have; Reddit later after checking its terms. |
| 6 | Plan mapping and credit costs (spec section 9)? | D15 | Keep section 9 as a proposal shown only behind the flag; decide prices after D15 with measured cost per run. |
| 7 | Who are 5 DevRel practitioners to rate sample outputs? | D15 | Pick 5 from your network; until then Customer value is a judged score and labeled that way. |
| C | Connect the Vercel project devradar to the repo for preview deploys? | Any time | Not during the build. Keep production on the tarball deploy; the box builds each push for evals. Revisit after D15. |
| D | The spec references LOOPER_REDESIGN_SPEC.md, which is not on the box. Use `/workspace/looper-design/SPEC.md` for D12 and D13? | D12 | Yes, unless you send the newer file. |
