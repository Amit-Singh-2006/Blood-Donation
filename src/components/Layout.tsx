import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/auth';

export default function Layout() {
  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setMenuOpen(false);
  }, [location.pathname]); // Update when navigating in case user changes

  const hideNav = ['/', '/login', '/register-donor', '/register-hospital', '/register-admin', '/how-it-works', '/emergency-network', '/impact-reports', '/privacy', '/terms', '/partnership', '/support', '/track'].includes(location.pathname)
    || location.pathname.startsWith('/track/');

  // Determine layout type based on path
  const isSidebarLayout = location.pathname.startsWith('/admin') || location.pathname.startsWith('/hospital') || location.pathname.startsWith('/analytics');
  const isDonorLayout = location.pathname.startsWith('/donor');

  // Close the profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    setShowProfile(false);
    await signOut();
    setUser(null);
    navigate('/login');
  };

  if (hideNav) {
    return <Outlet />;
  }

  if (isSidebarLayout) {
    return (
      <div className="flex min-h-screen bg-[#f8f6f6] font-sans text-slate-900">
        {/* Phones and tablets: the sidebar slides in over the page */}
        {menuOpen && <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
        <aside className={cn(
          "w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-50 transition-transform duration-200 lg:translate-x-0",
          menuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}>
          <div className="p-6 flex items-center gap-3">
            <div className="bg-[#ee2b2b] text-white p-1.5 rounded-lg">
              <span className="material-symbols-outlined block">emergency_share</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#ee2b2b]">LifeLink AI</h1>
          </div>

          <nav className="flex-1 px-4 space-y-2 mt-4">
            {/* Links follow the signed-in role; the dashboards themselves check access */}
            {user?.role === 'admin' ? (
              <NavLink to="/admin" icon="dashboard" label="Admin Dashboard" />
            ) : user?.role === 'hospital' ? (
              <NavLink to="/hospital" icon="dashboard" label="Hospital Dashboard" />
            ) : user?.role === 'donor' ? (
              <NavLink to="/donor" icon="dashboard" label="My Dashboard" />
            ) : (
              <NavLink to="/" icon="home" label="Home" />
            )}
            <NavLink to="/analytics" icon="analytics" label="Network Analytics" />
            <NavLink to="/track" icon="map" label="Track a Request" />
          </nav>

          <div className="p-4 border-t border-slate-100">
            {user ? (
              <>
                <div className="flex items-center gap-3 px-2 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#ee2b2b]/10 flex items-center justify-center overflow-hidden">
                    <span className="material-symbols-outlined text-[#ee2b2b]">person</span>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate">
                      {user?.name || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-xs text-slate-500 truncate capitalize">
                      {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  Sign Out
                </button>
              </>
            ) : (
              <Link to="/login" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#ee2b2b] text-white text-sm font-semibold hover:bg-[#ee2b2b]/90 transition-colors">
                <span className="material-symbols-outlined text-lg">login</span>
                Sign In
              </Link>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 lg:ml-64">
          <div className="lg:hidden sticky top-0 z-30 h-14 px-4 flex items-center gap-3 bg-white/90 backdrop-blur-md border-b border-slate-200">
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <span className="text-lg font-bold tracking-tight text-[#ee2b2b]">LifeLink AI</span>
          </div>
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
                <Link to="/donor/centers" className={cn("text-sm font-medium transition-colors hover:text-[#ee2b2b]", location.pathname === '/donor/centers' ? "text-[#ee2b2b] font-bold" : "text-slate-600")}>Where to Donate</Link>
                <Link to="/donor/impact" className={cn("text-sm font-medium transition-colors hover:text-[#ee2b2b]", location.pathname === '/donor/impact' ? "text-[#ee2b2b] font-bold" : "text-slate-600")}>My Impact</Link>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isDonorLayout ? (
              <>
                {/* Live alerts are on the dashboard; there is no separate notification feed */}
                <Link to="/donor" title="Your alerts" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
                  <span className="material-symbols-outlined">notifications</span>
                </Link>
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
                        <p className="text-xs text-slate-500">{user?.email}</p>
                      </div>
                      <div className="p-2 space-y-1">
                        <Link to="/donor/impact" onClick={() => setShowProfile(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-[#ee2b2b] transition-colors">
                          <span className="material-symbols-outlined text-lg">workspace_premium</span>
                          My Impact
                        </Link>
                        <Link to="/donor" onClick={() => setShowProfile(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-[#ee2b2b] transition-colors">
                          <span className="material-symbols-outlined text-lg">monitoring</span>
                          Dashboard
                        </Link>
                        <Link to="/donor/settings" onClick={() => setShowProfile(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-[#ee2b2b] transition-colors">
                          <span className="material-symbols-outlined text-lg">settings</span>
                          Settings
                        </Link>
                      </div>
                      <div className="border-t border-slate-50 p-2">
                        <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-[#ee2b2b] transition-colors">
                          <span className="material-symbols-outlined text-lg">logout</span>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-[#ee2b2b]">Login</Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-xs">© {new Date().getFullYear()} LifeLink AI. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b] transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b] transition-colors">Terms of Service</Link>
            <Link to="/support" className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b] transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && to !== '/admin' && to !== '/hospital' && location.pathname.startsWith(to));

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
