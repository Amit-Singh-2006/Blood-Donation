import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import AgentChat from '../components/AgentChat';
import Chat from '../components/Chat';
import MapView from '../components/MapView';
import { cn } from '@/lib/utils';
import { apiFetch } from '../lib/api';

type NavItem = 'overview' | 'requests' | 'inventory' | 'map' | 'analytics' | 'settings';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function HospitalDashboard() {
  const [activeTab, setActiveTab] = useState<NavItem>('overview');
  const [showChat, setShowChat] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCampaign, setShowCampaign] = useState(false);
  const [localRequests, setLocalRequests] = useState<any[]>([]);

  const allRequests = [...localRequests, ...requests];

  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Blood Request Fulfilled', message: 'Donor John D. is en route for Request #882', time: '2m ago', read: false },
    { id: 2, title: 'Low Stock Alert', message: 'O- blood type is below critical threshold', time: '1h ago', read: false },
    { id: 3, title: 'New Donor Match', message: '3 new donors found for Request #879', time: '2h ago', read: true },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));

    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    fetchData();
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const DUMMY_INVENTORY = [
    { blood_group: 'A+', units: 482, threshold: 50 },
    { blood_group: 'A-', units: 156, threshold: 30 },
    { blood_group: 'B+', units: 395, threshold: 40 },
    { blood_group: 'B-', units: 42, threshold: 25 },
    { blood_group: 'AB+', units: 267, threshold: 30 },
    { blood_group: 'AB-', units: 18, threshold: 20 },
    { blood_group: 'O+', units: 612, threshold: 80 },
    { blood_group: 'O-', units: 89, threshold: 40 },
  ];


  const DUMMY_REQUESTS = [
    { id: 'REQ-001', blood_group: 'O-', urgency: 'critical', units_required: 4, status: 'active', time: '8 min ago', patient: 'Trauma Bay 2', matchedDonors: 2 },
    { id: 'REQ-002', blood_group: 'AB+', urgency: 'standard', units_required: 2, status: 'active', time: '23 min ago', patient: 'Surgery Room 3', matchedDonors: 5 },
    { id: 'REQ-003', blood_group: 'B-', urgency: 'standard', units_required: 3, status: 'pending', time: '1 hr ago', patient: 'Ward 4 – Bed 12', matchedDonors: 1 },
    { id: 'REQ-004', blood_group: 'A+', urgency: 'critical', units_required: 6, status: 'active', time: '2 min ago', patient: 'ICU – Bed 7', matchedDonors: 3 },
    { id: 'REQ-005', blood_group: 'O+', urgency: 'standard', units_required: 1, status: 'fulfilled', time: '3 hr ago', patient: 'OPD', matchedDonors: 8 },
    { id: 'REQ-006', blood_group: 'B+', urgency: 'standard', units_required: 2, status: 'fulfilled', time: '5 hr ago', patient: 'Emergency 1', matchedDonors: 12 },
    { id: 'REQ-007', blood_group: 'O-', urgency: 'critical', units_required: 10, status: 'active', time: '10 min ago', patient: 'Major Accident', matchedDonors: 6 },
    { id: 'REQ-008', blood_group: 'A-', urgency: 'standard', units_required: 4, status: 'pending', time: '6 hr ago', patient: 'Surgery 5', matchedDonors: 2 },
    { id: 'REQ-009', blood_group: 'AB-', urgency: 'critical', units_required: 2, status: 'active', time: '45 min ago', patient: 'Pediatrics', matchedDonors: 1 },
    { id: 'REQ-010', blood_group: 'O+', urgency: 'standard', units_required: 5, status: 'fulfilled', time: '12 hr ago', patient: 'OPD Ward', matchedDonors: 15 },
  ];


  const DUMMY_DONATIONS = [
    { id: 'DON-201', donor: 'Rahul Sharma', blood_group: 'O-', units: 1, time: '09:14 AM', status: 'verified' },
    { id: 'DON-202', donor: 'Priya Mehta', blood_group: 'A+', units: 1, time: '10:02 AM', status: 'verified' },
    { id: 'DON-203', donor: 'Aditya Kumar', blood_group: 'B+', units: 1, time: '11:30 AM', status: 'processing' },
    { id: 'DON-204', donor: 'Sneha Iyer', blood_group: 'AB+', units: 1, time: '12:45 PM', status: 'verified' },
    { id: 'DON-205', donor: 'Vikram Singh', blood_group: 'O+', units: 1, time: '01:18 PM', status: 'verified' },
    { id: 'DON-206', donor: 'Ananya Reddy', blood_group: 'A-', units: 1, time: '02:33 PM', status: 'processing' },
    { id: 'DON-207', donor: 'Siddharth M.', blood_group: 'B-', units: 1, time: '03:10 PM', status: 'verified' },
    { id: 'DON-208', donor: 'Neha Kapoor', blood_group: 'O-', units: 1, time: '03:45 PM', status: 'verified' },
    { id: 'DON-209', donor: 'Rohan Gupta', blood_group: 'A+', units: 1, time: '04:20 PM', status: 'verified' },
    { id: 'DON-210', donor: 'Ishita S.', blood_group: 'AB-', units: 1, time: '05:05 PM', status: 'processing' },
  ];


  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [invData, reqData, donData] = await Promise.allSettled([
        apiFetch('/hospital/inventory'),
        apiFetch('/hospital/requests'),
        apiFetch('/hospital/donations'),
      ]);
      setInventory(invData.status === 'fulfilled' && invData.value?.length ? invData.value : DUMMY_INVENTORY);
      setRequests(reqData.status === 'fulfilled' && reqData.value?.length ? reqData.value : DUMMY_REQUESTS);
      setDonations(donData.status === 'fulfilled' && donData.value?.length ? donData.value : DUMMY_DONATIONS);
    } catch (err) {
      console.error('Failed to load data', err);
      setInventory(DUMMY_INVENTORY);
      setRequests(DUMMY_REQUESTS);
      setDonations(DUMMY_DONATIONS);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const navItems: { id: NavItem; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'requests', label: 'Emergencies', icon: 'emergency' },
    { id: 'inventory', label: 'Inventory', icon: 'bloodtype' },
    { id: 'map', label: 'Live Map', icon: 'map' },
    { id: 'analytics', label: 'Predictions', icon: 'monitoring' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  const hospitalName = "City General Hospital";
  const representativeName = user?.name || "Amit Singh Panwar";
  const initials = hospitalName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#f8f6f6] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col z-30">
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
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all relative group',
                  activeTab === item.id
                    ? 'bg-[#ee2b2b]/5 text-[#ee2b2b]'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                {activeTab === item.id && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#ee2b2b] rounded-full"
                  />
                )}
                <span className={cn(
                  'material-symbols-outlined text-xl transition-colors',
                  activeTab === item.id ? 'text-[#ee2b2b]' : 'text-slate-400 group-hover:text-slate-600'
                )}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 pt-4 space-y-3">
          <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl shadow-slate-900/10">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Facility Info</h4>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-black">{initials}</div>
              <div>
                <p className="text-[11px] font-bold truncate w-32">{hospitalName}</p>
                <p className="text-[9px] text-[#ee2b2b] font-black uppercase">{representativeName}</p>
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
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black text-slate-900 capitalize">{activeTab} Dashboard</h1>
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Emergency Services Active
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all relative"
              >
                <span className="material-symbols-outlined text-lg">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ee2b2b] rounded-full ring-2 ring-white"></span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-black text-xs text-slate-800 uppercase tracking-widest">Notifications</h3>
                      <button onClick={markAllRead} className="text-[10px] text-[#ee2b2b] font-black hover:underline uppercase tracking-tight">Mark All Read</button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
                          className="p-4 border-b border-slate-50 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', !n.read ? 'bg-[#ee2b2b]' : 'bg-slate-200')}></div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">{n.title}</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                            <span className="text-[9px] text-slate-400 font-bold block mt-1">{n.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setActiveTab('requests')}
              className="bg-[#ee2b2b] text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-[#ee2b2b]/20 hover:scale-105 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">emergency</span>
              NEW REQUEST
            </button>
          </div>
        </header>

        {/* Scrollable View Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && <OverviewTab requests={allRequests} inventory={inventory} donations={donations} onGoToRequests={() => setActiveTab('requests')} onStartCampaign={() => setShowCampaign(true)} />}
              {activeTab === 'requests' && <RequestsTab requests={requests} localRequests={localRequests} setLocalRequests={setLocalRequests} onRefresh={fetchData} />}
              {activeTab === 'inventory' && <InventoryTab inventory={inventory} onRefresh={fetchData} />}
              {activeTab === 'map' && <MapTab />}
              {activeTab === 'analytics' && <AnalyticsTab requests={allRequests} inventory={inventory} onStartCampaign={() => setShowCampaign(true)} />}
              {activeTab === 'settings' && <SettingsTab user={user} />}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Campaign Modal */}
      <AnimatePresence>
        {showCampaign && <CampaignModal onClose={() => setShowCampaign(false)} />}
      </AnimatePresence>

      {/* Floating AI Chat */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#ee2b2b] text-white rounded-full shadow-2xl shadow-[#ee2b2b]/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
      >
        <span className="material-symbols-outlined">psychology</span>
      </button>
      <AgentChat
        isOpen={showChat}
        context="hospital"
        onClose={() => setShowChat(false)}
        onAction={(actionName, data) => {
          if (actionName === 'create_emergency_request') {
            const newReq = {
              id: data.id,
              blood_group: data.blood_group,
              units_required: data.units_required,
              urgency: data.urgency === 'critical' ? 'critical' : 'high',
              status: 'active',
              time: 'Just now',
              patient: 'AI Prompted Request',
              expires_in_days: '3',
              matchedDonors: 0,
            };
            setLocalRequests(prev => [newReq, ...prev]);
            setActiveTab('requests');
          }
        }}
      />
    </div>
  );
}

// ─────────────────── OVERVIEW TAB ───────────────────
function OverviewTab({ requests, inventory, donations, onGoToRequests, onStartCampaign }: { requests: any[], inventory: any[], donations: any[], onGoToRequests: () => void, onStartCampaign: () => void }) {
  const criticalRequests = requests.filter(r => r.urgency === 'critical').length;
  const totalUnits = inventory.reduce((sum, i) => sum + (i.units || 0), 0);
  const lowStock = inventory.filter(i => i.units < 20);

  return (
    <div className="space-y-8">
      {/* Stats Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Requests', value: requests.length.toString(), icon: 'emergency', color: '#ee2b2b', trend: `${criticalRequests} critical` },
          { label: 'Total Blood Units', value: totalUnits.toString(), icon: 'bloodtype', color: '#3b82f6', trend: 'Across all types' },
          { label: 'Low Stock Types', value: lowStock.length.toString(), icon: 'analytics', color: lowStock.length > 0 ? '#ef4444' : '#10b981', trend: lowStock.length > 0 ? lowStock.map(i => i.blood_group).join(', ') : 'All optimal' },
          { label: 'Donations Today', value: donations.length.toString(), icon: 'trophy', color: '#f59e0b', trend: 'Verified' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-3xl font-black text-slate-900 mt-1">{stat.value}</h3>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
                style={{ backgroundColor: stat.color, boxShadow: `0 8px 20px -6px ${stat.color}66` }}
              >
                <span className="material-symbols-outlined text-xl">{stat.icon}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
              <span className="material-symbols-outlined text-sm" style={{ color: stat.color }}>trending_up</span>
              {stat.trend}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Feed */}
        <div className="xl:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900">Live Emergency Requests</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time Blood Requests</p>
              </div>
              <button onClick={onGoToRequests} className="text-[10px] font-black text-[#ee2b2b] hover:underline uppercase tracking-tight">View All</button>
            </div>

            <div className="space-y-4">
              {requests.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-bold">No active requests. Use "NEW REQUEST" to create one.</div>
              ) : requests.slice(0, 3).map((req, i) => (
                <div key={i} className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg relative overflow-hidden',
                      req.urgency === 'critical' ? 'bg-[#ee2b2b]' : 'bg-slate-900'
                    )}>
                      {req.urgency === 'critical' && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                      <span className="text-xs font-black relative z-10">{req.blood_group}</span>
                      <span className="text-[8px] font-black uppercase tracking-tighter opacity-70 relative z-10">Type</span>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900">Request #{req.id}</h4>
                      <p className="text-[10px] font-bold text-slate-400 mt-1">{req.units_required} units • {req.urgency}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded',
                    req.urgency === 'critical' ? 'bg-red-100 text-[#ee2b2b]' : 'bg-slate-100 text-slate-500'
                  )}>
                    {req.status || req.urgency}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-900/20">
            <div className="absolute top-0 right-0 p-8">
              <span className="material-symbols-outlined text-white/10 text-9xl">psychology</span>
            </div>
            <div className="relative z-10 max-w-lg">
              <span className="text-[10px] font-black text-[#ee2b2b] uppercase tracking-[0.2em] bg-red-500/10 px-3 py-1.5 rounded-full inline-block mb-4">AI Prediction Engine</span>
              <h3 className="text-2xl font-black leading-tight mb-4">Upcoming O- Shortage Predicted for Next Friday</h3>
              <p className="text-sm font-medium text-slate-400 leading-relaxed mb-6">Based on historical data and upcoming regional events, we anticipate a 40% increase in blood demand. We recommend initiating a proactive donor campaign.</p>
              <button
                onClick={onStartCampaign}
                className="bg-white text-slate-900 px-6 py-3 rounded-xl font-black text-xs hover:scale-105 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">campaign</span>
                START CAMPAIGN
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-8">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[#ee2b2b] text-lg">bloodtype</span>
              Stock Health
            </h4>
            <div className="space-y-4">
              {BLOOD_TYPES.map((type) => {
                const item = inventory.find(i => i.blood_group === type);
                const units = item?.units || 0;
                const max = 200;
                const pct = Math.min((units / max) * 100, 100);
                const color = pct < 20 ? 'bg-red-500' : pct < 50 ? 'bg-yellow-400' : 'bg-green-400';
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-black uppercase">
                      <span>{type}</span>
                      <span>{units} units</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8 }}
                        className={cn('h-full rounded-full', color)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── REQUESTS TAB ───────────────────
function RequestsTab({ requests, localRequests, setLocalRequests, onRefresh }: { requests: any[], localRequests: any[], setLocalRequests: React.Dispatch<React.SetStateAction<any[]>>, onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ blood_group: 'O+', units_required: '', urgency: 'standard', expires_in_days: '3' });

  const allRequests = [...localRequests, ...requests];


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await apiFetch('/hospital/requests', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSuccess('Emergency request broadcast successfully!');
      setShowForm(false);
      setForm({ blood_group: 'O+', units_required: '', urgency: 'standard', expires_in_days: '3' });
      onRefresh();
    } catch (err: any) {
      // If backend auth fails, save locally so the UI still works
      const newReq = {
        id: `LOC-${Date.now()}`,
        blood_group: form.blood_group,
        units_required: form.units_required,
        urgency: form.urgency === 'critical' ? 'critical' : 'high',
        status: 'active',
        time: 'Just now',
        patient: 'New Request',
        expires_in_days: form.expires_in_days,
        matchedDonors: 0,
      };
      setLocalRequests(prev => [newReq, ...prev]);
      setSuccess(`Request broadcast locally (expires in ${form.expires_in_days} day${form.expires_in_days === '1' ? '' : 's'})`);
      setShowForm(false);
      setForm({ blood_group: 'O+', units_required: '', urgency: 'standard', expires_in_days: '3' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(''), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {success && <div className="p-4 bg-green-50 text-green-700 rounded-xl font-bold border border-green-200">{success}</div>}

      {/* Create Request Form */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Emergency Request Wizard</h2>
            <p className="text-sm text-slate-500 mt-1">Create a new blood request and notify nearby donors.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#ee2b2b] text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg shadow-[#ee2b2b]/20 hover:scale-105 transition-all flex items-center gap-2"
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
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700">Blood Group</label>
                  <select
                    value={form.blood_group}
                    onChange={e => setForm(p => ({ ...p, blood_group: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] outline-none"
                  >
                    {BLOOD_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700">Units Required</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={form.units_required}
                    onChange={e => setForm(p => ({ ...p, units_required: e.target.value }))}
                    placeholder="e.g. 2"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700">Urgency</label>
                  <div className="flex gap-3">
                    {['standard', 'critical'].map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, urgency: u }))}
                        className={cn(
                          'flex-1 py-3 rounded-xl text-xs font-black border-2 transition-all capitalize',
                          form.urgency === u
                            ? u === 'critical' ? 'border-[#ee2b2b] bg-[#ee2b2b] text-white' : 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 text-slate-500 hover:border-slate-400'
                        )}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700">Time Frame</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      required
                      value={form.expires_in_days}
                      onChange={e => setForm(p => ({ ...p, expires_in_days: e.target.value }))}
                      className="w-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] outline-none"
                    />
                    <span className="text-sm font-bold text-slate-500">days</span>
                    <div className="flex gap-2 ml-auto">
                      {['1', '3', '7'].map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setForm(p => ({ ...p, expires_in_days: d }))}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all',
                            form.expires_in_days === d
                              ? 'border-[#ee2b2b] bg-[#ee2b2b]/10 text-[#ee2b2b]'
                              : 'border-slate-200 text-slate-400 hover:border-slate-400'
                          )}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#ee2b2b] text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-[#ee2b2b]/20 hover:bg-[#ee2b2b]/90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">emergency</span>}
                {isSubmitting ? 'Submitting...' : 'Broadcast Request'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {allRequests.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
            <span className="material-symbols-outlined text-5xl text-slate-200 mb-4 block">emergency_share</span>
            <p className="text-slate-400 font-bold">No emergency requests yet. Create your first one above.</p>
          </div>
        ) : allRequests.map((req, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-5">
              <div className={cn(
                'w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg',
                req.urgency === 'critical' ? 'bg-[#ee2b2b]' : 'bg-slate-800'
              )}>
                <span className="text-sm font-black">{req.blood_group}</span>
              </div>
              <div>
                <h4 className="font-black text-slate-900">Request #{req.id}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  {req.units_required} units needed •{' '}
                  {req.created_at && !isNaN(new Date(req.created_at).getTime())
                    ? new Date(req.created_at).toLocaleDateString()
                    : req.time || 'Just now'}
                  {req.expires_in_days ? ` • expires in ${req.expires_in_days}d` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={cn(
                'text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full',
                req.urgency === 'critical' ? 'bg-red-100 text-[#ee2b2b]' : 'bg-slate-100 text-slate-500'
              )}>
                {req.urgency}
              </span>
              <span className={cn(
                'text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full',
                req.status === 'fulfilled' ? 'bg-green-100 text-green-600' : 'bg-yellow-50 text-yellow-600'
              )}>
                {req.status || 'pending'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────── INVENTORY TAB ───────────────────
function InventoryTab({ inventory, onRefresh }: { inventory: any[], onRefresh: () => void }) {
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(true);
  // Local overrides: when backend is unavailable, store updates here
  const [localUnits, setLocalUnits] = useState<Record<string, number>>({});

  const getUnits = (type: string) => {
    // Prefer local override, then server inventory
    if (localUnits[type] !== undefined) return localUnits[type];
    const item = inventory.find(i => i.blood_group === type);
    return item?.units ?? '—';
  };

  const getStatus = (units: number | string) => {
    if (units === '—' || units === 0) return { label: 'Empty', color: 'bg-red-100 text-red-600' };
    if ((units as number) < 20) return { label: 'Critical', color: 'bg-red-100 text-red-600' };
    if ((units as number) < 60) return { label: 'Low', color: 'bg-yellow-100 text-yellow-600' };
    return { label: 'Optimal', color: 'bg-green-100 text-green-600' };
  };

  const handleSave = async (type: string) => {
    setIsSaving(true);
    const newUnits = parseInt(editValue);
    try {
      await apiFetch('/hospital/inventory', {
        method: 'PUT',
        body: JSON.stringify({ blood_group: type, units: newUnits }),
      });
      setIsSuccess(true);
      setMessage(`✓ ${type} updated to ${editValue} units`);
      setEditingType(null);
      onRefresh();
    } catch {
      // Backend unavailable / token invalid — save locally so UI reflects change
      setLocalUnits(prev => ({ ...prev, [type]: newUnits }));
      setIsSuccess(true);
      setMessage(`✓ ${type} updated to ${editValue} units (saved locally)`);
      setEditingType(null);
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={cn('p-4 rounded-xl font-bold border', isSuccess ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
          {message}
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
                <span className={cn('text-[9px] font-black uppercase px-2 py-1 rounded-full', status.color)}>
                  {status.label}
                </span>
              </div>
              <div className="space-y-1 mb-4">
                <p className="text-xs font-bold text-slate-400">Total Units</p>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
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
                    <button
                      onClick={() => handleSave(type)}
                      disabled={isSaving}
                      className="flex-1 py-2 bg-[#ee2b2b] text-white text-xs font-black rounded-lg hover:bg-[#ee2b2b]/90 transition-all disabled:opacity-60"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingType(null)}
                      className="py-2 px-3 bg-slate-100 text-slate-500 text-xs font-black rounded-lg hover:bg-slate-200 transition-all"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setEditingType(type); setEditValue(units === '—' ? '0' : units.toString()); }}
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

// ─────────────────── MAP TAB ───────────────────
function MapTab() {
  const [mapDonors, setMapDonors] = useState([
    { id: '1', lat: 28.62, lng: 77.21, name: 'Suresh Kumar' },
    { id: '2', lat: 28.61, lng: 77.22, name: 'Amit Sharma' },
    { id: '3', lat: 28.63, lng: 77.19, name: 'Priya Verma' },
    { id: '4', lat: 28.60, lng: 77.20, name: 'Rahul Singh' },
    { id: '5', lat: 28.615, lng: 77.215, name: 'Anjali Gupta' },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMapDonors(prev => prev.map(d => ({
        ...d,
        lat: d.lat + (Math.random() - 0.5) * 0.001,
        lng: d.lng + (Math.random() - 0.5) * 0.001
      })));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-3xl overflow-hidden border-8 border-white shadow-2xl relative h-[650px] flex flex-col">
        {/* Tactical Header Overlay */}
        <div className="absolute top-6 left-6 z-10 space-y-2 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Tactical Grid Active</span>
          </div>
          <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Connection: <span className="text-green-500 font-black">ENCRYPTED</span></p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Region: <span className="text-white font-black">NEW DELHI CENTRAL</span></p>
          </div>
        </div>

        {/* Stats Overlays */}
        <div className="absolute bottom-6 left-6 z-10 flex gap-3 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shadow-2xl">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Donors</p>
            <p className="text-xl font-black text-white">42</p>
          </div>
          <div className="bg-slate-900/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shadow-2xl">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Ready Ambulances</p>
            <p className="text-xl font-black text-white">03</p>
          </div>
        </div>

        <div className="absolute bottom-6 right-6 z-10 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[#ee2b2b] text-sm">satellite_alt</span>
              <p className="text-[8px] font-black text-white uppercase tracking-widest">Sat Link Beta-4</p>
            </div>
            <div className="h-1 w-24 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                animate={{ x: [-24, 96] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-8 h-full bg-[#ee2b2b]"
              />
            </div>
          </div>
        </div>

        {/* The Actual Map */}
        <div className="flex-1 z-0 relative">
          <MapView
            donors={mapDonors}
            onDispatch={(id) => {
              setMapDonors(prev => prev.filter(d => d.id !== id));
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: 'share_location', label: 'Nearby Donors', value: '12 available now' },
          { icon: 'speed', label: 'Est. Dispatch Time', value: '4.2 minutes' },
          { icon: 'hub', label: 'Network Nodes', value: '08 centers active' }
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
              <p className="text-sm font-black text-slate-900">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────── ANALYTICS TAB ───────────────────
function AnalyticsTab({ requests, inventory, onStartCampaign }: { requests: any[], inventory: any[], onStartCampaign: () => void }) {
  const criticalCount = requests.filter(r => r.urgency === 'critical').length;
  const standardCount = requests.filter(r => r.urgency === 'standard').length;
  const fulfilledCount = requests.filter(r => r.status === 'fulfilled').length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Critical Requests', value: criticalCount, color: '#ee2b2b', icon: 'emergency' },
          { label: 'Standard Requests', value: standardCount, color: '#3b82f6', icon: 'local_hospital' },
          { label: 'Fulfilled', value: fulfilledCount, color: '#10b981', icon: 'check_circle' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: s.color }}>
                <span className="material-symbols-outlined text-lg">{s.icon}</span>
              </div>
            </div>
            <h3 className="text-4xl font-black text-slate-900">{s.value}</h3>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8">
          <span className="material-symbols-outlined text-white/10 text-9xl">psychology</span>
        </div>
        <div className="relative z-10 max-w-lg">
          <span className="text-[10px] font-black text-[#ee2b2b] uppercase tracking-[0.2em] bg-red-500/10 px-3 py-1.5 rounded-full inline-block mb-4">AI Prediction Engine</span>
          <h3 className="text-2xl font-black leading-tight mb-4">Upcoming O- Shortage Predicted for Next Friday</h3>
          <p className="text-sm font-medium text-slate-400 leading-relaxed mb-6">Based on historical data and upcoming regional events, we anticipate a 40% increase in blood demand. Recommend initiating a proactive donor campaign.</p>
          <button
            onClick={onStartCampaign}
            className="bg-white text-slate-900 px-6 py-3 rounded-xl font-black text-xs hover:scale-105 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">campaign</span>
            START CAMPAIGN
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── SETTINGS TAB ───────────────────
function SettingsTab({ user }: { user: any }) {
  const [showId, setShowId] = useState(false);
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleRevealId = () => {
    if (password === '12345678') {
      setShowId(true);
      setPassword('');
    } else {
      alert('Incorrect password. Access denied.');
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 mb-6">Account Information</h3>
        <div className="space-y-4">
          {[
            { label: 'Hospital Name', value: 'City General Hospital' },
            { label: 'Representative', value: user?.name || 'Amit Singh Panwar' },
            { label: 'Email', value: user?.email || '—' },
            { label: 'Role', value: 'Hospital Admin' },
          ].map((field, i) => (
            <div key={i} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
              <span className="text-sm font-bold text-slate-500">{field.label}</span>
              <span className="text-sm font-black text-slate-900">{field.value}</span>
            </div>
          ))}

          <div className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
            <span className="text-sm font-bold text-slate-500">Account ID</span>
            {showId ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-black text-[#ee2b2b] bg-red-50 px-2 py-1 rounded">{user?.id || '—'}</span>
                <button
                  onClick={() => { setShowId(false); setIsVerifying(false); }}
                  className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">lock_open</span>
                  Hide
                </button>
              </div>
            ) : isVerifying ? (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-[#ee2b2b]/20 outline-none"
                />
                <button
                  onClick={handleRevealId}
                  className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-slate-800 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => { setIsVerifying(false); setPassword(''); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsVerifying(true)}
                className="flex items-center gap-2 text-[#ee2b2b] hover:text-[#ee2b2b]/80 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                <span className="text-xs font-black uppercase tracking-widest">Verify to view</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 mb-2">Notification Preferences</h3>
        <p className="text-sm text-slate-500 mb-6">Choose which alerts you want to receive.</p>
        <div className="space-y-4">
          {[
            'Critical blood shortage alerts',
            'New donor match notifications',
            'Request fulfilled updates',
            'Weekly inventory summary',
          ].map((pref, i) => (
            <label key={i} className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{pref}</span>
              <div className="relative">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-[#ee2b2b] transition-colors"></div>
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"></div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────── CAMPAIGN MODAL ───────────────────
function CampaignModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [form, setForm] = useState({
    bloodType: 'O-',
    urgency: 'high',
    targetDonors: '50',
    duration: '7',
    message: 'We urgently need your help. Our hospital is facing a critical shortage of O- blood. Every donation counts — please respond if you are available.',
    channels: { push: true, sms: true, email: true },
  });
  const [launching, setLaunching] = useState(false);

  const handleLaunch = async () => {
    setLaunching(true);
    await new Promise(r => setTimeout(r, 1800)); // simulate API call
    setLaunching(false);
    setStep('success');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 24 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {step === 'form' ? (
          <>
            {/* Header */}
            <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-[#ee2b2b] uppercase tracking-[0.2em] bg-red-500/10 px-3 py-1 rounded-full">AI Prediction Engine</span>
                <h2 className="text-xl font-black text-white mt-2">Launch Donor Campaign</h2>
                <p className="text-xs text-slate-400 mt-1">Reach out to eligible donors in your network</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-8 space-y-5 max-h-[65vh] overflow-y-auto">
              {/* Blood Type + Urgency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Blood Type Needed</label>
                  <select
                    value={form.bloodType}
                    onChange={e => setForm(f => ({ ...f, bloodType: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/30"
                  >
                    {BLOOD_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Urgency Level</label>
                  <select
                    value={form.urgency}
                    onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/30"
                  >
                    <option value="critical">🔴 Critical</option>
                    <option value="high">🟠 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </div>
              </div>

              {/* Target + Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Target Donors</label>
                  <input
                    type="number" min="1" max="500"
                    value={form.targetDonors}
                    onChange={e => setForm(f => ({ ...f, targetDonors: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Duration (days)</label>
                  <input
                    type="number" min="1" max="30"
                    value={form.duration}
                    onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/30"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Campaign Message</label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/30"
                />
                <p className="text-[10px] text-slate-400 mt-1 font-bold">{form.message.length} / 280 characters</p>
              </div>

              {/* Channels */}
              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-3">Notify Via</label>
                <div className="flex gap-3">
                  {(['push', 'sms', 'email'] as const).map(ch => (
                    <button
                      key={ch}
                      onClick={() => setForm(f => ({ ...f, channels: { ...f.channels, [ch]: !f.channels[ch] } }))}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black border-2 transition-all',
                        form.channels[ch]
                          ? 'border-[#ee2b2b] bg-[#ee2b2b]/5 text-[#ee2b2b]'
                          : 'border-slate-200 text-slate-400'
                      )}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {ch === 'push' ? 'notifications' : ch === 'sms' ? 'sms' : 'mail'}
                      </span>
                      {ch.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Campaign Preview</p>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#ee2b2b] flex items-center justify-center text-white text-xs font-black shrink-0">{form.bloodType}</div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Urgent {form.bloodType} Blood Needed — {form.urgency.charAt(0).toUpperCase() + form.urgency.slice(1)} Priority</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{form.message.slice(0, 80)}...</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-bold">Reaching {form.targetDonors} donors · {form.duration} day campaign</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-slate-100 flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="flex-1 py-3 rounded-xl bg-[#ee2b2b] text-white text-sm font-black shadow-lg shadow-[#ee2b2b]/25 hover:bg-[#ee2b2b]/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {launching ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Launching...</>
                ) : (
                  <><span className="material-symbols-outlined text-sm">rocket_launch</span>Launch Campaign</>
                )}
              </button>
            </div>
          </>
        ) : (
          // Success State
          <div className="p-12 text-center">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <span className="material-symbols-outlined text-green-500 text-5xl">check_circle</span>
            </motion.div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Campaign Launched! 🎉</h3>
            <p className="text-sm text-slate-500 mb-2">Your <span className="font-black text-[#ee2b2b]">{form.bloodType}</span> donor campaign is now live.</p>
            <p className="text-xs text-slate-400 mb-8">Alerting up to <strong>{form.targetDonors} donors</strong> via {Object.entries(form.channels).filter(([, v]) => v).map(([k]) => k.toUpperCase()).join(', ')} over {form.duration} days.</p>
            <div className="bg-slate-50 rounded-2xl p-5 text-left mb-8 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-400">Campaign ID</span>
                <span className="text-slate-900">CMP-{Math.floor(Math.random() * 9000) + 1000}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-400">Blood Type</span>
                <span className="text-[#ee2b2b]">{form.bloodType}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-400">Status</span>
                <span className="text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />Active</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-slate-900 text-white font-black text-sm hover:bg-slate-800 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
