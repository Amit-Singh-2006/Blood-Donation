import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../lib/utils';
import { apiFetch } from '../lib/api';
import { signOut } from '../lib/auth';
import { NetworkAnalytics, RequestStatus, fetchRequestStatus, formatMinutes, useNetworkAnalytics } from '../lib/network';
import Analytics from './Analytics';
import { INDIAN_STATES } from '../lib/india';

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
  jurisdiction?: string;
}

interface AdminMe {
  id: number;
  name: string;
  email: string;
  is_national: boolean;
  jurisdiction: string;
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
  const [me, setMe] = useState<AdminMe | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: network, error: networkError } = useNetworkAnalytics();

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
    apiFetch('/admin/me').then(setMe).catch(() => setMe(null));
  }, [loadOverview]);

  useEffect(() => {
    if (location.pathname.includes('/hospitals')) setActiveTab('hospitals');
    else if (location.pathname.includes('/requests')) setActiveTab('requests');
    else if (location.pathname.includes('/donors')) setActiveTab('donors');
    else if (location.pathname.includes('/analytics')) setActiveTab('analytics');
    else if (location.pathname.includes('/settings')) setActiveTab('settings');
    else if (location.pathname.includes('/admins')) setActiveTab('admins');
    else setActiveTab('overview');
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { id: 'overview', label: 'Network Health', icon: 'dashboard' },
    { id: 'hospitals', label: 'Hospitals', icon: 'local_hospital' },
    { id: 'requests', label: 'Requests', icon: 'emergency' },
    { id: 'donors', label: 'Donors', icon: 'group' },
    { id: 'analytics', label: 'Analytics', icon: 'monitoring' },
    ...(me?.is_national ? [{ id: 'admins', label: 'Admins', icon: 'manage_accounts' }] : []),
    { id: 'settings', label: 'Settings', icon: 'settings_suggest' },
  ];

  // Things an admin should act on, from real data
  const shortages = network ? BLOOD_TYPES.filter((g) => (network.donor_pool.by_blood_group[g]?.eligible_now ?? 0) === 0) : [];
  const pendingHospitals = overview ? overview.hospitals - overview.hospitals_verified : 0;
  const notifications = [
    pendingHospitals > 0 && { id: 'pending', title: `${pendingHospitals} hospital(s) awaiting verification`, msg: 'They cannot alert donors until you verify them.', tab: 'hospitals' },
    overview && overview.requests_not_dispatched > 0 && { id: 'dispatch', title: `${overview.requests_not_dispatched} request(s) never reached the network`, msg: 'The donor network was unreachable or rejected them when they were raised.', tab: 'requests' },
    overview && !overview.network_configured && { id: 'network', title: 'Donor network not configured', msg: 'Set N8N_WEBHOOK_KEY on the backend so requests can alert donors.', tab: 'settings' },
    shortages.length > 0 && { id: 'shortage', title: `No eligible donors for ${shortages.join(', ')}`, msg: 'Consider a donor recruitment drive for these groups.', tab: 'analytics' },
  ].filter(Boolean) as { id: string; title: string; msg: string; tab: string }[];

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const [hospitals] = await Promise.all([apiFetch('/admin/hospitals').catch(() => [])]);
      exportReport(overview, network, hospitals, me?.jurisdiction);
    } finally {
      setIsExporting(false);
    }
  };

  const displayName = me?.name || user?.name || user?.email?.split('@')[0] || 'Administrator';
  const goTo = (tab: string) => { setActiveTab(tab); setMenuOpen(false); };

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
                onClick={() => goTo(item.id)}
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
                <p className="text-[9px] text-[#ee2b2b] font-black uppercase tracking-wider">{me?.is_national ? 'National admin' : 'City admin'}</p>
              </div>
            </div>
            {me && <p className="text-[11px] text-slate-600 mt-3 flex items-start gap-1"><span className="material-symbols-outlined text-sm">location_on</span>{me.jurisdiction}</p>}
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
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <header className="h-16 lg:h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="lg:hidden w-10 h-10 shrink-0 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-lg lg:text-xl font-black text-slate-900 truncate">{navItems.find((n) => n.id === activeTab)?.label}</h1>
              {me && <p className="text-[11px] font-bold text-slate-500 truncate">Jurisdiction: {me.jurisdiction}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 relative shrink-0">
            {showSearch && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute right-0 top-12 w-64 sm:static sm:w-60 z-30">
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
                    className="absolute right-0 mt-3 w-[calc(100vw-2rem)] max-w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100">
                      <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest">Needs attention</h4>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-6 text-center text-xs text-slate-400 font-bold">Nothing needs attention right now.</p>
                      ) : notifications.map(n => (
                        <button key={n.id} onClick={() => { goTo(n.tab); setShowNotifications(false); }} className="w-full text-left p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
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
              aria-label="Download PDF report"
              className="flex items-center gap-2 h-10 px-3 sm:px-4 bg-[#ee2b2b] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#ee2b2b]/90 shadow-lg shadow-[#ee2b2b]/10 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">{isExporting ? 'sync' : 'description'}</span>
              <span className="hidden sm:inline">Report</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
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
              {activeTab === 'overview' && <OverviewView overview={overview} network={network} networkError={networkError} isNational={!!me?.is_national} onGo={goTo} />}
              {activeTab === 'hospitals' && <HospitalsView initialSearch={searchQuery} onChange={loadOverview} />}
              {activeTab === 'requests' && <RequestsView initialSearch={searchQuery} />}
              {activeTab === 'donors' && <DonorsView initialSearch={searchQuery} />}
              {activeTab === 'analytics' && <div className="-m-4 sm:-m-6 lg:-m-8"><Analytics /></div>}
              {activeTab === 'admins' && me?.is_national && <AdminsView meId={me.id} />}
              {activeTab === 'settings' && <SettingsView user={user} overview={overview} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

/** PDF report built only from real figures at the moment of export. */
function exportReport(overview: Overview | null, network: NetworkAnalytics | null, hospitals: any[], jurisdiction?: string) {
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
  doc.text(`Network Report${jurisdiction ? ` · ${jurisdiction}` : ''}`, 20, 30);
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
    head: [['Hospital', 'City', 'State', 'Registration no.', 'Verified']],
    body: hospitals.length ? hospitals.map((h: any) => [h.hospital_name, h.city || '', h.state || '', h.registration_number || '', h.is_verified ? 'Yes' : 'No']) : [['None registered', '', '', '', '']],
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

const STATUS_BADGE: Record<string, [string, string]> = {
  Open: ['Finding donors', 'bg-amber-100 text-amber-800'],
  Fulfilled: ['Donors on the way', 'bg-blue-100 text-blue-800'],
  Completed: ['Completed', 'bg-green-100 text-green-800'],
  Exhausted: ['No donors left', 'bg-red-100 text-red-800'],
  Cancelled: ['Cancelled', 'bg-slate-200 text-slate-700'],
};

const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** A request's badge: never-sent requests are flagged before anything else. */
const requestBadge = (r: any, liveStatus?: string): [string, string] => {
  if (!r.dispatched && r.network_error) return ['Not sent to donors', 'bg-red-600 text-white'];
  const status = liveStatus ?? r.status;
  return STATUS_BADGE[status] ?? [status, 'bg-slate-100 text-slate-600'];
};

const urgencyTone = (urgency: string) => urgency === 'Emergency' ? 'bg-[#ee2b2b]' : urgency === 'Urgent' ? 'bg-amber-500' : 'bg-slate-800';

function RecentRequestRow({ r }: { r: any }) {
  const [label, tone] = requestBadge(r);
  return (
    <div className="flex items-center gap-3 py-3">
      <span className={cn('w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-xs font-black text-white', urgencyTone(r.urgency))}>{r.blood_group}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900 truncate">{r.hospital_name}</p>
        <p className="text-xs text-slate-500 truncate">{r.units_required} unit(s) · {r.urgency} · {r.city} · {timeAgo(r.created_at)}</p>
      </div>
      <span className={cn('shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black uppercase', tone)}>{label}</span>
    </div>
  );
}

function OverviewView({ overview, network, networkError, isNational, onGo }: {
  overview: Overview | null;
  network: NetworkAnalytics | null;
  networkError: string;
  isNational: boolean;
  onGo: (tab: string) => void;
}) {
  const [recent, setRecent] = useState<any[] | null>(null);
  const [pending, setPending] = useState<any[] | null>(null);

  useEffect(() => {
    apiFetch('/admin/requests?limit=6').then(setRecent).catch(() => setRecent([]));
    apiFetch('/admin/hospitals').then((rows: any[]) => setPending(rows.filter((h) => !h.is_verified))).catch(() => setPending([]));
  }, []);

  const shortages = network ? BLOOD_TYPES.filter((g) => (network.donor_pool.by_blood_group[g]?.eligible_now ?? 0) === 0) : [];
  const tasks = [
    ...(pending ?? []).slice(0, 3).map((h) => ({
      key: `h${h.id}`, icon: 'local_hospital', title: `Verify ${h.hospital_name}`,
      text: `${[h.city, h.state].filter(Boolean).join(', ')} · registration no. ${h.registration_number || 'not given'}`,
      action: 'Review', tab: 'hospitals',
    })),
    (pending?.length ?? 0) > 3 && { key: 'more', icon: 'more_horiz', title: `${pending!.length - 3} more hospitals awaiting verification`, text: 'Only verified hospitals can alert donors.', action: 'Open', tab: 'hospitals' },
    overview && overview.requests_not_dispatched > 0 && { key: 'dispatch', icon: 'error', title: `${overview.requests_not_dispatched} request(s) never reached donors`, text: 'The donor network was unreachable when they were raised. Contact the hospital.', action: 'See requests', tab: 'requests' },
    overview && !overview.network_configured && { key: 'net', icon: 'cloud_off', title: 'Donor network not connected', text: 'Set N8N_WEBHOOK_KEY on the backend so requests can alert donors.', action: 'Settings', tab: 'settings' },
    isNational && shortages.length > 0 && { key: 'short', icon: 'bloodtype', title: `No eligible donors right now for ${shortages.join(', ')}`, text: 'Requests for these groups rely on compatible groups. A recruitment drive would help.', action: 'Analytics', tab: 'analytics' },
  ].filter(Boolean) as { key: string; icon: string; title: string; text: string; action: string; tab: string }[];

  const kpis = [
    isNational
      ? { label: 'Donors on the network', value: network?.donor_pool.registered ?? overview?.donors, icon: 'group', tone: 'bg-blue-50 text-blue-600', note: overview ? `${overview.donors} signed up on the website${network ? ` · ${network.donor_pool.eligible_now} eligible now` : ''}` : '' }
      : { label: 'Donors in your cities', value: overview?.donors, icon: 'group', tone: 'bg-blue-50 text-blue-600', note: 'Signed up on the website' },
    { label: 'Verified hospitals', value: overview ? `${overview.hospitals_verified} / ${overview.hospitals}` : undefined, icon: 'local_hospital', tone: 'bg-green-50 text-green-600', note: overview && overview.hospitals > overview.hospitals_verified ? `${overview.hospitals - overview.hospitals_verified} awaiting verification` : 'None pending' },
    { label: 'Active requests', value: overview?.requests_active, icon: 'emergency', tone: 'bg-red-50 text-[#ee2b2b]', note: overview ? `${overview.requests} raised in total` : '' },
    { label: 'Donations (30 days)', value: overview?.donations_30d, icon: 'volunteer_activism', tone: 'bg-amber-50 text-amber-600', note: overview ? `${overview.donations} recorded in total` : '' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 lg:p-6 border border-slate-200 shadow-sm">
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
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl p-5 lg:p-6 border border-slate-200 shadow-sm">
            <h4 className="font-black text-slate-900 mb-1">Needs your attention</h4>
            <p className="text-xs text-slate-500 mb-4">Things only an admin can move forward</p>
            {pending === null ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : tasks.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-100 text-sm text-green-900">
                <span className="material-symbols-outlined">task_alt</span>
                All clear. New hospital registrations and delivery problems will appear here.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tasks.map((t) => (
                  <div key={t.key} className="flex items-center gap-3 py-3">
                    <span className="w-9 h-9 shrink-0 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">{t.icon}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{t.title}</p>
                      {t.text && <p className="text-xs text-slate-500">{t.text}</p>}
                    </div>
                    <button onClick={() => onGo(t.tab)} className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800">{t.action}</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl p-5 lg:p-6 border border-slate-200 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h4 className="font-black text-slate-900">Recent blood requests</h4>
                <p className="text-xs text-slate-500">Raised by hospitals {isNational ? 'across India' : 'in your cities'}</p>
              </div>
              <button onClick={() => onGo('requests')} className="text-xs font-black text-[#ee2b2b] hover:underline shrink-0">View all →</button>
            </div>
            {recent === null ? (
              <p className="text-sm text-slate-400 py-4">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">No requests yet. Hospitals raise them from their dashboard once you have verified them.</p>
            ) : (
              <div className="divide-y divide-slate-100">{recent.map((r) => <RecentRequestRow key={r.id} r={r} />)}</div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-slate-900 rounded-2xl p-6 text-white">
            <p className="text-[10px] font-black text-[#ee2b2b] uppercase tracking-[0.2em] mb-3">{isNational ? 'Donor network now' : 'Whole donor network now'}</p>
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
              <p className="text-sm text-slate-400">{networkError ? 'Live network figures are unavailable right now.' : 'Loading live network figures…'}</p>
            )}
          </section>

          <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h4 className="font-black text-slate-900 mb-4">Request outcomes</h4>
            {overview && overview.requests > 0 ? (
              <div className="space-y-4">
                {([
                  ['Active', overview.requests_active, 'bg-amber-400'],
                  ['Completed', overview.requests_completed, 'bg-green-500'],
                  ['No donors left', overview.requests_exhausted, 'bg-red-500'],
                  ['Never reached donors', overview.requests_not_dispatched, 'bg-slate-400'],
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
              <p className="text-sm text-slate-400">{overview ? 'No requests yet.' : 'Loading…'}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const REQUEST_FILTERS: [string, string, (r: any) => boolean][] = [
  ['all', 'All', () => true],
  ['active', 'Active', (r) => ['Open', 'Fulfilled'].includes(r.status)],
  ['completed', 'Completed', (r) => r.status === 'Completed'],
  ['exhausted', 'No donors left', (r) => r.status === 'Exhausted'],
  ['cancelled', 'Cancelled', (r) => r.status === 'Cancelled'],
  ['failed', 'Not sent', (r) => !r.dispatched && !!r.network_error],
];

/** Every request in the admin's jurisdiction; active ones show live progress from the network. */
function RequestsView({ initialSearch = '' }: { initialSearch?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [live, setLive] = useState<Record<number, RequestStatus | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => { setSearch(initialSearch); }, [initialSearch]);
  useEffect(() => {
    apiFetch('/admin/requests?limit=500')
      .then((data: any[]) => {
        setRows(data);
        // Stored statuses only change when the hospital opens its dashboard, so
        // ask the network directly for requests that may still be moving
        data.filter((r) => ['Open', 'Fulfilled'].includes(r.status) && r.tracking_token).slice(0, 15).forEach((r) => {
          fetchRequestStatus(r.tracking_token).then((s) => setLive((m) => ({ ...m, [r.id]: s }))).catch(() => { });
        });
      })
      .catch((err) => setError(err.message || 'Could not load requests.'))
      .finally(() => setLoading(false));
  }, []);

  // Live status wins over the stored one when we have it
  const withLive = rows.map((r) => (live[r.id] ? { ...r, status: live[r.id]!.status } : r));
  const q = search.toLowerCase();
  const matchFilter = REQUEST_FILTERS.find(([id]) => id === filter)![2];
  const filtered = withLive.filter((r) => matchFilter(r) && [r.hospital_name, r.city, r.state, r.blood_group, r.patient_ref].some((v) => String(v ?? '').toLowerCase().includes(q)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Blood requests</h3>
          <p className="text-xs text-slate-500 mt-1">{rows.length} raised by hospitals in your jurisdiction. Active requests show live progress.</p>
        </div>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hospital, city, blood group…"
            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs w-full md:w-72 focus:ring-2 focus:ring-[#ee2b2b]/20 outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {REQUEST_FILTERS.map(([id, label, fn]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={cn('px-3 py-1.5 rounded-full text-xs font-bold border', filter === id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}
          >
            {label} <span className="opacity-60">{withLive.filter(fn).length}</span>
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-400">Loading requests…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-400">
          {rows.length === 0 ? 'No blood requests yet. Verified hospitals raise them from their dashboard.' : 'No requests match.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const status = live[r.id];
            const [label, tone] = requestBadge(r, status?.status);
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <span className={cn('w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-sm font-black text-white', urgencyTone(r.urgency))}>{r.blood_group}</span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-extrabold text-slate-900">{r.hospital_name} <span className="font-medium text-slate-500">· {[r.city, r.state].filter(Boolean).join(', ')}</span></p>
                  <p className="text-xs text-slate-500">
                    #{r.id} · {r.units_required} unit(s) · {r.urgency}{r.patient_ref ? ` · ${r.patient_ref}` : ''} · raised {new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    {r.required_by ? ` · needed by ${new Date(r.required_by).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                  </p>
                  {status && <p className="text-xs font-bold text-slate-700">{status.units_confirmed} of {status.units_required} unit(s) confirmed · {status.donors_alerted} donors alerted · {status.donors_on_standby} on standby</p>}
                  {!r.dispatched && r.network_error && <p className="text-xs font-bold text-red-700">{r.network_error}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-black uppercase', tone)}>{label}</span>
                  {r.tracking_token && (
                    <a href={`/track/${r.tracking_token}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">Track</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
    [h.hospital_name, h.city, h.state, h.pincode, h.registration_number, h.email].some(v => String(v ?? '').toLowerCase().includes(q))
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
            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs w-full md:w-72 focus:ring-2 focus:ring-[#ee2b2b]/20 transition-all outline-none"
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
                  {[h.hospital_type, h.address, h.city, h.state, h.pincode].filter(Boolean).join(', ') || '—'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {h.contact_number || 'no phone'} · {h.email}
                  {h.latitude != null && h.longitude != null && (
                    <> · <a className="font-bold text-[#ee2b2b] hover:underline" href={`https://www.google.com/maps?q=${h.latitude},${h.longitude}`} target="_blank" rel="noreferrer">map</a></>
                  )}
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

const inviteInput = 'w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  used: 'bg-emerald-100 text-emerald-700',
  revoked: 'bg-slate-100 text-slate-500',
  expired: 'bg-slate-100 text-slate-500',
};

/** National admins invite city admins (one person, one jurisdiction, one use) and can remove access. */
function AdminsView({ meId }: { meId?: number }) {
  const [admins, setAdmins] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', national: false, state: '', cities: '', validDays: 7 });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [issued, setIssued] = useState<{ code: string; invite: any } | null>(null);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    try {
      const [a, i] = await Promise.all([apiFetch('/admin/admins'), apiFetch('/admin/invites')]);
      setAdmins(a);
      setInvites(i);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Could not load admins.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const cities = form.cities.split(',').map((c) => c.trim()).filter(Boolean);
    if (!form.national && (!form.state || cities.length === 0)) {
      setFormError('Choose the state and at least one city this admin will look after.');
      return;
    }
    setCreating(true);
    try {
      const result = await apiFetch('/admin/invites', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          is_national: form.national,
          ...(form.national ? {} : { state: form.state, cities }),
          valid_days: form.validDays,
        }),
      });
      setIssued(result);
      setCopied('');
      setForm({ name: '', email: '', national: false, state: '', cities: '', validDays: 7 });
      load();
    } catch (err: any) {
      setFormError(err.message || 'Could not create the invite.');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (invite: any) => {
    if (!window.confirm(`Cancel the invite for ${invite.name}? The code will stop working.`)) return;
    try {
      await apiFetch(`/admin/invites/${invite.id}/revoke`, { method: 'PUT', body: JSON.stringify({}) });
      load();
    } catch (err: any) {
      setError(err.message || 'Could not cancel the invite.');
    }
  };

  const toggleAdmin = async (admin: any) => {
    const question = admin.active
      ? `Remove admin access for ${admin.name}? They will be signed out of the admin dashboard straight away.`
      : `Restore admin access for ${admin.name} (${admin.jurisdiction})?`;
    if (!window.confirm(question)) return;
    try {
      await apiFetch(`/admin/admins/${admin.id}/active`, { method: 'PUT', body: JSON.stringify({ active: !admin.active }) });
      load();
    } catch (err: any) {
      setError(err.message || 'Could not update access.');
    }
  };

  const link = issued ? `${window.location.origin}/register-admin?code=${encodeURIComponent(issued.code)}` : '';
  const expires = issued ? new Date(issued.invite.expires_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const message = issued
    ? `Hello ${issued.invite.name},\n\nYou are invited to be a LifeLink admin for ${issued.invite.jurisdiction}.\n\n1. Open ${link}\n2. Press "Check code" (your code is ${issued.code})\n3. Create your account with ${issued.invite.email}\n\nThe invite works once and expires on ${expires}. Please do not forward it.`
    : '';
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied('');
      window.prompt('Copy this:', text);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800">Admins and jurisdictions</h3>
        <p className="text-xs text-slate-500 mt-1">Each city admin verifies hospitals and sees donors only in their own cities. Invites are for one named person and work once.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <form onSubmit={createInvite} className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h4 className="font-black text-slate-900 flex items-center gap-2"><span className="material-symbols-outlined">person_add</span>Invite an admin</h4>
          <div className="space-y-1">
            <label htmlFor="inv-name" className="text-xs font-bold text-slate-600">Full name</label>
            <input id="inv-name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inviteInput} placeholder="e.g. Rahul Verma" />
          </div>
          <div className="space-y-1">
            <label htmlFor="inv-email" className="text-xs font-bold text-slate-600">Email (the invite only works with this address)</label>
            <input id="inv-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inviteInput} placeholder="rahul@example.com" />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-slate-600">Jurisdiction</legend>
            <div className="grid grid-cols-2 gap-2">
              {[[false, 'City admin'], [true, 'National (All India)']].map(([value, label]) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={form.national === value}
                  onClick={() => setForm({ ...form, national: value as boolean })}
                  className={cn('py-2 rounded-lg text-xs font-bold border-2', form.national === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600')}
                >
                  {label as string}
                </button>
              ))}
            </div>
          </fieldset>
          {form.national ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">A national admin sees every hospital and donor, and can invite and remove other admins.</p>
          ) : (
            <>
              <div className="space-y-1">
                <label htmlFor="inv-state" className="text-xs font-bold text-slate-600">State / UT</label>
                <select id="inv-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={inviteInput}>
                  <option value="">Select</option>
                  {INDIAN_STATES.map((st) => <option key={st}>{st}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="inv-cities" className="text-xs font-bold text-slate-600">Cities (comma-separated)</label>
                <input id="inv-cities" value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} className={inviteInput} placeholder="e.g. Pune, Pimpri-Chinchwad" />
                <p className="text-[11px] text-slate-500">Matched to the city hospitals and donors enter. Add other spellings too, e.g. Bengaluru, Bangalore.</p>
              </div>
            </>
          )}
          <div className="space-y-1">
            <label htmlFor="inv-days" className="text-xs font-bold text-slate-600">Invite valid for</label>
            <select id="inv-days" value={form.validDays} onChange={(e) => setForm({ ...form, validDays: Number(e.target.value) })} className={inviteInput}>
              {[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}
            </select>
          </div>
          {formError && <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">{formError}</p>}
          <button type="submit" disabled={creating} className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 disabled:opacity-50">
            {creating ? 'Creating…' : 'Create invite'}
          </button>
        </form>

        <div className="xl:col-span-3 space-y-6">
          {issued && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-emerald-900">Invite created for {issued.invite.name}</p>
                  <p className="text-xs text-emerald-800">{issued.invite.email} · {issued.invite.jurisdiction} · expires {expires}</p>
                </div>
                <button onClick={() => setIssued(null)} aria-label="Close" className="text-emerald-700 hover:text-emerald-900"><span className="material-symbols-outlined">close</span></button>
              </div>
              <p className="font-mono text-xl sm:text-2xl font-black tracking-wider text-slate-900 bg-white rounded-xl border border-emerald-200 px-4 py-3 break-all">{issued.code}</p>
              <p className="text-xs text-emerald-900"><strong>This code is shown only once.</strong> Share it privately with {issued.invite.name}, for example by phone or a direct message.</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copy('code', issued.code)} className="px-3 py-2 rounded-lg bg-white border border-emerald-200 text-xs font-bold text-emerald-800 hover:bg-emerald-100">
                  {copied === 'code' ? 'Copied ✓' : 'Copy code'}
                </button>
                <button onClick={() => copy('message', message)} className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800">
                  {copied === 'message' ? 'Copied ✓' : 'Copy invite message'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h4 className="font-black text-slate-900 mb-4">Invites</h4>
            {loading ? <p className="text-sm text-slate-400">Loading…</p> : invites.length === 0 ? (
              <p className="text-sm text-slate-400">No invites yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {invites.map((i) => (
                  <div key={i.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm">{i.name} <span className="font-normal text-slate-500">· {i.email}</span></p>
                      <p className="text-xs text-slate-500">
                        {i.jurisdiction} · code …{i.code_hint} · {i.status === 'used' ? `used${i.used_by ? ` by ${i.used_by}` : ''}` : `expires ${new Date(i.expires_at).toLocaleDateString('en-IN')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-black uppercase', STATUS_STYLE[i.status])}>{i.status}</span>
                      {i.status === 'pending' && (
                        <button onClick={() => revoke(i)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h4 className="font-black text-slate-900 mb-4">Admins</h4>
            {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
              <div className="divide-y divide-slate-100">
                {admins.map((a) => (
                  <div key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                        {a.name}
                        {a.is_national && <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-900 text-white">National</span>}
                        {!a.active && <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-100 text-red-700">Access removed</span>}
                        {a.id === meId && <span className="text-[10px] font-black uppercase text-slate-400">You</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {a.email} · {a.jurisdiction}
                        {a.invited_by ? ` · invited by ${a.invited_by}` : ''}
                        {a.last_login_at ? ` · last sign-in ${new Date(a.last_login_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ' · never signed in'}
                      </p>
                    </div>
                    {a.id !== meId && (
                      <button
                        onClick={() => toggleAdmin(a)}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-bold shrink-0', a.active ? 'border border-red-200 text-red-700 hover:bg-red-50' : 'bg-slate-900 text-white hover:bg-slate-800')}
                      >
                        {a.active ? 'Remove access' : 'Restore access'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
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
        <div className="flex flex-col sm:flex-row gap-2">
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
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs w-full md:w-64 focus:ring-2 focus:ring-[#ee2b2b]/20 outline-none"
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
