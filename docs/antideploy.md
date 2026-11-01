# LifeLink on Antideploy (test copy)

[Antideploy](https://antideploy.com) hosts a **test copy** of LifeLink. Vercel is
still the real site: the Android app, the one-minute database timer and the links
in production messages all point at Vercel.

| Part | Address | Antideploy application | How it deploys |
|---|---|---|---|
| Website | https://lifelink.antideploy.app | `Blood-Donation` (`.antideploy.json`), a static site built from GitHub | By itself on every push to `main` |
| API | https://lifelink-api.antideploy.app | `lifelink-api` (`server/.antideploy.json`), a container from `server/Dockerfile` | `node scripts/antideploy.mjs api` |

Both copies use the **live Supabase database**, the same one Vercel uses, so
anything done on the test site is real: use fake data and clean up afterwards.

## Cost

The free plan covers one live server app (the API) and unlimited static sites
(the website). The API gets 30 successful deploys a month, counted again from the
1st; a failed build costs nothing. That is why the API is deployed by hand rather
than on every push.

## Connecting a computer

The account token lives in `~/.antideploy/config.json`, never in the project.
To connect another computer, ask Claude Code to connect to Antideploy: it shows
a link, you click **Approve**. Tokens can be revoked at
https://antideploy.com/tokens.

## Commands

| Command | What it does |
|---|---|
| `node scripts/antideploy.mjs api` | Uploads `server/` and watches the build. Only files git tracks are sent, so `server/.env` never leaves the computer. `--force` builds unchanged code again |
| `node scripts/antideploy.mjs web` | Builds the newest commit of `main` for the website (a push normally does this) |
| `node scripts/antideploy.mjs status web` | Follows the website's latest deploy (also `status api`) |
| `node scripts/antideploy.mjs logs` | What the running API printed lately |

## Settings

Set through Antideploy's API (`PUT /api/v1/secrets`), never in a file. The
dashboard shows the names only.

**API (`lifelink-api`)**

| Name | Value |
|---|---|
| `DATABASE_URL`, `GROQ_API_KEY` | The same as production (copied from `server/.env`) |
| `JWT_SECRET` | The same as production. It must never differ: it also opens the admins' and hospitals' two-step secrets, and Antideploy would otherwise generate a new one |
| `SMTP_USER`, `SMTP_PASS` | The Gmail sender and its app password (pasted on Antideploy's own page) |
| `FRONTEND_URL` | `https://lifelink.antideploy.app` (allowed origin, and the site in links this copy sends) |
| `API_PUBLIC_URL` | `https://lifelink-api.antideploy.app` (one-tap links this copy sends) |
| `TRUST_PROXY` | `cloudflare`: requests reach the API through Cloudflare and then Fly.io's proxy, but Fly's own address for the app (`ad-lifelink-api-2e42d187.fly.dev`) also answers directly. So the API trusts Fly's private network and Cloudflare's published addresses, never a hop count: the visitor is the last address that is neither, and nobody can fake theirs to get round the sign-in limits. It also tells the API it is deployed (shared rate limits, no localhost origins). After each start the log says `[proxy] … the visitor's address is outside the trusted proxies, as it should be` |

Left out on purpose: `NETWORK_TICK_URL` (the timer keeps calling Vercel),
`TWILIO_*`, `WHATSAPP_*`, `USSD_GATEWAY_KEY` and `ADMIN_INVITE_CODE`. Antideploy
sets `PORT`.

**Website (`Blood-Donation`)**: `VITE_API_BASE_URL` = `https://lifelink-api.antideploy.app`.

A changed setting reaches the running app on its next deploy:
`node scripts/antideploy.mjs api --force` for the API, `node scripts/antideploy.mjs web`
for the website.

## Making it the real site

1. Timer: set `NETWORK_TICK_URL` = `https://lifelink-api.antideploy.app/network/tick`
   on the API and deploy it. On start-up the API points the database's minute
   timer at itself.
2. Android app: change `server.url` in `mobile/capacitor.config.json` and the
   address in the offline page, then publish a new APK.
3. Privacy Policy: add Antideploy to its list of providers and update the date
   of the terms.
4. `vercel.json`'s security policy then needs only the Antideploy API.
5. Retire the Vercel projects.
