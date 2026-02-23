import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Chat from '../components/Chat';
import ChatBot from '../components/ChatBot';
import { cn } from '@/lib/utils';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type NavItem = 'overview' | 'inventory' | 'requests' | 'map' | 'analytics' | 'settings';

export default function HospitalDashboard() {
  const [activeTab, setActiveTab] = useState<NavItem | 'dashboard' | 'inventory' | 'requests'>('dashboard');
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [showChat, setShowChat] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Blood Request Fulfilled', message: 'Donor John D. is en route for Request #882', time: '2m ago', read: false },
    { id: 2, title: 'Low Stock Alert', message: 'O- blood type is below critical threshold', time: '1h ago', read: false },
    { id: 3, title: 'New Donor Match', message: '3 new donors found for Request #879', time: '2h ago', read: true },
  ]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invData, reqData, donData] = await Promise.all([
        apiFetch('/hospital/inventory'),
        apiFetch('/hospital/requests'),
        apiFetch('/hospital/donations')
      ]);
      setInventory(invData);
      setRequests(reqData);
      setDonations(donData);
    } catch (err) {
      console.error('Failed to fetch hospital data:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const navItems: { id: string; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Overview', icon: 'dashboard' },
    { id: 'requests', label: 'Emergencies', icon: 'emergency' },
    { id: 'inventory', label: 'Inventory', icon: 'bloodtype' },
    { id: 'map', label: 'Live Map', icon: 'map' },
    { id: 'analytics', label: 'Predictions', icon: 'monitoring' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

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
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all relative group",
                  activeTab === item.id
                    ? "bg-[#ee2b2b]/5 text-[#ee2b2b]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {activeTab === item.id && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#ee2b2b] rounded-full"
                  />
                )}
                <span className={cn(
                  "material-symbols-outlined text-xl transition-colors",
                  activeTab === item.id ? "text-[#ee2b2b]" : "text-slate-400 group-hover:text-slate-600"
                )}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 pt-4">
          <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl shadow-slate-900/10 mb-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Facility Info</h4>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-black">CH</div>
              <div>
                <p className="text-[11px] font-bold truncate w-32">{user?.name || 'City General Hospital'}</p>
                <p className="text-[9px] text-[#ee2b2b] font-black uppercase">Verified Facility</p>
              </div>
            </div>
          </div>
          <button
            onClick={async () => { await logout(); navigate('/'); }}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-600 font-black text-xs hover:bg-slate-50 hover:text-[#ee2b2b] transition-all group shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-xl group-hover:rotate-12 transition-transform">logout</span>
            SIGN OUT
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
                      <button className="text-[10px] text-[#ee2b2b] font-black hover:underline uppercase tracking-tight">Mark All Read</button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {notifications.map(n => (
                        <div key={n.id} className="p-4 border-b border-slate-50 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
                          <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", !n.read ? "bg-[#ee2b2b]" : "bg-slate-200")}></div>
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
              {activeTab === 'dashboard' && <DashboardView setActiveTab={setActiveTab as any} stats={{ requests: 12, matches: 3, inventory: 428 }} />}
              {activeTab === 'requests' && <RequestWizardView requests={requests} />}
              {activeTab === 'inventory' && <InventoryView inventory={inventory} />}
              {activeTab === 'map' && <MapTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Chat */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-8 right-28 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
      >
        <span className="material-symbols-outlined">forum</span>
      </button>
      <Chat isOpen={showChat} recipientName="Emergency Center" recipientType="hospital" onClose={() => setShowChat(false)} />
      <ChatBot />
    </div >
  );
}

function DashboardView({ setActiveTab, stats }: { setActiveTab: (tab: 'dashboard' | 'inventory' | 'requests') => void; stats: { requests: number; matches: number; inventory: number } }) {
  const [quickRequestType, setQuickRequestType] = useState('O-');
  const [quickRequestUrgency, setQuickRequestUrgency] = useState('Critical (Immediate)');
  const [quickRequestUnits, setQuickRequestUnits] = useState(2);
  const [isMatching, setIsMatching] = useState(false);

  const [donorAppointments, setDonorAppointments] = useState([
    { id: 101, name: "Alex Johnson", bloodType: "O-", eligibility: "Verified (100%)", type: "Whole Blood", time: "Tomorrow, 10:30 AM", status: "pending" },
    { id: 102, name: "Maria Garcia", bloodType: "A+", eligibility: "Pending Review", type: "Power Red", time: "Tomorrow, 2:00 PM", status: "pending" }
  ]);

  const handleApproveAppointment = (id: number) => {
    setDonorAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' } : a));
  };

  const handleRejectAppointment = (id: number) => {
    setDonorAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' } : a));
  };

  const handleQuickMatch = async () => {
    setIsMatching(true);
    try {
      await apiFetch('/hospital/requests', {
        method: 'POST',
        body: JSON.stringify({
          blood_group: quickRequestType,
          units_required: quickRequestUnits,
          urgency: quickRequestUrgency.split(' ')[0], // e.g. "Critical"
          latitude: 47.6062, // Defaulting to Seattle for prototype
          longitude: -122.3321
        })
      });
      alert('Quick request created and matching started!');
      setActiveTab('requests');
    } catch (err: any) {
      alert(err.message || 'Failed to create request');
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Escort', value: '03', icon: 'ambulance', color: '#ee2b2b', trend: '+2 this hour' },
          { label: 'Potential Donors', value: '48', icon: 'person_search', color: '#3b82f6', trend: 'Nearby area' },
          { label: 'Shortage Risk', value: 'Low', icon: 'analytics', color: '#10b981', trend: 'AI Prediction' },
          { label: 'Network Rank', value: '#12', icon: 'trophy', color: '#f59e0b', trend: 'Global network' },
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
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#ee2b2b]/5 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900">Live Matching Engine</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time AI Donor Search</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Processing 12 requests
              </div>
            </div>

            <div className="space-y-4">
              {[
                { type: 'O-', id: '882', status: '8 Donors Notified', urgency: 'Critical', time: '12m ago' },
                { type: 'A+', id: '879', status: '14 Donors Notified', urgency: 'Standard', time: '2h ago' }
              ].map((req, i) => (
                <div key={i} className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all group/item">
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg relative overflow-hidden",
                      req.urgency === 'Critical' ? "bg-[#ee2b2b]" : "bg-slate-900"
                    )}>
                      {req.urgency === 'Critical' && (
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      )}
                      <span className="text-xs font-black relative z-10">{req.type}</span>
                      <span className="text-[8px] font-black uppercase tracking-tighter opacity-70 relative z-10">Type</span>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900">Urgent Request #{req.id}</h4>
                      <p className="text-[10px] font-bold text-slate-400 mt-1">{req.status} • {req.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded inline-block",
                        req.urgency === 'Critical' ? "bg-red-100 text-[#ee2b2b]" : "bg-slate-100 text-slate-500"
                      )}>
                        {req.urgency}
                      </span>
                    </div>
                    <button className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover/item:bg-[#ee2b2b] group-hover/item:text-white transition-all">
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                </div>
              ))}
              {donorAppointments.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-sm">
                  No pending appointments at this time.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryView({ inventory }: { inventory: any[] }) {
  const [stock, setStock] = useState<Record<string, number>>(() => {
    const initialStock: Record<string, number> = {
      'A+': 0, 'A-': 0, 'B+': 0, 'B-': 0, 'AB+': 0, 'AB-': 0, 'O+': 0, 'O-': 0
    };
    inventory.forEach(item => {
      if (initialStock[item.blood_group] !== undefined) {
        initialStock[item.blood_group] = item.units;
      }
    });
    return initialStock;
  });

  const updateStock = (type: keyof typeof stock, change: number) => {
    setStock(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] + change)
    }));
  };

  const getStatus = (count: number, type: string) => {
    if (type.includes('-') && count < 50) return { label: 'Critical Low', color: 'text-[#ee2b2b]', bg: 'bg-red-100' };
    if (count < 100) return { label: 'Low', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { label: 'Optimal', color: 'text-green-600', bg: 'bg-green-50' };
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Inventory & Predictions</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <p className="text-slate-500 text-sm font-medium">Last Synced: 2 minutes ago • AI Engine Active</p>
          </div>
        </div>
      </div>

      {/* Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* A+ Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-6">
            <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center font-black text-2xl text-slate-900">A+</div>
            <span className="px-2.5 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full">Optimal</span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Current Stock</span>
              <span className="text-slate-900 font-bold">{stock['A+']} Units</span>
            </div>
            <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-green-500 w-[75%] rounded-full"></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => updateStock('A+', -1)} className="flex-1 py-1.5 text-xs font-bold border border-slate-200 rounded hover:bg-slate-50">-</button>
              <button onClick={() => updateStock('A+', 1)} className="flex-1 py-1.5 text-xs font-bold border border-slate-200 rounded hover:bg-slate-50">+</button>
            </div>
          </div>
        </div>
        {/* O- Card */}
        <div className="bg-white p-6 rounded-xl border-2 border-[#ee2b2b]/40 shadow-lg shadow-[#ee2b2b]/5">
          <div className="flex justify-between items-center mb-6">
            <div className="h-12 w-12 rounded-lg bg-[#ee2b2b]/10 flex items-center justify-center font-black text-2xl text-[#ee2b2b]">O-</div>
            <span className="px-2.5 py-1 bg-red-100 text-[#ee2b2b] text-xs font-bold rounded-full animate-pulse">Critical Low</span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Current Stock</span>
              <span className="text-[#ee2b2b] font-bold">{stock['O-']} Units</span>
            </div>
            <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-[#ee2b2b] w-[15%] rounded-full"></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => updateStock('O-', -1)} className="flex-1 py-1.5 text-xs font-bold border border-slate-200 rounded hover:bg-slate-50">-</button>
              <button onClick={() => updateStock('O-', 1)} className="flex-1 py-1.5 text-xs font-bold border border-slate-200 rounded hover:bg-slate-50">+</button>
            </div>
          </div>
        </div>
        {/* B+ Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-6">
            <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center font-black text-2xl text-slate-900">B+</div>
            <span className="px-2.5 py-1 bg-orange-50 text-orange-600 text-xs font-bold rounded-full">Caution</span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Current Stock</span>
              <span className="text-slate-900 font-bold">{stock['B+']} Units</span>
            </div>
            <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-orange-400 w-[42%] rounded-full"></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => updateStock('B+', -1)} className="flex-1 py-1.5 text-xs font-bold border border-slate-200 rounded hover:bg-slate-50">-</button>
              <button onClick={() => updateStock('B+', 1)} className="flex-1 py-1.5 text-xs font-bold border border-slate-200 rounded hover:bg-slate-50">+</button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Full Inventory Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold">
              <tr>
                <th className="px-6 py-4">Blood Type</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Quantity (Units)</th>
                <th className="px-6 py-4">Last Updated</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(Object.keys(stock) as Array<keyof typeof stock>).map((type) => {
                const status = getStatus(stock[type], type);
                return (
                  <tr key={type} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{type}</td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold", status.bg, status.color)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">{stock[type]}</td>
                    <td className="px-6 py-4 text-slate-500">Just now</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => updateStock(type, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
                          <span className="material-symbols-outlined text-sm">remove</span>
                        </button>
                        <button onClick={() => updateStock(type, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
                          <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RequestWizardView({ requests }: { requests: any[] }) {
  const [urgency, setUrgency] = useState('Normal');
  const [bloodType, setBloodType] = useState<string | null>(null);
  const [units, setUnits] = useState(4);
  const [reason, setReason] = useState('Major Trauma / Surgery');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!bloodType) return;
    setIsSubmitting(true);
    try {
      await apiFetch('/hospital/requests', {
        method: 'POST',
        body: JSON.stringify({
          blood_group: bloodType,
          units_required: units,
          urgency: urgency,
          latitude: 47.6062, // Defaulting to Seattle for prototype
          longitude: -122.3321
        })
      });
      alert('Request submitted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-8">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Blood Requirement Details</h1>
        <p className="text-slate-500 mb-8">Specify the blood components needed and the urgency of the request.</p>

        <div className="space-y-8">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-4">Urgency Level</label>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setUrgency('Normal')}
                className={cn(
                  "flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all",
                  urgency === 'Normal' ? "border-slate-400 bg-slate-50" : "border-slate-100 hover:border-slate-200"
                )}
              >
                <span className="material-symbols-outlined text-slate-400 mb-1">check_circle</span>
                <span className="text-sm font-bold text-slate-600">Normal</span>
              </button>
              <button
                onClick={() => setUrgency('Urgent')}
                className={cn(
                  "flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all",
                  urgency === 'Urgent' ? "border-orange-400 bg-orange-50" : "border-orange-100 bg-orange-50/30 hover:border-orange-200"
                )}
              >
                <span className="material-symbols-outlined text-orange-500 mb-1">priority_high</span>
                <span className="text-sm font-bold text-orange-700">Urgent</span>
              </button>
              <button
                onClick={() => setUrgency('Critical')}
                className={cn(
                  "flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all",
                  urgency === 'Critical' ? "border-[#ee2b2b] bg-[#ee2b2b]/5 ring-2 ring-[#ee2b2b]/10" : "border-[#ee2b2b]/30 bg-[#ee2b2b]/5 hover:border-[#ee2b2b]"
                )}
              >
                <span className="material-symbols-outlined text-[#ee2b2b] mb-1">emergency</span>
                <span className="text-sm font-bold text-[#ee2b2b]">Critical</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="text-sm font-bold text-slate-700">Select Blood Type</label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(type => (
                <button
                  key={type}
                  onClick={() => setBloodType(type)}
                  className={cn(
                    "aspect-square flex items-center justify-center rounded-xl border text-xl font-bold transition-colors",
                    bloodType === type
                      ? "border-2 border-[#ee2b2b] bg-[#ee2b2b]/5 text-[#ee2b2b]"
                      : "border-slate-200 bg-white hover:border-[#ee2b2b]"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-4">Units Required</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setUnits(Math.max(1, units - 1))}
                  className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined">remove</span>
                </button>
                <div className="flex-1 text-center">
                  <span className="text-4xl font-extrabold text-slate-900">{units.toString().padStart(2, '0')}</span>
                </div>
                <button
                  onClick={() => setUnits(units + 1)}
                  className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
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
                <button className="bg-white text-slate-900 px-6 py-3 rounded-xl font-black text-xs hover:scale-105 transition-all">START CAMPAIGN</button>
              </div>
            </div>
          </div>

          {/* Sidebar Widgets */}
          <div className="space-y-8">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm h-min">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-[#ee2b2b] text-lg">event_available</span>
                Scheduled Today
              </h4>
              <div className="space-y-6">
                {[
                  { name: 'Alex Johnson', time: '10:30 AM', type: 'O-', typeLabel: 'Whole Blood' },
                  { name: 'Maria Garcia', time: '02:00 PM', type: 'A+', typeLabel: 'Platelets' }
                ].map((appt, i) => (
                  <div key={i} className="flex gap-4 group">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-[#ee2b2b]"></div>
                      <div className="w-px h-full bg-slate-100 my-1"></div>
                    </div>
                    <div className="pb-6">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{appt.time}</p>
                      <h5 className="font-bold text-slate-900 mt-1">{appt.name}</h5>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="w-7 h-7 bg-red-50 text-[#ee2b2b] text-[10px] font-black rounded-lg flex items-center justify-center border border-red-100">{appt.type}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">{appt.typeLabel}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full py-4 text-[10px] font-black text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-[0.2em] border-t border-slate-50">View Calendar</button>
            </div>

            <div className="bg-blue-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-blue-500/20">
              <h3 className="text-xl font-black mb-1">Stock Health</h3>
              <p className="text-xs font-bold text-blue-100/70 mb-6 italic tracking-tight">AI Audit • 1m ago</p>
              <div className="space-y-6">
                {[
                  { type: 'A+', level: 85, color: 'bg-green-400' },
                  { type: 'O+', level: 62, color: 'bg-white' },
                  { type: 'O-', level: 12, color: 'bg-red-400' }
                ].map((s, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-[11px] font-black uppercase">
                      <span>{s.type} Groups</span>
                      <span>{s.level}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-blue-700/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${s.level}%` }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 1 }}
                        className={cn("h-full rounded-full", s.color)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !bloodType}
              className="bg-[#ee2b2b] text-white px-8 py-4 rounded-xl font-black text-sm hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-3 shadow-lg shadow-[#ee2b2b]/20"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin material-symbols-outlined">sync</span>
                  INITIATING OVERRIDE...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">emergency_share</span>
                  BROADCAST EMERGENCY
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestsTab() {
  return (
    <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
      <div className="w-20 h-20 bg-[#ee2b2b]/5 rounded-3xl flex items-center justify-center text-[#ee2b2b] mx-auto mb-6">
        <span className="material-symbols-outlined text-4xl">emergency_share</span>
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-2">Emergency Request Wizard</h2>
      <p className="text-slate-500 max-w-md mx-auto font-medium">Configure advanced AI parameters for your emergency requirement.</p>
    </div>
  );
}

function InventoryTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type, i) => (
        <div key={i} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all border-b-4 border-b-transparent hover:border-b-[#ee2b2b] group">
          <div className="flex justify-between items-center mb-8">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 font-black text-xl group-hover:bg-[#ee2b2b] group-hover:text-white transition-colors">
              {type}
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
              <span className="text-[10px] font-black text-green-500 uppercase">Optimal</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">Total Units</p>
            <h4 className="text-3xl font-black text-slate-900">428</h4>
          </div>
        </div>
      ))}
    </div>
  );
}

function MapTab() {
  return (
    <div className="h-[600px] bg-slate-900 rounded-3xl relative overflow-hidden flex items-center justify-center text-white border-8 border-white shadow-2xl">
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_#ee2b2b_0%,_transparent_70%)]"></div>
      <div className="text-center relative z-10 p-12">
        <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <span className="material-symbols-outlined text-5xl text-[#ee2b2b]">navigation</span>
        </div>
        <h3 className="text-4xl font-black mb-4">Live Tactical View</h3>
        <p className="text-slate-400 max-w-md mx-auto font-bold uppercase tracking-widest text-xs leading-loose">
          Establishing encrypted connection to local health grid... <br />
          Syncing AIS data from local emergency vehicles...
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-xs font-black uppercase">Active Donors: 42</div>
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-xs font-black uppercase">Ambulances: 03</div>
        </div>
      </div>
    </div>
  );
}
