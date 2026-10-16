import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    NetDonor, NetMatch, NetRequest, composeAlert, matchDonors, minutesUntilNextRound, passCode, planEscalation, validateDispatch, waveSize,
} from '../src/network/rules';
import { decideOutcome, parseLink } from '../src/network/replies';

const NOW = Date.parse('2026-10-16T06:00:00Z');
const BASE = 'https://api.example/network';
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60000).toISOString();
const daysAgo = (days: number) => new Date(NOW - days * 86400000).toISOString().slice(0, 10);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOSPITAL_TOKEN = uuid(900);

const donor = (over: Partial<NetDonor> = {}): NetDonor => ({
    id: 1, name: 'Asha Patil', phone: '+915550000001', blood_group: 'O+', gender: 'female', city: 'Jalandhar',
    latitude: null, longitude: null, available: true, last_donation_date: null, total_donations: 0,
    preferred_channel: 'sms', fcm_token: null, xp_points: 0, committed_until: null, source: 'web', ...over,
});

const request = (over: Partial<NetRequest> = {}): NetRequest => ({
    id: 1001, hospital_name: 'Civil Hospital', hospital_city: 'Jalandhar', hospital_contact: '+915550000900', patient_ref: 'ICU-4',
    blood_group: 'O+', units_required: 1, urgency: 'Emergency', latitude: null, longitude: null, required_by: null, status: 'Open',
    units_confirmed: 0, units_donated: 0, compatible_donors: 3, donors_notified: 2, wave_size: 3, escalation_minutes: 10,
    escalation_rounds: 0, status_token: uuid(800), hospital_token: HOSPITAL_TOKEN, first_accept_at: null, fulfilled_at: null,
    closed_reason: null, closed_at: null, next_check_at: at(-10), created_at: at(7), updated_at: at(7), ...over,
});

const match = (over: Partial<NetMatch> = {}): NetMatch => ({
    id: 10001, request_id: 1001, donor_id: 1, donor_blood_group: 'O+', request_blood_group: 'O+', rank: 1, distance_km: null,
    exact_match: true, status: 'notified', response_token: uuid(1), channel: 'sms', contact: '+915550000001',
    hospital_name: 'Civil Hospital', hospital_city: 'Jalandhar', urgency: 'Emergency', units_required: 1,
    notified_at: at(5), responded_at: null, created_at: at(7), updated_at: at(5), ...over,
});

// ── Request initiation ────────────────────────────────────────────────────

test('wave sizes alert more donors up front for emergencies', () => {
    assert.equal(waveSize(1, 'Emergency'), 3);
    assert.equal(waveSize(2, 'Emergency'), 6);
    assert.equal(waveSize(5, 'Emergency'), 10);
    assert.equal(waveSize(1, 'Urgent'), 2);
    assert.equal(waveSize(3, 'Urgent'), 6);
    assert.equal(waveSize(1, 'Normal'), 2);
    assert.equal(waveSize(9, 'Normal'), 6);
});

test('a request is validated and normalised before anyone is alerted', () => {
    const ok = validateDispatch({
        hospital_name: ' Civil Hospital ', hospital_city: 'Jalandhar', hospital_contact: '98765 43210', blood_group: 'O+',
        units_required: '2', urgency: 'critical', patient_ref: 'ICU-4',
    }, NOW);
    assert.deepEqual(ok.errors, []);
    assert.equal(ok.request!.hospital_name, 'Civil Hospital');
    assert.equal(ok.request!.hospital_contact, '+919876543210');
    assert.equal(ok.request!.urgency, 'Emergency');
    assert.equal(ok.request!.units_required, 2);
    assert.equal(ok.request!.escalation_minutes, 10);
    assert.equal(ok.request!.wave_size, 6);
    assert.match(ok.request!.status_token, /^[0-9a-f-]{36}$/);
    assert.notEqual(ok.request!.status_token, ok.request!.hospital_token);

    // Blood needed within 2 hours escalates at the emergency pace whatever the label
    const soon = validateDispatch({ hospital_name: 'CH', hospital_city: 'Jalandhar', blood_group: 'A-', units_required: 1, urgency: 'Normal', required_by: at(-90) }, NOW);
    assert.equal(soon.request!.escalation_minutes, 10);
    assert.equal(validateDispatch({ hospital_name: 'CH', hospital_city: 'Jalandhar', blood_group: 'A-', units_required: 1, urgency: 'Normal' }, NOW).request!.escalation_minutes, 60);

    const bad = validateDispatch({ hospital_name: 'C', hospital_city: 'Jalandhar', blood_group: 'Z+', units_required: 21, urgency: 'soon', latitude: 31.3 }, NOW);
    assert.equal(bad.request, null);
    assert.deepEqual(bad.errors.map((e) => e.path), ['hospital_name', 'blood_group', 'units_required', 'urgency', 'latitude']);
    assert.match(bad.errors.find((e) => e.path === 'units_required')!.message, /1 to 20/);
});

// ── Compatibility engine ──────────────────────────────────────────────────

test('only compatible, available, rested donors nearby are ranked: closest, then same group, O- last', () => {
    const north = (km: number) => 31.326 + km / 111.2;
    const near = (id: number, km: number, over: Partial<NetDonor> = {}) => donor({ id, blood_group: 'A+', latitude: north(km), longitude: 75.576, ...over });
    const donors = [
        near(1, 3),
        near(2, 2, { blood_group: 'O-' }),
        near(3, 5, { blood_group: 'A-' }),
        near(4, 20),
        near(5, 1, { blood_group: 'B+' }), // cannot give to A+
        near(6, 100), // beyond 80 km
        donor({ id: 7, blood_group: 'O+', city: ' jalandhar ' }), // no location: same city counts
        donor({ id: 8, blood_group: 'A+', city: 'Ludhiana' }),
        near(9, 1, { gender: 'male', last_donation_date: daysAgo(60) }), // resting (90 days for men)
        near(10, 1, { committed_until: at(-60) }), // booked for another request
        near(11, 1, { available: false }),
        near(12, 1, { gender: 'female', last_donation_date: daysAgo(100) }), // resting (120 days for women)
        near(13, 1, { gender: 'male', last_donation_date: daysAgo(100), preferred_channel: 'in_app' }),
        near(14, 2, { xp_points: 50, preferred_channel: 'whatsapp' }),
    ];
    const req = request({ blood_group: 'A+', latitude: 31.326, longitude: 75.576, wave_size: 3 });
    const { matches, match_rule, compatible_groups } = matchDonors(req, donors, NOW);

    assert.equal(match_rule, 'within 80 km');
    assert.deepEqual(compatible_groups, ['O-', 'O+', 'A-', 'A+']);
    assert.deepEqual(matches.map((m) => m.donor_id), [14, 1, 13, 3, 2, 4, 7]);
    assert.deepEqual(matches.map((m) => m.status), ['notified', 'notified', 'notified', 'queued', 'queued', 'queued', 'queued']);
    assert.deepEqual(matches.map((m) => m.rank), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(matches[0]!.distance_km, 2);
    assert.equal(matches[6]!.distance_km, null);
    assert.deepEqual(matches.map((m) => m.exact_match), [true, true, true, false, false, true, false]);
    assert.deepEqual(matches.slice(0, 3).map((m) => [m.channel, m.contact]), [['whatsapp', '+915550000001'], ['sms', '+915550000001'], ['in_app', null]]);
    assert.equal(matches[0]!.notified_at, new Date(NOW).toISOString());
    assert.equal(matches[3]!.notified_at, null);
    assert.equal(new Set(matches.map((m) => m.response_token)).size, matches.length, 'every alert has its own token');
});

test('without hospital coordinates, donors in the same city are matched', () => {
    const { matches, match_rule } = matchDonors(request({ blood_group: 'O-' }), [
        donor({ id: 1, blood_group: 'O-' }), donor({ id: 2, blood_group: 'O+' }), donor({ id: 3, blood_group: 'O-', city: 'Delhi' }),
    ], NOW);
    assert.equal(match_rule, 'same city');
    assert.deepEqual(matches.map((m) => m.donor_id), [1]);
});

test('alerts say who needs blood, how far away, and carry the YES/NO links', () => {
    const a = composeAlert(BASE, match({ distance_km: 4.2, request_blood_group: 'A+', donor_blood_group: 'O-', units_required: 2 }));
    assert.equal(a.title, 'Emergency: A+ blood needed at Civil Hospital');
    assert.equal(a.message, 'Civil Hospital (Jalandhar) needs 2 unit(s) for an A+ patient, 4.2 km from you. Your O- blood is compatible. Can you donate today? Tap YES or NO.');
    assert.equal(a.accept_url, `${BASE}/donor-response?m=10001&t=${uuid(1)}&a=accept`);
    assert.equal(a.sms_text, `LifeLink Emergency: A+ blood needed at Civil Hospital (4.2 km). Can you donate today? YES: ${a.accept_url} NO: ${a.decline_url}`);
    assert.deepEqual(a.whatsapp_params, ['A+', 'Civil Hospital', a.accept_url, a.decline_url]);
    assert.match(composeAlert(BASE, match({ request_blood_group: 'B+' })).message, /for a B\+ patient\./);
});

// ── Auto-escalation ───────────────────────────────────────────────────────

test('an escalation round expires silent alerts and alerts the next eligible donors', () => {
    const req = request({ units_required: 2, donors_notified: 3, created_at: at(15) });
    const matches = [
        match({ id: 1, donor_id: 1, status: 'notified', notified_at: at(12) }), // no reply within 10 minutes
        match({ id: 2, donor_id: 2, status: 'notified', notified_at: at(5) }),
        match({ id: 3, donor_id: 3, status: 'accepted', notified_at: at(12) }),
        match({ id: 4, donor_id: 4, status: 'queued', rank: 4, notified_at: null }),
        match({ id: 5, donor_id: 5, status: 'queued', rank: 5, notified_at: null }),
        match({ id: 6, donor_id: 6, status: 'queued', rank: 6, notified_at: null }),
    ];
    const donors = new Map([1, 2, 3, 4, 5, 6].map((id) => [id, donor({ id, phone: `+9155500000${id}0` })]));
    donors.set(5, donor({ id: 5, committed_until: at(-120) })); // booked elsewhere since
    donors.set(6, donor({ id: 6, phone: '+915550000060', preferred_channel: 'whatsapp' }));

    const plan = planEscalation(req, matches, donors, NOW, 1);
    assert.equal(plan.action, 'escalate');
    assert.deepEqual(plan.updates.map((u) => [u.id, u.status]), [[1, 'expired'], [5, 'skipped'], [4, 'notified'], [6, 'notified']]);
    assert.deepEqual(plan.updates.find((u) => u.id === 6), { id: 6, status: 'notified', notified_at: new Date(NOW).toISOString(), channel: 'whatsapp', contact: '+915550000060' });
    assert.equal(plan.donors_notified_total, 5);
    assert.equal(minutesUntilNextRound(req, plan), 10);
});

test('escalation watches a covered request, and stops or gives up when it should', () => {
    const covered = planEscalation(request(), [match({ status: 'accepted' })], new Map(), NOW, 2);
    assert.equal(covered.action, 'watch');
    assert.equal(minutesUntilNextRound(request(), covered), 30);
    assert.equal(minutesUntilNextRound(request({ escalation_minutes: 60 }), covered), 60);

    const nobodyLeft = planEscalation(request(), [match({ status: 'declined' })], new Map(), NOW, 3);
    assert.deepEqual([nobodyLeft.action, nobodyLeft.reason], ['exhausted', 'all_compatible_donors_asked']);

    const old = request({ created_at: at(13 * 60) });
    assert.deepEqual([planEscalation(old, [], new Map(), NOW, 9).action, planEscalation(old, [], new Map(), NOW, 9).reason], ['exhausted', 'timed_out']);
    assert.equal(planEscalation(old, [match({ status: 'accepted' })], new Map(), NOW, 9).action, 'stop');
    assert.equal(planEscalation(request({ status: 'Completed' }), [], new Map(), NOW, 1).action, 'stop');
});

// ── One-tap replies ───────────────────────────────────────────────────────

const donorTap = (token: string, action: 'accept' | 'decline', m = 10001) => parseLink({ m: String(m), t: token, a: action });
const hospitalTap = (action: 'donated' | 'no_show', m = 10001) => parseLink({ m: String(m), h: HOSPITAL_TOKEN, a: action });

test('links are recognised by their shape; anything else is invalid', () => {
    assert.equal(donorTap(uuid(1), 'accept').kind, 'donor');
    assert.equal(hospitalTap('donated').kind, 'hospital_match');
    assert.equal(parseLink({ r: '1001', h: HOSPITAL_TOKEN, a: 'cancel' }).kind, 'hospital_request');
    assert.equal(parseLink({ m: '10001', t: 'nope', a: 'accept' }).kind, 'invalid');
    assert.equal(parseLink({ m: ['1', '2'], t: uuid(1), a: 'accept' }).kind, 'invalid');
    assert.equal(parseLink({ m: '10001', t: uuid(1), a: 'accept', format: 'json' }).format, 'json');
});

test('YES books the donor, tells the hospital, and stands down their other alerts', () => {
    const req = request({ units_required: 2 });
    const mine = match();
    const otherRequest = match({ id: 20001, request_id: 1002, hospital_name: 'DMC Ludhiana' });
    const d = decideOutcome({
        link: donorTap(uuid(1), 'accept'), match: mine, req, reqMatches: [mine, match({ id: 10002, donor_id: 2, response_token: uuid(2) })],
        donor: donor(), donorMatches: [mine, otherRequest], now: NOW, base: BASE,
    });
    assert.equal(d.outcome, 'accepted');
    assert.equal(d.title, 'Thank you, Asha!');
    assert.deepEqual(d.writes.match_updates.map((u) => [u.id, u.status]), [[10001, 'accepted'], [20001, 'superseded']]);
    assert.deepEqual(d.writes.request_updates[0], {
        id: 1001, status: 'Open', units_confirmed: 1, units_donated: 0, first_accept_at: new Date(NOW).toISOString(), fulfilled_at: null, closed_reason: null,
    });
    assert.deepEqual(d.writes.donor_commitments, [{ id: 1, committed_until: new Date(NOW + 24 * 3600000).toISOString() }]);
    const note = d.writes.notifications[0]!;
    assert.equal(note.title, 'Donor confirmed for O+ (1/2 units)');
    assert.match(note.message, /^Asha \(O\+, phone \+915550000001\) accepted 7 min after the request\. Confirm donation: /);
    assert.equal(note.confirm_donation_url, `${BASE}/donor-response?m=10001&h=${HOSPITAL_TOKEN}&a=donated`);
    assert.deepEqual(d.writes.hospital_sms.map((s) => s.to), ['+915550000900']);
    assert.match(String(d.payload.pass_code), /^LP-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(d.payload.pass_code, passCode(uuid(1)));
    assert.deepEqual([d.payload.request_status, d.payload.units_confirmed, d.payload.units_required], ['Open', 1, 2]);
});

test('the YES that covers the last unit fulfils the request and stands down other alerted donors only', () => {
    const mine = match({ id: 3, donor_id: 3, response_token: uuid(3) });
    const reqMatches = [match({ id: 1, status: 'accepted' }), match({ id: 2, donor_id: 2, status: 'notified' }), mine, match({ id: 4, donor_id: 4, status: 'queued' })];
    const d = decideOutcome({ link: donorTap(uuid(3), 'accept', 3), match: mine, req: request({ units_required: 2 }), reqMatches, donor: donor({ id: 3 }), donorMatches: [mine], now: NOW, base: BASE });
    assert.equal(d.outcome, 'accepted');
    assert.deepEqual(d.writes.match_updates.map((u) => [u.id, u.status]), [[3, 'accepted'], [2, 'not_needed']]);
    assert.equal(d.writes.request_updates[0]!.status, 'Fulfilled');
    assert.equal(d.writes.request_updates[0]!.fulfilled_at, new Date(NOW).toISOString());
    assert.match(d.writes.notifications[0]!.message, /All units are now covered\./);
});

test('late, double and conflicting YES taps change nothing they should not', () => {
    const covered = decideOutcome({ link: donorTap(uuid(1), 'accept'), match: match(), req: request({ status: 'Fulfilled' }), reqMatches: [match()], donor: donor(), donorMatches: [match()], now: NOW, base: BASE });
    assert.equal(covered.outcome, 'not_needed');
    assert.deepEqual(covered.writes.match_updates.map((u) => u.status), ['not_needed']);
    assert.equal(covered.payload.pass_code, undefined);

    const again = decideOutcome({ link: donorTap(uuid(1), 'accept'), match: match({ status: 'accepted' }), req: request(), reqMatches: [match({ status: 'accepted' })], donor: donor(), donorMatches: [], now: NOW, base: BASE });
    assert.equal(again.outcome, 'already_accepted');
    assert.ok(again.pass, 'the pass is shown again');
    assert.equal(again.writes.match_updates.length, 0);

    const elsewhere = match({ id: 20001, request_id: 1002, status: 'accepted', hospital_name: 'DMC Ludhiana' });
    const booked = decideOutcome({ link: donorTap(uuid(1), 'accept'), match: match(), req: request(), reqMatches: [match()], donor: donor(), donorMatches: [match(), elsewhere], now: NOW, base: BASE });
    assert.equal(booked.outcome, 'committed_elsewhere');
    assert.match(booked.message, /DMC Ludhiana/);
    assert.equal(booked.writes.match_updates.length, 0);
});

test('NO after YES withdraws, reopens a fulfilled request and tells the hospital', () => {
    const mine = match({ status: 'accepted' });
    const d = decideOutcome({ link: donorTap(uuid(1), 'decline'), match: mine, req: request({ status: 'Fulfilled', fulfilled_at: at(3) }), reqMatches: [mine], donor: donor({ committed_until: at(-600) }), donorMatches: [mine], now: NOW, base: BASE });
    assert.equal(d.outcome, 'withdrawn');
    assert.deepEqual(d.writes.request_updates[0]!.status, 'Open');
    assert.equal(d.writes.request_updates[0]!.fulfilled_at, null);
    assert.deepEqual(d.writes.donor_commitments, [{ id: 1, committed_until: null }]);
    assert.equal(d.writes.notifications[0]!.message, 'Asha can no longer come. LifeLink is alerting the next ranked donors.');

    const plain = decideOutcome({ link: donorTap(uuid(1), 'decline'), match: match(), req: request(), reqMatches: [match()], donor: donor(), donorMatches: [], now: NOW, base: BASE });
    assert.equal(plain.outcome, 'declined');
    assert.equal(plain.writes.notifications.length, 0);
    assert.equal(decideOutcome({ link: donorTap(uuid(1), 'decline'), match: match({ status: 'declined' }), req: request(), reqMatches: [], donor: donor(), donorMatches: [], now: NOW, base: BASE }).outcome, 'already_declined');
});

test('the hospital confirms a donation: the request completes and the donor\'s history moves on', () => {
    const mine = match({ status: 'accepted' });
    const reqMatches = [mine, match({ id: 10002, donor_id: 2, status: 'notified' }), match({ id: 10003, donor_id: 3, status: 'queued' })];
    const d = decideOutcome({ link: hospitalTap('donated'), match: mine, req: request(), reqMatches, donor: donor({ total_donations: 2, xp_points: 40 }), donorMatches: [mine], now: NOW, base: BASE });
    assert.equal(d.outcome, 'donation_recorded');
    assert.deepEqual(d.writes.match_updates.map((u) => [u.id, u.status]), [[10001, 'donated'], [10002, 'not_needed'], [10003, 'not_needed']]);
    assert.deepEqual([d.writes.request_updates[0]!.status, d.writes.request_updates[0]!.units_donated, d.writes.request_updates[0]!.closed_reason], ['Completed', 1, 'all_units_donated']);
    assert.deepEqual(d.writes.donations, [{ id: 1, last_donation_date: '2026-10-16', total_donations: 3, xp_points: 50 }]);
    assert.equal(d.writes.notifications[0]!.title, 'Thank you for donating!');
    assert.equal(d.message, '1 of 1 units donated for this request. The request is now complete.');
});

test('a no-show reopens the request; it applies only to a donor who said YES', () => {
    const mine = match({ status: 'accepted' });
    const d = decideOutcome({ link: hospitalTap('no_show'), match: mine, req: request({ status: 'Fulfilled' }), reqMatches: [mine], donor: donor(), donorMatches: [mine], now: NOW, base: BASE });
    assert.equal(d.outcome, 'no_show_recorded');
    assert.equal(d.writes.request_updates[0]!.status, 'Open');
    assert.match(d.message, /reopened/);

    const notYet = decideOutcome({ link: hospitalTap('no_show'), match: match(), req: request(), reqMatches: [match()], donor: donor(), donorMatches: [], now: NOW, base: BASE });
    assert.equal(notYet.outcome, 'not_applicable');
    assert.equal(notYet.writes.match_updates.length, 0);
});

test('cancelling stands everyone down and tells donors who were on their way', () => {
    const reqMatches = [
        match({ id: 1, status: 'accepted', donor_id: 7 }), match({ id: 2, status: 'notified' }), match({ id: 3, status: 'queued' }),
        match({ id: 4, status: 'donated' }), match({ id: 5, status: 'declined' }),
    ];
    const link = parseLink({ r: '1001', h: HOSPITAL_TOKEN, a: 'cancel' });
    const d = decideOutcome({ link, match: null, req: request({ units_required: 3 }), reqMatches, donor: null, donorMatches: [], now: NOW, base: BASE });
    assert.equal(d.outcome, 'cancelled');
    assert.deepEqual(d.writes.match_updates.map((u) => [u.id, u.status]), [[1, 'not_needed'], [2, 'not_needed'], [3, 'not_needed']]);
    assert.deepEqual(d.writes.donor_commitments, [{ id: 7, committed_until: null }]);
    assert.deepEqual(d.writes.notifications.map((n) => [n.donor_id, n.title]), [[7, 'No need to come in']]);
    assert.deepEqual([d.writes.request_updates[0]!.status, d.writes.request_updates[0]!.units_confirmed], ['Cancelled', 1]);

    const closed = decideOutcome({ link, match: null, req: request({ status: 'Completed' }), reqMatches, donor: null, donorMatches: [], now: NOW, base: BASE });
    assert.equal(closed.outcome, 'already_closed');
});

test('a wrong or reused token is refused and reveals nothing about the request', () => {
    const wrong = decideOutcome({ link: donorTap(uuid(2), 'accept'), match: match(), req: request(), reqMatches: [match()], donor: donor(), donorMatches: [], now: NOW, base: BASE });
    assert.deepEqual([wrong.outcome, wrong.httpStatus], ['invalid_link', 404]);
    assert.deepEqual(Object.keys(wrong.payload), ['outcome', 'title', 'message']);

    // The hospital's token never works as a donor's, and a donor's never as the hospital's
    assert.equal(decideOutcome({ link: donorTap(HOSPITAL_TOKEN, 'accept'), match: match(), req: request(), reqMatches: [], donor: donor(), donorMatches: [], now: NOW, base: BASE }).outcome, 'invalid_link');
    const asHospital = parseLink({ m: '10001', h: uuid(1), a: 'donated' });
    assert.equal(decideOutcome({ link: asHospital, match: match(), req: request(), reqMatches: [], donor: donor(), donorMatches: [], now: NOW, base: BASE }).outcome, 'invalid_link');

    // A match from another request cannot be confirmed with this request's token
    const foreign = match({ request_id: 1002 });
    assert.equal(decideOutcome({ link: hospitalTap('donated'), match: foreign, req: request(), reqMatches: [], donor: donor(), donorMatches: [], now: NOW, base: BASE }).outcome, 'invalid_link');

    const malformed = decideOutcome({ link: parseLink({ a: 'accept' }), match: null, req: null, reqMatches: [], donor: null, donorMatches: [], now: NOW, base: BASE });
    assert.deepEqual([malformed.outcome, malformed.httpStatus], ['invalid_link', 400]);
});

test('donation passes are stable per alert and different between alerts', () => {
    assert.equal(passCode(uuid(1)), passCode(uuid(1)));
    assert.notEqual(passCode(uuid(1)), passCode(uuid(2)));
    assert.match(passCode(uuid(1)), /^LP-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
});
