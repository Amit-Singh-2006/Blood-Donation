# Running LifeLink on Google Cloud

This moves LifeLink from Vercel to Google, step by step. Afterwards:

| Part | Where it runs | Free each month |
|---|---|---|
| API (`server/`) | **Cloud Run**, Mumbai (`asia-south1`), next to the Supabase database | 2 million requests, 180,000 vCPU-seconds, 360,000 GiB-seconds |
| Website | **Firebase Hosting**, with your own domain and free HTTPS | 10 GB stored, 360 MB transferred a day |
| Building the API | Cloud Build and Artifact Registry | 2,500 build minutes; about 0.5 GB of stored images |
| Passwords and keys | Secret Manager | a handful of secrets |

The database stays on Supabase. The Vercel site keeps working the whole time, so nothing goes down while you do this.

**You need:** a Google account, a debit or credit card for Google's billing (Google charges nothing inside the free amounts, but requires a card), your PC with this repository (for the values in `server/.env`), your Gmail app password (or make a new one), and about an hour. A domain name is optional at first (part 5).

**Words used below.** The *console* is the Google Cloud website, https://console.cloud.google.com. *Cloud Shell* is a terminal inside that website. *Project ID* is the unique name of your Google project, such as `lifelink-462817`.

---

## Part 1. Google Cloud project and billing (about 10 minutes, in the browser)

1. Open https://console.cloud.google.com and sign in with your Google account. Accept the terms if asked.
2. **Create the project.** At the top left, click the project picker (it may say "Select a project"), then **New project**. Name it `lifelink`. Google shows a Project ID under the name, often with numbers added, such as `lifelink-462817`. **Write the Project ID down**: almost every step uses it. Click **Create** and wait for the notification, then select the new project in the project picker.
3. **Turn on billing.** Open the menu (☰, top left) → **Billing**. Google asks you to link or create a billing account: choose **Create billing account** (or start the free trial if offered), enter your details and card. Google may make a small temporary charge to check the card. New accounts get trial credit for 90 days. **Before the trial ends, click "Activate full account"** (or "Upgrade") in Billing, or Google stops the project. Upgrading does not cost anything by itself: you still pay only for use above the free amounts.
4. **Set a budget alert.** Billing → **Budgets & alerts** → **Create budget**. Name it `LifeLink`, keep "All projects", set the amount to about ₹200 per month, keep the alert thresholds at 50%, 90% and 100%, and make sure "Email alerts to billing admins" is ticked. Click **Finish**. A budget only *warns* you by email; it does not stop anything. That is why the API is also capped at three copies (part 3, step 6).

## Part 2. Open Cloud Shell (2 minutes)

1. In the console, click the **Activate Cloud Shell** button: the `>_` icon at the top right. A terminal opens at the bottom of the page. The first time, it takes a minute to start.
2. **Pasting:** press Ctrl+V or right-click → Paste. Paste one block at a time and wait for it to finish before the next.
3. If a window asks to **Authorize Cloud Shell**, click **Authorize**.
4. Tell Cloud Shell your project. Replace `lifelink-462817` with *your* Project ID:

   ```bash
   export PROJECT_ID=lifelink-462817
   gcloud config set project "$PROJECT_ID"
   ```

   The prompt now shows your project ID in yellow.

**If Cloud Shell disconnects** (it does after about an hour of no use), your files stay, but you must run that block again. Once the API exists (part 3), also run:

```bash
API=$(gcloud run services describe lifelink-api --region asia-south1 --format='value(status.url)')
```

## Part 3. The API on Cloud Run (about 20 minutes)

### 3.1 Turn on the Google services LifeLink uses

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com compute.googleapis.com
```

This takes a minute or two and ends with "Operation ... finished successfully". These are the services for running the API (Run), building it (Cloud Build), storing what was built (Artifact Registry), keeping passwords (Secret Manager) and the default identity the API runs as (Compute).

### 3.2 Copy the code into Cloud Shell

```bash
git clone https://github.com/Amit-Singh-2006/Blood-Donation.git ~/Blood-Donation
```

### 3.3 Store the secrets

Four values are secret. They go into Secret Manager, never into a file or the code:

| Name | Where to find it |
|---|---|
| `DATABASE_URL` | the line `DATABASE_URL=...` in `server/.env` on your PC: copy everything after `=` (108 characters) |
| `JWT_SECRET` | the line `JWT_SECRET=...` in `server/.env` (64 characters). It **must** be this exact value: the admins' and hospitals' authenticator keys are encrypted with it |
| `GROQ_API_KEY` | the line `GROQ_API_KEY=...` in `server/.env` (56 characters) |
| `SMTP_PASS` | your Gmail app password, the one you gave Vercel. If you don't have it, make a new one at https://myaccount.google.com/apppasswords (Google shows it as four groups of letters: paste the 16 letters without the spaces) |

Open `server/.env` in VS Code to copy from it. Then paste this block into Cloud Shell:

```bash
for NAME in DATABASE_URL JWT_SECRET GROQ_API_KEY SMTP_PASS; do
  read -rsp "Paste $NAME, then press Enter: " VALUE; echo
  printf '%s' "$VALUE" | gcloud secrets create "$NAME" --data-file=-
done; unset VALUE
```

It asks for the four values one after another. **When you paste, nothing appears on screen**: that is on purpose, so the value is never shown or saved in the command history. Paste once, press Enter, and wait for "Created version [1] of the secret [...]" before pasting the next one.

Check that each one has the right length:

```bash
for NAME in DATABASE_URL JWT_SECRET GROQ_API_KEY SMTP_PASS; do
  printf '%s: ' "$NAME"; gcloud secrets versions access latest --secret="$NAME" | wc -c
done
```

You should see 108, 64, 56 and 16. If one is wrong, store it again: `read -rsp "Value: " V; printf '%s' "$V" | gcloud secrets versions add NAME --data-file=-; unset V` (replace `NAME`).

### 3.4 Give the API permission to read the secrets

```bash
SA="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor --condition=None
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role=roles/run.builder --condition=None
```

The API runs as Google's default "service account" for your project. The first line lets it read the secrets; the second lets Cloud Build build it. Each prints a long list (the project's permissions); that is normal. If you see "does not exist", wait a minute (step 3.1 is still finishing) and run it again.

### 3.5 Write the settings that are not secret

```bash
cat > ~/lifelink-env.yaml <<EOF
SMTP_USER: "your-address@gmail.com"
FRONTEND_URL: "https://$PROJECT_ID.web.app"
EOF
cat ~/lifelink-env.yaml
```

Before pressing Enter, replace `your-address@gmail.com` with the Gmail address the app password belongs to. `FRONTEND_URL` is where the website will be (part 4). This file lives in your Cloud Shell home, not in the repository.

### 3.6 Build and start the API

```bash
cd ~/Blood-Donation/server
gcloud run deploy lifelink-api --source . --region asia-south1 --allow-unauthenticated \
  --memory 512Mi --max-instances 3 --env-vars-file ~/lifelink-env.yaml \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,GROQ_API_KEY=GROQ_API_KEY:latest,SMTP_PASS=SMTP_PASS:latest
```

What happens:

- It asks to create a repository named `cloud-run-source-deploy`: type **Y** and press Enter. (That is where Google keeps the built API.)
- It uploads the `server/` folder, builds it with `server/Dockerfile` (3 to 6 minutes the first time) and starts it.
- It ends with **"Service URL: https://lifelink-api-....asia-south1.run.app"**. That is your new API address.

What the options mean: `asia-south1` is Mumbai, next to the database. `--allow-unauthenticated` makes the API public, as a website's API must be (LifeLink checks sign-ins itself). `--max-instances 3` means at most three copies run at once, which caps the cost. `--memory 512Mi` is the size of each copy. The API shuts down when nobody uses it, so the first request after a quiet spell takes a few seconds.

If the build fails, the output has a link to the build log: open it and look for the first red error line.

### 3.7 Tell the API its own address, and move the database timer to it

```bash
API=$(gcloud run services describe lifelink-api --region asia-south1 --format='value(status.url)')
echo "$API"
cat >> ~/lifelink-env.yaml <<EOF
API_PUBLIC_URL: "$API"
NETWORK_TICK_URL: "$API/network/tick"
EOF
gcloud run services update lifelink-api --region asia-south1 --env-vars-file ~/lifelink-env.yaml
```

`API_PUBLIC_URL` goes into the YES/NO links in donor messages. `NETWORK_TICK_URL` makes the database's one-minute timer (which escalates blood requests) call this API instead of Vercel's. Both APIs use the same database, so nothing is lost. To move the timer back to Vercel at any time, change that line in `~/lifelink-env.yaml` to `NETWORK_TICK_URL: "https://blood-donation-backend-sepia.vercel.app/network/tick"` and run the `gcloud run services update` line again.

### 3.8 Check the API

```bash
curl -s "$API/health"; echo
```

It should print `{"status":"ok","database":{"reachable":true,...}}`. If it says `"reachable":false`, `DATABASE_URL` is wrong: store it again (end of step 3.3) and run `gcloud run deploy` from step 3.6 again.

The API's logs are in the console: menu → **Cloud Run** → `lifelink-api` → **Logs**.

## Part 4. The website on Firebase Hosting (about 15 minutes)

### 4.1 Add Firebase to your project

1. Open https://console.firebase.google.com (same Google account).
2. Click **Create a project** (or **Add project**). Don't type a new name: choose your existing Google Cloud project instead. Look for **"Add Firebase to Google Cloud project"**, or pick it from the list that appears when you click the name box.
3. Firebase shows the billing plan (Blaze, because billing is on): confirm it. Its free amounts are the same as the free plan.
4. Google Analytics: turn it **off** (LifeLink doesn't use it). Click **Add Firebase** and wait.

### 4.2 Build the website for the new API

Back in Cloud Shell:

```bash
node --version
```

If it shows a version below 20, run `nvm install 22` first. Then:

```bash
cd ~/Blood-Donation
npm ci
VITE_CONTACT_EMAIL="your-contact@example.com" node scripts/firebase-hosting.mjs "$API"
```

- `npm ci` installs the website's tools (1 to 3 minutes).
- `VITE_CONTACT_EMAIL` is the contact address shown on the Support, Privacy and Terms pages. Use the same one you gave Vercel. If you never set one, leave that part out and start the line at `node`.
- The script builds the website so that it talks to your new API. It also writes `firebase.json` with the same security headers the Vercel site sends, with the new API allowed in its Content-Security-Policy. It ends with "Wrote firebase.json".

### 4.3 Sign the Firebase tool in, and publish

```bash
npx firebase-tools@15.32.1 login --no-localhost
```

It may ask whether Firebase can collect usage information (answer as you like). It then shows a link: open it, sign in with the same Google account, allow access, copy the code it shows, paste it into Cloud Shell and press Enter. Then publish:

```bash
npx firebase-tools@15.32.1 deploy --only hosting --project "$PROJECT_ID"
```

It ends with **"Hosting URL: https://YOUR-PROJECT-ID.web.app"**. The site is live there.

### 4.4 Test it

Open the Hosting URL (also on your phone) and check:

- the home page loads, with its fonts and icons;
- sign in as a donor, as a hospital and as an admin (the authenticator codes work, because `JWT_SECRET` is the same);
- on the hospital dashboard the map shows;
- "Forgot password" sends you an email (to your own address);
- a certificate opens and saves as a PDF.

If something fails, look at the API's logs (end of part 3) and tell me what you see.

## Part 5. Your own domain (30 minutes of work, then up to a day of waiting)

1. **Buy a domain** from any registrar (GoDaddy, Hostinger, Namecheap, BigRock, …). A `.in` costs roughly ₹500 to ₹1,000 a year. You don't need the hosting or email packages they offer.
2. **Connect it:** Firebase console → **Hosting** → **Add custom domain**. Enter your domain, such as `lifelinkindia.in`, and continue.
3. **Prove you own it, and point it at Firebase:** Firebase shows DNS records to add, usually a **TXT** record and one or two **A** records. In your registrar's site, open **DNS management** for the domain and add each record exactly as shown (type, host or name — often `@` — and value). **Delete any A or AAAA records the registrar added for a "parked" page**, or they will fight with Firebase's.
4. **Add `www` too:** in Firebase, add a second custom domain, `www.your-domain.in`, and choose **Redirect** to `your-domain.in`. Add the records it shows.
5. **Wait.** DNS changes take from minutes to 24 hours. Firebase then shows the domain as **Connected** and sets up HTTPS on its own.
6. **Tell the API about the domain.** Links in emails, messages and certificates use the first address in `FRONTEND_URL`, so put the domain first:

   ```bash
   sed -i "s|^FRONTEND_URL: .*|FRONTEND_URL: \"https://your-domain.in,https://$PROJECT_ID.web.app\"|" ~/lifelink-env.yaml
   cat ~/lifelink-env.yaml
   gcloud run services update lifelink-api --region asia-south1 --env-vars-file ~/lifelink-env.yaml
   ```

   (Replace `your-domain.in` first. Or edit the file by hand with `nano ~/lifelink-env.yaml`: change the line, then Ctrl+O, Enter to save and Ctrl+X to leave.)

The API keeps its `run.app` address. Cloud Run cannot attach a custom domain in Mumbai, and it doesn't need one: the website calls it exactly as it calls the Vercel API today.

## Part 6. The Android app

The app opens the website's address. Send me the domain: I'll change it in `mobile/capacitor.config.json` and `mobile/www/offline.html` and push, and GitHub builds a new APK at the usual download link. It installs over the old app; nobody needs to uninstall or sign in again.

## Part 7. Retire Vercel

Leave Vercel running for a week or two, until phones have the new app: both sites share the database, so they can run side by side. Then, at https://vercel.com, open each project (`blood-donation-frontend`, `blood-donation-backend`) → **Settings** → at the bottom, **Delete Project**. Links in messages sent before the move point at the old addresses, so they stop working then (blood requests last hours, so this is fine after a few days).

## Later: updates, costs, problems

**Publishing a new version** (after changes are pushed to GitHub), in Cloud Shell:

```bash
export PROJECT_ID=your-project-id; gcloud config set project "$PROJECT_ID"
cd ~/Blood-Donation && git pull
API=$(gcloud run services describe lifelink-api --region asia-south1 --format='value(status.url)')
# The API (settings and secrets stay as they are)
cd server && gcloud run deploy lifelink-api --source . --region asia-south1 && cd ..
# The website
npm ci && VITE_CONTACT_EMAIL="your-contact@example.com" node scripts/firebase-hosting.mjs "$API" \
  && npx firebase-tools@15.32.1 deploy --only hosting --project "$PROJECT_ID"
```

**Changing a secret:** `read -rsp "Value: " V; printf '%s' "$V" | gcloud secrets versions add NAME --data-file=-; unset V`, then redeploy the API (the line above).

**Costs:** console → Billing → **Reports** shows what each service used this month.

**Something broke after an update:** console → Cloud Run → `lifelink-api` → **Revisions**: select the previous revision and choose "Manage traffic" to send 100% to it. For the website: Firebase console → Hosting → release history → **Rollback**.

## What changed in the code for Google

Nothing needs editing: the API notices Cloud Run (`K_SERVICE`) and then trusts its proxy for visitors' addresses, shares rate limits in Postgres and never trusts `localhost` origins. Cloud Run gives the server CPU only while a request is open, so off Vercel each answer waits for the work it started, such as an email (`server/src/utils/background.ts`); the password-reset answer waits a fixed 4 seconds so its timing still reveals nothing. The database timer calls whatever `NETWORK_TICK_URL` the deployed API sets; a developer's machine never sets it.
