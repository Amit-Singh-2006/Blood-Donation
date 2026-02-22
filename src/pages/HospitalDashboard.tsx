import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Chat from '../components/Chat';
import { cn } from '@/lib/utils';
import { apiFetch } from '../lib/api';

export default function HospitalDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'requests'>('dashboard');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };
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

  const markAsRead = (id: number) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="flex-1 p-8 max-w-[1400px] mx-auto w-full relative">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900">{user?.name || 'Hospital Emergency Dashboard'}</h2>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
            AI Engine Status: <span className="font-semibold text-green-600">Optimal (14% Load)</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-500 hover:text-[#ee2b2b] transition-colors font-bold text-sm bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm mr-2"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            Logout
          </button>
          <div className="relative group" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center bg-white hover:shadow-sm transition-all relative"
            >
              <span className="material-symbols-outlined text-slate-600">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#ee2b2b] rounded-full ring-2 ring-white"></span>
              )}
            </button>

            {/* Notification Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-14 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="text-xs text-[#ee2b2b] font-semibold hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-sm">No notifications</div>
                    ) : (
                      notifications.map(notification => (
                        <div
                          key={notification.id}
                          onClick={() => markAsRead(notification.id)}
                          className={cn(
                            "p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer",
                            !notification.read ? "bg-red-50/30" : ""
                          )}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <h4 className={cn("text-sm font-bold", !notification.read ? "text-slate-900" : "text-slate-600")}>
                              {notification.title}
                            </h4>
                            <span className="text-xs text-slate-400">{notification.time}</span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2">{notification.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-3 text-center border-t border-slate-100 bg-slate-50">
                    <button className="text-xs font-bold text-slate-600 hover:text-[#ee2b2b]">View All History</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => setActiveTab('requests')}
            className="bg-[#ee2b2b] hover:bg-[#ee2b2b]/90 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-[#ee2b2b]/20 transition-all transform active:scale-95"
          >
            <span className="material-symbols-outlined">add_alert</span>
            Raise Emergency Request
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'dashboard' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'inventory' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Inventory
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'requests' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Requests
        </button>
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && (
        <DashboardView
          setActiveTab={setActiveTab}
          stats={{
            requests: requests.length,
            matches: 48,
            inventory: inventory.reduce((acc, curr) => acc + curr.units, 0)
          }}
        />
      )}
      {activeTab === 'inventory' && <InventoryView inventory={inventory} />}
      {activeTab === 'requests' && <RequestWizardView requests={requests} />}

      {/* Chat Toggle */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-8 right-8 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform z-50"
      >
        <span className="material-symbols-outlined">chat</span>
        <span className="text-sm font-bold">Donor Chat</span>
      </button>

      <Chat isOpen={showChat} recipientName="Sarah J." recipientType="donor" onClose={() => setShowChat(false)} />
    </div>
  );
}

function DashboardView({ setActiveTab, stats }: { setActiveTab: (tab: 'dashboard' | 'inventory' | 'requests') => void; stats: { requests: number; matches: number; inventory: number } }) {
  const [quickRequestType, setQuickRequestType] = useState('O-');
  const [quickRequestUrgency, setQuickRequestUrgency] = useState('Critical (Immediate)');
  const [quickRequestUnits, setQuickRequestUnits] = useState(2);
  const [isMatching, setIsMatching] = useState(false);

  const handleQuickMatch = () => {
    setIsMatching(true);
    setTimeout(() => {
      setIsMatching(false);
      setActiveTab('requests'); // Redirect to full request view or show success
      // Ideally show a success toast here
    }, 2000);
  };

  return (
    <div className="space-y-8">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Active Blood Requests</p>
              <h3 className="text-3xl font-black">12</h3>
            </div>
            <div className="bg-[#ee2b2b]/10 p-2 rounded-lg text-[#ee2b2b]">
              <span className="material-symbols-outlined">bloodtype</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-green-600 font-bold">+2</span>
            <span className="text-slate-400">since last hour</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Potential Matches</p>
              <h3 className="text-3xl font-black">48</h3>
            </div>
            <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500">
              <span className="material-symbols-outlined">groups</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-green-600 font-bold">+5</span>
            <span className="text-slate-400">new local donors</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">AI Engine Load</p>
              <h3 className="text-3xl font-black">14%</h3>
            </div>
            <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
              <span className="material-symbols-outlined">psychology</span>
            </div>
          </div>
          <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="bg-[#ee2b2b] h-full rounded-full" style={{ width: '14%' }}></div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Latency: 0.8s • 2,400 scans/sec</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-bold">Active AI Matching Sessions</h4>
            <a href="#" className="text-sm font-semibold text-[#ee2b2b] hover:underline">View All</a>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl border border-[#ee2b2b]/20 bg-[#ee2b2b]/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#ee2b2b] text-white flex items-center justify-center font-black text-lg">O-</div>
                <div>
                  <h5 className="font-bold">Urgent Transfusion Req #882</h5>
                  <p className="text-sm text-slate-500">Requested 12m ago • 2 Units</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs font-bold text-[#ee2b2b] uppercase tracking-wider">Critical Priority</p>
                  <p className="text-sm font-medium">8 Donors Notified</p>
                </div>
                <span className="material-symbols-outlined text-slate-400">chevron_right</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-lg">A+</div>
                <div>
                  <h5 className="font-bold">Surgical Reserve Req #879</h5>
                  <p className="text-sm text-slate-500">Requested 2h ago • 5 Units</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Standard</p>
                  <p className="text-sm font-medium">14 Donors Notified</p>
                </div>
                <span className="material-symbols-outlined text-slate-400">chevron_right</span>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ee2b2b]">post_add</span>
            Quick Request
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Blood Type Needed</label>
              <div className="grid grid-cols-4 gap-2">
                {['O-', 'O+', 'A-', 'A+'].map(type => (
                  <button
                    key={type}
                    onClick={() => setQuickRequestType(type)}
                    className={cn(
                      "py-2 border rounded-lg text-sm font-bold transition-colors",
                      quickRequestType === type
                        ? "border-[#ee2b2b] bg-[#ee2b2b]/5 text-[#ee2b2b] border-2"
                        : "border-slate-200 hover:border-[#ee2b2b]"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Urgency Level</label>
              <select
                value={quickRequestUrgency}
                onChange={(e) => setQuickRequestUrgency(e.target.value)}
                className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm focus:ring-[#ee2b2b] focus:border-[#ee2b2b]"
              >
                <option>Standard (Within 24h)</option>
                <option>Critical (Immediate)</option>
                <option>Life-Threatening (Priority 1)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Quantity (Units)</label>
              <input
                className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm focus:ring-[#ee2b2b] focus:border-[#ee2b2b]"
                type="number"
                value={quickRequestUnits}
                onChange={(e) => setQuickRequestUnits(parseInt(e.target.value))}
                min={1}
              />
            </div>
            <button
              onClick={handleQuickMatch}
              disabled={isMatching}
              className="w-full bg-[#ee2b2b] text-white py-3 rounded-xl font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isMatching ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Matching...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">search_spark</span>
                  Start AI Matching
                </>
              )}
            </button>
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

  const handleSubmit = () => {
    if (!bloodType) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      // Reset or show success
      alert('Request submitted successfully!');
    }, 2000);
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
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-4">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm p-3 focus:ring-[#ee2b2b] focus:border-[#ee2b2b]"
              >
                <option>Major Trauma / Surgery</option>
                <option>Internal Bleeding</option>
                <option>Transfusion Therapy</option>
                <option>Other Emergency</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!bloodType || isSubmitting}
          className="flex items-center gap-2 bg-[#ee2b2b] text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-[#ee2b2b]/20 hover:bg-red-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Processing...' : 'Configure AI Search'}
          {!isSubmitting && <span className="material-symbols-outlined text-sm">arrow_forward</span>}
        </button>
      </div>
    </div>
  );
}
