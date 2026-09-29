# LifeLink n8n workflows

These seven n8n workflows run the donor network end to end: onboarding, matching, alerts, donor replies, fulfilment and analytics. They follow the "AI-Enhanced Blood Donation Network" flow (stages 1–8) and are live on `https://amitsingh7291.app.n8n.cloud`.

Each `*.workflow.ts` file is the source for one workflow, written with the n8n Workflow SDK. To change a workflow, edit its file, then validate it and create or update the workflow through the n8n MCP server (`validate_workflow`, then `create_workflow_from_code` or `update_workflow`). The files are not part of the website build.

## Workflows and endpoints

All endpoints live under `https://amitsingh7291.app.n8n.cloud/webhook/lifelink/`.

| Workflow | Endpoint | Spec stage |
|---|---|---|
| `donor-registry` | `POST /donors` | 1–2: onboarding and registry capture |
| `ussd-gateway` | `POST /ussd` (Africa's Talking format) | 1: basic-phone login, registration and replies |
| `donor-portal` | `POST /donor-portal` (backend only) | Website/app donor dashboard: status, live alerts, availability and alert channel |
| `emergency-dispatch` | `POST /emergency-request` | 3–6: request, compatibility engine, notifications, auto-escalation |
| `donor-response` | `GET /donor-response` | 6–7: one-tap donor replies, hospital confirmations, fulfilment |
| `tracking-analytics` | `GET /request-status?token=…`, `GET /analytics` | Patient-side tracking; 8: analytics |
| `error-handler` | (Error Trigger) | Logs any failed run of the workflows above |

### Raise a request (hospital)

```http
POST /webhook/lifelink/emergency-request
{
  "hospital_name": "AIIMS Trauma Centre", "hospital_city": "Delhi",
  "hospital_contact": "+919876543210", "patient_ref": "ICU-7",
  "blood_group": "AB+", "units_required": 2, "urgency": "critical",
  "latitude": 28.5672, "longitude": 77.21, "required_by": "2026-09-30T14:00:00+05:30"
}
```

`urgency` accepts the dashboard's values (`standard`, `critical`), the older `low`–`critical` scale, or the database values (`Normal`, `Urgent`, `Emergency`). The response includes:

- `tracking_url`: safe to share with the patient's family. It never shows donor identities.
- `hospital_token`: keep this private. It confirms donations (`a=donated`), records no-shows (`a=no_show`) and cancels the request (`a=cancel`).

### Matching rules

These rules are shared with `server/src/utils/bloodCompatibility.ts`. `server/test/n8nParity.test.ts` fails if a copy in these files drifts from the server.

- **ABO/Rh compatibility:** red cells and whole blood. O- is the universal donor and AB+ the universal recipient.
- **Eligibility:** the donor must be available, not committed to another request, and past their deferral window (90 days for men, 120 days otherwise).
- **Distance:** within 50 miles. A donor with no coordinates counts if they are in the hospital's city.
- **Ranking:** by 10-mile proximity band first, then ABO-identical donors, with O- last for non-O- patients (preserves O- supply), then longest time since eligible, then XP.

### Escalation

The first wave alerts 3× the units needed for Emergency, 2× for Urgent and units + 1 for Normal.

After each escalation window (Emergency 10 min, Urgent 20, Normal 60; 10 min if `required_by` is within 2 hours), the loop does the following:

1. Expires alerts nobody answered.
2. Re-checks availability.
3. Alerts the next ranked donors.

When nobody is left to ask, it closes the request as `Exhausted` and alerts the hospital.

Once enough donors have confirmed, the loop only watches for withdrawals or no-shows, checking every 30+ min. A withdrawal or no-show reopens the request, and the standby queue is still available. The loop stops when the request is `Completed` or `Cancelled`, or after 12 hours.

## Data tables (n8n project `sMsd1bnOtkZWhlDD`)

| Table | Purpose |
|---|---|
| `lifelink_donor_registry` | Donors keyed by phone: blood group, location, availability, donation history, commitment hold |
| `lifelink_requests` | Blood requests and their fulfilment state |
| `lifelink_request_matches` | Every ranked donor per request and their alert status (`queued`, `notified`, `accepted`, `declined`, `expired`, `donated`, `no_show`, …) |
| `lifelink_notifications` | In-app notifications for donors and hospitals (mirrors the app's `notifications` table). Donor alerts carry `accept_url` / `decline_url`; hospital "donor confirmed" alerts carry `confirm_donation_url` / `no_show_url`, so the one-tap links are easy to open while SMS is off |
| `lifelink_workflow_errors` | Failed runs, with a link to each execution |

`legacy_v1_*` tables belong to the retired v1 workflow and can be deleted.

## Credentials and going live

| Credential (n8n) | Used by |
|---|---|
| `Header Auth account` (header `X-LifeLink-Key`) | `emergency-request`, `donors` and `donor-portal` webhooks. Callers must send the header; anything else gets 403. The website backend sends it from its `N8N_WEBHOOK_KEY` environment variable. |
| `Twilio account` | Donor SMS and WhatsApp alerts (`emergency-dispatch`) and hospital texts (`donor-response`) |

A donor's `preferred_channel` (`sms`, `whatsapp`, `push` or `in_app`) picks the delivery node; every alert is also written to `lifelink_notifications`. Donors whose channel is `push` but who have no FCM token get SMS instead.

Still to do before real launch:

- **Use a long random webhook key.** Generate one with `openssl rand -hex 32`, put it in the Header Auth credential and in the backend's environment. Never commit it.
- **Restrict `ussd`** to your USSD gateway's IP range (webhook option *IP whitelist*).
- **Twilio trial limits.** A trial account only delivers to verified numbers and prefixes messages with "Sent from your Twilio trial account". Upgrade before real donors are on it.
- **WhatsApp.** Alerts go from the Twilio WhatsApp sandbox (`+14155238886`), which only reaches phones that have sent the sandbox join code, and only for 24 hours after their last message. For real donors, register your own WhatsApp sender in Twilio (needs Meta business verification) and send alerts from an approved template.
- **Push (FCM).** Needs a Google service-account credential and the Firebase project ID; the node stays disabled until then.
