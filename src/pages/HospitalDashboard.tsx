import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Chat from '../components/Chat';
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [invData, reqData, donData] = await Promise.allSettled([
        apiFetch('/hospital/inventory'),
        apiFetch('/hospital/requests'),
        apiFetch('/hospital/donations'),
      ]);
      if (invData.status === 'fulfilled') setInventory(invData.value);
      if (reqData.status === 'fulfilled') setRequests(reqData.value);
      if (donData.status === 'fulfilled') setDonations(donData.value);
    } catch (err) {
      console.error('Failed to load data', err);
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

  const hospitalName = user?.name || 'City General Hospital';
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
                <p className="text-[9px] text-[#ee2b2b] font-black uppercase">Verified Facility</p>
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
              {activeTab === 'overview' && <OverviewTab requests={requests} inventory={inventory} donations={donations} onGoToRequests={() => setActiveTab('requests')} />}
              {activeTab === 'requests' && <RequestsTab requests={requests} onRefresh={fetchData} />}
              {activeTab === 'inventory' && <InventoryTab inventory={inventory} onRefresh={fetchData} />}
              {activeTab === 'map' && <MapTab />}
              {activeTab === 'analytics' && <AnalyticsTab requests={requests} inventory={inventory} />}
              {activeTab === 'settings' && <SettingsTab user={user} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Chat */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
      >
        <span className="material-symbols-outlined">forum</span>
      </button>
      <Chat isOpen={showChat} recipientName="Emergency Center" recipientType="hospital" onClose={() => setShowChat(false)} />
    </div>
  );
}

// ─────────────────── OVERVIEW TAB ───────────────────
function OverviewTab({ requests, inventory, donations, onGoToRequests }: { requests: any[], inventory: any[], donations: any[], onGoToRequests: () => void }) {
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
              <button className="bg-white text-slate-900 px-6 py-3 rounded-xl font-black text-xs hover:scale-105 transition-all">START CAMPAIGN</button>
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
function RequestsTab({ requests, onRefresh }: { requests: any[], onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ blood_group: 'O+', units_required: '', urgency: 'standard' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await apiFetch('/hospital/requests', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSuccess('Emergency request created successfully!');
      setShowForm(false);
      setForm({ blood_group: 'O+', units_required: '', urgency: 'standard' });
      onRefresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create request');
    } finally {
      setIsSubmitting(false);
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        {requests.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
            <span className="material-symbols-outlined text-5xl text-slate-200 mb-4 block">emergency_share</span>
            <p className="text-slate-400 font-bold">No emergency requests yet. Create your first one above.</p>
          </div>
        ) : requests.map((req, i) => (
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
                <p className="text-xs text-slate-500 mt-1">{req.units_required} units needed • {new Date(req.created_at).toLocaleDateString()}</p>
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

  const getUnits = (type: string) => {
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
    try {
      await apiFetch('/hospital/inventory', {
        method: 'PUT',
        body: JSON.stringify({ blood_group: type, units: parseInt(editValue) }),
      });
      setMessage(`${type} updated to ${editValue} units`);
      setEditingType(null);
      onRefresh();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('Failed to update: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-4 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-200">{message}</div>
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

// ─────────────────── ANALYTICS TAB ───────────────────
function AnalyticsTab({ requests, inventory }: { requests: any[], inventory: any[] }) {
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
          <button className="bg-white text-slate-900 px-6 py-3 rounded-xl font-black text-xs hover:scale-105 transition-all">START CAMPAIGN</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── SETTINGS TAB ───────────────────
function SettingsTab({ user }: { user: any }) {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 mb-6">Account Information</h3>
        <div className="space-y-4">
          {[
            { label: 'Hospital Name', value: user?.name || 'City General Hospital' },
            { label: 'Email', value: user?.email || '—' },
            { label: 'Role', value: 'Hospital' },
            { label: 'Account ID', value: user?.id || '—' },
          ].map((field, i) => (
            <div key={i} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
              <span className="text-sm font-bold text-slate-500">{field.label}</span>
              <span className="text-sm font-black text-slate-900">{field.value}</span>
            </div>
          ))}
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
