import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { getUser } from '../lib/session';
import { Campaign, CampaignInfo, campaignDates, campaignDays, campaignHours, campaignSlots, fmtDate, isPast, todayIST } from '../lib/campaign';

const field = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#ee2b2b] focus:ring-2 focus:ring-red-100';
const label = 'block text-xs font-bold text-slate-600 mb-1';
const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
// Same-day health declaration, following India's NBTC donor selection guidelines
const CHECKS = [
  ['feeling_well', 'I feel healthy today and will eat a proper meal before donating'],
  ['no_recent_illness', 'No fever, infection or antibiotics in the last 2 weeks'],
  ['no_tattoo_12m', 'No tattoo, piercing or acupuncture in the last 12 months'],
  ['no_alcohol_24h', 'I will not drink alcohol in the 24 hours before donating'],
] as const;
const EMPTY = { name: '', email: '', phone: '', blood_group: '', gender: '', dob: '', weight_kg: '', city: '', preferred_date: '', preferred_slot: '', last_donation_date: '' };

/** Public campaign page: the link in every campaign alert. Anyone can register; a signed-in donor's details are filled in. */
export default function CampaignPage() {
  const { id } = useParams();
  const [c, setC] = useState<Campaign | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [f, setF] = useState(EMPTY);
  const [health, setHealth] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [already, setAlready] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const donorHeaders: Record<string, string> | undefined = getUser('donor') ? { 'X-LifeLink-Role': 'donor' } : undefined;

  useEffect(() => {
    apiFetch(`/campaigns/${id}`).then(setC).catch((e) => setLoadError(e.message));
    if (!donorHeaders) return;
    apiFetch('/campaigns/for/me', { headers: donorHeaders }).then((d) => {
      const p = d.profile ?? {};
      setF((prev) => ({ ...prev, name: p.name ?? '', email: p.email ?? '', phone: p.phone ?? '', blood_group: p.blood_group ?? '', gender: String(p.gender ?? '').toLowerCase(), dob: p.dob ?? '', city: p.city ?? '', last_donation_date: p.last_donation_date ?? '' }));
      setAlready(d.campaigns.some((x: Campaign) => String(x.id) === id && x.registration_id));
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // The rules the server checks too, shown before the donor submits
  const problem = useMemo(() => {
    if (!c) return null;
    if (f.dob) {
      const age = Math.floor((Date.parse(c.start_date) - Date.parse(f.dob)) / (365.25 * 86400e3));
      if (age < 18 || age > 65) return 'Donors must be 18 to 65 years old on the campaign day.';
    }
    if (f.weight_kg && Number(f.weight_kg) < 45) return 'Donors must weigh at least 45 kg.';
    if (f.last_donation_date && f.gender) {
      const need = f.gender === 'female' ? 120 : 90;
      if ((Date.parse(c.end_date) - Date.parse(f.last_donation_date)) / 86400e3 < need) return `You need ${need} days between donations, so you cannot donate at this campaign yet.`;
    }
    return null;
  }, [c, f]);

  if (loadError) return <Shell><p className="text-sm font-bold text-red-700">{loadError}</p></Shell>;
  if (!c) return <Shell><p className="text-sm text-slate-500">Loading campaign…</p></Shell>;

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const closed = c.status === 'cancelled' ? 'This campaign has been cancelled.' : isPast(c) ? 'This campaign has ended. Thank you to everyone who donated!' : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (problem) { setError(problem); return; }
    setSaving(true);
    const body: Record<string, unknown> = { ...f, weight_kg: Number(f.weight_kg), health: { ...health, consent: !!health.consent } };
    for (const k of ['city', 'preferred_date', 'preferred_slot', 'last_donation_date']) if (!body[k]) delete body[k];
    if (c.days === 1) body.preferred_date = c.start_date;
    try {
      await apiFetch(`/campaigns/${c.id}/register`, { method: 'POST', body: JSON.stringify(body), headers: donorHeaders });
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const check = (key: string, text: string) => (
    <label key={key} className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
      <input type="checkbox" required checked={!!health[key]} onChange={(e) => setHealth({ ...health, [key]: e.target.checked })} className="mt-0.5 w-4 h-4 accent-[#ee2b2b]" />
      <span>{text}</span>
    </label>
  );

  return (
    <Shell>
      <div className="bg-red-50 border border-red-100 rounded-3xl p-6 space-y-3">
        <span className="text-[10px] font-black text-[#ee2b2b] uppercase tracking-[0.2em] bg-white border border-red-100 px-3 py-1.5 rounded-full inline-block">Blood donation campaign</span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 wrap-break-word">{c.name}</h1>
        <CampaignInfo icon="event">{campaignDates(c)}</CampaignInfo>
        <CampaignInfo icon="schedule">{campaignHours(c)}</CampaignInfo>
        <CampaignInfo icon="location_on">
          {c.venue}{c.address ? `, ${c.address}` : ''}, {c.city}{c.state ? `, ${c.state}` : ''}
          {c.map_url && <> · <a href={c.map_url} target="_blank" rel="noopener noreferrer" className="font-bold text-[#ee2b2b] hover:underline">Open map</a></>}
        </CampaignInfo>
        {c.rewards && <CampaignInfo icon="redeem">{c.rewards}</CampaignInfo>}
        {c.refreshments && <CampaignInfo icon="local_cafe">{c.refreshments}</CampaignInfo>}
        {c.contact_phone && <CampaignInfo icon="call"><a href={`tel:${c.contact_phone}`} className="font-bold text-[#ee2b2b]">{c.contact_phone}</a></CampaignInfo>}
        {c.description && <p className="text-sm text-slate-600 whitespace-pre-line">{c.description}</p>}
      </div>

      {closed ? (
        <p className="text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-2xl p-5">{closed}</p>
      ) : done || already ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 space-y-2">
          <p className="text-lg font-black text-green-800 flex items-center gap-2"><span className="material-symbols-outlined">check_circle</span>{done ? "You're registered!" : "You're already registered"}</p>
          <p className="text-sm text-green-900">
            See you {f.preferred_date || c.days === 1 ? `on ${fmtDate(f.preferred_date || c.start_date)}` : 'at the camp'}{f.preferred_slot ? `, ${f.preferred_slot}` : ''}.
            Bring a photo ID, drink plenty of water and eat a meal 2 to 3 hours before. Your haemoglobin (at least 12.5 g/dL) is checked at the camp.
          </p>
          {donorHeaders && <Link to="/donor/campaigns" className="inline-block text-sm font-bold text-[#ee2b2b] hover:underline">Back to your campaigns →</Link>}
        </div>
      ) : (
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
          <div>
            <h2 className="text-lg font-black text-slate-900">Register to donate</h2>
            <p className="text-sm text-slate-500">
              {donorHeaders ? 'We filled in your LifeLink details. Check them before you register.' : <>Already a LifeLink donor? <Link to="/login" className="font-bold text-[#ee2b2b]">Sign in</Link> to fill this in automatically.</>}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={label} htmlFor="cp-name">Full name</label><input id="cp-name" required className={field} value={f.name} onChange={set('name')} placeholder="e.g. Priya Sharma" autoComplete="name" /></div>
            <div><label className={label} htmlFor="cp-phone">Mobile number</label><input id="cp-phone" required type="tel" className={field} value={f.phone} onChange={set('phone')} placeholder="e.g. 98765 43210" autoComplete="tel" /></div>
            <div><label className={label} htmlFor="cp-email">Email (Gmail or any)</label><input id="cp-email" required type="email" className={field} value={f.email} onChange={set('email')} placeholder="e.g. priya@gmail.com" autoComplete="email" /></div>
            <div><label className={label} htmlFor="cp-city">City</label><input id="cp-city" className={field} value={f.city} onChange={set('city')} placeholder={`e.g. ${c.city}`} /></div>
            <div>
              <label className={label} htmlFor="cp-group">Blood group</label>
              <select id="cp-group" required className={field} value={f.blood_group} onChange={set('blood_group')}>
                <option value="">Choose…</option>
                {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                <option value="Unknown">I don't know</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="cp-gender">Gender</label>
              <select id="cp-gender" required className={field} value={f.gender} onChange={set('gender')}>
                <option value="">Choose…</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div><label className={label} htmlFor="cp-dob">Date of birth</label><input id="cp-dob" required type="date" max={todayIST()} className={field} value={f.dob} onChange={set('dob')} /></div>
            <div><label className={label} htmlFor="cp-weight">Weight (kg)</label><input id="cp-weight" required type="number" min={30} max={250} className={field} value={f.weight_kg} onChange={set('weight_kg')} placeholder="At least 45 kg" /></div>
            {c.days > 1 && (
              <div>
                <label className={label} htmlFor="cp-day">Which day will you come?</label>
                <select id="cp-day" required className={field} value={f.preferred_date} onChange={set('preferred_date')}>
                  <option value="">Choose…</option>
                  {campaignDays(c).filter((d) => d >= todayIST()).map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={label} htmlFor="cp-slot">Preferred time</label>
              <select id="cp-slot" className={field} value={f.preferred_slot} onChange={set('preferred_slot')}>
                <option value="">Any time</option>
                {campaignSlots(c).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={label} htmlFor="cp-last">Last blood donation (if any)</label><input id="cp-last" type="date" max={todayIST()} className={field} value={f.last_donation_date} onChange={set('last_donation_date')} /></div>
          </div>

          <fieldset className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-3">
            <legend className="px-2 text-xs font-black text-[#ee2b2b] uppercase tracking-widest">Health check</legend>
            {CHECKS.map(([key, text]) => check(key, text))}
            {f.gender === 'female' && check('not_pregnant', 'I am not pregnant or breastfeeding, and have not given birth in the last 12 months')}
          </fieldset>
          {check('consent', 'I agree to share these details with the camp organisers so they can contact me about this campaign')}

          {(error || problem) && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error || problem}</p>}
          <button type="submit" disabled={saving} className="w-full py-3.5 rounded-xl bg-[#ee2b2b] text-white font-black hover:bg-red-700 disabled:opacity-50">
            {saving ? 'Registering…' : 'Register for this campaign'}
          </button>
        </form>
      )}
    </Shell>
  );
}

const Shell = ({ children }: { children: ReactNode }) => <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">{children}</div>;
