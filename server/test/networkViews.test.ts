import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NetDonor, NetMatch, NetRequest } from '../src/network/rules';
import {
    buildDonorView, buildHospitalView, buildTracking, computeAnalytics, parseHospitalPortal, registryReply, validatePortal, validateRegistry,
} from '../src/network/views';
import { parseUssd, ussdMenu, ussdOutcomeReply } from '../src/network/ussd';
import { accountEmail, campaignMessages } from '../src/network/messages';
import { replyPage, trackingPage } from '../src/network/pages';
import { decideOutcome, parseLink } from '../src/network/replies';

const NOW = Date.parse('2026-10-16T06:00:00Z');
const BASE = 'https://api.example/network';
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60000).toISOString();
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOSPITAL_TOKEN = uuid(900);

const donor = (over: Partial<NetDonor> = {}): NetDonor => ({
    id: 1, name: 'Asha Patil', phone: '+915550000001', blood_group: 'O+', gender: 'female', city: 'Jalandhar',
    latitude: null, longitude: null, available: true, last_donation_date: null, total_donations: 0,
    preferred_channel: 'sms', fcm_token: null, xp_points: 0, committed_until: null, source: 'web', ...over,
});
const request = (over: Partial<NetRequest> = {}): NetRequest => ({
    id: 1001, hospital_name: 'Civil Hospital', hospital_city: 'Jalandhar', hospital_contact: '+915550000900', patient_ref: 'ICU-4',
    blood_group: 'O+', units_required: 2, urgency: 'Emergency', latitude: null, longitude: null, required_by: null, status: 'Open',
    units_confirmed: 0, units_donated: 0, compatible_donors: 4, donors_notified: 3, wave_size: 3, escalation_minutes: 10,
    escalation_rounds: 0, status_token: uuid(800), hospital_token: HOSPITAL_TOKEN, first_accept_at: null, fulfilled_at: null,
    closed_reason: null, closed_at: null, next_check_at: at(-4), created_at: at(30), updated_at: at(1), ...over,
});
const match = (over: Partial<NetMatch> = {}): NetMatch => ({
    id: 10001, request_id: 1001, donor_id: 1, donor_blood_group: 'O+', request_blood_group: 'O+', rank: 1, distance_km: 3.4,
    exact_match: true, status: 'notified', response_token: uuid(1), channel: 'sms', contact: '+915550000001',
    hospital_name: 'Civil Hospital', hospital_city: 'Jalandhar', urgency: 'Emergency', units_required: 2,
    notified_at: at(20), responded_at: null, created_at: at(30), updated_at: at(20), ...over,
});

// ── Donor portal ──────────────────────────────────────────────────────────

test('the donor sees live alerts with their links, a pass once they said YES, and their history', () => {
    const matches = [
        match({ id: 1, status: 'notified', notified_at: at(20) }),
        match({ id: 2, status: 'accepted', request_id: 1002, response_token: uuid(2), notified_at: at(60), responded_at: at(5) }),
        // 02:00 on 1 September in India
        match({ id: 3, status: 'donated', request_id: 900, responded_at: '2026-08-31T20:30:00Z' }),
        match({ id: 4, status: 'declined', request_id: 901, responded_at: at(600) }),
    ];
    const view = buildDonorView(donor({ last_donation_date: '2026-09-01', total_donations: 1, xp_points: 10 }), matches, NOW, BASE);
    assert.deepEqual(view.alerts.map((a) => [a.match_id, a.status]), [[2, 'accepted'], [1, 'awaiting_reply']]);
    assert.equal(view.alerts[1]!.accept_url, `${BASE}/donor-response?m=1&t=${uuid(1)}&a=accept`);
    assert.equal(view.alerts[0]!.accept_url, null, 'no YES link once accepted');
    assert.match(String(view.alerts[0]!.pass_code), /^LP-/);
    assert.equal(view.alerts[1]!.pass_code, null);
    assert.equal(view.alerts[0]!.decline_url, `${BASE}/donor-response?m=2&t=${uuid(2)}&a=decline`);
    assert.deepEqual(view.history, [{ match_id: 3, request_id: 900, hospital_name: 'Civil Hospital', hospital_city: 'Jalandhar', blood_group_needed: 'O+', donated_on: '2026-09-01', lab_blood_group: null }]);
    assert.equal(view.donor.blood_group_verified, false, 'self-reported until a lab confirms it');
    assert.deepEqual(view.stats, { alerts_received: 4, accepted: 2, donations_via_lifelink: 1 });
    // Women rest 120 days
    assert.equal(view.donor.eligible_from, '2026-12-30');
    assert.equal(view.donor.eligible_now, false);
    assert.equal(view.donor.committed_until, null);
});

test('portal updates must name something to change, with a supported channel', () => {
    assert.deepEqual(validatePortal({ phone: '98765 43210', action: 'update', available: false }).errors, []);
    assert.equal(validatePortal({ phone: '98765 43210' }).phone, '+919876543210');
    assert.deepEqual(validatePortal({ phone: '98765 43210', action: 'update' }).errors.map((e) => e.path), ['action']);
    assert.deepEqual(validatePortal({ phone: '123', preferred_channel: 'push', available: 'yes' }).errors.map((e) => e.path), ['phone', 'available', 'preferred_channel']);
});

// ── Hospital portal ───────────────────────────────────────────────────────

test('a hospital sees its own request only with its token, with confirmed donors and their action links', () => {
    const matches = [
        match({ id: 1, donor_id: 1, status: 'accepted', responded_at: at(8) }),
        match({ id: 2, donor_id: 2, status: 'donated', responded_at: at(15), response_token: uuid(2) }),
        match({ id: 3, donor_id: 3, status: 'declined' }),
        match({ id: 4, donor_id: null, status: 'no_show', responded_at: at(2), response_token: uuid(4) }),
        match({ id: 5, donor_id: 5, status: 'queued', notified_at: null }),
        match({ id: 6, request_id: 1002, status: 'accepted' }),
    ];
    const donors = new Map([[1, donor()], [2, donor({ id: 2, name: 'Rohan Mehra', phone: '+915550000002' })]]);
    assert.deepEqual(buildHospitalView({ request_id: 1001, hospital_token: uuid(1) }, request(), matches, donors, BASE), { request_id: 1001, found: false });

    const view = buildHospitalView({ request_id: 1001, hospital_token: HOSPITAL_TOKEN }, request(), matches, donors, BASE);
    assert.ok(view.found);
    if (!view.found) return;
    assert.deepEqual(view.donors.map((d) => [d.match_id, d.name, d.phone, d.status]), [[2, 'Rohan', '+915550000002', 'donated'], [1, 'Asha', '+915550000001', 'accepted'], [4, 'Donor', null, 'no_show']]);
    assert.equal(view.donors[1]!.donated_url, `${BASE}/donor-response?m=1&h=${HOSPITAL_TOKEN}&a=donated`);
    assert.equal(view.donors[0]!.donated_url, null);
    assert.deepEqual([view.units_confirmed, view.units_donated, view.donors_declined, view.donors_on_standby, view.donors_alerted], [2, 1, 1, 1, 4]);
    assert.equal(view.cancel_url, `${BASE}/donor-response?r=1001&h=${HOSPITAL_TOKEN}&a=cancel`);
    assert.equal(view.next_check_at, at(-4));
    assert.equal(view.tracking_token, uuid(800));

    const done = buildHospitalView({ request_id: 1001, hospital_token: HOSPITAL_TOKEN }, request({ status: 'Completed' }), matches, donors, BASE);
    assert.ok(done.found && done.cancel_url === null && done.next_check_at === null);
});

test('a donor sees whether a hospital lab confirmed their blood group, and any correction', () => {
    const lab = match({ id: 5, status: 'donated', request_id: 950, donor_blood_group: 'B+', lab_blood_group: 'A+', lab_recorded_at: at(60), responded_at: at(120) });
    const view = buildDonorView(donor({ blood_group: 'A+', blood_group_verified_at: at(60) }), [lab], NOW, BASE);
    assert.equal(view.donor.blood_group_verified, true);
    assert.equal(view.donor.blood_group_verified_by, 'Civil Hospital');
    assert.equal(view.donor.blood_group_corrected_from, 'B+', 'they had registered as B+');
    assert.equal(view.history[0]!.lab_blood_group, 'A+');

    // A later lab result that agrees replaces the correction notice
    const again = match({ id: 6, status: 'donated', request_id: 960, hospital_name: 'DMC Hospital', donor_blood_group: 'A+', lab_blood_group: 'A+', lab_recorded_at: at(10) });
    const later = buildDonorView(donor({ blood_group: 'A+', blood_group_verified_at: at(10) }), [lab, again], NOW, BASE);
    assert.equal(later.donor.blood_group_verified_by, 'DMC Hospital');
    assert.equal(later.donor.blood_group_corrected_from, null);
});

test('a hospital sees the lab result of each donation and which donors have a lab-confirmed group', () => {
    const donors = new Map([
        [1, donor()],
        [2, donor({ id: 2, name: 'Rohan Mehta', phone: '+915550000002', blood_group_verified_at: at(20) })],
    ]);
    const matches = [
        match({ id: 1, donor_id: 1, status: 'accepted', responded_at: at(5) }),
        match({ id: 2, donor_id: 2, status: 'donated', responded_at: at(50), lab_blood_group: 'O+', lab_recorded_at: at(20) }),
    ];
    const view = buildHospitalView({ request_id: 1001, hospital_token: HOSPITAL_TOKEN }, request(), matches, donors, BASE);
    assert.ok(view.found);
    if (!view.found) return;
    assert.deepEqual(view.donors.map((d) => [d.match_id, d.blood_group_verified, d.lab_blood_group]), [[2, true, 'O+'], [1, false, null]]);
});

test('signing up again keeps a lab-confirmed blood group and says so', () => {
    const { profile } = validateRegistry({ name: 'Asha Patil', phone: '98765 43210', blood_group: 'B+', city: 'Jalandhar', gender: 'Female' }, NOW);
    const kept = registryReply(profile!, { id: 1, last_donation_date: null, blood_group: 'A+' }, false, [], NOW);
    assert.equal(kept.blood_group, 'A+');
    assert.deepEqual(kept.your_blood_can_help, ['A+', 'AB+']);
    assert.match(kept.warnings.join(' '), /lab confirmed your blood group as A\+/);
    assert.deepEqual(registryReply(profile!, { id: 1, last_donation_date: null, blood_group: 'B+' }, false, [], NOW).warnings, []);
});

test('the hospital portal takes at most 25 well-formed requests', () => {
    const list = Array.from({ length: 30 }, (_, i) => ({ request_id: 1001 + i, hospital_token: HOSPITAL_TOKEN.toUpperCase() }));
    const parsed = parseHospitalPortal([...list, { request_id: 'x', hospital_token: HOSPITAL_TOKEN }, { request_id: 5, hospital_token: 'short' }]);
    assert.equal(parsed.length, 25);
    assert.equal(parsed[0]!.hospital_token, HOSPITAL_TOKEN);
    assert.deepEqual(parseHospitalPortal('nonsense'), []);
});

// ── Tracking ──────────────────────────────────────────────────────────────

test('the family tracker shows progress and a timeline, never donor identities', () => {
    const req = request({ escalation_rounds: 1, first_accept_at: at(12), status: 'Open' });
    const matches = [
        match({ id: 1, status: 'accepted', notified_at: at(29), responded_at: at(12) }),
        match({ id: 2, status: 'expired', notified_at: at(29), donor_id: 2, response_token: uuid(2) }),
        match({ id: 3, status: 'notified', notified_at: at(18), donor_id: 3, response_token: uuid(3), distance_km: null }),
        match({ id: 4, status: 'queued', notified_at: null, donor_id: 4 }),
    ];
    const summary = buildTracking(req, matches);
    assert.deepEqual([summary.units_confirmed, summary.donors_alerted, summary.donors_no_response, summary.donors_on_standby], [1, 3, 1, 1]);
    assert.deepEqual(summary.confirmed_donors, [{ blood_group: 'O+', distance_km: 3.4, state: 'on the way' }]);
    assert.deepEqual(summary.timeline.map((t) => t.event), [
        'Request raised by Civil Hospital',
        'First compatible donors alerted',
        'More donors alerted (escalation round 1)',
        'First donor confirmed (18 min after the request)',
    ]);
    assert.match(summary.next_step, /every 10 minutes until 2 unit\(s\) are confirmed/);
    const json = JSON.stringify(summary);
    for (const secret of [uuid(1), uuid(2), HOSPITAL_TOKEN, '+915550000001', 'Asha']) assert.ok(!json.includes(secret), `leaked ${secret}`);

    const page = trackingPage(req, summary);
    assert.match(page, /<meta http-equiv="refresh" content="120">/);
    assert.doesNotMatch(trackingPage(request({ status: 'Completed' }), buildTracking(request({ status: 'Completed' }), [])), /http-equiv="refresh"/);
});

// ── Analytics ─────────────────────────────────────────────────────────────

test('analytics count requests, the donor pool and how donors respond', () => {
    const requests = [
        request({ id: 1, status: 'Open', first_accept_at: null }),
        request({ id: 2, status: 'Fulfilled', created_at: at(60), first_accept_at: at(50) }),
        request({ id: 3, status: 'Completed', created_at: at(60), first_accept_at: at(40) }),
        request({ id: 4, status: 'Cancelled' }),
    ];
    const matches = [
        match({ id: 1, status: 'accepted', notified_at: at(50), responded_at: at(46) }),
        match({ id: 2, status: 'donated', exact_match: false, channel: 'whatsapp', notified_at: at(50), responded_at: at(44) }),
        match({ id: 3, status: 'declined', notified_at: at(50), responded_at: at(48) }),
        match({ id: 4, status: 'expired', notified_at: at(50) }),
        match({ id: 5, status: 'queued', notified_at: null }),
    ];
    const donors = [
        donor({ id: 1, blood_group: 'O+' }),
        donor({ id: 2, blood_group: 'O+', committed_until: at(-60) }),
        donor({ id: 3, blood_group: 'B-', available: false }),
        donor({ id: 4, blood_group: 'A+', gender: 'male', last_donation_date: '2026-09-30' }),
    ];
    const m = computeAnalytics(requests, matches, donors, NOW);
    assert.deepEqual(m.requests, {
        total: 4, open: 1, fulfilled: 1, completed: 1, exhausted: 0, cancelled: 1,
        covered_pct: 66.7, median_minutes_to_first_donor: 15, first_donor_within_15_min_pct: 50,
    });
    assert.deepEqual([m.donor_pool.registered, m.donor_pool.available, m.donor_pool.eligible_now, m.donor_pool.committed_now], [4, 3, 1, 1]);
    assert.deepEqual(m.donor_pool.by_blood_group['O+'], { registered: 2, eligible_now: 1 });
    assert.deepEqual(m.responses, {
        alerts_sent: 4, responded: 3, response_rate_pct: 75, accepted: 2, acceptance_rate_pct: 50, declined: 1, no_response: 1,
        median_response_minutes: 4, donations_logged: 1, no_shows: 0, alerts_by_channel: { sms: 3, whatsapp: 1 },
    });
    assert.deepEqual(m.compatibility, { accepted_from_other_compatible_groups: 1, share_of_accepted_pct: 50 });
});

// ── Registry ──────────────────────────────────────────────────────────────

test('the registry normalises profiles and explains what it changed', () => {
    const ok = validateRegistry({ name: ' Asha Patil ', phone: '98765 43210', blood_group: 'O-', city: 'Jalandhar', gender: 'Female', preferred_channel: 'push' }, NOW);
    assert.deepEqual(ok.errors, []);
    assert.equal(ok.profile!.phone, '+919876543210');
    assert.equal(ok.profile!.gender, 'female');
    assert.equal(ok.profile!.preferred_channel, 'sms', 'push needs an app token');
    assert.equal(ok.warnings.length, 1);
    assert.equal(ok.profile!.total_donations, null, 'history the form did not send is kept');

    const reply = registryReply(ok.profile!, { id: 7, last_donation_date: '2026-08-01' }, true, ok.warnings, NOW);
    assert.equal(reply.status, 'registered');
    assert.equal(reply.eligibility.eligible_from, '2026-11-29');
    assert.equal(reply.your_blood_can_help.length, 8, 'O- can help every patient');

    const bad = validateRegistry({ name: 'A', phone: '12', blood_group: 'O', city: 'J', gender: 'robot', last_donation_date: '2026-12-01', total_donations: -1, available: 'no' }, NOW);
    assert.deepEqual(bad.errors.map((e) => e.path), ['phone', 'name', 'blood_group', 'city', 'gender', 'last_donation_date', 'total_donations', 'available']);
});

// ── USSD ──────────────────────────────────────────────────────────────────

const session = (text: string, phoneNumber = '+919876543210') => parseUssd({ sessionId: 's1', serviceCode: '*384*7#', phoneNumber, text });

test('an unknown number can register by USSD with a blood group and a city', () => {
    assert.match(ussdMenu(session(''), null, [], NOW).reply, /^CON Welcome to LifeLink\./);
    assert.match(ussdMenu(session('1'), null, [], NOW).reply, /7\. O\+\n8\. O-\n9\. Not sure$/);
    assert.equal(ussdMenu(session('1*7'), null, [], NOW).reply, 'CON Enter your city or town:');
    assert.match(ussdMenu(session('1*9'), null, [], NOW).reply, /^END Please get your blood group tested/);
    const done = ussdMenu(session('1*7*jalandhar'), null, [], NOW);
    assert.equal(done.action, 'register');
    if (done.action !== 'register') return;
    assert.deepEqual(done.register, { phone: '+919876543210', blood_group: 'O+', city: 'Jalandhar' });
    assert.equal(done.reply, 'END Registered as an O+ donor in Jalandhar. We will text you when your blood can help a patient nearby. Thank you!');
    assert.equal(ussdMenu(session('1*7*x'), null, [], NOW).reply, 'END Invalid choice. Please dial again.');
    assert.equal(ussdMenu(session('', 'unknown'), null, [], NOW).reply, 'END Sorry, we could not read your phone number.');
});

test('a registered donor answers requests, checks eligibility and switches alerts by USSD', () => {
    const me = donor({ gender: 'male', last_donation_date: '2026-09-01' });
    const pending = [match({ id: 10005, response_token: uuid(5) })];
    assert.equal(ussdMenu(session(''), me, pending, NOW).reply, 'CON Welcome Asha (O+ donor)\n1. Blood requests for you (1)\n2. My eligibility\n3. Alerts: ON');
    assert.match(ussdMenu(session(''), donor({ source: 'ussd' }), [], NOW).reply, /^CON Welcome back/);
    assert.equal(ussdMenu(session('1'), me, pending, NOW).reply, 'CON Requests needing you:\n1. Emergency O+ - Civil Hospital (3.4 km)');
    assert.match(ussdMenu(session('1*1'), me, pending, NOW).reply, /^CON Civil Hospital \(Jalandhar\) needs O\+ blood \(Emergency\)\./);
    const yes = ussdMenu(session('1*1*1'), me, pending, NOW);
    assert.deepEqual(yes.action === 'respond' && yes.respond, { match_id: 10005, token: uuid(5), action: 'accept', hospital_name: 'Civil Hospital' });
    assert.equal(ussdMenu(session('2'), me, [], NOW).reply, 'END O+ donor. Last donation 01/09/2026. You can donate again from 30/11/2026.');
    const off = ussdMenu(session('3*2'), me, [], NOW);
    assert.deepEqual(off.action === 'set_availability' && off.availability, { id: 1, available: false });
    assert.equal(ussdOutcomeReply('accepted', 'Civil Hospital'), 'END Thank you! Civil Hospital has been told you are coming. Please carry a photo ID.');
    assert.equal(ussdOutcomeReply('invalid_link', 'x'), 'END Sorry, we could not record your reply. Please try again.');
});

// ── Messages and pages ────────────────────────────────────────────────────

test('campaign invitations carry the camp details and the sign-up link', () => {
    const [m] = campaignMessages(
        { name: 'Daan Utsav', city: 'Jalandhar', venue: 'Town Hall', address: 'GT Road', when: '20 Oct 2026, 9:00 am to 5:00 pm', rewards: 'Certificate', refreshments: null, contact_phone: '+915550000950', description: '<b>Bring ID</b>' },
        'https://lifelink.example/campaign/4', [{ name: 'Asha Patil', email: 'asha@example.com', phone: '+915550000001' }]);
    assert.equal(m!.sms_text, 'LifeLink: Blood donation camp "Daan Utsav" in Jalandhar, 20 Oct 2026, 9:00 am to 5:00 pm at Town Hall, GT Road, Jalandhar. Rewards: Certificate. Register: https://lifelink.example/campaign/4');
    assert.equal(m!.email_subject, 'Blood donation camp: Daan Utsav (Jalandhar)');
    assert.match(m!.email_html, /^<p>Hi Asha,<\/p>/);
    assert.match(m!.email_html, /&lt;b&gt;Bring ID&lt;\/b&gt;/);
});

test('account emails: a 6-digit reset code, or the notice that the password changed', () => {
    const code = accountEmail({ type: 'reset_code', to: 'asha@example.com', name: 'Asha <Patil>', code: '482913', minutes: 15, needs_authenticator: true });
    assert.equal(code.subject, 'Your LifeLink password reset code');
    assert.match(code.html, /482913/);
    assert.match(code.html, /authenticator app/);
    assert.match(code.html, /Hi Asha,/);
    assert.throws(() => accountEmail({ type: 'reset_code', to: 'asha@example.com', name: 'Asha', code: '12ab56' }), /6-digit/);
    assert.throws(() => accountEmail({ type: 'reset_code', to: 'not an email', name: 'Asha', code: '123456' }), /valid recipient/);
    const changed = accountEmail({ type: 'password_changed', to: 'asha@example.com', name: 'Asha', when: '16 Oct 2026, 11:30 am' });
    assert.equal(changed.subject, 'Your LifeLink password was changed');
    assert.match(changed.html, /changed on 16 Oct 2026, 11:30 am \(IST\)/);
});

test('account emails: a hospital hears the verification decision, a donor hears a lab correction', () => {
    const approved = accountEmail({ type: 'hospital_verification', to: 'civil@example.com', name: 'Civil Hospital', decision: 'approved', url: 'https://lifelink.example/hospital' });
    assert.equal(approved.subject, 'Your hospital is verified on LifeLink');
    assert.match(approved.html, /href="https:\/\/lifelink.example\/hospital"/);
    // The admin's note is shown as text
    const changes = accountEmail({ type: 'hospital_verification', to: 'civil@example.com', name: 'Civil Hospital', decision: 'changes_requested', note: 'Upload the <b>current</b> certificate' });
    assert.equal(changes.subject, 'LifeLink needs more from your hospital');
    assert.match(changes.html, /Upload the &lt;b&gt;current&lt;\/b&gt; certificate/);
    assert.equal(accountEmail({ type: 'hospital_verification', to: 'civil@example.com', name: 'Civil Hospital', decision: 'revoked', note: 'Licence expired' }).subject, 'Your LifeLink verification was paused');
    assert.throws(() => accountEmail({ type: 'hospital_verification', to: 'civil@example.com', name: 'Civil Hospital' }), /decision/);

    const corrected = accountEmail({ type: 'blood_group_corrected', to: 'rohan@example.com', name: 'Rohan Mehta', blood_group: 'A+', previous_blood_group: 'B+', hospital_name: 'Civil Hospital' });
    assert.equal(corrected.subject, 'Your blood group on LifeLink is now A+');
    assert.match(corrected.html, /Hi Rohan,/);
    assert.match(corrected.html, /You had registered as B\+/);
    assert.throws(() => accountEmail({ type: 'blood_group_corrected', to: 'rohan@example.com', name: 'Rohan', blood_group: 'A+' }), /Both blood groups/);
});

test('reply pages escape what they show and link the pass to its QR page', () => {
    const req = request({ hospital_name: '<script>alert(1)</script> Hospital', units_required: 1 });
    const mine = match({ hospital_name: req.hospital_name });
    const d = decideOutcome({ link: parseLink({ m: '10001', t: uuid(1), a: 'accept' }), match: mine, req, reqMatches: [mine], donor: donor(), donorMatches: [mine], now: NOW, base: BASE });
    const page = replyPage(d, 'https://lifelink.example');
    assert.doesNotMatch(page, /<script>/);
    assert.match(page, /&lt;script&gt;/);
    assert.ok(page.includes(`href="https://lifelink.example/pass/${d.pass}"`));
    assert.match(page, /1 of 1 units confirmed &middot; Fulfilled/);
});
