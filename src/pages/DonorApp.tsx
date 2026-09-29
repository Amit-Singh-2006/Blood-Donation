import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import AgentChat from '../components/AgentChat';
import { apiFetch } from '../lib/api';
import { EMERGENCY } from '../lib/contact';

/** A blood request the donor was alerted to, from GET /donor/network. */
interface NetworkAlert {
  match_id: number;
  status: 'awaiting_reply' | 'accepted';
  hospital_name: string;
  hospital_city: string;
  blood_group_needed: string;
  urgency: string;
  units_required: number;
  distance_miles: number | null;
  alerted_at: string | null;
  accept_url: string | null;
  decline_url: string;
}

interface DonorNetworkView {
  registered: boolean;
  donor?: {
    name: string;
    blood_group: string;
    city: string;
    available: boolean;
    preferred_channel: string;
    total_donations: number;
    xp_points?: number;
    last_donation_date: string | null;
    eligible_from: string | null;
    eligible_now: boolean;
  };
  alerts?: NetworkAlert[];
  history?: { request_id: number; hospital_name: string; hospital_city: string; blood_group_needed: string; donated_on: string }[];
  stats?: { alerts_received: number; accepted: number; donations_via_lifelink: number };
}

interface Badge { name: string; icon: string; tone: string; why: string }

/** Recognition only: badges have no monetary value (see the Terms). */
const earnedBadges = (donor: DonorNetworkView['donor'], stats: DonorNetworkView['stats']): Badge[] => {
  const n = donor?.total_donations ?? 0;
  return [
    n >= 1 && { name: 'First Donation', icon: 'water_drop', tone: 'bg-[#ee2b2b]/10 text-[#ee2b2b]', why: 'Gave blood for the first time' },
    (stats?.accepted ?? 0) >= 1 && { name: 'Answered the Call', icon: 'notifications_active', tone: 'bg-amber-100 text-amber-600', why: 'Said YES to a hospital request' },
    n >= 3 && { name: 'Regular Donor', icon: 'event_repeat', tone: 'bg-blue-100 text-blue-600', why: '3 or more donations' },
    n >= 5 && { name: 'Life Saver', icon: 'volunteer_activism', tone: 'bg-green-100 text-green-600', why: '5 or more donations' },
    n >= 10 && { name: 'Hero', icon: 'military_tech', tone: 'bg-purple-100 text-purple-600', why: '10 or more donations' },
    donor?.blood_group === 'O-' && n >= 1 && { name: 'Universal Donor', icon: 'diversity_1', tone: 'bg-slate-100 text-slate-700', why: 'O- blood can help any patient' },
  ].filter(Boolean) as Badge[];
};

type PreferenceChange = { available?: boolean; preferred_channel?: string };

const formatDay = (day?: string | null) =>
  day ? new Date(day.length === 10 ? day + 'T00:00:00' : day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const openDirections = (place: string) =>
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`, '_blank', 'noopener');

function DonorSettingsView({ channel, onSave }: { channel?: string; onSave: (change: PreferenceChange) => Promise<void> }) {
  const [selected, setSelected] = useState(channel ?? 'sms');
  const [status, setStatus] = useState('');
  useEffect(() => { if (channel) setSelected(channel); }, [channel]);

  const save = async () => {
    setStatus('Saving…');
    try {
      await onSave({ preferred_channel: selected });
      setStatus('Saved');
    } catch (err: any) {
      setStatus(err.message || 'Could not save your settings.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#ee2b2b]">settings</span>
          Account Settings
        </h2>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg border-slate-100 bg-slate-50">
            <div>
              <h4 className="font-bold text-slate-900">Blood request alerts</h4>
              <p className="text-sm text-slate-500">How LifeLink reaches you when a nearby patient needs your blood group</p>
            </div>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium"
            >
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="in_app">Only in the app</option>
            </select>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg border-slate-100 bg-slate-50">
            <div>
              <h4 className="font-bold text-slate-900">Location Services</h4>
              <p className="text-sm text-slate-500">Allow AI to find nearest hospitals for matching</p>
            </div>
            <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-pointer">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
            </div>
          </div>
        </div>
        <div className="mt-8 flex items-center gap-4">
          <button onClick={save} className="px-6 py-3 w-full sm:w-auto bg-[#ee2b2b] text-white rounded-lg font-bold hover:bg-[#ee2b2b]/90 transition-all shadow-md">
            Save Changes
          </button>
          {status && <span className="text-sm text-slate-500">{status}</span>}
        </div>
      </div>
    </div>
  );
}

export default function DonorApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAvailable, setIsAvailable] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [network, setNetwork] = useState<DonorNetworkView | null>(null);
  const [networkError, setNetworkError] = useState('');
  const [replyNotice, setReplyNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [respondingId, setRespondingId] = useState<number | null>(null);

  const [user, setUser] = useState<any>(null);
  const [donations, setDonations] = useState<any[]>([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    fetchDonations();
    fetchNetwork();
  }, []);

  // Live alerts, eligibility and availability come from the LifeLink donor network
  const fetchNetwork = async () => {
    try {
      const view: DonorNetworkView = await apiFetch('/donor/network');
      setNetwork(view);
      setIsAvailable(!!view.donor?.available);
      setNetworkError('');
    } catch (err: any) {
      setNetworkError(err.message || 'Could not reach the donor network.');
    }
  };

  const updatePreferences = async (change: PreferenceChange) => {
    const view: DonorNetworkView = await apiFetch('/donor/network', { method: 'PUT', body: JSON.stringify(change) });
    setNetwork(view);
    setIsAvailable(!!view.donor?.available);
  };

  const toggleAvailability = async () => {
    const next = !isAvailable;
    setIsAvailable(next);
    try {
      await updatePreferences({ available: next });
    } catch (err: any) {
      setIsAvailable(!next);
      setNetworkError(err.message || 'Could not update your availability.');
    }
  };

  // These are the same one-tap links sent by SMS/WhatsApp; format=json returns
  // the outcome instead of a page, so the reply shows up right here.
  const respondToAlert = async (alertInfo: NetworkAlert, url: string) => {
    setRespondingId(alertInfo.match_id);
    try {
      const res = await fetch(`${url}&format=json`);
      const outcome = await res.json();
      setReplyNotice({ ok: res.ok, text: `${outcome.title}. ${outcome.message}` });
    } catch {
      window.open(url, '_blank', 'noopener');
    } finally {
      setRespondingId(null);
      fetchNetwork();
    }
  };

  const fetchDonations = async () => {
    try {
      const data = await apiFetch('/donor/donations');
      setDonations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch donations:', err);
    }
  };


  // Determine active tab based on URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/centers')) return 'centers';
    if (path.includes('/impact')) return 'impact';
    if (path.includes('/settings')) return 'settings';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaimCertificate = async (donation: any) => {
    // Prompt the user for the email they want the certificate sent to
    const defaultEmail = user?.email || "";
    const userEmail = window.prompt("Where should we email your Certificate of Appreciation?", defaultEmail);

    // If user clicks Cancel on the prompt, abort.
    if (!userEmail) {
      return;
    }

    setClaimingId(donation.id);
    try {
      const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_CERTIFICATE_URL;
      if (scriptUrl) {
        await fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify({
            name: network?.donor?.name || user?.name || "LifeLink Donor",
            email: userEmail,
            bloodGroup: network?.donor?.blood_group || user?.blood_group || "",
          }),
        });
        alert('Certificate generation request sent! Please check your email inbox in a few moments. (It will also be logged in the spreadsheet)');
      } else {
        alert("Certificate URL not configured.");
      }
    } catch (err) {
      console.error(err);
      alert('Error generating certificate.');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className={`max-w-7xl mx-auto px-6 ${activeTab === 'centers' ? 'py-4' : 'py-8'} relative`}>
      {/* Hero: Availability Toggle */}
      {activeTab !== 'centers' && (
        <div className="mb-10 bg-white rounded-xl p-6 border border-[#ee2b2b]/10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#ee2b2b]/10 rounded-xl">
              <span className="material-symbols-outlined text-[#ee2b2b] text-3xl">sensors</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Real-time Availability</h2>
              <p className="text-sm text-slate-500">Toggle active status to receive urgent blood requests via AI matching.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className={`text-sm font-bold uppercase tracking-wider ${!isAvailable ? 'text-slate-400' : 'text-slate-300'}`}>Unavailable</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isAvailable}
                disabled={!network?.donor}
                onChange={toggleAvailability}
              />
              <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#ee2b2b]"></div>
            </label>
            <span className={`text-sm font-bold uppercase tracking-wider ${isAvailable ? 'text-[#ee2b2b]' : 'text-slate-300'}`}>Available</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-6 mb-8 border-b border-slate-200 overflow-x-auto">
        <Link
          to="/donor"
          className={`pb-4 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'dashboard' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Dashboard
        </Link>
        <Link
          to="/donor/centers"
          className={`pb-4 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${(activeTab as string) === 'centers' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Where to Donate
        </Link>
        <Link
          to="/donor/impact"
          className={`pb-4 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'impact' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          My Impact
        </Link>
      </div>

      {activeTab === 'dashboard' && (
        <DashboardView
          donations={donations}
          network={network}
          networkError={networkError}
          isAvailable={isAvailable}
          replyNotice={replyNotice}
          respondingId={respondingId}
          onRespond={respondToAlert}
          onClaimCertificate={handleClaimCertificate}
          claimingId={claimingId}
        />
      )}
      {activeTab === 'centers' && <WhereToDonateView city={network?.donor?.city} />}
      {activeTab === 'impact' && <ImpactView network={network} networkError={networkError} donations={donations} onClaimCertificate={handleClaimCertificate} claimingId={claimingId} />}
      {activeTab === 'settings' && <DonorSettingsView channel={network?.donor?.preferred_channel} onSave={updatePreferences} />}

      {/* Floating AI Chat Button */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#ee2b2b] text-white rounded-full shadow-2xl shadow-[#ee2b2b]/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
      >
        <span className="material-symbols-outlined">psychology</span>
      </button>
      <AgentChat
        isOpen={showChat}
        context="donor"
        onClose={() => setShowChat(false)}
        onAction={(actionName, outcome) => {
          // The assistant already accepted through the network; show the result and refresh
          if (actionName === 'accept_blood_request') {
            if (outcome?.title) setReplyNotice({ ok: true, text: `${outcome.title}. ${outcome.message}` });
            fetchNetwork();
          }
        }}
      />
    </div>
  );
}

function DashboardView({
  donations, network, networkError, isAvailable, replyNotice, respondingId, onRespond, onClaimCertificate, claimingId
}: {
  donations: any[]; network: DonorNetworkView | null; networkError: string; isAvailable: boolean;
  replyNotice: { ok: boolean; text: string } | null; respondingId: number | null;
  onRespond: (alertInfo: NetworkAlert, url: string) => void;
  onClaimCertificate: (donation: any) => void; claimingId: string | null;
}) {
  const donor = network?.donor;
  const alerts = network?.alerts ?? [];
  const waiting = alerts.filter((a) => a.status === 'awaiting_reply').length;
  const totalDonations = donor?.total_donations ?? donations.length;
  const nextMilestone = [1, 5, 10, 25, 50, 100].find((m) => m > totalDonations) ?? totalDonations;
  const milestonePct = nextMilestone ? Math.round((totalDonations / nextMilestone) * 100) : 100;
  const badges = earnedBadges(donor, network?.stats);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Live requests from the donor network */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900">
            <span className="material-symbols-outlined text-[#ee2b2b]">emergency</span>
            Pending Requests
          </h3>
          {waiting > 0 && (
            <span className="text-xs font-bold bg-[#ee2b2b]/10 text-[#ee2b2b] px-3 py-1 rounded-full uppercase">
              {waiting} Live {waiting === 1 ? 'Match' : 'Matches'}
            </span>
          )}
        </div>

        {/* Donation Timeline Info */}
        <div className="bg-white rounded-xl p-4 border border-blue-100 flex items-start gap-4 mb-6 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <span className="material-symbols-outlined">calendar_clock</span>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Donation Eligibility</h4>
            <p className="text-sm text-slate-600 mt-1">
              {!donor ? (
                networkError ? 'Your eligibility will show here once the donor network is reachable.' : 'Checking your eligibility…'
              ) : (
                <>
                  {donor.last_donation_date
                    ? <>Your last donation was on <strong className="text-slate-900">{formatDay(donor.last_donation_date)}</strong>. </>
                    : <>No donation recorded yet. </>}
                  {donor.eligible_now
                    ? <>You are currently <span className="font-bold text-green-600 uppercase text-xs tracking-wider">Eligible</span> to donate.</>
                    : <>You can donate again from <strong className="text-slate-900">{formatDay(donor.eligible_from)}</strong>.</>}
                </>
              )}
              <br /><span className="text-xs text-slate-400 mt-1 block">(Donors wait 90 days (men) or 120 days (women) between whole blood donations.)</span>
            </p>
          </div>
        </div>

        {replyNotice && (
          <div className={`rounded-xl p-4 border text-sm font-medium ${replyNotice.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            {replyNotice.text}
          </div>
        )}

        {networkError ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800">
            {networkError}
          </div>
        ) : !network ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            Checking for blood requests near you…
          </div>
        ) : alerts.length > 0 ? (
          alerts.map((req) => (
            <div key={req.match_id} className="bg-white rounded-xl p-6 border border-[#ee2b2b]/20 shadow-lg shadow-[#ee2b2b]/5">
              <div className="flex justify-between items-start mb-2 gap-4">
                <div>
                  <span className="bg-[#ee2b2b] text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-tighter">{req.urgency}</span>
                  <h4 className="text-xl font-bold text-slate-900 mt-2">{req.hospital_name}</h4>
                  <p className="text-sm text-slate-500">{req.hospital_city}</p>
                </div>
                <span className="text-3xl font-black text-[#ee2b2b]">{req.blood_group_needed}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-5">
                {req.distance_miles != null && (
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">near_me</span> {req.distance_miles} miles</span>
                )}
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">water_drop</span> {req.units_required} unit(s) needed</span>
                {req.alerted_at && (
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span> Alerted {new Date(req.alerted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                )}
              </div>
              {req.status === 'accepted' ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex-1 text-sm font-bold text-green-700 bg-green-50 px-4 py-3 rounded-lg">You're confirmed. The hospital is expecting you.</span>
                  <button
                    onClick={() => onRespond(req, req.decline_url)}
                    disabled={respondingId === req.match_id}
                    className="bg-white hover:bg-slate-50 text-slate-600 font-bold py-3 px-5 rounded-lg transition-all border border-slate-200 disabled:opacity-50"
                  >
                    I can't make it
                  </button>
                  <button onClick={() => openDirections(`${req.hospital_name}, ${req.hospital_city}`)} className="w-12 h-12 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors" title="Directions">
                    <span className="material-symbols-outlined text-slate-600">map</span>
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => req.accept_url && onRespond(req, req.accept_url)}
                    disabled={respondingId === req.match_id}
                    className="flex-1 bg-[#ee2b2b] hover:bg-[#ee2b2b]/90 text-white font-bold py-3 rounded-lg transition-all shadow-md shadow-[#ee2b2b]/20 disabled:opacity-50"
                  >
                    {respondingId === req.match_id ? 'Sending…' : 'Accept Request'}
                  </button>
                  <button
                    onClick={() => onRespond(req, req.decline_url)}
                    disabled={respondingId === req.match_id}
                    className="flex-none bg-white hover:bg-slate-50 text-slate-600 font-bold py-3 px-6 rounded-lg transition-all border border-slate-200 disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button onClick={() => openDirections(`${req.hospital_name}, ${req.hospital_city}`)} className="w-12 h-12 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors" title="Directions">
                    <span className="material-symbols-outlined text-slate-600">map</span>
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl text-slate-400 mb-3">
              {isAvailable ? "event_busy" : "power_settings_new"}
            </span>
            <h4 className="text-lg font-bold text-slate-900 mb-2">
              {isAvailable ? "No matching requests" : "AI Matching Paused"}
            </h4>
            <p className="text-sm text-slate-500 max-w-sm">
              {isAvailable ? "We will notify you immediately if your blood type is needed." : "Turn on your availability to start receiving live emergency requests from nearby hospitals."}
            </p>
          </div>
        )}
        {/* History Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 overflow-hidden">
          <h3 className="text-lg font-bold mb-6 text-slate-900">Donation History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  <th className="pb-4 font-semibold">Date</th>
                  <th className="pb-4 font-semibold">Location</th>
                  <th className="pb-4 font-semibold">Type</th>
                  <th className="pb-4 font-semibold">Status</th>
                  <th className="pb-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {donations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 italic">No donations found. Start donating today!</td>
                  </tr>
                ) : (
                  donations.map((donation) => (
                    <tr key={donation.id} className="group">
                      <td className="py-4 text-sm font-medium text-slate-900">{new Date(donation.donation_date).toLocaleDateString()}</td>
                      <td className="py-4 text-sm text-slate-600">{donation.hospital_name || 'Hospital'}</td>
                      <td className="py-4 text-sm text-slate-600">{donation.units} Units</td>
                      <td className="py-4">
                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase">Verified</span>
                      </td>
                      <td className="py-4 text-right flex flex-col items-end gap-2">
                        <button
                          onClick={() => onClaimCertificate(donation)}
                          disabled={claimingId === donation.id}
                          className="text-xs font-bold bg-[#ee2b2b] text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                          {claimingId === donation.id ? "Sending..." : "Get Certificate"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column: Stats & Performance */}
      <div className="space-y-8">
        {/* Performance Stats */}
        <div className="bg-[#ee2b2b] text-white rounded-xl p-6 shadow-xl shadow-[#ee2b2b]/20 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-6">Total Impact</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-4xl font-black mb-1">{totalDonations}</p>
                <p className="text-[10px] font-bold uppercase opacity-80">Donations</p>
              </div>
              <div>
                {/* One whole-blood donation can help up to three patients */}
                <p className="text-4xl font-black mb-1">{totalDonations * 3}</p>
                <p className="text-[10px] font-bold uppercase opacity-80">Lives Helped</p>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold">Next Milestone: {nextMilestone} {nextMilestone === 1 ? 'donation' : 'donations'}</span>
                <span className="text-xs">{milestonePct}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-1.5">
                <div className="bg-white rounded-full h-1.5" style={{ width: `${milestonePct}%` }}></div>
              </div>
            </div>
          </div>
          {/* Abstract Pattern for Background */}
          <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 opacity-10">
            <span className="material-symbols-outlined text-[120px]">hub</span>
          </div>
        </div>

        {/* Badges */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Earned Badges</h3>
            <Link to="/donor/impact" className="text-[#ee2b2b] text-xs font-bold hover:underline">View All</Link>
          </div>
          {badges.length === 0 ? (
            <p className="text-sm text-slate-400">Your first donation earns your first badge.</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {badges.slice(0, 3).map((b) => (
                <div key={b.name} className="flex flex-col items-center text-center gap-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${b.tone}`}>
                    <span className="material-symbols-outlined text-2xl">{b.icon}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600">{b.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Where to donate */}
        <Link to="/donor/centers" className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-[#ee2b2b]/30 hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#ee2b2b]">location_on</span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Where to donate{donor?.city ? ` in ${donor.city}` : ''}</h3>
              <p className="text-xs text-slate-500">LifeLink hospitals and licensed blood centres near you</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function WhereToDonateView({ city }: { city?: string }) {
  const [centers, setCenters] = useState<{ hospital_name: string; city: string; contact_number: string | null; in_your_city: boolean }[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/donor/centers')
      .then((rows) => setCenters(rows))
      .catch((err) => setError(err.message || 'Could not load hospitals.'));
  }, []);

  const local = centers?.filter((c) => c.in_your_city) ?? [];
  const others = centers?.filter((c) => !c.in_your_city) ?? [];

  const list = (rows: typeof local) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {rows.map((c) => (
        <div key={`${c.hospital_name}-${c.city}`} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-3">
          <div>
            <p className="font-bold text-slate-900">{c.hospital_name}</p>
            <p className="text-xs text-slate-500">{c.city}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {c.contact_number && (
              <a href={`tel:${c.contact_number}`} className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50" title="Call">
                <span className="material-symbols-outlined text-lg">call</span>
              </a>
            )}
            <button onClick={() => openDirections(`${c.hospital_name}, ${c.city}`)} className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50" title="Directions">
              <span className="material-symbols-outlined text-lg">map</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-blue-100 p-6 flex gap-4">
        <span className="material-symbols-outlined text-blue-600">info</span>
        <div className="text-sm text-slate-600 space-y-1">
          <p className="font-bold text-slate-900">You don't need to book</p>
          <p>When a nearby patient needs your blood group, LifeLink alerts you and the hospital expects you once you tap YES. To donate any time, visit a licensed blood centre: call ahead to check timings, carry a photo ID and eat a light meal first.</p>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">LifeLink hospitals{city ? ` in ${city}` : ''}</h3>
        {error ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">{error}</p>
        ) : !centers ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : local.length ? list(local) : (
          <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-5">No verified LifeLink hospitals in your city yet. The blood centre directory below lists every licensed centre.</p>
        )}
      </section>

      {others.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Other LifeLink hospitals</h3>
          {list(others)}
        </section>
      )}

      <a href={EMERGENCY.bloodBankSearchUrl} target="_blank" rel="noopener noreferrer" className="block bg-white rounded-xl border border-slate-200 p-6 hover:border-[#ee2b2b]/30 hover:shadow-md transition-all">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-3xl text-[#ee2b2b]">search</span>
          <div>
            <p className="font-bold text-slate-900">Find a licensed blood centre near you</p>
            <p className="text-sm text-slate-500">e-RaktKosh, the Government of India's directory of blood centres and their stock.</p>
          </div>
          <span className="material-symbols-outlined text-slate-400 ml-auto">open_in_new</span>
        </div>
      </a>
    </div>
  );
}

function ImpactView({ network, networkError, donations, onClaimCertificate, claimingId }: {
  network: DonorNetworkView | null; networkError: string; donations: any[];
  onClaimCertificate: (donation: any) => void; claimingId: string | null;
}) {
  const donor = network?.donor;
  const stats = network?.stats;
  const history = network?.history ?? [];
  const total = donor?.total_donations ?? donations.length;
  const badges = earnedBadges(donor, stats);
  const locked = [
    { name: 'First Donation', need: 'Donate once' },
    { name: 'Answered the Call', need: 'Say YES to a request' },
    { name: 'Regular Donor', need: '3 donations' },
    { name: 'Life Saver', need: '5 donations' },
    { name: 'Hero', need: '10 donations' },
  ].filter((b) => !badges.some((e) => e.name === b.name));

  if (!network) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
        {networkError || 'Loading your impact…'}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Donations', total],
          ['Lives helped', total * 3],
          ['Requests answered', stats?.accepted ?? 0],
          ['XP', donor?.xp_points ?? 0],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-3xl font-black text-slate-900">{value}</p>
            <p className="text-xs font-bold text-slate-500 uppercase mt-1">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 -mt-4">One whole-blood donation can help up to three patients. XP and badges are a thank-you from LifeLink: they have no cash value, because donation in India is voluntary and unpaid.</p>

      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Badges</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {badges.map((b) => (
            <div key={b.name} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center ${b.tone}`}>
                <span className="material-symbols-outlined">{b.icon}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{b.name}</p>
                <p className="text-[11px] text-slate-500">{b.why}</p>
              </div>
            </div>
          ))}
          {locked.map((b) => (
            <div key={b.name} className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-200 opacity-60">
              <div className="w-11 h-11 rounded-full flex items-center justify-center bg-slate-100 text-slate-400">
                <span className="material-symbols-outlined">lock</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">{b.name}</p>
                <p className="text-[11px] text-slate-500">{b.need}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Donations through LifeLink</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">None yet. When you answer a request and the hospital confirms your donation, it appears here.</p>
        ) : (
          <ul className="space-y-3">
            {history.map((h) => (
              <li key={h.request_id} className="flex items-center justify-between gap-3 p-4 rounded-xl bg-slate-50">
                <div>
                  <p className="font-bold text-slate-900">{h.hospital_name}</p>
                  <p className="text-xs text-slate-500">{h.hospital_city} · {h.blood_group_needed} patient · {formatDay(h.donated_on)}</p>
                </div>
                <button
                  onClick={() => onClaimCertificate({ id: `net-${h.request_id}` })}
                  disabled={claimingId === `net-${h.request_id}`}
                  className="text-xs font-bold bg-[#ee2b2b] text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1 disabled:opacity-50 shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                  {claimingId === `net-${h.request_id}` ? 'Sending…' : 'Certificate'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
