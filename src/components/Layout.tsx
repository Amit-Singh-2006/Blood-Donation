import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function Layout() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, [location.pathname]); // Update when navigating in case user changes

  const hideNav = location.pathname === '/' || location.pathname === '/register-donor' || location.pathname === '/register-hospital' || location.pathname === '/register-admin' || location.pathname === '/how-it-works' || location.pathname === '/emergency-network' || location.pathname === '/impact-reports';

  // Determine layout type based on path
  const isSidebarLayout = location.pathname.startsWith('/admin') || location.pathname.startsWith('/hospital') || location.pathname.startsWith('/analytics') || location.pathname.startsWith('/tracking');
  const isDonorLayout = location.pathname.startsWith('/donor');

  // Close notifications when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim() !== '') {
      navigate('/donor/centers');
      setSearchQuery('');
    }
  };

  if (hideNav) {
    return <Outlet />;
  }

  if (isSidebarLayout) {
    return (
      <div className="flex min-h-screen bg-[#f8f6f6] font-sans text-slate-900">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-20">
          <div className="p-6 flex items-center gap-3">
            <div className="bg-[#ee2b2b] text-white p-1.5 rounded-lg">
              <span className="material-symbols-outlined block">emergency_share</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#ee2b2b]">LifeLink AI</h1>
          </div>

          <nav className="flex-1 px-4 space-y-2 mt-4">
            {location.pathname.startsWith('/admin') ? (
              <>
                <NavLink to="/admin" icon="dashboard" label="Network Overview" />
                <NavLink to="/admin/hospitals" icon="local_hospital" label="Hospitals" />
                <NavLink to="/admin/donors" icon="group" label="Donors" />
                <NavLink to="/analytics" icon="query_stats" label="Analytics" />
                <NavLink to="/admin/settings" icon="settings" label="Settings" />
              </>
            ) : (
              <>
                <NavLink to="/hospital" icon="dashboard" label="Dashboard" />
                <NavLink to="/hospital/requests" icon="notifications_active" label="Emergency Requests" />
                <NavLink to="/tracking" icon="map" label="Live Tracking" />
                <NavLink to="/hospital/inventory" icon="inventory_2" label="Inventory" />
                <NavLink to="/analytics" icon="analytics" label="Analytics" />
              </>
            )}
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center gap-3 px-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                <span className="material-symbols-outlined text-slate-400">person</span>
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">
                  {location.pathname.startsWith('/admin') ? 'Sarah Jenkins' : 'City General'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {location.pathname.startsWith('/admin') ? 'System Admin' : 'Hospital Admin'}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64">
          <Outlet />
        </main>
      </div>
    );
  }

  // Donor / Default Topbar Layout
  return (
    <div className="min-h-screen bg-[#f8f6f6] font-sans text-slate-900 flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
          <div className="flex items-center gap-10">
            <Link to="/donor" className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ee2b2b] text-3xl">water_drop</span>
              <span className="text-xl font-bold tracking-tight text-slate-900">LifeLink AI</span>
            </Link>

            {isDonorLayout && (
              <nav className="hidden md:flex items-center gap-6">
                <Link to="/donor" className={cn("text-sm font-medium transition-colors hover:text-[#ee2b2b]", location.pathname === '/donor' ? "text-[#ee2b2b] font-bold" : "text-slate-600")}>Dashboard</Link>
                <Link to="/donor/centers" className={cn("text-sm font-medium transition-colors hover:text-[#ee2b2b]", location.pathname === '/donor/centers' ? "text-[#ee2b2b] font-bold" : "text-slate-600")}>Donation Centers</Link>
                <Link to="/donor/impact" className={cn("text-sm font-medium transition-colors hover:text-[#ee2b2b]", location.pathname === '/donor/impact' ? "text-[#ee2b2b] font-bold" : "text-slate-600")}>Impact Report</Link>
                <Link to="/donor/community" className={cn("text-sm font-medium transition-colors hover:text-[#ee2b2b]", location.pathname === '/donor/community' ? "text-[#ee2b2b] font-bold" : "text-slate-600")}>Community</Link>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isDonorLayout ? (
              <>
                <div className="relative hidden sm:block">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                  <input
                    className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-[#ee2b2b]/20 w-64 transition-all"
                    placeholder="Search hospitals..."
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearch}
                  />
                </div>

                <div className="relative" ref={notificationRef}>
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors relative"
                  >
                    <span className="material-symbols-outlined">notifications</span>
                    <span className="absolute top-2 right-2 w-2 h-2 bg-[#ee2b2b] rounded-full ring-2 ring-white"></span>
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-4 border-b border-slate-50 flex justify-between items-center">
                        <h4 className="font-bold text-sm">Notifications</h4>
                        <span className="text-[10px] font-bold text-[#ee2b2b] bg-[#ee2b2b]/10 px-2 py-0.5 rounded-full">2 New</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <div className="p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 cursor-pointer">
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#ee2b2b]/10 flex items-center justify-center text-[#ee2b2b] shrink-0">
                              <span className="material-symbols-outlined text-sm">emergency</span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">Urgent O- Request</p>
                              <p className="text-xs text-slate-500 mt-0.5">City General Hospital needs your help immediately.</p>
                              <p className="text-[10px] text-slate-400 mt-2 font-medium">2 mins ago</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer">
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                              <span className="material-symbols-outlined text-sm">check_circle</span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">Donation Verified</p>
                              <p className="text-xs text-slate-500 mt-0.5">Your donation at Red Cross #4 has been processed.</p>
                              <p className="text-[10px] text-slate-400 mt-2 font-medium">1 day ago</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-2 bg-slate-50 text-center border-t border-slate-100">
                        <button className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b]">Mark all as read</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setShowProfile(!showProfile)}
                    className="flex items-center gap-2 bg-slate-100 p-1 pr-3 rounded-full hover:bg-slate-200 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#ee2b2b]/10 flex items-center justify-center text-[#ee2b2b]">
                      <span className="material-symbols-outlined text-sm">person</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700 max-w-[80px] truncate">{user?.name || 'User'}</span>
                  </button>
                  {showProfile && (
                    <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-4 border-b border-slate-50">
                        <p className="font-bold text-sm text-slate-900">{user?.name || 'User'}</p>
                        <p className="text-xs text-slate-500">{user?.email || 'user@example.com'}</p>
                      </div>
                      <div className="p-2 space-y-1">
                        <Link to="/donor/impact" onClick={() => setShowProfile(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-[#ee2b2b] transition-colors">
                          <span className="material-symbols-outlined text-lg">workspace_premium</span>
                          My Rewards
                        </Link>
                        <Link to="/donor" onClick={() => setShowProfile(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-[#ee2b2b] transition-colors">
                          <span className="material-symbols-outlined text-lg">monitoring</span>
                          Impact History
                        </Link>
                        <Link to="/donor/settings" onClick={() => setShowProfile(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-[#ee2b2b] transition-colors">
                          <span className="material-symbols-outlined text-lg">settings</span>
                          Settings
                        </Link>
                      </div>
                      <div className="border-t border-slate-50 p-2">
                        <button onClick={() => { setShowProfile(false); localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/'); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-[#ee2b2b] transition-colors">
                          <span className="material-symbols-outlined text-lg">logout</span>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link to="/" className="text-sm font-bold text-slate-600 hover:text-[#ee2b2b]">Login</Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-xs">© 2024 LifeLink AI. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b] transition-colors">Privacy Policy</a>
            <a href="#" className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b] transition-colors">Terms of Service</a>
            <a href="#" className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b] transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/admin' && to !== '/hospital' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
        isActive
          ? "bg-[#ee2b2b]/10 text-[#ee2b2b] font-semibold"
          : "text-slate-600 hover:bg-slate-50"
      )}
    >
      <span className="material-symbols-outlined">{icon}</span>
      {label}
    </Link>
  );
}
