# LifeLink

LifeLink connects voluntary blood donors with hospitals in India. When a hospital needs blood for a patient, LifeLink alerts compatible donors nearby who are past their rest period, nearest first, in waves until enough of them say YES. The hospital and the patient's family can follow the request as it happens.

- Website: https://blood-donation-frontend-delta.vercel.app
- Android app: [LifeLink.apk](https://github.com/Amit-Singh-2006/Blood-Donation/releases/download/android-latest/LifeLink.apk) (the app shows the live website)
- How it is secured: [SECURITY.md](SECURITY.md)

LifeLink is not a blood centre and not an emergency service. Blood is collected, tested and transfused only by licensed blood centres; LifeLink coordinates donors.

## What it does

**Donors**
- Sign up (18 to 65, NBTC donor rules), set availability and how to be alerted: SMS, WhatsApp or in the app
- Answer requests with one tap; after a YES, get a donation pass for the hospital gate, directions, and the option to share live location with that hospital
- See their eligibility (90 days between donations for men, 120 for women), donation history, badges and XP
- Get a certificate for each donation a hospital recorded, with a code anyone can check at `/certificate/<code>`
- Change their details in Settings, or delete their account and data there

**Hospitals**
- Raise blood requests and follow each donor's reply in real time; record donations, no-shows and the blood group their lab found (it becomes the donor's lab-confirmed group)
- Are verified before their requests reach real donors: they upload their registration certificate and an authorisation letter, and an admin checks them and phones the hospital
- Sign in with an authenticator app (two-step sign-in)

**Admins**
- Each admin covers a jurisdiction (cities in a state, or all of India). They review hospitals, see donors and requests in their area, run donation campaigns, deactivate abusive accounts and export a PDF report
- The first admin signs up with a one-time setup code; national admins invite the rest

**Also**
- A public request tracker for families, network statistics, USSD for basic phones (needs a gateway), and an AI chat assistant (Groq) that can answer questions and help donors respond

## How it is built

| Part | Technology | Where it runs |
|---|---|---|
| Website (`/`) | React 19, Vite, Tailwind CSS 4, TypeScript | Vercel |
| API (`server/`) | Express 5, TypeScript, `pg`, Zod. The donor network (matching, escalation, messages) runs inside it | Vercel, Mumbai region |
| Database | PostgreSQL on Supabase (Mumbai). Tables are created and updated by the API at start-up (`server/src/config/initDb.ts`); a `pg_cron` timer calls the API every minute while escalations or messages are due | Supabase |
| Android app (`mobile/`) | Capacitor 8, showing the live website, plus a small plugin to save files to Downloads | Built by GitHub Actions |

Messages go out by Twilio (SMS), Meta's WhatsApp Cloud API and SMTP email, each only once its settings are present.

```
src/            website: pages, components, lib (API client, certificates, legal rules)
server/src/     API: routes, controllers, schemas, middleware, network (the donor network engine)
server/scripts/ database backup and restore
server/test/    API tests
mobile/         Android app (Capacitor)
```

## Run it locally

You need Node.js 22 or newer and a PostgreSQL database (a free Supabase project works).

```bash
# API, on http://localhost:5000
cd server
cp .env.example .env        # then fill in DATABASE_URL and JWT_SECRET at least
npm install
npm run dev

# Website, on http://localhost:3000 (in another terminal, from the repository root)
cp .env.example .env
npm install
npm run dev
```

Keep the API on `localhost`, not `127.0.0.1`: the website and API must be the same site for the sign-in cookie to work.

To create the first admin, set `ADMIN_INVITE_CODE` in `server/.env` and sign up at `/register-admin` with it. It works only while no admin exists.

## Configuration

Every setting is described in [`server/.env.example`](server/.env.example) (API) and [`.env.example`](.env.example) (website). The main ones:

| Setting | Used for |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (Supabase: the transaction pooler URI, port 6543) |
| `JWT_SECRET` | Signs sign-in tokens; changing it signs everyone out |
| `GROQ_API_KEY` | The AI assistant |
| `FRONTEND_URL` | The website's address, for links in messages and certificates |
| `ADMIN_INVITE_CODE` | Creating the first admin |
| `TWILIO_*`, `WHATSAPP_*`, `SMTP_*`, `EMAIL_FROM` | SMS, WhatsApp and email; each is skipped until set |
| `VITE_API_BASE_URL` | The API the website calls |
| `VITE_CONTACT_EMAIL`, `VITE_GRIEVANCE_OFFICER_NAME` | Shown on Support, the Privacy Policy and the Terms |

Secrets belong in `.env` files (git ignores them) and in the Vercel project settings, never in code.

## Tests

```bash
npm test                 # website (Vitest)
npm run lint             # website type check
cd server && npm test    # API (node:test)
cd server && npx tsc --noEmit
```

## Deploying

- **Website and API:** pushing to `main` deploys both on Vercel. The API brings the database schema up to date when it starts, so there are no separate migrations.
- **Android app:** a push to `main` that changes `mobile/` builds the APK in GitHub Actions, signs it with LifeLink's release key and publishes it to the `android-latest` release. The key and its password exist only as the `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` repository secrets and on the maintainer's PC, never in git; the workflow refuses to publish an APK signed with any other key. Each build gets a higher version code, so it installs over the last one.
- **Legal texts:** when the Terms or Privacy Policy change, update `LEGAL_UPDATED` in `src/lib/contact.ts` and `LEGAL_VERSION` in `server/src/utils/legal.ts` together (a test checks they match); new sign-ups record that version.

## Backups

Supabase's free plan has no automatic backups, so `server/scripts/backup.ts` exports the whole database to an encrypted file (AES-256-GCM) and proves each file restores before keeping it.

```bash
cd server
npm run backup                                          # one backup now
powershell -ExecutionPolicy Bypass -File scripts/schedule-backup.ps1   # every day at 21:30 (Windows)
npm run restore-backup -- check <file>                  # does this file open and load? Changes nothing
```

- Backups go to `OneDrive\LifeLink backups` (or `LIFELINK_BACKUP_DIR`); the newest 30 are kept.
- The key is created on the first run at `~/lifelink-private/backup-key.txt` (or `LIFELINK_BACKUP_KEY_FILE`). Keep a copy in a password manager: without it no backup can be opened.
- To recover into a new, empty database: `RESTORE_DATABASE_URL=<new database> npm run restore-backup -- restore <file>`, then point `DATABASE_URL` (here and on Vercel) at it. The restore refuses a database that already has data.

## Privacy

LifeLink handles personal and health-related data under India's Digital Personal Data Protection Act, 2023. What is collected, who sees it and how long it is kept is in the [Privacy Policy](https://blood-donation-frontend-delta.vercel.app/privacy); the rules for using LifeLink are in the [Terms of Service](https://blood-donation-frontend-delta.vercel.app/terms). Please report security problems privately to the maintainer rather than in a public issue.
