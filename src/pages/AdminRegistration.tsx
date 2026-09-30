import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../lib/api';
import { saveUser } from '../lib/session';
import { PASSWORD_RULES, passwordProblems } from '../lib/password';

interface InviteCheck {
  valid: boolean;
  reason?: string;
  kind?: 'setup' | 'invite';
  name?: string;
  email?: string;
  jurisdiction?: string;
  is_national?: boolean;
  expires_at?: string;
}

const inputClass = 'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all outline-none text-slate-900 placeholder:text-slate-400';

export default function AdminRegistration() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<InviteCheck | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const checkCode = async (value = code) => {
    if (!value.trim()) return;
    setChecking(true);
    setError('');
    try {
      const result: InviteCheck = await apiFetch('/auth/admin-invite/check', { method: 'POST', body: JSON.stringify({ code: value.trim() }) });
      setCheck(result);
      if (result.valid && result.kind === 'invite') {
        setName(result.name ?? '');
        setEmail(result.email ?? '');
      }
    } catch (err: any) {
      setCheck({ valid: false, reason: err.message || 'Could not check the code. Please try again.' });
    } finally {
      setChecking(false);
    }
  };

  // Invite links carry the code (?code=...): check it straight away
  useEffect(() => {
    if (params.get('code')) checkCode(params.get('code')!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verified = check?.valid === true;
  const lockedEmail = verified && check?.kind === 'invite';
  const problems = passwordProblems(password);
  const canSubmit = verified && name.trim().length >= 2 && email.trim() !== '' && problems.length === 0 && password === confirm && agreed;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setError(password !== confirm ? 'The two passwords do not match.' : 'Please complete every field above.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { user } = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role: 'admin', admin_invite_code: code.trim() }),
      });
      saveUser(user);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f6] flex flex-col">
      <header className="w-full px-4 sm:px-6 lg:px-20 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-slate-200">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-[#ee2b2b] p-1.5 rounded-lg text-white">
            <span className="material-symbols-outlined text-2xl">shield_person</span>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900">LifeLink <span className="text-[#ee2b2b]">Admin</span></span>
        </Link>
        <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-[#ee2b2b]">Sign in</Link>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Set up your admin account</h1>
          <p className="text-slate-500">
            Each invite is issued to one person, for one jurisdiction, and works once.
          </p>
        </div>

        {/* Step 1: the invite code */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-[#ee2b2b] text-white text-xs font-black flex items-center justify-center">1</span>
            <h2 className="font-black text-slate-900">Check your invite code</h2>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); checkCode(); }} className="flex flex-col sm:flex-row gap-2">
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); setCheck(null); }}
              placeholder="LL-XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              aria-label="Invite code"
              className={`${inputClass} font-mono tracking-wider uppercase flex-1`}
            />
            <button
              type="submit"
              disabled={!code.trim() || checking}
              className="px-5 py-3 rounded-xl bg-[#ee2b2b] text-white font-bold hover:bg-red-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {checking ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-lg">fact_check</span>}
              Check code
            </button>
          </form>

          <AnimatePresence mode="wait">
            {check && (
              <motion.div
                key={check.valid ? 'ok' : 'bad'}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="status"
                className={`rounded-xl p-4 text-sm border ${check.valid ? 'bg-green-50 border-green-200 text-green-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}
              >
                {check.valid ? (
                  <div className="space-y-1">
                    <p className="font-black flex items-center gap-2"><span className="material-symbols-outlined text-lg">verified</span>
                      {check.kind === 'setup' ? 'Setup code accepted' : 'Invite is valid'}
                    </p>
                    {check.kind === 'setup' ? (
                      <p>This creates the first <strong>national admin</strong> (All India). After that, national admins send personal invites to city admins.</p>
                    ) : (
                      <>
                        <p>Issued to <strong>{check.name}</strong> ({check.email})</p>
                        <p>Jurisdiction: <strong>{check.is_national ? 'All India (national admin)' : check.jurisdiction}</strong></p>
                        {check.expires_at && <p>Valid until {new Date(check.expires_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="flex items-start gap-2"><span className="material-symbols-outlined text-lg">error</span>{check.reason}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Step 2: the account (only after the code checks out) */}
        <section className={`bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm transition-opacity ${verified ? '' : 'opacity-50 pointer-events-none select-none'}`} aria-disabled={!verified}>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-[#ee2b2b] text-white text-xs font-black flex items-center justify-center">2</span>
            <h2 className="font-black text-slate-900">Create your account</h2>
          </div>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-name" className="text-sm font-bold text-slate-700">Full name</label>
              <input id="admin-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Rahul Verma" autoComplete="name" disabled={!verified} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="text-sm font-bold text-slate-700">Email address</label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={lockedEmail}
                className={`${inputClass} ${lockedEmail ? 'bg-slate-50 text-slate-500' : ''}`}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={!verified}
              />
              {lockedEmail && <p className="text-xs text-slate-500">This invite only works with the email it was issued to.</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="text-sm font-bold text-slate-700">Password</label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-12`}
                  autoComplete="new-password"
                  disabled={!verified}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900">
                  <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1">
                {PASSWORD_RULES.map(([label, ok]) => (
                  <li key={label} className={`text-xs font-bold flex items-center gap-1 ${ok(password) ? 'text-green-700' : 'text-slate-400'}`}>
                    <span className="material-symbols-outlined text-sm">{ok(password) ? 'check_circle' : 'radio_button_unchecked'}</span>{label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="admin-confirm" className="text-sm font-bold text-slate-700">Confirm password</label>
              <input id="admin-confirm" type={showPassword ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" disabled={!verified} />
              {confirm && confirm !== password && <p className="text-xs font-bold text-amber-700">The passwords do not match yet.</p>}
            </div>

            <label className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 w-4 h-4 accent-slate-900" disabled={!verified} />
              <span>I will use donor and hospital data only to run LifeLink in my jurisdiction, and handle it as the <Link to="/privacy" className="font-bold underline">Privacy Policy</Link> and the DPDP Act, 2023 require.</span>
            </label>

            {error && <p role="alert" className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="w-full py-4 rounded-xl bg-[#ee2b2b] text-white font-black hover:bg-red-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? 'Creating account…' : 'Create admin account'}
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </form>
        </section>

        <p className="text-center text-sm text-slate-500">
          Already have an admin account? <Link to="/login" className="font-bold text-[#ee2b2b] hover:underline">Sign in</Link>
        </p>
      </main>
    </div>
  );
}
