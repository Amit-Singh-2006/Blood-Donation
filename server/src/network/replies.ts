/**
 * One-tap replies: a donor's YES/NO, and a hospital confirming a donation,
 * recording a no-show or cancelling the request. decideOutcome works out the
 * new state and the reply page; every write is returned as a list, so the
 * engine applies only the changes that are needed.
 */
import {
    HOURS_COMMITTED, XP_PER_DONATION, MatchStatus, NetDonor, NetMatch, NetRequest, RequestStatus,
    firstName, hospitalLink, passCode, sameToken,
} from './rules';

export interface ParsedLink {
    kind: 'donor' | 'hospital_match' | 'hospital_request' | 'invalid';
    action: string;
    format: 'json' | 'html';
    match_id: number;
    request_id: number;
    token: string | null;
    hospital_token: string | null;
}

/**
 * Donor links carry the match id and its response token; hospital links carry
 * the request's hospital token (never shown to donors or on the tracking page).
 */
export const parseLink = (q: Record<string, unknown>): ParsedLink => {
    const action = String(q.a ?? '').toLowerCase();
    const isInt = (v: unknown) => /^\d{1,9}$/.test(String(v ?? ''));
    const isToken = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));

    let kind: ParsedLink['kind'] = 'invalid';
    if (['accept', 'decline'].includes(action) && isInt(q.m) && isToken(q.t)) kind = 'donor';
    else if (['donated', 'no_show'].includes(action) && isInt(q.m) && isToken(q.h)) kind = 'hospital_match';
    else if (action === 'cancel' && isInt(q.r) && isToken(q.h)) kind = 'hospital_request';

    return {
        kind,
        action,
        format: q.format === 'json' ? 'json' : 'html',
        match_id: isInt(q.m) ? Number(q.m) : 0,
        request_id: isInt(q.r) ? Number(q.r) : 0,
        token: isToken(q.t) ? String(q.t).toLowerCase() : null,
        hospital_token: isToken(q.h) ? String(q.h).toLowerCase() : null,
    };
};

export interface NotificationRow {
    donor_id: number | null; // the registry donor, or null for a hospital note
    request_id: number;
    match_id: number | null;
    title: string;
    message: string;
    type: string;
    channel: string;
    recipient: string;
    accept_url?: string | null;
    decline_url?: string | null;
    confirm_donation_url?: string | null;
    no_show_url?: string | null;
}

export interface RequestUpdate {
    id: number;
    status: RequestStatus;
    units_confirmed: number;
    units_donated: number;
    first_accept_at: string | null;
    fulfilled_at: string | null;
    closed_reason: string | null;
}

export interface Writes {
    match_updates: { id: number; status: MatchStatus; responded_at: string }[];
    request_updates: RequestUpdate[];
    donor_commitments: { id: number; committed_until: string | null }[];
    donations: { id: number; last_donation_date: string; total_donations: number; xp_points: number }[];
    notifications: NotificationRow[];
    hospital_sms: { to: string; text: string }[];
}

export interface Decision {
    outcome: string;
    httpStatus: number;
    tone: 'ok' | 'warn';
    title: string;
    message: string;
    /** The donor's pass, when they are expected at the hospital. */
    pass: string | null;
    /** The JSON reply (format=json); the HTML page shows the same facts. */
    payload: Record<string, unknown>;
    writes: Writes;
}

export interface ReplyContext {
    link: ParsedLink;
    match: NetMatch | null;
    req: NetRequest | null;
    /** Every match of the request. */
    reqMatches: NetMatch[];
    donor: NetDonor | null;
    /** Every match of the donor, across requests. */
    donorMatches: NetMatch[];
    now: number;
    /** Public address of the network API, for the links in hospital notes. */
    base: string;
}

export const decideOutcome = ({ link: p, match, req, reqMatches, donor, donorMatches, now, base }: ReplyContext): Decision => {
    const nowIso = new Date(now).toISOString();
    const today = nowIso.slice(0, 10);
    const out: Writes = { match_updates: [], request_updates: [], donor_commitments: [], donations: [], notifications: [], hospital_sms: [] };

    const donorLinkOk = p.kind === 'donor' && !!match && !!req && match.request_id === req.id && sameToken(match.response_token, p.token);
    const hospitalLinkOk = !!req && sameToken(req.hospital_token, p.hospital_token)
        && (p.kind === 'hospital_request' || (p.kind === 'hospital_match' && !!match && match.request_id === req.id));

    if (!req || (!donorLinkOk && !hospitalLinkOk)) {
        const title = 'This link is not valid';
        const message = 'It may be mistyped or out of date. To help, open the LifeLink app or dial the LifeLink USSD code.';
        // An invalid link reveals nothing about the request it points at
        return {
            outcome: 'invalid_link', httpStatus: p.kind === 'invalid' ? 400 : 404, tone: 'warn', title, message, pass: null,
            payload: { outcome: 'invalid_link', title, message }, writes: out,
        };
    }

    const overrides: Record<number, MatchStatus> = {};
    const statusOf = (m: NetMatch) => overrides[m.id] ?? m.status;
    const committedCount = () => reqMatches.filter((m) => ['accepted', 'donated'].includes(statusOf(m))).length;
    const donatedCount = () => reqMatches.filter((m) => statusOf(m) === 'donated').length;
    const setMatch = (m: Pick<NetMatch, 'id'>, s: MatchStatus) => out.match_updates.push({ id: m.id, status: s, responded_at: nowIso });
    const requestUpdate = (fields: Partial<RequestUpdate>) => out.request_updates.push({
        id: req.id,
        status: req.status,
        units_confirmed: req.units_confirmed ?? 0,
        units_donated: req.units_donated ?? 0,
        first_accept_at: req.first_accept_at ?? null,
        fulfilled_at: req.fulfilled_at ?? null,
        closed_reason: req.closed_reason ?? null,
        ...fields,
    });
    // Fulfilment stands down only donors already alerted; standby donors stay
    // queued so a withdrawal or no-show can still escalate to them
    const closeOutstanding = (statuses: MatchStatus[]) => {
        for (const m of reqMatches) {
            if (statuses.includes(statusOf(m))) {
                overrides[m.id] = 'not_needed';
                setMatch(m, 'not_needed');
            }
        }
    };
    const hospitalNote = (type: string, title: string, message: string) => {
        out.notifications.push({ donor_id: null, request_id: req.id, match_id: match?.id ?? null, title, message, type, channel: 'in_app', recipient: 'hospital:' + req.hospital_name });
        if (req.hospital_contact) out.hospital_sms.push({ to: req.hospital_contact, text: 'LifeLink: ' + title + '. ' + message });
    };
    const hospitalLinks = (m: NetMatch) => ' Confirm donation: ' + hospitalLink(base, m.id, req.hospital_token, 'donated')
        + ' | No-show: ' + hospitalLink(base, m.id, req.hospital_token, 'no_show');
    const commitDonor = (id: number | null | undefined, until: string | null) => {
        if (id != null) out.donor_commitments.push({ id, committed_until: until });
    };

    let outcome: string;
    let tone: 'ok' | 'warn' = 'ok';
    let title: string;
    let message: string;

    if (p.kind === 'donor' && p.action === 'accept') {
        const m = match!;
        const elsewhere = donorMatches.find((x) => x.request_id !== req.id && x.status === 'accepted');
        if (['accepted', 'donated'].includes(m.status)) {
            outcome = 'already_accepted';
            title = 'You are already confirmed';
            message = req.hospital_name + ' is expecting you. Thank you!';
        } else if (['Fulfilled', 'Completed', 'Cancelled'].includes(req.status)) {
            outcome = 'not_needed';
            title = 'Thank you, this request is covered';
            message = 'Enough donors have already confirmed for ' + req.hospital_name + '. We will alert you the next time your blood group is needed.';
            if (!['not_needed', 'superseded'].includes(m.status)) setMatch(m, 'not_needed');
        } else if (elsewhere) {
            outcome = 'committed_elsewhere';
            tone = 'warn';
            title = 'You are already booked';
            message = 'You have already accepted a request from ' + elsewhere.hospital_name + '. Thank you for helping!';
        } else {
            outcome = 'accepted';
            overrides[m.id] = 'accepted';
            setMatch(m, 'accepted');
            const committed = committedCount();
            const fulfilled = committed >= req.units_required;
            if (fulfilled) closeOutstanding(['notified']);
            requestUpdate({
                status: fulfilled ? 'Fulfilled' : req.status,
                units_confirmed: committed,
                first_accept_at: req.first_accept_at || nowIso,
                fulfilled_at: fulfilled ? nowIso : null,
            });
            commitDonor(donor?.id, new Date(now + HOURS_COMMITTED * 3600000).toISOString());
            // Booked for this request: stand down their alerts for any other
            for (const x of donorMatches) {
                if (x.request_id !== req.id && ['notified', 'queued'].includes(x.status)) setMatch(x, 'superseded');
            }
            const minutes = Math.max(0, Math.round((now - Date.parse(req.created_at)) / 60000));
            hospitalNote(
                'donor_accepted',
                'Donor confirmed for ' + req.blood_group + ' (' + committed + '/' + req.units_required + ' units)',
                firstName(donor?.name, 'there') + ' (' + m.donor_blood_group + (m.distance_km != null ? ', ' + m.distance_km + ' km away' : '')
                + ', phone ' + (donor?.phone || 'n/a') + ') accepted ' + minutes + ' min after the request.'
                + (fulfilled ? ' All units are now covered.' : '') + hospitalLinks(m),
            );
            title = 'Thank you, ' + firstName(donor?.name, 'there') + '!';
            message = req.hospital_name + ' (' + req.hospital_city + ') has been told you are coming. Please go today with a photo ID and eat a light meal first. If your plans change, open the NO link so we can alert someone else.';
        }
    } else if (p.kind === 'donor') {
        const m = match!;
        if (m.status === 'donated') {
            outcome = 'already_donated';
            title = 'Your donation is recorded';
            message = 'Thank you for donating!';
        } else if (m.status === 'accepted' && !['Completed', 'Cancelled'].includes(req.status)) {
            outcome = 'withdrawn';
            tone = 'warn';
            overrides[m.id] = 'declined';
            setMatch(m, 'declined');
            const committed = committedCount();
            const reopened = req.status === 'Fulfilled' && committed < req.units_required;
            requestUpdate({ status: reopened ? 'Open' : req.status, units_confirmed: committed, fulfilled_at: reopened ? null : req.fulfilled_at ?? null });
            commitDonor(donor?.id, null);
            hospitalNote(
                'donor_withdrew',
                'A donor withdrew for ' + req.blood_group + ' (' + committed + '/' + req.units_required + ' units)',
                firstName(donor?.name, 'there') + ' can no longer come.' + (reopened || req.status === 'Open' ? ' LifeLink is alerting the next ranked donors.' : ''),
            );
            title = 'Thanks for letting us know';
            message = 'We have told ' + req.hospital_name + ' and will alert the next donor.';
        } else if (m.status === 'declined') {
            outcome = 'already_declined';
            title = 'No problem';
            message = 'We have already noted that you cannot donate this time.';
        } else {
            outcome = 'declined';
            setMatch(m, 'declined');
            title = 'No problem, thank you';
            message = 'We will alert the next donor. You stay on the list for future requests.';
        }
    } else if (p.kind === 'hospital_match' && p.action === 'donated') {
        const m = match!;
        if (m.status === 'donated') {
            outcome = 'already_recorded';
            title = 'Donation already recorded';
            message = 'Nothing else to do.';
        } else {
            outcome = 'donation_recorded';
            overrides[m.id] = 'donated';
            setMatch(m, 'donated');
            const donated = donatedCount();
            const committed = committedCount();
            const completed = donated >= req.units_required;
            if (completed) closeOutstanding(['notified', 'queued']);
            requestUpdate({
                status: completed ? 'Completed' : committed >= req.units_required ? 'Fulfilled' : req.status,
                units_confirmed: committed,
                units_donated: donated,
                first_accept_at: req.first_accept_at || nowIso,
                fulfilled_at: req.fulfilled_at || (committed >= req.units_required ? nowIso : null),
                closed_reason: completed ? 'all_units_donated' : req.closed_reason ?? null,
            });
            if (donor) {
                out.donations.push({
                    id: donor.id,
                    last_donation_date: today,
                    total_donations: (donor.total_donations ?? 0) + 1,
                    xp_points: (donor.xp_points ?? 0) + XP_PER_DONATION,
                });
                out.notifications.push({
                    donor_id: donor.id, request_id: req.id, match_id: m.id, type: 'donation_recorded', channel: 'in_app', recipient: 'donor:' + donor.id,
                    title: 'Thank you for donating!',
                    message: 'Your donation at ' + req.hospital_name + ' is recorded (+' + XP_PER_DONATION + ' XP). You can donate again after your rest period.',
                });
            }
            title = 'Donation recorded';
            message = donated + ' of ' + req.units_required + ' units donated for this request.' + (completed ? ' The request is now complete.' : '');
        }
    } else if (p.kind === 'hospital_match') {
        const m = match!;
        if (m.status !== 'accepted') {
            outcome = 'not_applicable';
            tone = 'warn';
            title = 'Nothing to change';
            message = 'This donor is not currently confirmed (status: ' + m.status + ').';
        } else {
            outcome = 'no_show_recorded';
            tone = 'warn';
            overrides[m.id] = 'no_show';
            setMatch(m, 'no_show');
            const committed = committedCount();
            const reopened = req.status === 'Fulfilled' && committed < req.units_required;
            requestUpdate({ status: reopened ? 'Open' : req.status, units_confirmed: committed, fulfilled_at: reopened ? null : req.fulfilled_at ?? null });
            commitDonor(donor?.id, null);
            title = 'No-show recorded';
            message = committed + ' of ' + req.units_required + ' units still confirmed.' + (reopened ? ' The request is reopened and LifeLink is alerting the next donors.' : '');
        }
    } else if (['Cancelled', 'Completed'].includes(req.status)) {
        outcome = 'already_closed';
        title = 'Request already ' + req.status.toLowerCase();
        message = 'Nothing else to do.';
    } else {
        outcome = 'cancelled';
        for (const m of reqMatches) {
            if (!['notified', 'queued', 'accepted'].includes(m.status)) continue;
            setMatch(m, 'not_needed');
            if (m.status === 'accepted') {
                commitDonor(m.donor_id, null);
                if (m.donor_id != null) {
                    out.notifications.push({
                        donor_id: m.donor_id, request_id: req.id, match_id: m.id, type: 'request_cancelled', channel: 'in_app', recipient: 'donor:' + m.donor_id,
                        title: 'No need to come in',
                        message: req.hospital_name + ' no longer needs this donation. Thank you for being ready to help!',
                    });
                }
            }
        }
        // Stood-down donors no longer count; only units already donated remain
        requestUpdate({ status: 'Cancelled', units_confirmed: donatedCount(), closed_reason: 'cancelled_by_hospital' });
        title = 'Request cancelled';
        message = 'All alerted donors have been stood down.';
    }

    // The hospital is sent the links to confirm this donor's donation or no-show
    for (const n of out.notifications) {
        if (n.type === 'donor_accepted' && n.match_id != null) {
            n.confirm_donation_url = hospitalLink(base, n.match_id, req.hospital_token, 'donated');
            n.no_show_url = hospitalLink(base, n.match_id, req.hospital_token, 'no_show');
        }
    }

    const after = out.request_updates[0] ?? req;
    const payload: Record<string, unknown> = { outcome, title, message };
    // A donor who is expected at the hospital gets their pass (again, if they reopen the link)
    const pass = ['accepted', 'already_accepted'].includes(outcome) && match ? passCode(match.response_token) : null;
    if (pass) payload.pass_code = pass;
    Object.assign(payload, { request_status: after.status, units_required: req.units_required, units_confirmed: after.units_confirmed ?? 0 });

    return { outcome, httpStatus: 200, tone, title, message, pass, payload, writes: out };
};
