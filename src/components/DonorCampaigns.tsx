import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { Campaign, CampaignInfo, campaignDates, campaignHours, isPast } from '../lib/campaign';

/** Donor: campaigns in their city (they are alerted when one is announced) and the ones they joined. */
export default function DonorCampaigns() {
  const [data, setData] = useState<{ profile: { city: string | null } | null; campaigns: Campaign[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/campaigns/for/me').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading campaigns…</p>;

  const upcoming = data.campaigns.filter((c) => c.status === 'active' && !isPast(c));
  const past = data.campaigns.filter((c) => c.status !== 'active' || isPast(c));

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
        <h2 className="text-lg font-black text-slate-900">Blood donation campaigns{data.profile?.city ? ` in ${data.profile.city}` : ''}</h2>
        <p className="text-sm text-slate-600">When a camp is announced in your city, we tell you here and by SMS, WhatsApp and email.</p>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-slate-500">No upcoming campaigns in your city right now.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {upcoming.map((c) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-black text-slate-900 wrap-break-word">{c.name}</h3>
              <CampaignInfo icon="event">{campaignDates(c)}</CampaignInfo>
              <CampaignInfo icon="schedule">{campaignHours(c)}</CampaignInfo>
              <CampaignInfo icon="location_on">{c.venue}{c.address ? `, ${c.address}` : ''}, {c.city}</CampaignInfo>
              {c.rewards && <CampaignInfo icon="redeem">{c.rewards}</CampaignInfo>}
              {c.refreshments && <CampaignInfo icon="local_cafe">{c.refreshments}</CampaignInfo>}
              {c.registration_id ? (
                <p className="text-sm font-bold text-green-700 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">check_circle</span>You're registered. See you there!
                </p>
              ) : (
                <Link to={`/campaign/${c.id}`} className="block text-center px-4 py-2.5 rounded-xl bg-[#ee2b2b] text-white text-sm font-black hover:bg-red-700">Register</Link>
              )}
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Your earlier campaigns</h3>
          <div className="space-y-2">
            {past.map((c) => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 wrap-break-word">{c.name}</p>
                  <p className="text-xs text-slate-500">{campaignDates(c)} · {c.city}</p>
                </div>
                <span className="text-xs font-bold text-[#ee2b2b]">
                  {c.status === 'cancelled' ? 'Cancelled' : c.donated ? 'You donated. Thank you!' : c.attended ? 'You came' : 'Registered'}
                </span>
              </div>
            ))}
          </div>
          <Link to="/donor/reviews" className="inline-block mt-3 text-sm font-bold text-[#ee2b2b] hover:underline">Review a campaign you joined →</Link>
        </div>
      )}
    </div>
  );
}
