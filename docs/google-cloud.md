# Running LifeLink on Google Cloud

LifeLink can run on Google instead of Vercel, at no cost for a small site:

| Part | Google service | Free each month |
|---|---|---|
| API (`server/`) | **Cloud Run**, Mumbai (`asia-south1`), next to the Supabase database | 2 million requests, 180,000 vCPU-seconds, 360,000 GiB-seconds |
| Website | **Firebase Hosting**, with your own domain and free HTTPS | 10 GB stored, 360 MB transferred a day |
| Building the API | Cloud Build and Artifact Registry | 2,500 build minutes; about 0.5 GB of stored images |
| Passwords and keys | Secret Manager | a handful of secrets |

The database stays on Supabase and the Android app keeps working; only the addresses change. Google needs a billing account (a card) even inside the free amounts, so set a budget alert (step 4).

Everything below runs in **Cloud Shell**, the terminal built into the Google Cloud console (the `>_` button at the top right), so nothing needs installing on your PC. Replace `YOUR_PROJECT_ID` with your project's ID.

## 1. Project and billing (once, in the console)

1. Open https://console.cloud.google.com and sign in.
2. Create a project, for example `lifelink`. Note its **Project ID**.
3. Billing: link a billing account (new accounts get a free trial credit). Upgrade it to a paid account before the trial ends, or Google stops the project; within the free amounts you still pay nothing.
4. Billing → **Budgets & alerts** → create a budget of, say, ₹200 a month with email alerts at 50%, 90% and 100%.

## 2. The API on Cloud Run

Open Cloud Shell and run:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com compute.googleapis.com
git clone https://github.com/Amit-Singh-2006/Blood-Donation.git ~/Blood-Donation
```

**Secrets.** Copy `DATABASE_URL`, `JWT_SECRET` and `GROQ_API_KEY` from `server/.env` on your PC, and your Gmail app password for `SMTP_PASS`. `JWT_SECRET` must be exactly the same value: the admins' and hospitals' authenticator keys are encrypted with it. Each value is typed hidden and never lands in the shell history:

```bash
for NAME in DATABASE_URL JWT_SECRET GROQ_API_KEY SMTP_PASS; do
  read -rsp "Paste $NAME, then press Enter: " VALUE; echo
  printf '%s' "$VALUE" | gcloud secrets create "$NAME" --data-file=-
done; unset VALUE
```

Let the API read them, and let Cloud Build build it:

```bash
PROJECT=$(gcloud config get-value project)
SA="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/run.builder
```

**Settings** that are not secret go in a file in your Cloud Shell home (not in the repository):

```bash
cat > ~/lifelink-env.yaml <<'EOF'
SMTP_USER: "your-address@gmail.com"
FRONTEND_URL: "https://YOUR_PROJECT_ID.web.app"
EOF
```

**Deploy** (the first build takes a few minutes; answer `Y` if asked to create a repository):

```bash
cd ~/Blood-Donation/server
gcloud run deploy lifelink-api --source . --region asia-south1 --allow-unauthenticated \
  --memory 512Mi --max-instances 3 --env-vars-file ~/lifelink-env.yaml \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,GROQ_API_KEY=GROQ_API_KEY:latest,SMTP_PASS=SMTP_PASS:latest
```

Then tell the API its own address, which also moves the database timer to it:

```bash
API=$(gcloud run services describe lifelink-api --region asia-south1 --format='value(status.url)')
cat >> ~/lifelink-env.yaml <<EOF
API_PUBLIC_URL: "$API"
NETWORK_TICK_URL: "$API/network/tick"
EOF
gcloud run services update lifelink-api --region asia-south1 --env-vars-file ~/lifelink-env.yaml
curl -s "$API/health"        # {"status":"ok","database":{"reachable":true,...}}
```

`--max-instances 3` caps the cost. The API scales to zero when idle, so the first request after a quiet spell takes a few seconds.

## 3. The website on Firebase Hosting

1. Open https://console.firebase.google.com → **Add project** → choose your existing Google Cloud project. Google Analytics is not needed.
2. In Cloud Shell, build the website for your API and deploy it:

```bash
cd ~/Blood-Donation
npm ci
VITE_CONTACT_EMAIL="your-contact@example.com" node scripts/firebase-hosting.mjs "$API"
npx firebase-tools@15.32.1 login --no-localhost
npx firebase-tools@15.32.1 deploy --only hosting --project YOUR_PROJECT_ID
```

`scripts/firebase-hosting.mjs` builds the site with the API address and writes `firebase.json` with the same security headers as `vercel.json` (its Content-Security-Policy allows the new API). The site is now at `https://YOUR_PROJECT_ID.web.app`. Sign in there as a donor, a hospital and an admin to check it, and send yourself a password reset email.

## 4. Your own domain

1. Buy a domain from any registrar (a `.in` costs roughly ₹500 to ₹1,000 a year).
2. Firebase console → **Hosting** → **Add custom domain** → enter it (and `www.` as a redirect). Add the TXT and A records it shows in your registrar's DNS settings. HTTPS is set up automatically; it can take up to a day.
3. Put the domain first in `FRONTEND_URL` (links in emails, messages and certificates use the first address), then update the API:

```bash
sed -i 's|^FRONTEND_URL: .*|FRONTEND_URL: "https://your-domain.in,https://YOUR_PROJECT_ID.web.app"|' ~/lifelink-env.yaml
gcloud run services update lifelink-api --region asia-south1 --env-vars-file ~/lifelink-env.yaml
```

The API keeps its `run.app` address: Cloud Run cannot attach a custom domain in Mumbai, and that is fine, because the website calls it the same way it calls the Vercel API today.

## 5. The Android app

The app opens the website's address, set in `mobile/capacitor.config.json` (`server.url`) and `mobile/www/offline.html`. Change both to the new domain and push to `main`: GitHub builds a new APK, which installs over the old one.

## 6. Retire Vercel

Both APIs share the database, so the Vercel site can keep running while people move over. Once the new app is out (give it a week or two), delete both Vercel projects. Links in messages sent before the move point at the old addresses, so they stop working then.

## Updating later

```bash
cd ~/Blood-Donation && git pull
API=$(gcloud run services describe lifelink-api --region asia-south1 --format='value(status.url)')
# API
cd server && gcloud run deploy lifelink-api --source . --region asia-south1 && cd ..
# Website
npm ci && VITE_CONTACT_EMAIL="your-contact@example.com" node scripts/firebase-hosting.mjs "$API" \
  && npx firebase-tools@15.32.1 deploy --only hosting --project YOUR_PROJECT_ID
```

A redeploy keeps the service's settings and secrets. To change a secret: `printf '%s' "$NEW" | gcloud secrets versions add NAME --data-file=-`, then redeploy.

## What changes in the code

Nothing needs editing for Google: the API notices Cloud Run (`K_SERVICE`) and then trusts its proxy for visitors' addresses, shares rate limits in Postgres and never trusts `localhost` origins. Cloud Run gives the server CPU only while a request is open, so off Vercel each answer waits for the work it started, such as an email (`server/src/utils/background.ts`); the password reset answer waits a fixed 4 seconds so its timing still reveals nothing. The database timer calls whatever `NETWORK_TICK_URL` the deployed API sets; a developer's machine never sets it.
