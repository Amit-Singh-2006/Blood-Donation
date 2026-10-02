import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch } from '../lib/api';
import { DASHBOARD, ROLES, ROLE_LABEL, Role, saveUser, signedInUsers } from '../lib/session';
import TwoStepVerification, { type SecondStepChallenge } from '../components/TwoStepVerification';
import { isNativeApp } from '../lib/app';

export default function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('email') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Stay signed in for 30 days; ticked in the app, a choice on shared computers
  const [remember, setRemember] = useState(isNativeApp);
  // Admins and hospitals continue with a code from their authenticator app
  const [challenge, setChallenge] = useState<SecondStepChallenge | null>(null);
  const params = new URLSearchParams(window.location.search);
  // Sent here to open a dashboard this browser isn't signed in to yet
  const asRole = (ROLES as string[]).includes(params.get('as') ?? '') ? (params.get('as') as Role) : null;
  const [error, setError] = useState<string | null>(() =>
    params.get('expired') ? `Your${asRole ? ` ${ROLE_LABEL[asRole].toLowerCase()}` : ''} session expired. Please sign in again.` : null
  );
  const accounts = signedInUsers();

  const finish = (user: any) => {
    saveUser(user);
    navigate(DASHBOARD[user.role as Role] ?? '/', { replace: true });
  };

  // One form for everyone: the account itself says whether it is a donor,
  // hospital or admin, so there is no role to pick (and none to get wrong)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password, remember }),
      });
      if (res.mfa) {
        setChallenge(res.mfa);
        return;
      }
      finish(res.user);
    } catch (err: any) {
      setError(err.message === 'Invalid credentials' ? 'That email and password do not match an account.' : err.message || 'Sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f6f6] relative overflow-hidden">
      <header className="w-full px-4 sm:px-6 lg:px-20 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-[#ee2b2b]/10 sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-[#ee2b2b] p-1.5 rounded-lg text-white">
            <span className="material-symbols-outlined text-2xl">vital_signs</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">LifeLink <span className="text-[#ee2b2b]">AI</span></h1>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/how-it-works" className="text-sm font-semibold hover:text-[#ee2b2b] transition-colors">How it Works</Link>
          <Link to="/emergency-network" className="text-sm font-semibold hover:text-[#ee2b2b] transition-colors">Emergency Network</Link>
          <Link to="/support" className="text-sm font-semibold hover:text-[#ee2b2b] transition-colors">Support</Link>
        </nav>
        <Link to="/register-donor" className="bg-[#ee2b2b] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-[#ee2b2b]/20 hover:bg-[#ee2b2b]/90 transition-all">
          Become a donor
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative">
        <div className="absolute top-20 left-10 w-64 h-64 bg-[#ee2b2b]/5 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#ee2b2b]/10 rounded-full blur-3xl -z-10"></div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-110 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">Sign in</h2>
            <p className="text-slate-500 font-medium">
              {asRole && !error ? `Sign in with your ${ROLE_LABEL[asRole].toLowerCase()} account to open the ${ROLE_LABEL[asRole].toLowerCase()} dashboard.` : 'For donors, hospitals and LifeLink admins.'}
            </p>
          </div>

          {accounts.length > 0 && (
            <div className="bg-white/70 rounded-2xl border border-slate-200 p-4 space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Signed in on this browser</p>
              {accounts.map((a) => (
                <div key={a.role} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate"><strong className="text-slate-900">{ROLE_LABEL[a.role as Role]}</strong> <span className="text-slate-500">· {a.name || a.email}</span></span>
                  <Link to={DASHBOARD[a.role as Role]} className="shrink-0 text-xs font-black text-[#ee2b2b] hover:underline">Open dashboard →</Link>
                </div>
              ))}
              <p className="text-[11px] text-slate-500">You can be signed in as an admin, a hospital and a donor at the same time.</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-[0_10px_25px_-5px_rgba(242,13,13,0.05)]">
            {error && (
              <div role="alert" className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-bold border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-bold text-slate-700 ml-1">Email address</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ee2b2b] transition-colors">mail</span>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-sm font-bold text-slate-700 ml-1">Password</label>
                  <Link to={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ''}`} className="text-xs font-bold text-[#ee2b2b] hover:underline">Forgot password?</Link>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ee2b2b] transition-colors">lock</span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400"
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#ee2b2b] transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-600 cursor-pointer select-none ml-1">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 accent-[#ee2b2b]"
                />
                Keep me signed in
                <span className="text-xs text-slate-400">(not on a shared computer)</span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#ee2b2b] text-white py-4 rounded-lg font-bold text-lg shadow-xl shadow-[#ee2b2b]/20 hover:bg-[#ee2b2b]/90 active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sign in'}
              </button>
            </form>
          </div>

          <div className="bg-white/70 rounded-2xl border border-slate-200 p-5 space-y-3 text-sm">
            <p className="font-bold text-slate-700">New to LifeLink?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Link to="/register-donor" className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:border-[#ee2b2b] hover:text-[#ee2b2b] transition-colors">
                <span className="material-symbols-outlined text-lg">volunteer_activism</span> Register as a donor
              </Link>
              <Link to="/register-hospital" className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:border-[#ee2b2b] hover:text-[#ee2b2b] transition-colors">
                <span className="material-symbols-outlined text-lg">local_hospital</span> Register a hospital
              </Link>
            </div>
            <p className="text-slate-500">
              Received an admin invite? <Link to="/register-admin" className="font-bold text-[#ee2b2b] hover:underline">Set up your admin account</Link>
            </p>
          </div>
        </motion.div>
      </main>

      {challenge && (
        <TwoStepVerification challenge={challenge} onDone={finish} onCancel={() => { setChallenge(null); setPassword(''); }} />
      )}

      <footer className="w-full px-4 py-6 border-t border-slate-200">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center">
          <div className="flex gap-6">
            <Link className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b]" to="/privacy">Privacy Policy</Link>
            <Link className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b]" to="/terms">Terms of Service</Link>
            <Link className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b]" to="/partnership">Hospital Partnership</Link>
          </div>
          <p className="text-xs font-bold text-slate-400">© {new Date().getFullYear()} LifeLink AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
