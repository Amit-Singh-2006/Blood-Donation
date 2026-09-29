import { workflow, node, trigger, sticky, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const portalWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Hospital Portal Request',
    parameters: { httpMethod: 'POST', path: 'lifelink/hospital-portal', authentication: 'headerAuth', responseMode: 'responseNode', options: {} },
    credentials: { httpHeaderAuth: newCredential('Header Auth account') },
    position: [0, 300]
  },
  output: [{ body: { requests: [{ request_id: 1, hospital_token: '410dcab5-0440-4787-a556-2d1a72651973' }] } }]
});

const parseRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Portal Request',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// The website backend asks for a hospital's requests in one call, each with
// the hospital token the dispatch returned for it.
const MAX = 25;
const body = $input.first().json.body ?? {};
const list = Array.isArray(body.requests) ? body.requests : [body];
const isInt = (v) => Number.isInteger(v) && v > 0;
const isToken = (v) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));

const requests = list
  .filter((r) => r && isInt(r.request_id) && isToken(r.hospital_token))
  .slice(0, MAX)
  .map((r) => ({ request_id: r.request_id, hospital_token: String(r.hospital_token).toLowerCase() }));

return [{ json: { valid: requests.length > 0, requests } }];`
    },
    position: [220, 300]
  },
  output: [{ valid: true, requests: [{ request_id: 1, hospital_token: '410dcab5-0440-4787-a556-2d1a72651973' }] }]
});

const isValid = ifElse({
  version: 2.3,
  config: {
    name: 'Any Valid Requests?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.valid }}'), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    },
    position: [440, 300]
  }
});

const rejectRequest = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Reject Invalid Request',
    parameters: { respondWith: 'json', responseBody: expr('{{ { status: "rejected", message: "Send requests: [{ request_id, hospital_token }]" } }}'), options: { responseCode: 400 } },
    position: [660, 500]
  },
  output: [{ status: 'rejected' }]
});

const loadRequests = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load Requests',
    alwaysOutputData: true,
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: '9V3yanItFZmzrY2z', cachedResultName: 'lifelink_requests' },
      returnAll: true
    },
    position: [660, 200]
  },
  output: [{ id: 1, status: 'Open', blood_group: 'AB+', units_required: 2, hospital_token: '410dcab5-0440-4787-a556-2d1a72651973', status_token: '4e88c541-125a-4c9d-8d4f-897c37f075eb' }]
});

const loadMatches = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load Matches',
    alwaysOutputData: true,
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'gF5uzzKWNIUnqLoO', cachedResultName: 'lifelink_request_matches' },
      returnAll: true
    },
    position: [880, 200]
  },
  output: [{ id: 11, request_id: 1, donor_id: 3, donor_blood_group: 'O+', distance_km: 14.3, status: 'accepted', notified_at: '2026-09-29T10:00:00.000Z', responded_at: '2026-09-29T10:05:00.000Z' }]
});

const loadDonors = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load Donors',
    alwaysOutputData: true,
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      returnAll: true
    },
    position: [1100, 200]
  },
  output: [{ id: 3, name: 'Rohan Gupta', phone: '+915550000103' }]
});

const buildView = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Hospital View',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// The hospital's own view of its requests: live progress, the donors who
// confirmed (first name and phone, so staff can coordinate) and the one-tap
// action links. A request is only returned when its hospital token matches.
const BASE = 'https://amitsingh7291.app.n8n.cloud/webhook/lifelink/donor-response';
const wanted = $('Parse Portal Request').first().json.requests;
const requests = new Map($('Load Requests').all().map((i) => i.json).filter((r) => r.id).map((r) => [r.id, r]));
const matches = $('Load Matches').all().map((i) => i.json).filter((m) => m.id);
const donors = new Map($('Load Donors').all().map((i) => i.json).filter((d) => d.id).map((d) => [d.id, d]));

const firstName = (n) => String(n ?? '').trim().split(/\\s+/)[0] || 'Donor';
const count = (list, ...statuses) => list.filter((m) => statuses.includes(m.status)).length;
const time = (v) => Date.parse(v || '') || 0;

const views = wanted.map(({ request_id, hospital_token }) => {
  const req = requests.get(request_id);
  if (!req || req.hospital_token !== hospital_token) return { request_id, found: false };

  const own = matches.filter((m) => m.request_id === req.id);
  const alerted = own.filter((m) => m.notified_at);
  const lastAlert = alerted.map((m) => m.notified_at).sort().pop();
  const active = ['Open', 'Fulfilled'].includes(req.status);
  const link = (m, action) => BASE + '?m=' + m.id + '&h=' + req.hospital_token + '&a=' + action;

  const confirmed = own
    .filter((m) => ['accepted', 'donated', 'no_show'].includes(m.status))
    .sort((a, b) => time(a.responded_at) - time(b.responded_at))
    .map((m) => {
      const d = donors.get(m.donor_id) ?? {};
      return {
        match_id: m.id,
        name: firstName(d.name),
        phone: d.phone ?? null,
        blood_group: m.donor_blood_group,
        distance_km: m.distance_km ?? null,
        status: m.status,
        responded_at: m.responded_at ?? null,
        donated_url: m.status === 'accepted' ? link(m, 'donated') : null,
        no_show_url: m.status === 'accepted' ? link(m, 'no_show') : null,
      };
    });

  return {
    request_id: req.id,
    found: true,
    status: req.status,
    blood_group: req.blood_group,
    urgency: req.urgency,
    units_required: req.units_required,
    units_confirmed: count(own, 'accepted', 'donated'),
    units_donated: count(own, 'donated'),
    patient_ref: req.patient_ref ?? null,
    created_at: req.createdAt,
    first_accept_at: req.first_accept_at ?? null,
    fulfilled_at: req.fulfilled_at ?? null,
    closed_reason: req.closed_reason ?? null,
    compatible_donors: req.compatible_donors ?? own.length,
    donors_alerted: alerted.length,
    donors_declined: count(own, 'declined'),
    donors_no_reply: count(own, 'expired'),
    donors_on_standby: count(own, 'queued'),
    next_check_at: req.status === 'Open' && lastAlert ? new Date(time(lastAlert) + (req.escalation_minutes ?? 10) * 60000).toISOString() : null,
    tracking_token: req.status_token,
    cancel_url: active ? BASE + '?r=' + req.id + '&h=' + req.hospital_token + '&a=cancel' : null,
    donors: confirmed,
  };
});

return [{ json: { requests: views } }];`
    },
    position: [1320, 200]
  },
  output: [{ requests: [{ request_id: 1, found: true, status: 'Open', donors: [] }] }]
});

const respondView = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Return Hospital View',
    parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: { responseCode: 200 } },
    position: [1540, 200]
  },
  output: [{ requests: [] }]
});

const note = sticky("## Hospital portal (website backend only)\nThe backend sends `requests: [{ request_id, hospital_token }]` for the logged-in hospital with the `X-LifeLink-Key` header, and gets each request's live progress, the donors who confirmed (first name and phone, for coordination) and the one-tap links to confirm a donation, record a no-show or cancel.\n\nFamilies use the anonymous tracker instead; donor identities never leave this endpoint except to the hospital that owns the request.", [portalWebhook, parseRequest], { color: 5, position: [-40, -80], width: 600, height: 260 });

export default workflow('lifelink-hospital-portal', 'LifeLink – Hospital Portal')
  .add(portalWebhook)
  .to(parseRequest)
  .to(isValid
    .onTrue(loadRequests.to(loadMatches.to(loadDonors.to(buildView.to(respondView)))))
    .onFalse(rejectRequest))
  .add(note)
  .group('Validate request', [parseRequest, isValid], { description: 'Keeps well-formed { request_id, hospital_token } pairs, at most 25.' })
  .group('Build hospital view', [loadRequests, loadMatches, loadDonors, buildView, respondView], { description: 'Checks each hospital token and returns progress, confirmed donors and action links.' });
