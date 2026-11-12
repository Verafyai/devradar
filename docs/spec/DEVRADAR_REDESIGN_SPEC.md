# DevRadar: Redesign spec

> For Cursor. Site: devradar.rexstjohn.com. Mockups (source of truth for visuals): devradar-1-home.png (signed out), devradar-2-home-signed-in.png (company pinned, switcher open), devradar-3-signin-flow.png (sign-in and company onboarding), devradar-4-event-scanner.png (an app page). All event names, numbers and company details in the mockups are sample data.

DevRadar becomes a home for several DevRel apps instead of a single scan. A signed-in user saves their company once; every app starts from that saved profile.

## 1. Design tokens and type

- Background #0A0D12; surfaces #11161D / #151B23; borders #222B36 / #2D3845.
- Accent green #5CD68C (filled buttons, eyebrows, links); filled-button text #06210F.
- Text #F2F5F8 / #C3CCD6 / #8C97A4 / #5F6B78.
- Font Inter for everything. Monospace only for URLs and the radar labels in the hero.
- Minimum text size 14px anywhere; body 16-17px. The current page uses 12-13px monospace in many places; that's what makes it hard to read.

| Style | Size / weight |
|---|---|
| H1 | 84px / 800, -0.035em (56px under 768px) |
| H2 (section) | 40px / 800 |
| App title | 21px / 700 |
| Lede | 21px / 400 |
| Body, descriptors | 16-17px |
| Nav links | 17px / 500 |
| Eyebrow | 14px / 600, 0.16em, uppercase, green |
| Buttons | 16-18px / 600 |

## 2. Header (every page)

- Height 76px, padding 0 40px, bottom border 1px #18202A.
- Left: radar logo 36px, DevRadar 22px/700, then "by Rex St. John" 14px/500 #8C97A4. Links to /.
- Right, signed out: How it works, Pricing (17px/500), Sign in (outlined button).
- Right, signed in: How it works, Pricing, company switcher pill (company logo 28px + domain + caret), user avatar menu.
- Company switcher menu (see devradar-2): "Your companies" list with a check on the active one; + Add a company; Edit {company}'s profile; Remove {company} (red, with confirm).

## 3. Home page

### 3.1 Hero (devradar-1)

- Background visual: a radar sweep over a network of developer touchpoints (GitHub, Discord, docs, npm, SDK, API, meetups, hackathons, X, Reddit), with the touchpoints inside the sweep highlighted. Build it as an SVG with a subtle rotating sweep (CSS rotate, 8s loop, disabled under prefers-reduced-motion). It sits on the right two-thirds and fades to the background on the left so the text stays readable. Don't use stock photos.
- Delete "DEVELOPER RELATIONS RADAR", "Keep it current." and the "Enter your docs page. We scan it the way..." copy, the 1-7 step pills, and the "What we usually find first" card.
- Eyebrow DEVRADAR.
- H1 Agentic DevRel.
- Lede: "Automate, streamline, optimize and schedule your developer relations and community work with DevRadar's apps, plugins and extensions."
- Primary action, signed out: input yourcompany.com + "Scan your company". Under it: "Sign in to save your company. Takes about 90 seconds. · Search powered by Bright Data".
  - Clicking Scan your company when signed out opens the sign-in modal, then continues to onboarding with the URL already filled in.
- Primary action, signed in with a pinned company: the input shows the company chip and domain; button Run Deep Scan. Note: "Your company is pinned. Every app below starts from {Company}'s profile. Switch or add companies from the menu up top."

### 3.2 Apps grid

- Eyebrow APPS, H2 "Everything a DevRel team runs, on autopilot", lede "Pick an app. Each one starts from your saved company profile."
- 3-column grid (2 under 1100px, 1 under 700px), gap 18px. Each card: radius 18px, padding 24px, min-height 214px.
- Card anatomy: 52px icon tile (app color at 12% fill, 35% border, 28px stroke icon in app color); title 21px/700 with optional status pill (LIVE / BETA / SOON); one-sentence descriptor 16px; "Open {App} ->" link in green at the bottom. Whole card is clickable.
- Apps without a working backend yet show SOON, are still clickable, and open their page with a "Join the waitlist" button instead of a run button.

| # | App | Icon / color | Descriptor | Status |
|---|---|---|---|---|
| 1 | Event Scanner | calendar, #5CD68C | Find the conferences, meetups and hackathons where your target developers will be, by market and location. | new |
| 2 | Developer Profiler | person + code, #7FB2FF | Profiles of the developers who use tools like yours: roles, stacks, languages and where they spend time. | new |
| 3 | Social Trends | trend arrow, #F2B45C | What developers in your space are talking about on X, Reddit, Hacker News and GitHub, this week. | new |
| 4 | Influencers & Innovators | star, #F28FB0 | The builders, creators and maintainers who shape opinion in your category, ranked by real reach. | new |
| 5 | Docs & Code Scanner | doc + magnifier, #9C8CFF | A one-time audit of your docs, API reference and sample code for errors, gaps and agent readiness. | new |
| 6 | Looper | loop arrows, #4FD1D9 | Keeps docs, API and sample code in sync as your product changes. Finds breakages and drifted wording on every release. | new |
| 7 | Competition | grid, #FF8A6B | Maps your competitors in a grid and grades each one against you on docs, DX, pricing and community. | new |
| 8 | DevRadar Deep Scan | radar, #5CD68C | A full analysis of your site and docs, read the way an agent, a competitor and a developer would. | LIVE (today's scan) |
| 9 | Idea Generator | lightbulb, #F5D76E | App, demo and content ideas generated from what developers in your space are building right now. | new |

Icons: 24x24 stroke SVGs (1.9px, round caps), one file per app in /public/icons/apps/ (or the static equivalent here). The mockups include the drawings.

### 3.3 Footer

"© 2026 DevRadar by Rex St. John · Privacy · Terms", 14px.

## 4. Sign-in and company onboarding (devradar-3)

All steps run in one modal (560px wide, radius 18px). Closing it mid-way keeps progress.

Step 1: Sign in
- Title "Sign in to DevRadar", sub "Save your company once, and every app starts from it."
- Continue with GitHub, Continue with Google, divider, Work email + "Email me a sign-in link" (magic link). No passwords.
- Note: "No password. We'll never post anything on your behalf."
- Use one hosted auth provider (e.g. Supabase Auth, Clerk or Auth.js) with GitHub, Google and email magic-link.

Step 2: Tell us about your company
- "Paste your landing page. We'll find your docs, API reference, GitHub and community on our own."
- One URL field (prefilled if they started from the hero); validates it's a reachable website; Scan my company.

Step 3: Scanning
- Real progress steps (not a timer): Reading the landing page; Finding docs, API and developer portal; Collecting links: GitHub, community, blog; Building your company profile. Counts on the right, progress bar, elapsed time.
- Crawl rules: respect robots.txt, identify with a DevRadar user agent, stay on the company's own domains plus linked docs/GitHub/community hosts, cap at ~50 pages. Use Bright Data for search where needed.

Step 4: Is this your company?
- Brand card: logo, name, one-line description, Edit.
- Found links, each editable inline: Website, Docs, API reference, Developer portal, GitHub, Community (Discord/Slack/forum), Blog, Changelog, Status, Pricing. Missing ones show + Add.
- Buttons: Not my company (back to step 2) and Save to my profile.
- On save: the company becomes the active pinned company and the modal closes onto the signed-in home.

Notes
- Saving a company to a profile doesn't claim ownership of it; anyone can track any public company. (Team features later can verify by email domain.)
- On scan failure: say what failed, offer Try again or Enter links manually.

## 5. Pinned company behavior

- Each user has a list of companies and one active company (stored server-side).
- The active company shows in the header switcher and the hero, and prefills every app.
- Add: opens onboarding at step 2. Edit: opens step 4 with saved values. Remove: confirm dialog; if it was active, the next one becomes active; if none remain, the hero returns to the signed-out "Scan your company" state.

## 6. App pages (pattern; Event Scanner shown in devradar-4)

Every app page uses the same layout:
1. Breadcrumb "Apps > {App}".
2. Icon tile + H1 app name (44px/800); one-line description ending "Starting from {Company}'s profile."
3. Input card with the app's fields and one green run button.
4. Results header with count and sort, then result rows/cards.
5. Long runs show the same step-progress pattern as onboarding.

### 6.1 Event Scanner (first to build after the shell)

- Fields: Target market (prefilled from the company profile, editable, e.g. "AI application developers"), Target location (city + radius, or "Online"), When (next 1 / 3 / 6 / 12 months). Button Find events.
- Result row: date block; event name and one-line description (type, CFP or sponsor status); location and audience size; fit % with a recommended action (Talk + booth / Lightning talk / Sponsor a prize / Submit a talk); Add to plan.
- Sorted by fit. "Add to plan" saves to a per-company plan list (later: export to calendar).

### 6.2 Other apps (inputs and outputs, to build one at a time)

| App | Inputs (all prefilled from the company) | Output |
|---|---|---|
| Developer Profiler | target market, region | 3-5 developer personas: role, stack, languages, tools, where they hang out, what they need |
| Social Trends | topics/keywords, sources, time window | trending topics with volume, sample posts, sentiment, what changed this week |
| Influencers & Innovators | category, region | ranked people with reach, recent relevant posts, topics, links; ranking explained |
| Docs & Code Scanner | docs URL, API reference, sample-code repos | issues list: broken links, outdated code, errors, gaps, agent-readiness checks |
| Looper | repos + docs + release feed | continuous: on each release, flags drift between product, docs and samples; opens suggested fixes; weekly report |
| Competition | competitors (suggested, editable) | comparison grid and letter grades vs. you on docs, DX, pricing, community, agent readiness |
| DevRadar Deep Scan | company (default) | today's full report, unchanged except restyled to these tokens |
| Idea Generator | focus area | app, demo, tutorial and content ideas tied to current trends, with why each fits |

People-related apps (Profiler, Influencers) use public information only, show public professional profiles, and never collect private contact details.

## 7. Routes

| Route | Page |
|---|---|
| / | Home |
| /apps/{slug} | App page (event-scanner, developer-profiler, social-trends, influencers, docs-scanner, looper, competition, deep-scan, ideas) |
| /companies | Manage companies |
| /pricing, /how-it-works | as today |

Keep today's scan working at its current URL and redirect it to /apps/deep-scan.

## 8. Done when

- [ ] No text on any page is smaller than 14px; nav is 17px; logo reads "DevRadar by Rex St. John" at the sizes in section 2.
- [ ] Hero shows "Agentic DevRel", the new lede and the radar visual; old copy, step pills and "What we usually find first" card are gone.
- [ ] Signed out, "Scan your company" leads through sign-in into onboarding with the URL carried over.
- [ ] Onboarding finds the company's links, lets the user edit them, and saves the company as pinned.
- [ ] Signed in, the header switcher and hero show the pinned company; add, edit, switch and remove all work.
- [ ] Nine app cards, each with its own icon and color, descriptor and status; whole card clickable.
- [ ] Event Scanner runs with market, location and time window and returns ranked events.
- [ ] Deep Scan still works and lives at /apps/deep-scan.
- [ ] Checked at 375, 768 and 1440px.
