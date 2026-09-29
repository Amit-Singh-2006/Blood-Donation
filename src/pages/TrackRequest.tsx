import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RequestStatus, extractTrackingToken, fetchRequestStatus } from '../lib/network';
import { EMERGENCY } from '../lib/contact';

// Matches the n8n tracking page; each refresh is a billed n8n execution
const REFRESH_MS = 2 * 60 * 1000;
const ACTIVE = ['Open', 'Fulfilled'];

const STATUS_META: Record<RequestStatus['status'], { label: string; tone: string; icon: string }> = {
  Open: { label: 'Finding donors', tone: 'bg-amber-100 text-amber-800', icon: 'person_search' },
  Fulfilled: { label: 'Donors on the way', tone: 'bg-blue-100 text-blue-800', icon: 'directions_run' },
  Completed: { label: 'Blood donated', tone: 'bg-green-100 text-green-800', icon: 'check_circle' },
  Exhausted: { label: 'No donors found yet', tone: 'bg-red-100 text-red-800', icon: 'error' },
  Cancelled: { label: 'Cancelled by hospital', tone: 'bg-slate-200 text-slate-700', icon: 'cancel' },
};

const formatWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

export default function TrackRequest() {
  const { token: routeToken } = useParams();
  const navigate = useNavigate();
  const token = routeToken ? extractTrackingToken(routeToken) : null;

  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [status, setStatus] = useState<RequestStatus | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (t: string, quiet = false) => {
    if (!quiet) setPhase('loading');
    try {
      const result = await fetchRequestStatus(t);
      setStatus(result);
      setPhase(result ? 'found' : 'not_found');
      setUpdatedAt(new Date());
    } catch (e: any) {
      // A failed background refresh keeps showing the last known state
      if (!quiet) {
        setError(e.message);
        setPhase('error');
      }
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (token) load(token);
    else setPhase(routeToken ? 'not_found' : 'idle');
  }, [token, routeToken, load]);

  useEffect(() => {
    if (!token || !status || !ACTIVE.includes(status.status)) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load(token, true);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [token, status, load]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = extractTrackingToken(input);
    if (!t) {
      setInputError('That does not look like a tracking code. Paste the code or link the hospital gave you.');
      return;
    }
    setInputError('');
    navigate(`/track/${t}`);
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: 'LifeLink blood request', url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // The user closed the share sheet
    }
  };

  return (
    <div className="min-h-screen bg-[#fff5f5] text-slate-900 font-sans flex flex-col">
      <header className="bg-white border-b border-[#ee2b2b]/10">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-[#ee2b2b] p-1.5 rounded-lg text-white">
              <span className="material-symbols-outlined text-xl">vital_signs</span>
            </div>
            <span className="text-lg font-extrabold tracking-tight">LifeLink <span className="text-[#ee2b2b]">AI</span></span>
          </Link>
          <Link to="/" className="text-sm font-bold text-slate-600 hover:text-[#ee2b2b]">Home</Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-black">Track a blood request</h1>
          <p className="text-sm text-slate-500 mt-1">Live progress for the patient's family. Donor names and phone numbers are never shown here.</p>
        </div>

        {!token && (
          <form onSubmit={submit} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
            <label htmlFor="tracking-code" className="text-sm font-bold text-slate-700">Tracking code or link from the hospital</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="tracking-code"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. 7490af64-2df9-438f-…"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-[#ee2b2b] focus:ring-2 focus:ring-[#ee2b2b]/20 outline-none text-sm"
              />
              <button className="bg-[#ee2b2b] text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-[#ee2b2b]/90">Track</button>
            </div>
            {inputError && <p className="text-sm text-red-600">{inputError}</p>}
            <p className="text-xs text-slate-500">No code yet? Ask the treating hospital to raise the request on LifeLink. They will give you the code.</p>
          </form>
        )}

        {phase === 'loading' && (
          <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-500 border border-slate-100">Loading the latest progress…</div>
        )}

        {phase === 'not_found' && (
          <div className="bg-white rounded-2xl p-6 border border-amber-200 space-y-3">
            <h2 className="font-black text-lg">We couldn't find this request</h2>
            <p className="text-sm text-slate-600">Check that you copied the whole code or link from the hospital. If it still fails, ask the hospital to confirm the request was raised.</p>
            <Link to="/track" className="inline-block text-sm font-bold text-[#ee2b2b] hover:underline">Try another code</Link>
          </div>
        )}

        {phase === 'error' && token && (
          <div className="bg-white rounded-2xl p-6 border border-amber-200 space-y-3">
            <h2 className="font-black text-lg">Tracking is unavailable right now</h2>
            <p className="text-sm text-slate-600">{error} The request itself keeps running; please try again in a minute.</p>
            <button onClick={() => load(token)} className="text-sm font-bold text-[#ee2b2b] hover:underline">Try again</button>
          </div>
        )}

        {phase === 'found' && status && <RequestView status={status} />}

        {phase === 'found' && status && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>
              Updated {updatedAt?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              {ACTIVE.includes(status.status) ? ' · refreshes every 2 minutes' : ''}
            </span>
            <div className="flex gap-2">
              <button onClick={() => token && load(token, true)} className="px-3 py-2 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-50">Refresh</button>
              <button onClick={share} className="px-3 py-2 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-50">
                {copied ? 'Link copied' : 'Share with family'}
              </button>
            </div>
          </div>
        )}

        <HelpBox exhausted={status?.status === 'Exhausted'} />
      </main>
    </div>
  );
}

function RequestView({ status }: { status: RequestStatus }) {
  const meta = STATUS_META[status.status] ?? STATUS_META.Open;
  const pct = Math.min(100, Math.round((status.units_confirmed / Math.max(1, status.units_required)) * 100));

  return (
    <>
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${meta.tone}`}>
              <span className="material-symbols-outlined text-sm">{meta.icon}</span>
              {meta.label}
            </span>
            <h2 className="text-xl font-black mt-3">{status.hospital_name}</h2>
            <p className="text-sm text-slate-500">
              {status.hospital_city} · {status.urgency}{status.patient_ref ? ` · ${status.patient_ref}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black text-[#ee2b2b] leading-none">{status.blood_group}</p>
            <p className="text-xs text-slate-500 mt-1">blood needed</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="h-3 bg-red-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#ee2b2b] rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm text-slate-600 mt-2">
            <strong>{status.units_confirmed} of {status.units_required}</strong> unit(s) confirmed by donors · {status.units_donated} donated
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            ['Compatible donors found', status.compatible_donors_found],
            ['Alerted so far', status.donors_alerted],
            ['On standby', status.donors_on_standby],
            ['No reply yet', status.donors_no_response],
          ].map(([label, value]) => (
            <div key={label} className="bg-slate-50 rounded-xl p-3">
              <p className="text-2xl font-black">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-black mb-2">What happens next</h3>
        <p className="text-sm text-slate-700 leading-relaxed">{status.next_step}</p>
        {status.next_check_at && (
          <p className="text-xs text-slate-500 mt-2">If nobody else confirms, more donors are alerted at {formatWhen(status.next_check_at)}.</p>
        )}
      </section>

      {status.confirmed_donors.length > 0 && (
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-black mb-3">Confirmed donors</h3>
          <ul className="space-y-2">
            {status.confirmed_donors.map((d, i) => (
              <li key={i} className="flex items-center justify-between text-sm bg-slate-50 rounded-xl px-4 py-3">
                <span><strong>{d.blood_group}</strong> donor{d.distance_km != null ? ` · ${d.distance_km} km away` : ''}</span>
                <span className={`text-xs font-bold ${d.state === 'donated' ? 'text-green-700' : 'text-blue-700'}`}>{d.state}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-black mb-3">Timeline</h3>
        <ol className="relative border-l-2 border-red-100 ml-2 space-y-4">
          {status.timeline.map((t, i) => (
            <li key={i} className="pl-5 relative">
              <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-[#ee2b2b]" />
              <p className="text-sm font-semibold text-slate-800">{t.event}</p>
              <p className="text-xs text-slate-500">{formatWhen(t.at)}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function HelpBox({ exhausted }: { exhausted: boolean }) {
  return (
    <section className={`rounded-2xl p-6 border ${exhausted ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100 shadow-sm'}`}>
      <h3 className="font-black mb-3">{exhausted ? 'What you can do now' : 'While you wait'}</h3>
      <ul className="space-y-3 text-sm text-slate-700">
        <li className="flex gap-3">
          <span className="material-symbols-outlined text-[#ee2b2b]">call</span>
          <span>
            Medical emergency: call <a href={`tel:${EMERGENCY.allEmergencies}`} className="font-black text-[#ee2b2b]">{EMERGENCY.allEmergencies}</a>, or{' '}
            <a href={`tel:${EMERGENCY.ambulance}`} className="font-black text-[#ee2b2b]">{EMERGENCY.ambulance}</a> for an ambulance.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="material-symbols-outlined text-[#ee2b2b]">search</span>
          <span>
            Check blood stock at blood banks near you on{' '}
            <a href={EMERGENCY.bloodBankSearchUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#ee2b2b] hover:underline">e-RaktKosh</a>{' '}
            (Government of India), and ask the hospital's blood bank about it.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="material-symbols-outlined text-[#ee2b2b]">group_add</span>
          <span>
            Relatives and friends can help too:{' '}
            <Link to="/register-donor" className="font-bold text-[#ee2b2b] hover:underline">register as a donor</Link>{' '}
            so blood banks can restock.
          </span>
        </li>
      </ul>
    </section>
  );
}
