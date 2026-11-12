# DevRadar

DevRadar is a home for developer-relations apps. A signed-in user saves a company once. Every app starts from that profile.

The site is static HTML, CSS, and client JavaScript, plus Node serverless functions in `api/`. There is no framework. Deep Scan still uses the existing `/api/scan`, `/api/report`, and `/r/:token` functions. Those files are unchanged. The scan form now lives at `/apps/deep-scan`, and `/scan` redirects there.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43123

`npm test` runs the unit tests, including a live fetch of example.com.

Without `BLOB_READ_WRITE_TOKEN`, accounts, companies, waitlist emails, and plans are stored as JSON files in `.data/` (or `DEVRADAR_DATA_DIR`). On Vercel, set the blob token so that data survives. Without it, Vercel keeps the same records in `/tmp`, which is ephemeral.

## What works

- Home, header, company switcher, nine app cards, pricing, how it works, privacy, and terms.
- GitHub OAuth, Google OAuth, and email magic links.
- Company onboarding that fetches the real site (robots.txt, DevRadar user agent, about 50 pages) and saves the profile.
- Add, edit, switch, and remove companies. One company is active.
- Event Scanner: market, location, and time window, ranked from the public confs.tech calendar, with Add to plan.
- Deep Scan form posts to the existing `/api/scan` endpoint.
- Waitlist emails for the apps that are not built yet.

## What is stubbed

Developer Profiler, Social Trends, Influencers & Innovators, Docs & Code Scanner, Looper, Competition, and Idea Generator show their page and a waitlist. Their backends are not built. Add to plan stores events for later calendar export. It does not create calendar events yet.

## Environment variables

Set these in the host. Do not commit values.

| Name | Used for |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Durable storage for users, companies, sessions, plans, and waitlist. Without it, local JSON or ephemeral `/tmp` is used. |
| `APP_URL` | Public origin for OAuth redirects, for example `https://devradar.rexstjohn.com`. Falls back to the request host. |
| `GITHUB_CLIENT_ID` | GitHub sign-in. |
| `GITHUB_CLIENT_SECRET` | GitHub sign-in. |
| `GOOGLE_CLIENT_ID` | Google sign-in. |
| `GOOGLE_CLIENT_SECRET` | Google sign-in. |
| `RESEND_API_KEY` | Sending magic-link email. |
| `EMAIL_FROM` | From address for magic-link email. |
| `BRIGHTDATA_API_KEY` | Optional search during company onboarding, and the existing Deep Scan. |
| `BRIGHTDATA_SERP_ZONE` | Optional Bright Data zone. Defaults to `serp_api1`. |
| `BRIGHTDATA_UNLOCKER_ZONE` | Existing Deep Scan unlocker. |
| `XAI_API_KEY` | Existing Deep Scan. |
| `OPENAI_API_KEY` | Existing Deep Scan. |
| `OPENAI_MODEL` | Existing Deep Scan. |
| `DEVRADAR_ADMIN_TOKEN` | Existing Deep Scan admin actions. |
| `DEVRADAR_DATA_DIR` | Optional override for the local JSON store. |
| `PORT` | Local dev server port. Defaults to `43123`. |

If GitHub or Google credentials are missing, those buttons explain which variables to set and do not redirect. If `RESEND_API_KEY` or `EMAIL_FROM` is missing, magic links are sent only when the request host is localhost, and the sign-in link is shown on the page. Any other host gets the configuration message and no link.

OAuth redirect URLs to register with the providers:

- `{APP_URL}/api/auth-callback?provider=github`
- `{APP_URL}/api/auth-callback?provider=google`

## Deploy

This directory is the Vercel project: static files at the root and functions in `api/`. `vercel.json` sets function durations, the `/scan` redirect, and the existing `/r/:token` rewrite. The existing Deep Scan store still uses `BLOB_READ_WRITE_TOKEN` when it is set, and a local file store otherwise.
