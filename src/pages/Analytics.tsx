import React, { useCallback, useEffect, useState } from 'react';
import { NetworkAnalytics, fetchNetworkAnalytics, formatMinutes } from '../lib/network';

const GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
const pct = (v: number | null | undefined) => (v == null ? '–' : `${Math.round(v)}%`);

export default function Analytics() {
  const [data, setData] = useState<NetworkAnalytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchNetworkAnalytics());
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const r = data?.requests;
  const pool = data?.donor_pool;
  const resp = data?.responses;
  const maxRegistered = Math.max(1, ...GROUPS.map((g) => pool?.by_blood_group[g]?.registered ?? 0));
  const shortages = GROUPS.filter((g) => pool && (pool.by_blood_group[g]?.eligible_now ?? 0) === 0);
  const statusRows: [string, number, string][] = r ? [
    ['Open (finding donors)', r.open, 'bg-amber-400'],
    ['Fulfilled (donors on the way)', r.fulfilled, 'bg-blue-500'],
    ['Completed (donated)', r.completed, 'bg-green-500'],
    ['Exhausted (no donors left)', r.exhausted, 'bg-red-500'],
    ['Cancelled', r.cancelled, 'bg-slate-400'],
  ] : [];

  return (
    <div className="flex-1 p-8 max-w-[1400px] mx-auto w-full">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Network Analytics</h2>
          <p className="text-slate-500 mt-1">Live from the LifeLink donor network: requests, donor pool and response rates.</p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">sync</span>
              Updated {new Date(data.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <span className="material-symbols-outlined text-lg">refresh</span>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">{error}</div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Kpi icon="group" tone="bg-blue-50 text-blue-600" label="Registered donors" value={pool?.registered} sub={pool && `${pool.available} marked available`} />
        <Kpi icon="bloodtype" tone="bg-green-50 text-green-600" label="Eligible to donate now" value={pool?.eligible_now} sub={pool && `${pool.committed_now} committed to a request`} />
        <Kpi icon="check_circle" tone="bg-[#ee2b2b]/10 text-[#ee2b2b]" label="Requests covered" value={r && pct(r.covered_pct)} sub={r && `${r.total} requests in total`} />
        <Kpi icon="timer" tone="bg-orange-50 text-orange-600" label="Median time to first donor" value={r && formatMinutes(r.median_minutes_to_first_donor)} sub={r && `${pct(r.first_donor_within_15_min_pct)} within 15 min`} />
      </div>

      {shortages.length > 0 && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-600">warning</span>
          <p className="text-sm text-red-900">
            <strong>No eligible donors right now for {shortages.join(', ')}.</strong> Requests for these groups can still be covered by compatible groups, but recruiting donors here would reduce risk.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Donor pool by blood group */}
        <section className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200">
          <h4 className="font-bold text-slate-900">Donor pool by blood group</h4>
          <p className="text-xs text-slate-500 mb-6">Eligible now (dark) vs registered (light)</p>
          <div className="space-y-3">
            {GROUPS.map((g) => {
              const row = pool?.by_blood_group[g] ?? { registered: 0, eligible_now: 0 };
              return (
                <div key={g} className="flex items-center gap-3">
                  <span className="w-10 text-sm font-black text-slate-700">{g}</span>
                  <div className="relative flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-red-200 rounded-full" style={{ width: `${(row.registered / maxRegistered) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 bg-[#ee2b2b] rounded-full" style={{ width: `${(row.eligible_now / maxRegistered) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right text-sm font-semibold text-slate-600 tabular-nums">{row.eligible_now} / {row.registered}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Requests by status */}
        <section className="bg-white p-6 rounded-xl border border-slate-200">
          <h4 className="font-bold text-slate-900 mb-6">Requests by status</h4>
          <div className="space-y-4">
            {statusRows.map(([label, value, color]) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{label}</span>
                  <span className="font-bold text-slate-900">{value}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${r && r.total ? (value / r.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            {!r && <p className="text-sm text-slate-400">{loading ? 'Loading…' : 'No data'}</p>}
          </div>
        </section>
      </div>

      {/* Donor responses */}
      <section className="bg-white p-6 rounded-xl border border-slate-200">
        <h4 className="font-bold text-slate-900 mb-6">Donor responses</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {([
            ['Alerts sent', resp?.alerts_sent],
            ['Response rate', resp && pct(resp.response_rate_pct)],
            ['Acceptance rate', resp && pct(resp.acceptance_rate_pct)],
            ['Median reply time', resp && formatMinutes(resp.median_response_minutes)],
            ['No reply', resp?.no_response],
            ['Donations logged', resp?.donations_logged],
            ['No-shows', resp?.no_shows],
          ] as [string, React.ReactNode][]).map(([label, value]) => (
            <div key={label} className="bg-slate-50 rounded-xl p-4">
              <p className="text-xl font-black text-slate-900">{value ?? '–'}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
        {resp && (
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {Object.entries(resp.alerts_by_channel).map(([channel, count]) => (
              <span key={channel} className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">{channel.replace('_', '-')}: {count}</span>
            ))}
          </div>
        )}
        {data && data.compatibility.accepted_from_other_compatible_groups > 0 && (
          <p className="mt-6 text-sm text-slate-600 bg-slate-50 rounded-lg p-4 border border-dashed border-slate-200">
            <strong>{data.compatibility.accepted_from_other_compatible_groups}</strong> accepted donors ({pct(data.compatibility.share_of_accepted_pct)}) had a different but compatible blood group.
            Matching only identical groups would have missed them.
          </p>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon, tone, label, value, sub }: { icon: string; tone: string; label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200">
      <div className={`p-2 rounded-lg w-fit mb-4 ${tone}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <p className="text-slate-500 text-sm font-medium">{label}</p>
      <h3 className="text-2xl font-bold text-slate-900 mt-1">{value ?? '–'}</h3>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}
