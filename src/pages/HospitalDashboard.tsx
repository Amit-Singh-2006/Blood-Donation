import { HospitalReviews } from '../components/Reviews';
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import AgentChat from '../components/AgentChat';
import { cn } from '@/lib/utils';
import { apiFetch } from '../lib/api';
import { signOut } from '../lib/auth';
import { getUser } from '../lib/session';
import { useNetworkAnalytics } from '../lib/network';
import { EMERGENCY } from '../lib/contact';
import { Point, agoText, distanceKm, etaMinutes } from '../lib/geo';

// The camera scanner and the map load only when used
const PassScanner = lazy(() => import('../components/PassScanner'));
const DonorMap = lazy(() => import('../components/DonorMap'));

type NavItem = 'overview' | 'requests' | 'inventory' | 'reviews' | 'settings';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
// Live data refresh while requests are active; each refresh is one n8n execution
const REFRESH_MS = 2 * 60 * 1000;
const ACTIVE = ['Open', 'Fulfilled'];

const URGENCIES = [
  { value: 'Normal', label: 'Standard', hint: 'Planned transfusion' },
  { value: 'Urgent', label: 'Urgent', hint: 'Needed within hours' },
  { value: 'Emergency', label: 'Emergency', hint: 'Life-threatening, now' },
];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  Open: { label: 'Finding donors', tone: 'bg-amber-100 text-amber-800' },
  Fulfilled: { label: 'Donors on the way', tone: 'bg-blue-100 text-blue-800' },
  Completed: { label: 'Completed', tone: 'bg-green-100 text-green-800' },
  Exhausted: { label: 'No donors left', tone: 'bg-red-100 text-red-800' },
  Cancelled: { label: 'Cancelled', tone: 'bg-slate-200 text-slate-700' },
};

interface LiveDonor {
  match_id: number;
  name: string;
  phone: string | null;
  blood_group: string;
  distance_km: number | null;
  /** The QR/ID the donor shows at the gate */
  pass_code?: string;
  status: 'accepted' | 'donated' | 'no_show';
  responded_at: string | null;
  donated_url: string | null;
  no_show_url: string | null;
}

interface LiveView {
  status: string;
  units_confirmed: number;
  units_donated: number;
  compatible_donors: number;
  donors_alerted: number;
  donors_declined: number;
  donors_no_reply: number;
  donors_on_standby: number;
  next_check_at: string | null;
  tracking_token: string | null;
  cancel_url: string | null;
  donors: LiveDonor[];
}

interface HospitalRequest {
  id: number;
  blood_group: string;
  units_required: number;
  urgency: string;
  status: string;
  created_at: string;
  patient_ref: string | null;
  required_by: string | null;
  tracking_token: string | null;
  network_error: string | null;
  live: LiveView | null;
}

interface HospitalProfile {
  hospital_name: string;
  hospital_type: string | null;
  registration_number: string | null;
  address: string | null;
  city: string;
  state: string | null;
  pincode: string | null;
  contact_number: string;
  has_location: boolean;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean;
  network_configured: boolean;
}

/** Where a donor on their way is, if they chose to share it. */
interface DonorLocation extends Point {
  match_id: number;
  request_id: number;
  accuracy_m: number | null;
  updated_at: string;
}

interface DispatchSummary {
  request: HospitalRequest;
  network: { status: string; compatible_donors: number; donors_alerted: number; donors_on_standby: number; escalation_minutes: number | null; tracking_token: string | null; message?: string } | null;
  warning: string | null;
}

const formatWhen = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

const familyLink = (token: string) => `${window.location.origin}/track/${token}`;

const readSeen = () => {
  try { return Number(localStorage.getItem('hospitalNotificationsSeen') || 0); } catch { return 0; }
};

export default function HospitalDashboard() {
  const [activeTab, setActiveTab] = useState<NavItem>('overview');
  const [showChat, setShowChat] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<HospitalProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [requests, setRequests] = useState<HospitalRequest[]>([]);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [seenAt, setSeenAt] = useState(readSeen);
  const [locations, setLocations] = useState<DonorLocation[]>([]);
  const [scanning, setScanning] = useState(false);
  const [passResult, setPassResult] = useState<PassCheck | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<Record<number, string>>(readVerified);

  const loadRequests = useCallback(async () => {
    const data = await apiFetch('/hospital/requests');
    setRequests(data.requests ?? []);
    setNetworkError(data.network_error ?? null);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [prof, reqs, inv, don] = await Promise.allSettled([
      apiFetch('/hospital/profile'),
      loadRequests(),
      apiFetch('/hospital/inventory'),
      apiFetch('/hospital/donations'),
    ]);
    if (prof.status === 'fulfilled') setProfile(prof.value);
    if (inv.status === 'fulfilled') setInventory(inv.value ?? []);
    if (don.status === 'fulfilled') setDonations(don.value ?? []);
    const failed = [prof, reqs, inv, don].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    setLoadError(failed ? `Some data could not be loaded: ${failed.reason?.message ?? 'server error'}` : '');
    setIsLoading(false);
  }, [loadRequests]);

  useEffect(() => {
    setUser(getUser('hospital'));

    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    fetchData();
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fetchData]);

  const hasActive = requests.some((r) => ACTIVE.includes(r.status));
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') loadRequests().catch(() => { });
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [hasActive, loadRequests]);

  // Donors on their way who chose to share their location: refresh every 20 s
  const donorsOnTheWay = requests.some((r) => r.live?.donors.some((d) => d.status === 'accepted'));
  useEffect(() => {
    if (!donorsOnTheWay) { setLocations([]); return; }
    const load = () => apiFetch('/hospital/donor-locations').then(setLocations).catch(() => { });
    load();
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20000);
    return () => clearInterval(id);
  }, [donorsOnTheWay]);

  // A scanned or typed pass is checked against the donors who said YES to our requests
  const checkPass = (code: string) => {
    setScanning(false);
    for (const r of requests) {
      const donor = r.live?.donors.find((d) => d.pass_code === code);
      if (!donor) continue;
      if (donor.status === 'accepted') {
        const next = { ...verifiedAt, [donor.match_id]: new Date().toISOString() };
        setVerifiedAt(next);
        try { sessionStorage.setItem(VERIFIED_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      }
      setPassResult({ code, request: r, donor });
      return;
    }
    setPassResult({ code });
  };
  const checkPassRef = useRef(checkPass);
  checkPassRef.current = checkPass;
  const onPassScanned = useCallback((code: string) => checkPassRef.current(code), []);
  const hospitalPoint = profile?.latitude != null && profile?.longitude != null
    ? { latitude: profile.latitude, longitude: profile.longitude, name: profile.hospital_name }
    : null;

  // Notifications come from what actually happened on the network
  const events = requests
    .flatMap((r) => [
      ...(r.live?.donors ?? []).map((d) => ({
        id: `${d.match_id}-${d.status}`,
        at: d.responded_at,
        title: d.status === 'donated' ? 'Donation recorded' : d.status === 'no_show' ? 'Donor did not come' : 'Donor confirmed',
        message: `${d.name} (${d.blood_group}) for request #${r.id}`,
      })),
      ...(r.status === 'Exhausted' ? [{ id: `x${r.id}`, at: r.created_at, title: 'No donors left', message: `Request #${r.id} (${r.blood_group}): contact your regional blood bank` }] : []),
    ])
    .filter((e) => e.at)
    .sort((a, b) => Date.parse(b.at!) - Date.parse(a.at!))
    .slice(0, 10);
  const unreadCount = events.filter((e) => Date.parse(e.at!) > seenAt).length;

  const markAllRead = () => {
    const now = Date.now();
    setSeenAt(now);
    try { localStorage.setItem('hospitalNotificationsSeen', String(now)); } catch { /* storage unavailable */ }
  };

  const handleSignOut = async () => {
    await signOut('hospital'); // other accounts on this browser stay signed in
    navigate('/login');
  };

  const navItems: { id: NavItem; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'requests', label: 'Blood Requests', icon: 'emergency' },
    { id: 'inventory', label: 'Inventory', icon: 'bloodtype' },
    { id: 'reviews', label: 'Reviews', icon: 'reviews' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  const hospitalName = profile?.hospital_name || user?.hospital_name || user?.name || 'Your hospital';
  const goTo = (tab: NavItem) => { setActiveTab(tab); setMenuOpen(false); };
  const initials = hospitalName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#f8f6f6] overflow-hidden">
      {/* Phones and tablets: the sidebar slides in over the page */}
      {menuOpen && <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col overflow-y-auto transition-transform duration-200 lg:static lg:translate-x-0',
        menuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      )}>
        <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="lg:hidden absolute top-4 right-4 w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100">
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="p-8 pb-4">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-[#ee2b2b] rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white">add_business</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-none">LifeLink AI</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Hospital Portal</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => goTo(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all relative group',
                  activeTab === item.id ? 'bg-[#ee2b2b]/5 text-[#ee2b2b]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                {activeTab === item.id && (
                  <motion.div layoutId="sidebar-active" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#ee2b2b] rounded-full" />
                )}
                <span className={cn('material-symbols-outlined text-xl transition-colors', activeTab === item.id ? 'text-[#ee2b2b]' : 'text-slate-400 group-hover:text-slate-600')}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 pt-4 space-y-3">
          <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-slate-900">
            <h4 className="text-xs font-black uppercase tracking-widest text-[#ee2b2b] mb-2">Facility</h4>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#ee2b2b] text-white flex items-center justify-center text-xs font-black">{initials}</div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold truncate w-32">{hospitalName}</p>
                <p className={cn('text-[9px] font-black uppercase', profile?.is_verified ? 'text-green-600' : 'text-amber-600')}>
                  {profile ? (profile.is_verified ? 'Verified' : 'Pending verification') : '…'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-[#ee2b2b] transition-all"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <header className="h-16 lg:h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="lg:hidden w-10 h-10 shrink-0 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h1 className="text-lg lg:text-xl font-black text-slate-900 truncate">{navItems.find((n) => n.id === activeTab)?.label}</h1>
            {hasActive && (
              <>
                <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block"></div>
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  {requests.filter((r) => ACTIVE.includes(r.status)).length} active request(s)
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all relative"
                aria-label="Notifications"
              >
                <span className="material-symbols-outlined text-lg">notifications</span>
                {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ee2b2b] rounded-full ring-2 ring-white"></span>}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-12 w-[calc(100vw-2rem)] max-w-80 bg-white rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden z-30"
                  >
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-black text-xs text-slate-800 uppercase tracking-widest">Notifications</h3>
                      <button onClick={markAllRead} className="text-[10px] text-[#ee2b2b] font-black hover:underline uppercase tracking-tight">Mark All Read</button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {events.length === 0 ? (
                        <p className="p-6 text-center text-xs text-slate-400 font-bold">No notifications yet.</p>
                      ) : events.map(n => (
                        <div key={n.id} className="p-4 border-b border-slate-50 flex gap-3">
                          <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', Date.parse(n.at!) > seenAt ? 'bg-[#ee2b2b]' : 'bg-slate-200')}></div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">{n.title}</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                            <span className="text-[9px] text-slate-400 font-bold block mt-1">{formatWhen(n.at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setScanning(true)}
              aria-label="Scan donor pass"
              className="bg-[#ee2b2b] text-white h-10 px-3 sm:px-4 rounded-xl text-xs font-black hover:bg-red-700 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
              <span className="hidden sm:inline">SCAN PASS</span>
            </button>
            <button
              onClick={() => goTo('requests')}
              aria-label="New blood request"
              className="bg-[#ee2b2b] text-white h-10 px-3 sm:px-5 rounded-xl text-xs font-black shadow-lg shadow-[#ee2b2b]/20 hover:scale-105 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">emergency</span>
              <span className="hidden sm:inline">NEW REQUEST</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar space-y-6">
          {profile && !profile.is_verified && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4">
              <span className="material-symbols-outlined text-amber-600">pending</span>
              <div className="text-sm text-amber-900">
                <p className="font-black">Your hospital is awaiting verification</p>
                <p className="mt-1">A LifeLink admin checks your registration details before your requests can alert donors. You can explore the dashboard and update inventory meanwhile.</p>
              </div>
            </div>
          )}
          {loadError && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-800">{loadError}</div>}
          {networkError && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">{networkError} Requests are still saved; live progress will return shortly.</div>}

          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {isLoading && requests.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 border border-slate-100 text-center text-slate-400 font-bold">Loading your dashboard…</div>
              ) : (
                <>
                  {activeTab === 'overview' && <OverviewTab requests={requests} inventory={inventory} donations={donations} onGoToRequests={() => setActiveTab('requests')} />}
                  {activeTab === 'requests' && <RequestsTab requests={requests} verified={!!profile?.is_verified} onRefresh={loadRequests} locations={locations} hospitalPoint={hospitalPoint} verifiedAt={verifiedAt} onScan={() => setScanning(true)} />}
                  {activeTab === 'inventory' && <InventoryTab inventory={inventory} onRefresh={fetchData} />}
                  {activeTab === 'reviews' && <HospitalReviews />}
                  {activeTab === 'settings' && <SettingsTab user={user} profile={profile} />}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Floating AI Chat */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#ee2b2b] text-white rounded-full shadow-2xl shadow-[#ee2b2b]/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
        aria-label="Open AI assistant"
      >
        <span className="material-symbols-outlined">psychology</span>
      </button>
      <AgentChat
        isOpen={showChat}
        context="hospital"
        onClose={() => setShowChat(false)}
        onAction={(actionName) => {
          if (actionName === 'create_emergency_request') {
            loadRequests().catch(() => { });
            setActiveTab('requests');
          }
        }}
      />
      {scanning && (
        <Suspense fallback={null}>
          <PassScanner onCode={onPassScanned} onClose={() => setScanning(false)} />
        </Suspense>
      )}
      {passResult && (
        <PassResultModal
          result={passResult}
          verifiedAt={passResult.donor ? verifiedAt[passResult.donor.match_id] : undefined}
          onClose={() => setPassResult(null)}
          onRefresh={loadRequests}
        />
      )}
    </div>
  );
}


// ─────────────────── DONOR PASS CHECK ───────────────────
interface PassCheck { code: string; request?: HospitalRequest; donor?: LiveDonor }

const VERIFIED_KEY = 'lifelink.verifiedPasses';
const readVerified = (): Record<number, string> => {
  try { return JSON.parse(sessionStorage.getItem(VERIFIED_KEY) || '{}'); } catch { return {}; }
};

/** The outcome of scanning (or typing) a donor's pass at the gate. */
function PassResultModal({ result, verifiedAt, onClose, onRefresh }: { result: PassCheck; verifiedAt?: string; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const { donor, request } = result;

  const recordDonation = async () => {
    if (!donor?.donated_url) return;
    setBusy(true);
    try {
      const res = await fetch(`${donor.donated_url}&format=json`);
      const body = await res.json();
      setOutcome({ ok: res.ok, text: `${body.title}. ${body.message}` });
    } catch {
      setOutcome({ ok: false, text: 'The donor network could not be reached. Please try again.' });
    } finally {
      setBusy(false);
      onRefresh().catch(() => { });
    }
  };

  const tone = !donor ? 'border-red-500' : donor.status === 'accepted' ? 'border-green-500' : 'border-amber-500';
  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Donor pass">
      <div className={cn('bg-white rounded-2xl w-full max-w-md shadow-2xl border-t-8 p-6 space-y-4', tone)}>
        {!donor ? (
          <>
            <h3 className="text-xl font-black text-red-700 flex items-center gap-2"><span className="material-symbols-outlined">gpp_bad</span>Not a pass for your hospital</h3>
            <p className="text-sm text-slate-600">No donor who said YES to your requests has pass <span className="font-mono font-bold">{result.code}</span>. Check the ID, or ask the donor to open their LifeLink confirmation again.</p>
          </>
        ) : (
          <>
            <h3 className={cn('text-xl font-black flex items-center gap-2', donor.status === 'accepted' ? 'text-green-700' : 'text-amber-700')}>
              <span className="material-symbols-outlined">{donor.status === 'accepted' ? 'verified_user' : 'info'}</span>
              {donor.status === 'accepted' ? 'Pass verified' : donor.status === 'donated' ? 'Pass already used' : 'Marked as not coming'}
            </h3>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-1 text-sm">
              <p className="text-lg font-black text-slate-900">{donor.name} <span className="text-[#ee2b2b]">{donor.blood_group}</span></p>
              {request && <p className="text-slate-600">For request #{request.id}: {request.units_required} unit(s) of {request.blood_group}{request.patient_ref ? ` · ${request.patient_ref}` : ''}</p>}
              {donor.phone && <p className="text-slate-600">Phone: <a href={`tel:${donor.phone}`} className="font-bold text-slate-900 underline">{donor.phone}</a></p>}
              <p className="font-mono text-xs text-slate-500">{result.code}{verifiedAt ? ` · checked ${formatWhen(verifiedAt)}` : ''}</p>
            </div>
            {donor.status === 'accepted' && <p className="text-sm text-slate-600">Check a photo ID with this name before the donation.</p>}
            {donor.status === 'donated' && <p className="text-sm text-slate-600">This donor's donation is already recorded.</p>}
            {donor.status === 'no_show' && <p className="text-sm text-slate-600">This donor was marked as not coming, so the next donors were alerted. If they are here now, thank them and check whether the blood is still needed.</p>}
          </>
        )}
        {outcome && <p className={cn('rounded-xl p-3 text-sm font-medium border', outcome.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800')}>{outcome.text}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {donor?.status === 'accepted' && donor.donated_url && !outcome?.ok && (
            <button onClick={recordDonation} disabled={busy} className="px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-black hover:bg-green-700 disabled:opacity-50">
              {busy ? 'Saving…' : 'Donation done'}
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── OVERVIEW TAB ───────────────────
function OverviewTab({ requests, inventory, donations, onGoToRequests }: { requests: HospitalRequest[]; inventory: any[]; donations: any[]; onGoToRequests: () => void }) {
  const { data: network, error: networkLoadError } = useNetworkAnalytics();
  const active = requests.filter((r) => ACTIVE.includes(r.status));
  const onTheWay = active.reduce((sum, r) => sum + Math.max(0, (r.live?.units_confirmed ?? 0) - (r.live?.units_donated ?? 0)), 0);
  const totalUnits = inventory.reduce((sum, i) => sum + (i.units || 0), 0);
  const lowStock = BLOOD_TYPES.filter((t) => (inventory.find((i) => i.blood_group === t)?.units ?? 0) < 20);
  const noEligible = network ? BLOOD_TYPES.filter((g) => (network.donor_pool.by_blood_group[g]?.eligible_now ?? 0) === 0) : [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Requests', value: active.length, icon: 'emergency', color: '#ee2b2b', note: `${active.filter((r) => r.urgency === 'Emergency').length} emergency` },
          { label: 'Donors on the Way', value: onTheWay, icon: 'directions_run', color: '#3b82f6', note: 'Confirmed, not yet donated' },
          { label: 'Units in Stock', value: totalUnits, icon: 'bloodtype', color: lowStock.length ? '#ef4444' : '#10b981', note: lowStock.length ? `Low: ${lowStock.join(', ')}` : 'All groups above 20 units' },
          { label: 'Donations Recorded', value: donations.length, icon: 'volunteer_activism', color: '#f59e0b', note: 'Through LifeLink' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-3xl font-black text-slate-900 mt-1">{stat.value}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: stat.color }}>
                <span className="material-symbols-outlined text-xl">{stat.icon}</span>
              </div>
            </div>
            <p className="text-[10px] font-bold text-slate-500">{stat.note}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900">Active Requests</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Live from the donor network</p>
              </div>
              <button onClick={onGoToRequests} className="text-[10px] font-black text-[#ee2b2b] hover:underline uppercase tracking-tight">View All</button>
            </div>
            <div className="space-y-4">
              {active.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-bold">No active requests. Use "NEW REQUEST" to alert donors.</div>
              ) : active.slice(0, 4).map((req) => (
                <div key={req.id} className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-slate-50/30">
                  <div className="flex items-center gap-5">
                    <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg', req.urgency === 'Emergency' ? 'bg-[#ee2b2b] text-white' : 'bg-red-50 border border-red-100 text-[#ee2b2b]')}>
                      <span className="text-sm font-black">{req.blood_group}</span>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900">Request #{req.id}{req.patient_ref ? ` · ${req.patient_ref}` : ''}</h4>
                      <p className="text-[11px] font-bold text-slate-500 mt-1">
                        {req.live ? `${req.live.units_confirmed} of ${req.units_required} units confirmed · ${req.live.donors_alerted} donors alerted` : `${req.units_required} units · ${req.urgency}`}
                      </p>
                    </div>
                  </div>
                  <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded', STATUS_META[req.status]?.tone)}>{STATUS_META[req.status]?.label ?? req.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-3xl p-8 text-slate-900">
            <span className="text-[10px] font-black text-[#ee2b2b] uppercase tracking-[0.2em] bg-white border border-red-100 px-3 py-1.5 rounded-full inline-block mb-4">Donor Network Now</span>
            {!network ? (
              <p className="text-sm text-slate-600">{networkLoadError ? 'Live network figures are unavailable right now.' : 'Loading live network figures…'}</p>
            ) : (
              <>
                <h3 className="text-2xl font-black leading-tight mb-2">{network.donor_pool.eligible_now} donors eligible to donate right now</h3>
                <p className="text-sm text-slate-600 mb-6">
                  {noEligible.length
                    ? `No eligible donors at the moment for ${noEligible.join(', ')}. Compatible groups can still cover these, but plan ahead for patients who need them.`
                    : 'Every blood group has at least one eligible donor on the network.'}
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {BLOOD_TYPES.map((g) => (
                    <div key={g} className="bg-white border border-red-100 rounded-xl p-3 text-center">
                      <p className="text-xs font-black text-[#ee2b2b]">{g}</p>
                      <p className="text-lg font-black">{network.donor_pool.by_blood_group[g]?.eligible_now ?? 0}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm h-fit">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-[#ee2b2b] text-lg">bloodtype</span>
            Stock Health
          </h4>
          {inventory.length === 0 ? (
            <p className="text-sm text-slate-400">No stock recorded yet. Add units in the Inventory tab.</p>
          ) : (
            <div className="space-y-4">
              {BLOOD_TYPES.map((type) => {
                const units = inventory.find(i => i.blood_group === type)?.units || 0;
                const pct = Math.min((units / 200) * 100, 100);
                const color = units < 20 ? 'bg-red-500' : units < 60 ? 'bg-yellow-400' : 'bg-green-400';
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-black uppercase">
                      <span>{type}</span>
                      <span>{units} units</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className={cn('h-full rounded-full', color)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────── REQUESTS TAB ───────────────────
function RequestsTab({ requests, verified, onRefresh, locations, hospitalPoint, verifiedAt, onScan }: {
  requests: HospitalRequest[]; verified: boolean; onRefresh: () => Promise<void>;
  locations: DonorLocation[]; hospitalPoint: (Point & { name: string }) | null; verifiedAt: Record<number, string>; onScan: () => void;
}) {
  const emptyForm = { blood_group: 'O+', units_required: '1', urgency: 'Urgent', patient_ref: '', required_by: '' };
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DispatchSummary | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const summary: DispatchSummary = await apiFetch('/hospital/requests', {
        method: 'POST',
        body: JSON.stringify({
          blood_group: form.blood_group,
          units_required: Number(form.units_required),
          urgency: form.urgency,
          ...(form.patient_ref.trim() ? { patient_ref: form.patient_ref.trim() } : {}),
          ...(form.required_by ? { required_by: new Date(form.required_by).toISOString() } : {}),
        }),
      });
      setResult(summary);
      setShowForm(false);
      setForm(emptyForm);
      setOpenId(summary.request.id);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'The request could not be created.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">Request Blood</h2>
            <p className="text-sm text-slate-500 mt-1">Compatible, eligible donors near your hospital are alerted within seconds. If nobody answers, more are alerted automatically.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={!verified}
            title={verified ? '' : 'Available once your hospital is verified'}
            className="bg-[#ee2b2b] text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg shadow-[#ee2b2b]/20 hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-40 disabled:hover:scale-100 shrink-0"
          >
            <span className="material-symbols-outlined text-sm">{showForm ? 'close' : 'add'}</span>
            {showForm ? 'Cancel' : 'New Request'}
          </button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleSubmit}
              className="border-t border-slate-100 p-8 space-y-6"
            >
              {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold border border-red-100">{error}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="space-y-2 block">
                  <span className="text-sm font-black text-slate-700">Blood group needed</span>
                  <select
                    value={form.blood_group}
                    onChange={e => setForm(p => ({ ...p, blood_group: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] outline-none"
                  >
                    {BLOOD_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm font-black text-slate-700">Units required (1–20)</span>
                  <input
                    type="number" required min="1" max="20"
                    value={form.units_required}
                    onChange={e => setForm(p => ({ ...p, units_required: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] outline-none"
                  />
                </label>
                <div className="space-y-2 md:col-span-2">
                  <span className="text-sm font-black text-slate-700">Urgency</span>
                  <div className="grid grid-cols-3 gap-3">
                    {URGENCIES.map(u => (
                      <button
                        key={u.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, urgency: u.value }))}
                        className={cn(
                          'py-3 px-2 rounded-xl text-xs font-black border-2 transition-all text-center',
                          form.urgency === u.value
                            ? u.value === 'Emergency' ? 'border-[#ee2b2b] bg-[#ee2b2b] text-white' : 'border-[#ee2b2b] bg-red-50 text-[#ee2b2b]'
                            : 'border-slate-200 text-slate-500 hover:border-slate-400'
                        )}
                      >
                        {u.label}
                        <span className="block text-[10px] font-bold opacity-70 mt-0.5">{u.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <label className="space-y-2 block">
                  <span className="text-sm font-black text-slate-700">Patient reference <span className="font-bold text-slate-400">(optional)</span></span>
                  <input
                    maxLength={40}
                    value={form.patient_ref}
                    onChange={e => setForm(p => ({ ...p, patient_ref: e.target.value }))}
                    placeholder="e.g. ICU Bed 7. Never the patient's name."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] outline-none"
                  />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm font-black text-slate-700">Needed by <span className="font-bold text-slate-400">(optional)</span></span>
                  <input
                    type="datetime-local"
                    value={form.required_by}
                    onChange={e => setForm(p => ({ ...p, required_by: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] outline-none"
                  />
                  <span className="text-[11px] text-slate-400">Within 2 hours, donors are re-alerted every 10 minutes.</span>
                </label>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#ee2b2b] text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-[#ee2b2b]/20 hover:bg-[#ee2b2b]/90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">emergency</span>}
                {isSubmitting ? 'Alerting donors…' : 'Alert Donors'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {result && <DispatchResultCard summary={result} onClose={() => setResult(null)} />}

      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
            <span className="material-symbols-outlined text-5xl text-slate-200 mb-4 block">emergency_share</span>
            <p className="text-slate-400 font-bold">No blood requests yet.</p>
          </div>
        ) : requests.map((req) => (
          <RequestCard
            key={req.id} req={req} open={openId === req.id} onToggle={() => setOpenId(openId === req.id ? null : req.id)} onRefresh={onRefresh}
            locations={locations.filter((l) => l.request_id === req.id)} hospitalPoint={hospitalPoint} verifiedAt={verifiedAt} onScan={onScan}
          />
        ))}
      </div>
    </div>
  );
}

function DispatchResultCard({ summary, onClose }: { summary: DispatchSummary; onClose: () => void }) {
  const { network, warning, request } = summary;
  const noDonors = network?.status === 'no_compatible_donors';
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-3xl p-6 border', warning || noDonors ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200')}>
      <div className="flex justify-between items-start gap-4">
        <div className="text-sm">
          <p className="font-black text-slate-900 text-base">
            {warning ? `Request #${request.id} saved` : noDonors ? `Request #${request.id}: no compatible donors available right now` : `Request #${request.id} sent to the donor network`}
          </p>
          {network && !noDonors && (
            <p className="text-slate-700 mt-1">
              {network.compatible_donors} compatible donors found · <strong>{network.donors_alerted} alerted now</strong> · {network.donors_on_standby} on standby
              {network.escalation_minutes ? ` · more alerted every ${network.escalation_minutes} min until covered` : ''}
            </p>
          )}
          {noDonors && (
            <p className="text-slate-700 mt-1">
              Contact your regional blood bank now, and check stock on{' '}
              <a href={EMERGENCY.bloodBankSearchUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline">e-RaktKosh</a>.
            </p>
          )}
          {warning && <p className="text-amber-900 mt-1">{warning}</p>}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      {request.tracking_token && <FamilyLink token={request.tracking_token} />}
    </motion.div>
  );
}

function FamilyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = familyLink(token);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked; the link is visible to copy by hand */ }
  };
  return (
    <div className="mt-5 bg-white rounded-2xl p-4 border border-slate-100 flex flex-col sm:flex-row items-center gap-4">
      <QRCodeSVG value={url} size={88} />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-black text-slate-900">Tracking link for the patient's family</p>
        <p className="text-slate-500 text-xs mt-0.5">Shows progress only, never donor names or numbers. Share it by message or let them scan the code.</p>
        <p className="font-mono text-xs text-slate-700 mt-2 truncate">{url}</p>
      </div>
      <button onClick={copy} className="px-4 py-2 rounded-xl bg-[#ee2b2b] text-white text-xs font-black hover:bg-red-700 shrink-0">
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}

function RequestCard({ req, open, onToggle, onRefresh, locations, hospitalPoint, verifiedAt, onScan }: {
  req: HospitalRequest; open: boolean; onToggle: () => void; onRefresh: () => Promise<void>;
  locations: DonorLocation[]; hospitalPoint: (Point & { name: string }) | null; verifiedAt: Record<number, string>; onScan: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const live = req.live;
  const meta = STATUS_META[req.status] ?? { label: req.status, tone: 'bg-slate-100 text-slate-600' };
  const pct = live ? Math.min(100, Math.round((live.units_confirmed / Math.max(1, req.units_required)) * 100)) : 0;
  const closed = ['Completed', 'Cancelled'].includes(req.status);
  // Requests on the network are cancelled through its own link, which also tells
  // every alerted donor to stand down; requests that never reached it close here
  const neverSent = !req.tracking_token && !live;
  const canCancel = !closed && (!!live?.cancel_url || neverSent);
  const networkDown = !closed && !!req.tracking_token && !live;
  const onTheWay = (live?.donors ?? []).filter((d) => d.status === 'accepted');
  const locationOf = (matchId: number) => locations.find((l) => l.match_id === matchId);
  const located = onTheWay.filter((d) => locationOf(d.match_id));

  // The same one-tap links the network sends to hospital staff; format=json returns the outcome
  const act = async (key: string, url: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    try {
      const res = await fetch(`${url}&format=json`);
      const outcome = await res.json();
      setNotice({ ok: res.ok, text: `${outcome.title}. ${outcome.message}` });
    } catch {
      setNotice({ ok: false, text: 'The donor network could not be reached. Please try again.' });
    } finally {
      setBusy(null);
      await onRefresh().catch(() => { });
    }
  };

  const cancelRequest = async () => {
    const question = `Cancel request #${req.id}?${live ? ' Every donor alerted for it will be told they are no longer needed.' : ''}`;
    if (live?.cancel_url) return act('cancel', live.cancel_url, question);
    if (!window.confirm(question)) return;
    setBusy('cancel');
    try {
      await apiFetch(`/hospital/requests/${req.id}/cancel`, { method: 'PUT', body: JSON.stringify({}) });
      setNotice({ ok: true, text: 'Request cancelled.' });
    } catch (err: any) {
      setNotice({ ok: false, text: err.message || 'Could not cancel the request.' });
    } finally {
      setBusy(null);
      await onRefresh().catch(() => { });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <button onClick={onToggle} className="w-full p-6 flex items-center justify-between gap-4 text-left">
        <div className="flex items-center gap-5 min-w-0">
          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0', req.urgency === 'Emergency' ? 'bg-[#ee2b2b] text-white' : 'bg-red-50 border border-red-100 text-[#ee2b2b]')}>
            <span className="text-sm font-black">{req.blood_group}</span>
          </div>
          <div className="min-w-0">
            <h4 className="font-black text-slate-900">Request #{req.id}{req.patient_ref ? ` · ${req.patient_ref}` : ''}</h4>
            <p className="text-xs text-slate-500 mt-1">
              {req.units_required} unit(s) · {req.urgency} · {formatWhen(req.created_at)}
              {req.required_by ? ` · needed by ${formatWhen(req.required_by)}` : ''}
            </p>
            {live && (
              <div className="mt-2 flex items-center gap-3">
                <div className="w-40 h-2 bg-red-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#ee2b2b] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-bold text-slate-600">{live.units_confirmed}/{req.units_required} confirmed · {live.units_donated} donated</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn('text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full', meta.tone)}>{meta.label}</span>
          <span className="material-symbols-outlined text-slate-400">{open ? 'expand_less' : 'expand_more'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-6 space-y-5">
          {notice && (
            <div className={cn('rounded-xl p-3 text-sm font-medium border', notice.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800')}>{notice.text}</div>
          )}

          {(canCancel || networkDown) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs text-slate-500">
                {canCancel ? 'Got the blood elsewhere, or no longer needed? Cancel so no more donors are alerted.' : 'The donor network is unreachable right now, so this request cannot be cancelled yet. Try again shortly.'}
              </p>
              {canCancel && (
                <button
                  disabled={!!busy}
                  onClick={cancelRequest}
                  className="shrink-0 px-4 py-2 rounded-lg border border-red-200 bg-white text-xs font-black text-[#ee2b2b] hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  {busy === 'cancel' ? 'Cancelling…' : 'Cancel request'}
                </button>
              )}
            </div>
          )}

          {!live ? (
            <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-4 border border-amber-200">
              {req.network_error ?? 'Live progress is not available for this request.'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ['Compatible donors', live.compatible_donors],
                  ['Alerted', live.donors_alerted],
                  ['On standby', live.donors_on_standby],
                  ['No reply', live.donors_no_reply],
                  ['Declined', live.donors_declined],
                ].map(([label, value]) => (
                  <div key={label as string} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xl font-black text-slate-900">{value}</p>
                    <p className="text-[11px] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              {live.next_check_at && (
                <p className="text-xs text-slate-500">If still short, the next donors are alerted at {formatWhen(live.next_check_at)}.</p>
              )}
              {req.status === 'Exhausted' && (
                <p className="text-sm text-red-800 bg-red-50 rounded-xl p-4 border border-red-200">
                  Every compatible donor in range has been asked. Contact your regional blood bank, and check stock on{' '}
                  <a href={EMERGENCY.bloodBankSearchUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline">e-RaktKosh</a>.
                </p>
              )}

              {located.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-black text-slate-900">Donors on the way</h5>
                  <Suspense fallback={<div className="h-[260px] rounded-xl bg-slate-100 animate-pulse" />}>
                    <DonorMap
                      hospital={hospitalPoint}
                      donors={located.map((d) => ({ id: d.match_id, label: `${d.name} · ${d.blood_group}`, latitude: locationOf(d.match_id)!.latitude, longitude: locationOf(d.match_id)!.longitude }))}
                    />
                  </Suspense>
                  <p className="text-[11px] text-slate-500">Only donors who chose to share their location appear. Positions refresh every 20 seconds.</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h5 className="text-sm font-black text-slate-900">Confirmed donors</h5>
                  {onTheWay.length > 0 && (
                    <button onClick={onScan} className="px-3 py-1.5 rounded-lg bg-[#ee2b2b] text-white text-xs font-black hover:bg-red-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">qr_code_scanner</span> Scan pass
                    </button>
                  )}
                </div>
                {live.donors.length === 0 ? (
                  <p className="text-sm text-slate-400">No donor has confirmed yet. You'll see them here as soon as they tap YES.</p>
                ) : (
                  <div className="space-y-3">
                    {live.donors.map((d) => (
                      <div key={d.match_id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <div>
                          <p className="font-black text-slate-900">
                            {d.name} <span className="text-[#ee2b2b]">{d.blood_group}</span>
                            {d.distance_km != null && <span className="text-xs font-bold text-slate-400"> · {d.distance_km} km away</span>}
                          </p>
                          <p className="text-xs text-slate-500">
                            {d.status === 'donated' ? 'Donated' : d.status === 'no_show' ? 'Did not come' : 'On the way'}
                            {d.responded_at ? ` · accepted ${formatWhen(d.responded_at)}` : ''}
                          </p>
                          {d.pass_code && (
                            <p className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                              <span className="font-mono">Pass {d.pass_code}</span>
                              {verifiedAt[d.match_id] && (
                                <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 font-black uppercase text-[10px]">Pass checked {formatWhen(verifiedAt[d.match_id])}</span>
                              )}
                            </p>
                          )}
                          {d.status === 'accepted' && (() => {
                            const loc = locationOf(d.match_id);
                            if (!loc) return <p className="text-[11px] text-slate-400 mt-1">Live location not shared</p>;
                            const km = hospitalPoint ? distanceKm(loc, hospitalPoint) : null;
                            return (
                              <p className="text-xs font-bold text-blue-700 mt-1 flex flex-wrap items-center gap-1">
                                <span className="material-symbols-outlined text-sm">near_me</span>
                                {km != null ? `${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} away · about ${etaMinutes(km)} min · ` : ''}updated {agoText(loc.updated_at)}
                                <a href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`} target="_blank" rel="noopener noreferrer" className="underline ml-1">open map</a>
                              </p>
                            );
                          })()}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {d.phone && (
                            <a href={`tel:${d.phone}`} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-100 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">call</span>{d.phone}
                            </a>
                          )}
                          {d.donated_url && (
                            <button disabled={!!busy} onClick={() => act(`d${d.match_id}`, d.donated_url!)} className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-black hover:bg-green-700 disabled:opacity-50">
                              {busy === `d${d.match_id}` ? 'Saving…' : 'Donation done'}
                            </button>
                          )}
                          {d.no_show_url && (
                            <button disabled={!!busy} onClick={() => act(`n${d.match_id}`, d.no_show_url!, `Mark ${d.name} as a no-show? The next donors will be alerted.`)} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                              {busy === `n${d.match_id}` ? 'Saving…' : "Didn't come"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </>
          )}

          {req.tracking_token && <FamilyLink token={req.tracking_token} />}
        </div>
      )}
    </div>
  );
}

// ─────────────────── INVENTORY TAB ───────────────────
function InventoryTab({ inventory, onRefresh }: { inventory: any[]; onRefresh: () => void }) {
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const getUnits = (type: string) => inventory.find(i => i.blood_group === type)?.units ?? 0;

  const getStatus = (units: number) => {
    if (units === 0) return { label: 'Empty', color: 'bg-red-100 text-red-600' };
    if (units < 20) return { label: 'Critical', color: 'bg-red-100 text-red-600' };
    if (units < 60) return { label: 'Low', color: 'bg-yellow-100 text-yellow-600' };
    return { label: 'Healthy', color: 'bg-green-100 text-green-600' };
  };

  const handleSave = async (type: string) => {
    setIsSaving(true);
    try {
      await apiFetch('/hospital/inventory', { method: 'PUT', body: JSON.stringify({ blood_group: type, units: parseInt(editValue, 10) }) });
      setMessage({ ok: true, text: `${type} updated to ${editValue} units` });
      setEditingType(null);
      onRefresh();
    } catch (err: any) {
      setMessage({ ok: false, text: `Could not save ${type}: ${err.message || 'server error'}` });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={cn('p-4 rounded-xl font-bold border', message.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
          {message.text}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {BLOOD_TYPES.map((type) => {
          const units = getUnits(type);
          const status = getStatus(units);
          const isEditing = editingType === type;
          return (
            <div key={type} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group border-b-4 border-b-transparent hover:border-b-[#ee2b2b]">
              <div className="flex justify-between items-center mb-6">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 font-black text-xl group-hover:bg-[#ee2b2b] group-hover:text-white transition-colors">
                  {type}
                </div>
                <span className={cn('text-[9px] font-black uppercase px-2 py-1 rounded-full', status.color)}>{status.label}</span>
              </div>
              <div className="space-y-1 mb-4">
                <p className="text-xs font-bold text-slate-400">Units in stock</p>
                {isEditing ? (
                  <input
                    type="number" min="0"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="text-2xl font-black text-slate-900 w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[#ee2b2b]"
                    autoFocus
                  />
                ) : (
                  <h4 className="text-3xl font-black text-slate-900">{units}</h4>
                )}
              </div>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button onClick={() => handleSave(type)} disabled={isSaving} className="flex-1 py-2 bg-[#ee2b2b] text-white text-xs font-black rounded-lg hover:bg-[#ee2b2b]/90 transition-all disabled:opacity-60">
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditingType(null)} className="py-2 px-3 bg-slate-100 text-slate-500 text-xs font-black rounded-lg hover:bg-slate-200 transition-all">✕</button>
                  </>
                ) : (
                  <button
                    onClick={() => { setEditingType(type); setEditValue(String(units)); }}
                    className="w-full py-2 text-xs font-black text-slate-400 hover:text-[#ee2b2b] border border-slate-100 hover:border-[#ee2b2b] rounded-lg transition-all"
                  >
                    Update Units
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────── SETTINGS TAB ───────────────────
function SettingsTab({ user, profile }: { user: any; profile: HospitalProfile | null }) {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-100 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 mb-6">Hospital Account</h3>
        <div className="space-y-1">
          {[
            ['Hospital', profile?.hospital_name],
            ['Type', profile?.hospital_type],
            ['Registration / licence no.', profile?.registration_number],
            ['Address', profile ? [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ') : ''],
            ['Exact location', profile ? (profile.has_location ? 'Shared (donors ranked by distance)' : 'Not shared (donors matched by city)') : ''],
            ['Contact number', profile?.contact_number],
            ['Signed in as', user?.email],
            ['Verification', profile ? (profile.is_verified ? 'Verified by LifeLink' : 'Awaiting admin verification') : ''],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-3 border-b border-slate-50 last:border-0">
              <span className="text-sm font-bold text-slate-500">{label}</span>
              <span className="text-sm font-black text-slate-900 sm:text-right wrap-break-word">{value || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm text-sm text-slate-600 space-y-3">
        <h3 className="text-lg font-black text-slate-900">How your requests reach donors</h3>
        <p>Each request is matched against ABO/Rh-compatible donors who are past their rest period, nearest first. Donors are alerted by SMS, WhatsApp or in the app, and reply with one tap.</p>
        <p>When a donor confirms, you see their first name and phone number here to coordinate. Use their details only for this donation, as our <a href="/terms" className="font-bold text-[#ee2b2b] hover:underline">Terms</a> require.</p>
        <p>Your contact number above also gets an SMS when a donor confirms or withdraws, so staff away from the dashboard still know.</p>
      </div>
    </div>
  );
}
