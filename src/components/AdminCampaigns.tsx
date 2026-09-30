import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, InputHTMLAttributes } from 'react';
import { apiFetch } from '../lib/api';
import { Campaign, CampaignInfo, campaignDates, campaignHours, fmtDate, todayIST } from '../lib/campaign';

const field = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#ee2b2b] focus:ring-2 focus:ring-red-100';
const label = 'block text-xs font-bold text-slate-600 mb-1';
const EMPTY = { name: '', venue: '', city: '', state: '', address: '', map_url: '', start_date: '', days: '1', start_time: '09:00', end_time: '17:00', rewards: '', refreshments: '', contact_phone: '', target_donors: '', description: '' };
type FormKey = keyof typeof EMPTY;

const statusOf = (c: Campaign): [string, string] => {
  const t = todayIST();
  if (c.status === 'cancelled') return ['Cancelled', 'bg-slate-100 text-slate-600'];
  if (c.end_date < t) return ['Ended', 'bg-slate-100 text-slate-600'];
  if (c.start_date <= t) return ['Running now', 'bg-green-100 text-green-700'];
  return ['Upcoming', 'bg-red-100 text-[#ee2b2b]'];
};

/** Admin: create campaigns (alerting the city's donors), then follow sign-ups and mark attendance. */
export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(() => {
    apiFetch('/admin/campaigns').then((rows) => { setCampaigns(rows); setError(null); }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (openId !== null) return <Registrations id={openId} onBack={() => { setOpenId(null); load(); }} />;

  const cancel = async (c: Campaign) => {
    if (!window.confirm(`Cancel "${c.name}"? Donors will no longer be able to register.`)) return;
    try {
      await apiFetch(`/admin/campaigns/${c.id}/cancel`, { method: 'PUT' });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900">Blood donation campaigns</h2>
          <p className="text-sm text-slate-500">Announce a camp, alert every donor in the city, and track who registered, came and donated.</p>
        </div>
        {!creating && (
          <button onClick={() => { setCreating(true); setNotice(null); }} className="px-4 py-2.5 rounded-xl bg-[#ee2b2b] text-white text-sm font-black hover:bg-red-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">add</span>New campaign
          </button>
        )}
      </div>
      {notice && <p className="text-sm font-bold text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">{notice}</p>}
      {error && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}
      {creating && <CampaignForm onCancel={() => setCreating(false)} onCreated={(msg) => { setCreating(false); setNotice(msg); load(); }} />}

      {!campaigns ? (
        <p className="text-sm text-slate-500">Loading campaigns…</p>
      ) : campaigns.length === 0 ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-[#ee2b2b]">campaign</span>
          <p className="font-black text-slate-900 mt-2">No campaigns yet</p>
          <p className="text-sm text-slate-600">Create one to invite every donor in a city to a blood donation camp.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {campaigns.map((c) => {
            const [status, tone] = statusOf(c);
            return (
              <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 wrap-break-word">{c.name}</h3>
                    <p className="text-xs text-slate-500">{c.venue}, {c.city}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase shrink-0 ${tone}`}>{status}</span>
                </div>
                <CampaignInfo icon="event">{campaignDates(c)}</CampaignInfo>
                <CampaignInfo icon="schedule">{campaignHours(c)}</CampaignInfo>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {([['Registered', c.registered ?? 0], ['Came', c.attended ?? 0], ['Donated', c.donated ?? 0], ['Litres', ((c.volume_ml ?? 0) / 1000).toFixed(1)]] as const).map(([k, v]) => (
                    <div key={k} className="bg-red-50 rounded-lg p-2">
                      <p className="text-lg font-black text-[#ee2b2b]">{String(v)}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{k}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  {c.alerted_count ?? 0} donor{c.alerted_count === 1 ? '' : 's'} alerted{c.alert_error ? ` (in the app only: ${c.alert_error})` : ''}
                  {c.reviews ? ` · ★ ${c.rating} from ${c.reviews} review${c.reviews === 1 ? '' : 's'}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setOpenId(c.id)} className="px-3 py-2 rounded-lg bg-[#ee2b2b] text-white text-xs font-black hover:bg-red-700">Registrations and attendance</button>
                  <a href={`/campaign/${c.id}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-red-200 text-[#ee2b2b] text-xs font-black hover:bg-red-50">Sign-up page</a>
                  {status === 'Upcoming' || status === 'Running now' ? (
                    <button onClick={() => cancel(c)} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50">Cancel campaign</button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CampaignForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (message: string) => void }) {
  const [f, setF] = useState({ ...EMPTY, start_date: todayIST() });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: FormKey) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) if (v.trim() !== '') body[k] = v.trim();
    body.days = Number(f.days);
    if (f.target_donors) body.target_donors = Number(f.target_donors);
    try {
      const r = await apiFetch('/admin/campaigns', { method: 'POST', body: JSON.stringify(body) });
      const n = r.alerted as number;
      onCreated(n
        ? `Campaign created. ${n} donor${n === 1 ? '' : 's'} in ${r.campaign.city} can see it in the app${r.alert_error ? `, but SMS, WhatsApp and email could not be sent: ${r.alert_error}` : ', and SMS, WhatsApp and email alerts are on their way'}.`
        : `Campaign created. No donors are registered in ${r.campaign.city} yet, so no alerts went out. Share the sign-up page instead.`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const input = (k: FormKey, text: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={label} htmlFor={`cf-${k}`}>{text}</label>
      <input id={`cf-${k}`} className={field} value={f[k]} onChange={set(k)} {...props} />
    </div>
  );

  return (
    <form onSubmit={submit} className="bg-white border border-red-100 rounded-2xl p-5 space-y-4">
      <h3 className="font-black text-slate-900">New campaign</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {input('name', 'Campaign name', { required: true, placeholder: 'e.g. Navratri Mega Blood Donation Camp' })}
        {input('venue', 'Venue', { required: true, placeholder: 'e.g. Community Hall, Sector 21' })}
        {input('city', 'City', { required: true, placeholder: 'e.g. Pune' })}
        {input('state', 'State', { placeholder: 'e.g. Maharashtra' })}
        {input('address', 'Full address', { placeholder: 'Street, landmark, PIN code' })}
        {input('map_url', 'Google Maps link (optional)', { type: 'url', placeholder: 'https://maps.app.goo.gl/…' })}
        {input('start_date', 'First day', { type: 'date', required: true, min: todayIST() })}
        {input('days', 'Number of days', { type: 'number', min: 1, max: 30, required: true })}
        {input('start_time', 'Opens at', { type: 'time', required: true })}
        {input('end_time', 'Closes at', { type: 'time', required: true })}
        {input('rewards', 'Rewards and prizes', { placeholder: 'e.g. Certificate, T-shirt, lucky draw' })}
        {input('refreshments', 'Refreshments', { placeholder: 'e.g. Juice, biscuits, lunch coupon' })}
        {input('contact_phone', 'Contact number', { type: 'tel', placeholder: 'e.g. 98765 43210' })}
        {input('target_donors', 'Target donors (optional)', { type: 'number', min: 1, placeholder: 'e.g. 150' })}
      </div>
      <div>
        <label className={label} htmlFor="cf-description">Details for donors (optional)</label>
        <textarea id="cf-description" rows={3} className={field} value={f.description} onChange={set('description')} placeholder="Blood bank partner, what to bring (photo ID), parking…" />
      </div>
      <p className="text-xs text-slate-500">Creating the campaign alerts every donor registered in this city, in the app and by SMS, WhatsApp and email, with a link to sign up.</p>
      {err && <p className="text-sm font-bold text-red-700">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-[#ee2b2b] text-white text-sm font-black hover:bg-red-700 disabled:opacity-50">
          {saving ? 'Creating and alerting…' : 'Create and alert donors'}
        </button>
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
      </div>
    </form>
  );
}

interface Registration {
  id: number; name: string; email: string; phone: string; blood_group: string; gender: string; dob: string; weight_kg: number;
  city: string | null; preferred_date: string | null; preferred_slot: string | null; last_donation_date: string | null;
  attended: boolean | null; donated: boolean | null; volume_ml: number | null; remarks: string | null; created_at: string; is_member: boolean;
}

const age = (dob: string) => Math.floor((Date.now() - Date.parse(dob)) / (365.25 * 86400e3));
const yesNo = (v: boolean | null) => (v === null ? '' : v ? 'Yes' : 'No');
// Quote every cell, and stop spreadsheet apps from running a cell as a formula
const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return `"${(/^[=@]|^[+-](?!\d)/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

function Registrations({ id, onBack }: { id: number; onBack: () => void }) {
  const [data, setData] = useState<{ campaign: Campaign; registrations: Registration[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(() => {
    apiFetch(`/admin/campaigns/${id}/registrations`).then((d) => { setData(d); setError(null); setUpdated(new Date()); }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 20000); // new sign-ups show up without a reload
    return () => window.clearInterval(timer);
  }, [load]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.registrations ?? []).filter((r) => !s || [r.name, r.phone, r.email, r.blood_group].some((v) => v?.toLowerCase().includes(s)));
  }, [data, q]);

  const back = <button onClick={onBack} className="text-sm font-bold text-[#ee2b2b] flex items-center gap-1"><span className="material-symbols-outlined text-lg">arrow_back</span>All campaigns</button>;
  if (!data) return <div className="space-y-4">{back}<p className="text-sm text-slate-500">{error ?? 'Loading registrations…'}</p></div>;

  const c = data.campaign;
  const regs = data.registrations;
  const gave = regs.filter((r) => r.donated);
  const ml = gave.reduce((sum, r) => sum + (r.volume_ml ?? 0), 0);

  const download = () => {
    const header = ['Name', 'Mobile', 'Email', 'Blood group', 'Gender', 'Age', 'Weight (kg)', 'City', 'Preferred day', 'Preferred time', 'Last donation', 'Registered at', 'Came', 'Donated', 'Volume (ml)', 'Remarks'];
    const lines = regs.map((r) => [r.name, r.phone, r.email, r.blood_group, r.gender, age(r.dob), r.weight_kg, r.city, r.preferred_date, r.preferred_slot, r.last_donation_date,
      new Date(r.created_at).toLocaleString('en-IN'), yesNo(r.attended), yesNo(r.donated), r.volume_ml, r.remarks].map(csvCell).join(','));
    const blob = new Blob(['﻿' + [header.map(csvCell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${c.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-registrations.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-5">
      {back}
      <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
        <h2 className="text-lg font-black text-slate-900">{c.name}</h2>
        <p className="text-sm text-slate-600">{campaignDates(c)} · {campaignHours(c)} · {c.venue}, {c.city}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {([['Registered', regs.length], ['Came', regs.filter((r) => r.attended).length], ['Donated', gave.length], ['Blood collected', `${(ml / 1000).toFixed(2)} L`]] as const).map(([k, v]) => (
            <div key={k} className="bg-white border border-red-100 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-[#ee2b2b]">{String(v)}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase">{k}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, mobile, email or blood group" className={`${field} sm:max-w-xs`} aria-label="Search registrations" />
        <button onClick={download} disabled={!regs.length} className="px-4 py-2.5 rounded-xl bg-[#ee2b2b] text-white text-sm font-black hover:bg-red-700 disabled:opacity-40 flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">download</span>Download list (CSV)
        </button>
        <span className="text-xs text-slate-500">Updates every 20 seconds{updated ? ` · last at ${updated.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
      </div>
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{regs.length ? 'No one matches that search.' : 'No one has registered yet. The list fills in as donors sign up.'}</p>
      ) : (
        <div className="space-y-3">{rows.map((r) => <AttendanceRow key={r.id} campaignId={c.id} r={r} onSaved={load} />)}</div>
      )}
    </div>
  );
}

function AttendanceRow({ campaignId, r, onSaved }: { campaignId: number; r: Registration; onSaved: () => void }) {
  const [attended, setAttended] = useState<boolean | null>(r.attended);
  const [donated, setDonated] = useState(!!r.donated);
  const [volume, setVolume] = useState(String(r.volume_ml ?? 350));
  const [remarks, setRemarks] = useState(r.remarks ?? '');
  const [state, setState] = useState('');

  const save = async () => {
    if (attended === null) return;
    setState('Saving…');
    try {
      await apiFetch(`/admin/campaigns/${campaignId}/registrations/${r.id}`, {
        method: 'PUT',
        body: JSON.stringify({ attended, donated: attended && donated, volume_ml: attended && donated ? Number(volume) : null, remarks: remarks.trim() || undefined }),
      });
      setState('Saved');
      onSaved();
    } catch (e: any) {
      setState(e.message);
    }
  };

  const choice = (on: boolean, text: string, click: () => void, tone: string) => (
    <button type="button" onClick={click} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${on ? tone : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{text}</button>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-slate-900">
            {r.name}
            <span className="ml-2 px-2 py-0.5 rounded-md bg-red-50 text-[#ee2b2b] text-xs font-black">{r.blood_group === 'Unknown' ? 'Group not known' : r.blood_group}</span>
            {r.is_member && <span className="ml-2 text-[10px] font-bold text-green-700 uppercase">LifeLink donor</span>}
          </p>
          <p className="text-xs text-slate-500 wrap-break-word">
            {r.phone} · {r.email} · {r.gender}, {age(r.dob)} yrs, {r.weight_kg} kg
            {r.preferred_date ? ` · ${fmtDate(r.preferred_date)}` : ''}{r.preferred_slot ? `, ${r.preferred_slot}` : ''}
            {r.last_donation_date ? ` · last donated ${fmtDate(r.last_donation_date)}` : ''}
          </p>
        </div>
        <a href={`tel:${r.phone}`} className="text-xs font-bold text-[#ee2b2b] flex items-center gap-1"><span className="material-symbols-outlined text-base">call</span>Call</a>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-600">Came?</span>
        {choice(attended === true, 'Yes', () => setAttended(true), 'bg-green-100 border-green-300 text-green-800')}
        {choice(attended === false, 'No-show', () => { setAttended(false); setDonated(false); }, 'bg-slate-100 border-slate-300 text-slate-800')}
        {attended && (
          <>
            <span className="text-xs font-bold text-slate-600 ml-2">Donated?</span>
            {choice(donated, 'Yes', () => setDonated(true), 'bg-red-100 border-red-300 text-[#ee2b2b]')}
            {choice(!donated, 'Deferred', () => setDonated(false), 'bg-amber-100 border-amber-300 text-amber-800')}
            {donated && (
              <select value={volume} onChange={(e) => setVolume(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white" aria-label="Volume donated">
                <option value="350">350 ml</option>
                <option value="450">450 ml</option>
              </select>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={300} placeholder="Remarks, e.g. low haemoglobin, deferred" className={`${field} flex-1 min-w-48`} aria-label="Remarks" />
        <button onClick={save} disabled={attended === null} className="px-4 py-2.5 rounded-xl bg-[#ee2b2b] text-white text-xs font-black hover:bg-red-700 disabled:opacity-40">Save</button>
        {state && <span className="text-xs font-bold text-slate-500">{state}</span>}
      </div>
    </div>
  );
}
