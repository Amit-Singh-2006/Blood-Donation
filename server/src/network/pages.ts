/**
 * The network's own web pages: the page a donor or hospital sees after a
 * one-tap link, the tracking page for the patient's family and the
 * analytics dashboard. Plain HTML with inline styles, no scripts.
 */
import type { Decision } from './replies';
import type { NetRequest } from './rules';
import type { NetworkAnalytics, buildTracking } from './views';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** The page shown after a donor's YES/NO or a hospital's action link. */
export const replyPage = (d: Decision, frontend: string) => {
    const accent = d.tone === 'ok' ? '#16a34a' : '#d97706';
    const p = d.payload;
    const showRequest = d.outcome !== 'invalid_link';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LifeLink</title>'
        + '<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fff5f5;color:#1f2937}main{max-width:480px;margin:10vh auto;padding:16px}'
        + '.card{background:#fff;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,.08);border-top:6px solid ' + accent + '}'
        + 'h1{font-size:1.4rem;margin:0 0 12px}p{line-height:1.5;margin:0 0 12px}.meta{color:#6b7280;font-size:.9rem}.brand{color:#dc2626;font-weight:700;margin-bottom:12px}'
        + '.pass{margin:18px 0 6px;padding:16px;border:2px dashed #dc2626;border-radius:12px;text-align:center}.code{font:700 1.6rem/1.2 ui-monospace,monospace;letter-spacing:.08em;margin:6px 0 10px}.pass a{color:#dc2626;font-weight:700}</style></head>'
        + '<body><main><div class="card"><div class="brand">LifeLink</div><h1>' + esc(d.title) + '</h1><p>' + esc(d.message) + '</p>'
        + (d.pass ? '<div class="pass"><p class="meta">Your donation pass</p><p class="code">' + esc(d.pass) + '</p>'
            + '<p><a href="' + esc(frontend + '/pass/' + encodeURIComponent(d.pass)) + '">Show it as a QR code</a></p>'
            + '<p class="meta">Show this at the hospital gate with a photo ID. Staff scan it to confirm you are the donor they are expecting.</p></div>' : '')
        + (showRequest ? '<p class="meta">' + esc(p.units_confirmed) + ' of ' + esc(p.units_required) + ' units confirmed &middot; ' + esc(p.request_status) + '</p>' : '')
        + '</div></main></body></html>';
};

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '');

const trackingFrame = (title: string, body: string, refresh: boolean) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + (refresh ? '<meta http-equiv="refresh" content="120">' : '') + '<title>' + esc(title) + '</title>'
    + '<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fff5f5;color:#1f2937}main{max-width:560px;margin:0 auto;padding:24px 16px}'
    + '.card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.08);margin-bottom:16px}.brand{color:#dc2626;font-weight:700}'
    + 'h1{font-size:1.35rem;margin:6px 0 4px}.sub{color:#6b7280;margin:0 0 16px}.bar{height:14px;background:#fee2e2;border-radius:999px;overflow:hidden}.fill{height:100%;background:#dc2626}'
    + '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-top:16px}.stat{background:#f9fafb;border-radius:12px;padding:12px}.stat b{display:block;font-size:1.4rem}'
    + '.pill{display:inline-block;padding:4px 10px;border-radius:999px;font-size:.8rem;font-weight:600;background:#fee2e2;color:#991b1b}ol{padding-left:18px;margin:0}li{margin:6px 0}.muted{color:#6b7280;font-size:.85rem}</style></head>'
    + '<body><main>' + body + '</main></body></html>';

export const trackingNotFoundPage = () => trackingFrame('LifeLink tracking',
    '<div class="card"><div class="brand">LifeLink</div><h1>Tracking link not found</h1><p>Please check the link from the hospital.</p></div>', false);

/** The family's tracking page; it refreshes every 2 minutes while donors are being found. */
export const trackingPage = (req: Pick<NetRequest, 'blood_group' | 'hospital_name' | 'urgency' | 'patient_ref' | 'status' | 'units_required'>, summary: ReturnType<typeof buildTracking>) => {
    const pct = Math.min(100, Math.round((summary.units_confirmed / req.units_required) * 100));
    const body = '<div class="card"><div class="brand">LifeLink</div><h1>' + esc(req.blood_group) + ' blood for ' + esc(req.hospital_name) + '</h1>'
        + '<p class="sub">' + esc(req.urgency) + (req.patient_ref ? ' &middot; ' + esc(req.patient_ref) : '') + ' &middot; <span class="pill">' + esc(req.status) + '</span></p>'
        + '<div class="bar"><div class="fill" style="width:' + pct + '%"></div></div>'
        + '<p class="muted">' + summary.units_confirmed + ' of ' + esc(req.units_required) + ' unit(s) confirmed &middot; ' + summary.units_donated + ' donated</p>'
        + '<div class="grid"><div class="stat"><b>' + summary.compatible_donors_found + '</b>compatible donors found</div><div class="stat"><b>' + summary.donors_alerted + '</b>alerted so far</div>'
        + '<div class="stat"><b>' + summary.donors_on_standby + '</b>on standby</div><div class="stat"><b>' + summary.donors_no_response + '</b>no reply yet</div></div></div>'
        + '<div class="card"><b>What happens next</b><p>' + esc(summary.next_step) + '</p>' + (summary.next_check_at ? '<p class="muted">Next check: ' + esc(fmt(summary.next_check_at)) + ' IST</p>' : '') + '</div>'
        + (summary.confirmed_donors.length ? '<div class="card"><b>Confirmed donors</b><ol>' + summary.confirmed_donors.map((d) => '<li>' + esc(d.blood_group) + ' donor' + (d.distance_km != null ? ', ' + esc(d.distance_km) + ' km away' : '') + ' &middot; ' + esc(d.state) + '</li>').join('') + '</ol></div>' : '')
        + '<div class="card"><b>Timeline</b><ol>' + summary.timeline.map((t) => '<li>' + esc(t.event) + '<br><span class="muted">' + esc(fmt(t.at)) + ' IST</span></li>').join('') + '</ol>'
        + '<p class="muted">This page refreshes every 2 minutes and never shows donor identities.</p></div>';
    return trackingFrame('LifeLink: ' + req.blood_group + ' request', body, ['Open', 'Fulfilled'].includes(req.status));
};

/** The analytics dashboard (?format=html); the website reads the JSON instead. */
export const analyticsPage = (metrics: NetworkAnalytics) => {
    const GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
    const show = (v: unknown, unit?: string) => (v === null || v === undefined ? '–' : esc(v) + (unit ?? ''));
    const stat = (label: string, value: unknown, unit?: string) => '<div class="stat"><b>' + show(value, unit) + '</b>' + esc(label) + '</div>';
    const byGroup = metrics.donor_pool.by_blood_group;
    const maxRegistered = Math.max(1, ...GROUPS.map((g) => byGroup[g]?.registered ?? 0));
    const bars = GROUPS.map((g) => {
        const row = byGroup[g] ?? { registered: 0, eligible_now: 0 };
        return '<div class="row"><span class="lbl">' + g + '</span><div class="track"><div class="reg" style="width:' + (row.registered / maxRegistered) * 100 + '%"></div>'
            + '<div class="elig" style="width:' + (row.eligible_now / maxRegistered) * 100 + '%"></div></div><span class="num">' + row.eligible_now + ' / ' + row.registered + '</span></div>';
    }).join('');
    const r = metrics.requests;
    const s = metrics.responses;
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="600"><title>LifeLink network analytics</title>'
        + '<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a}main{max-width:960px;margin:0 auto;padding:24px 16px}'
        + 'h1{margin:0 0 4px}.muted{color:#64748b;font-size:.85rem}.card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 4px 20px rgba(15,23,42,.06);margin-top:16px}'
        + '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.stat{background:#f1f5f9;border-radius:12px;padding:14px}.stat b{display:block;font-size:1.6rem}'
        + '.row{display:flex;align-items:center;gap:10px;margin:8px 0}.lbl{width:36px;font-weight:700}.track{position:relative;flex:1;height:14px;background:#f1f5f9;border-radius:999px;overflow:hidden}'
        + '.reg{position:absolute;inset:0 auto 0 0;background:#fecaca}.elig{position:absolute;inset:0 auto 0 0;background:#dc2626}.num{width:64px;text-align:right;font-variant-numeric:tabular-nums}</style></head>'
        + '<body><main><h1>LifeLink network analytics</h1><p class="muted">Generated ' + esc(metrics.generated_at) + ' &middot; refreshes every 10 minutes</p>'
        + '<div class="card"><b>Requests: open vs fulfilled</b><div class="grid">' + stat('open', r.open) + stat('fulfilled (donors on the way)', r.fulfilled) + stat('completed (donated)', r.completed)
        + stat('exhausted', r.exhausted) + stat('covered', r.covered_pct, '%') + stat('median minutes to first donor', r.median_minutes_to_first_donor) + stat('first donor within 15 min', r.first_donor_within_15_min_pct, '%') + '</div></div>'
        + '<div class="card"><b>Donor pool</b><div class="grid">' + stat('registered', metrics.donor_pool.registered) + stat('available', metrics.donor_pool.available)
        + stat('eligible now', metrics.donor_pool.eligible_now) + stat('committed to a request', metrics.donor_pool.committed_now) + '</div>'
        + '<p class="muted">Eligible now (dark) vs registered (light), by blood group</p>' + bars + '</div>'
        + '<div class="card"><b>Donor responses</b><div class="grid">' + stat('alerts sent', s.alerts_sent) + stat('response rate', s.response_rate_pct, '%') + stat('acceptance rate', s.acceptance_rate_pct, '%')
        + stat('median minutes to reply', s.median_response_minutes) + stat('no reply', s.no_response) + stat('donations logged', s.donations_logged) + '</div>'
        + '<p class="muted">Accepted donors from a compatible but different blood group: ' + show(metrics.compatibility.accepted_from_other_compatible_groups) + ' (' + show(metrics.compatibility.share_of_accepted_pct, '%') + ') &middot; alerts by channel: '
        + (esc(Object.entries(s.alerts_by_channel).map(([k, v]) => k + ' ' + v).join(', ')) || 'none') + '</p></div></main></body></html>';
};
