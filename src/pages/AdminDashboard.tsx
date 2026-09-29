import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../lib/utils';
import { apiFetch } from '../lib/api';
import { signOut } from '../lib/auth';
import { NetworkAnalytics, formatMinutes, useNetworkAnalytics } from '../lib/network';
import Analytics from './Analytics';

const BLOOD_TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

interface Overview {
  donors: number;
  hospitals: number;
  hospitals_verified: number;
  requests: number;
  requests_active: number;
  requests_completed: number;
  requests_exhausted: number;
  requests_not_dispatched: number;
  donations: number;
  donations_30d: number;
  network_configured: boolean;
}

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const { data: network } = useNetworkAnalytics();

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await apiFetch('/admin/overview'));
      setOverviewError('');
    } catch (err: any) {
      setOverviewError(err.message || 'Could not load the overview.');
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (location.pathname.includes('/hospitals')) setActiveTab('hospitals');
    else if (location.pathname.includes('/donors')) setActiveTab('donors');
    else if (location.pathname.includes('/analytics')) setActiveTab('analytics');
    else if (location.pathname.includes('/settings')) setActiveTab('settings');
    else setActiveTab('overview');
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { id: 'overview', label: 'Network Health', icon: 'dashboard' },
    { id: 'hospitals', label: 'Hospitals', icon: 'local_hospital' },
    { id: 'donors', label: 'Donors', icon: 'group' },
    { id: 'analytics', label: 'Analytics', icon: 'monitoring' },
    { id: 'settings', label: 'Settings', icon: 'settings_suggest' },
  ];

  // Things an admin should act on, from real data
  const shortages = network ? BLOOD_TYPES.filter((g) => (network.donor_pool.by_blood_group[g]?.eligible_now ?? 0) === 0) : [];
  const pendingHospitals = overview ? overview.hospitals - overview.hospitals_verified : 0;
  const notifications = [
    pendingHospitals > 0 && { id: 'pending', title: `${pendingHospitals} hospital(s) awaiting verification`, msg: 'They cannot alert donors until you verify them.', tab: 'hospitals' },
    overview && overview.requests_not_dispatched > 0 && { id: 'dispatch', title: `${overview.requests_not_dispatched} request(s) never reached the network`, msg: 'The donor network was unreachable or rejected them when they were raised.', tab: 'overview' },
    overview && !overview.network_configured && { id: 'network', title: 'Donor network not configured', msg: 'Set N8N_WEBHOOK_KEY on the backend so requests can alert donors.', tab: 'settings' },
    shortages.length > 0 && { id: 'shortage', title: `No eligible donors for ${shortages.join(', ')}`, msg: 'Consider a donor recruitment drive for these groups.', tab: 'analytics' },
  ].filter(Boolean) as { id: string; title: string; msg: string; tab: string }[];

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const [hospitals] = await Promise.all([apiFetch('/admin/hospitals').catch(() => [])]);
      exportReport(overview, network, hospitals);
    } finally {
      setIsExporting(false);
    }
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'Administrator';

  return (
    <div className="flex min-h-screen bg-[#f8f6f6] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col z-30">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white">shield</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-none">LifeLink AI</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Admin Control</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all relative group',
                  activeTab === item.id ? 'bg-slate-900 shadow-lg shadow-slate-200 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                {activeTab === item.id && (
                  <motion.div layoutId="admin-sidebar-active" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#ee2b2b] rounded-full" />
                )}
                <span className={cn('material-symbols-outlined text-xl transition-colors', activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600')}>
                  {item.icon}
                </span>
                {item.label}
                {item.id === 'hospitals' && pendingHospitals > 0 && (
                  <span className="ml-auto text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pendingHospitals}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 pt-4 space-y-3">
          <div className="bg-slate-100 rounded-2xl p-5 border border-slate-200 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Signed in</h4>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-[10px] font-black">{displayName.slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold truncate w-32">{displayName}</p>
                <p className="text-[9px] text-[#ee2b2b] font-black uppercase tracking-tighter">Administrator</p>
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20 shrink-0">
          <h1 className="text-xl font-black text-slate-900">{navItems.find((n) => n.id === activeTab)?.label}</h1>

          <div className="flex items-center gap-4 relative">
            {showSearch && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 240, opacity: 1 }} className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search hospitals and donors…"
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-xs focus:ring-2 focus:ring-[#ee2b2b]/20 transition-all outline-none"
                />
              </motion.div>
            )}

            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-all relative', showNotifications ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                aria-label="Notifications"
              >
                <span className="material-symbols-outlined text-lg">notifications</span>
                {notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-[#ee2b2b] rounded-full border-2 border-white"></span>}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100">
                      <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest">Needs attention</h4>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-6 text-center text-xs text-slate-400 font-bold">Nothing needs attention right now.</p>
                      ) : notifications.map(n => (
                        <button key={n.id} onClick={() => { setActiveTab(n.tab); setShowNotifications(false); }} className="w-full text-left p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                          <p className="font-bold text-slate-900 text-xs">{n.title}</p>
                          <p className="text-[10px] text-slate-500 font-medium mt-1">{n.msg}</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setShowSearch(!showSearch)}
              className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-all', showSearch ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
              aria-label="Search"
            >
              <span className="material-symbols-outlined text-lg">search</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting || !overview}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#ee2b2b] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#ee2b2b]/90 shadow-lg shadow-[#ee2b2b]/10 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">{isExporting ? 'sync' : 'description'}</span>
              <span>Report</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="max-w-7xl mx-auto w-full"
            >
              {overviewError && activeTab === 'overview' && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{overviewError}</div>
              )}
              {activeTab === 'overview' && <OverviewView overview={overview} network={network} onGo={setActiveTab} />}
              {activeTab === 'hospitals' && <HospitalsView initialSearch={searchQuery} onChange={loadOverview} />}
              {activeTab === 'donors' && <DonorsView initialSearch={searchQuery} />}
              {activeTab === 'analytics' && <div className="-m-8"><Analytics /></div>}
              {activeTab === 'settings' && <SettingsView user={user} overview={overview} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

/** PDF report built only from real figures at the moment of export. */
function exportReport(overview: Overview | null, network: NetworkAnalytics | null, hospitals: any[]) {
  const doc = new jsPDF();
  const generated = new Date().toLocaleString('en-IN');

  doc.setFillColor(238, 43, 43);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('LifeLink AI', 20, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Network Report', 20, 30);
  doc.text(`Generated: ${generated}`, 130, 20);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Website accounts and requests', 20, 55);
  autoTable(doc, {
    startY: 60,
    head: [['Metric', 'Value']],
    body: overview ? [
      ['Registered donors', String(overview.donors)],
      ['Hospitals (verified / total)', `${overview.hospitals_verified} / ${overview.hospitals}`],
      ['Blood requests (active / total)', `${overview.requests_active} / ${overview.requests}`],
      ['Requests completed', String(overview.requests_completed)],
      ['Requests with no donors left', String(overview.requests_exhausted)],
      ['Donations recorded (last 30 days / total)', `${overview.donations_30d} / ${overview.donations}`],
    ] : [['Unavailable', '']],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] },
    margin: { left: 20, right: 20 },
  });

  let y = (doc as any).lastAutoTable.finalY + 15;
  doc.text('Donor network (all channels)', 20, y);
  autoTable(doc, {
    startY: y + 5,
    head: [['Blood group', 'Eligible now', 'Registered']],
    body: network ? BLOOD_TYPES.map((g) => [g, String(network.donor_pool.by_blood_group[g]?.eligible_now ?? 0), String(network.donor_pool.by_blood_group[g]?.registered ?? 0)]) : [['Unavailable', '', '']],
    headStyles: { fillColor: [238, 43, 43] },
    margin: { left: 20, right: 20 },
  });
  if (network) {
    y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Requests covered: ${network.requests.covered_pct ?? '-'}%   Median time to first donor: ${formatMinutes(network.requests.median_minutes_to_first_donor)}   Response rate: ${network.responses.response_rate_pct ?? '-'}%`, 20, y);
  }

  y = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Hospitals', 20, y);
  autoTable(doc, {
    startY: y + 5,
    head: [['Hospital', 'City', 'Registration no.', 'Verified']],
    body: hospitals.length ? hospitals.map((h: any) => [h.hospital_name, h.city || '', h.registration_number || '', h.is_verified ? 'Yes' : 'No']) : [['None registered', '', '', '']],
    headStyles: { fillColor: [15, 23, 42] },
    margin: { left: 20, right: 20 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Figures from the LifeLink database and donor network at the time of export. Contains business contact details: share only with authorised staff.', 20, 280);
    doc.text(`Page ${i} of ${pageCount}`, 180, 287);
  }
  doc.save(`LifeLink-Network-Report-${new Date().toISOString().split('T')[0]}.pdf`);
}

function OverviewView({ overview, network, onGo }: { overview: Overview | null; network: NetworkAnalytics | null; onGo: (tab: string) => void }) {
  const kpis = [
    { label: 'Registered donors', value: overview?.donors, icon: 'group', tone: 'bg-blue-50 text-blue-600', note: network ? `${network.donor_pool.registered} on the donor network incl. SMS/USSD` : '' },
    { label: 'Verified hospitals', value: overview ? `${overview.hospitals_verified} / ${overview.hospitals}` : undefined, icon: 'local_hospital', tone: 'bg-green-50 text-green-600', note: overview && overview.hospitals > overview.hospitals_verified ? `${overview.hospitals - overview.hospitals_verified} awaiting verification` : 'None pending' },
    { label: 'Active requests', value: overview?.requests_active, icon: 'emergency', tone: 'bg-red-50 text-[#ee2b2b]', note: overview ? `${overview.requests} raised in total` : '' },
    { label: 'Donations (30 days)', value: overview?.donations_30d, icon: 'volunteer_activism', tone: 'bg-amber-50 text-amber-600', note: overview ? `${overview.donations} recorded in total` : '' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${k.tone}`}>
              <span className="material-symbols-outlined">{k.icon}</span>
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{k.label}</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{k.value ?? '–'}</h3>
            {k.note && <p className="text-[11px] font-bold text-slate-500 mt-1">{k.note}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h4 className="font-black text-slate-900 mb-1">Request outcomes</h4>
          <p className="text-xs text-slate-500 mb-6">Requests raised from hospital dashboards</p>
          {overview && overview.requests > 0 ? (
            <div className="space-y-4">
              {([
                ['Active (finding donors or donors on the way)', overview.requests_active, 'bg-amber-400'],
                ['Completed (blood donated)', overview.requests_completed, 'bg-green-500'],
                ['No donors left', overview.requests_exhausted, 'bg-red-500'],
                ['Never reached the network', overview.requests_not_dispatched, 'bg-slate-400'],
              ] as [string, number, string][]).map(([label, value, color]) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-bold text-slate-900">{value}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / overview.requests) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{overview ? 'No requests have been raised yet.' : 'Loading…'}</p>
          )}
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 text-white">
          <p className="text-[10px] font-black text-[#ee2b2b] uppercase tracking-[0.2em] mb-3">Donor network now</p>
          {network ? (
            <>
              <p className="text-3xl font-black">{network.donor_pool.eligible_now}</p>
              <p className="text-sm text-slate-400 mb-4">donors eligible to donate right now</p>
              <div className="grid grid-cols-4 gap-2">
                {BLOOD_TYPES.map((g) => (
                  <div key={g} className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-[10px] font-black text-slate-400">{g}</p>
                    <p className="font-black">{network.donor_pool.by_blood_group[g]?.eligible_now ?? 0}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => onGo('analytics')} className="mt-4 text-xs font-black text-[#ee2b2b] hover:underline">Full analytics →</button>
            </>
          ) : (
            <p className="text-sm text-slate-400">Loading…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function HospitalsView({ initialSearch = '', onChange }: { initialSearch?: string; onChange?: () => void }) {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [localSearch, setLocalSearch] = useState(initialSearch);

  useEffect(() => {
    setLocalSearch(initialSearch);
  }, [initialSearch]);

  const load = async () => {
    setLoading(true);
    try {
      setHospitals(await apiFetch('/admin/hospitals'));
      setError('');
    } catch (err: any) {
      setError(err.message || 'Could not load hospitals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Only verified hospitals can raise requests that alert donors
  const setVerified = async (h: any, verified: boolean) => {
    const question = verified
      ? `Verify ${h.hospital_name}? Its requests will start alerting real donors. Confirm you have checked registration number "${h.registration_number || 'not provided'}".`
      : `Revoke verification for ${h.hospital_name}? It will no longer be able to alert donors.`;
    if (!window.confirm(question)) return;
    setBusyId(h.id);
    try {
      await apiFetch(`/admin/hospitals/${h.id}/verification`, { method: 'PUT', body: JSON.stringify({ verified }) });
      await load();
      onChange?.();
    } catch (err: any) {
      setError(err.message || 'Could not update verification.');
    } finally {
      setBusyId(null);
    }
  };

  const q = localSearch.toLowerCase();
  const filtered = hospitals.filter(h =>
    [h.hospital_name, h.city, h.registration_number, h.email].some(v => String(v ?? '').toLowerCase().includes(q))
  );
  const pending = hospitals.filter(h => !h.is_verified).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Hospital Verification</h3>
          <p className="text-xs text-slate-500 mt-1">{hospitals.length} registered · {pending} awaiting verification</p>
        </div>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search name, city, registration no…"
            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs w-72 focus:ring-2 focus:ring-[#ee2b2b]/20 transition-all outline-none"
          />
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
        Before verifying, check the registration number against the state's Clinical Establishments register or the hospital's blood centre licence, and confirm the contact details with the hospital. Only verified hospitals can alert donors.
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-400">Loading hospitals…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-400">
          {hospitals.length === 0 ? 'No hospitals have registered yet.' : 'No hospitals match your search.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((h) => (
            <div key={h.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-slate-900">{h.hospital_name}</h4>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${h.is_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {h.is_verified ? 'Verified' : 'Pending'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {h.city || '—'} · {h.contact_number || 'no phone'} · {h.email}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registration no.: <span className="font-bold text-slate-700">{h.registration_number || 'not provided'}</span>
                  {h.created_at ? ` · registered ${new Date(h.created_at).toLocaleDateString('en-IN')}` : ''}
                </p>
              </div>
              <button
                disabled={busyId === h.id}
                onClick={() => setVerified(h, !h.is_verified)}
                className={`px-4 py-2 rounded-lg text-xs font-bold shrink-0 disabled:opacity-50 ${h.is_verified ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
              >
                {busyId === h.id ? 'Saving…' : h.is_verified ? 'Revoke' : 'Verify'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DonorsView({ initialSearch = '' }: { initialSearch?: string }) {
  const [donors, setDonors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialSearch);
  const [group, setGroup] = useState('');

  useEffect(() => { setSearch(initialSearch); }, [initialSearch]);
  useEffect(() => {
    apiFetch('/admin/donors')
      .then((rows) => setDonors(rows))
      .catch((err) => setError(err.message || 'Could not load donors.'))
      .finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();
  const filtered = donors.filter((d) =>
    (!group || d.blood_group === group) &&
    [d.name, d.email, d.city, d.phone].some((v) => String(v ?? '').toLowerCase().includes(q))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Donors</h3>
          <p className="text-xs text-slate-500 mt-1">
            {donors.length} registered on the website. Donors who joined by SMS or USSD appear in the network analytics only.
          </p>
        </div>
        <div className="flex gap-2">
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none">
            <option value="">All groups</option>
            {BLOOD_TYPES.map((g) => <option key={g}>{g}</option>)}
          </select>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, city, phone…"
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs w-64 focus:ring-2 focus:ring-[#ee2b2b]/20 outline-none"
            />
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100">
              {['Donor', 'Group', 'City', 'Phone', 'Last donation', 'Donations', 'Joined'].map((h) => <th key={h} className="px-4 py-3 font-black">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading donors…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">{donors.length ? 'No donors match.' : 'No donors have registered yet.'}</td></tr>
            ) : filtered.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3">
                  <p className="font-bold text-slate-900">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.email}</p>
                </td>
                <td className="px-4 py-3 font-black text-[#ee2b2b]">{d.blood_group || '–'}</td>
                <td className="px-4 py-3 text-slate-600">{d.city || '–'}</td>
                <td className="px-4 py-3 text-slate-600">{d.phone || '–'}</td>
                <td className="px-4 py-3 text-slate-600">{d.last_donation_date ? new Date(d.last_donation_date).toLocaleDateString('en-IN') : '–'}</td>
                <td className="px-4 py-3 font-bold text-slate-900">{d.donations}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(d.created_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsView({ user, overview }: { user: any; overview: Overview | null }) {
  const [health, setHealth] = useState<{ status: string; database: { reachable: boolean; target?: string; error_code?: string } } | null>(null);

  useEffect(() => {
    apiFetch('/health').then(setHealth).catch(() => setHealth({ status: 'error', database: { reachable: false } }));
  }, []);

  const rows: [string, React.ReactNode, boolean | null][] = [
    ['Database', health ? (health.database.reachable ? `Connected (${health.database.target})` : `Unreachable${health.database.error_code ? ` (${health.database.error_code})` : ''}`) : 'Checking…', health ? health.database.reachable : null],
    ['Donor network (n8n)', overview ? (overview.network_configured ? 'Configured' : 'N8N_WEBHOOK_KEY is not set') : 'Checking…', overview ? overview.network_configured : null],
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-lg font-black text-slate-900 mb-4">Your account</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500 font-bold">Name</span><span className="font-black text-slate-900">{user?.name ?? '–'}</span></div>
          <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500 font-bold">Email</span><span className="font-black text-slate-900">{user?.email ?? '–'}</span></div>
          <div className="flex justify-between py-2"><span className="text-slate-500 font-bold">Role</span><span className="font-black text-slate-900">Administrator</span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-lg font-black text-slate-900 mb-4">System status</h3>
        <div className="space-y-3">
          {rows.map(([label, value, ok]) => (
            <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span className="text-sm font-bold text-slate-700">{label}</span>
              <span className={cn('text-sm font-black flex items-center gap-2', ok === null ? 'text-slate-400' : ok ? 'text-green-700' : 'text-red-700')}>
                <span className={cn('w-2 h-2 rounded-full', ok === null ? 'bg-slate-300' : ok ? 'bg-green-500' : 'bg-red-500')} />
                {value}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-4">Secrets such as API keys live in the Vercel project settings and the n8n credential store, never in this dashboard.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-600 space-y-2">
        <h3 className="text-lg font-black text-slate-900">Matching rules in force</h3>
        <p>ABO/Rh red-cell compatibility; donors within 80 km or in the hospital's city; rest period of 90 days for men and 120 for women; O- kept for patients who need it.</p>
        <p>Escalation: Emergency every 10 minutes, Urgent every 20, Normal every 60 (10 minutes when blood is needed within 2 hours). Requests stop escalating after 12 hours.</p>
      </div>
    </div>
  );
}
