import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch } from '../lib/api';
import { PASSWORD_RULES, passwordProblems } from '../lib/password';

type Step = 'email' | 'code' | 'authenticator' | 'password' | 'done';

const input = 'w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400';
const codeInput = 'w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-2xl font-black tracking-[0.3em] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b]';
const primary = 'w-full bg-[#ee2b2b] text-white py-3.5 rounded-lg font-bold shadow-lg shadow-[#ee2b2b]/20 hover:bg-[#ee2b2b]/90 transition-all disabled:opacity-60';
const quiet = 'text-xs font-bold text-[#ee2b2b] hover:underline disabled:text-slate-400 disabled:no-underline';

const TITLES: Record<Step, [string, string]> = {
  email: ['Reset your password', "Enter the email you use for LifeLink, and we'll send you a 6-digit code."],
  code: ['Check your email', ''],
  authenticator: ['Two-step verification', 'Your account also uses an authenticator app. Enter its 6-digit code to continue.'],
  password: ['Choose a new password', 'You will be signed out on every device, then sign in with the new password.'],
  done: ['Password changed', 'You have been signed out on every device. Sign in with your new password.'],
};

/**
 * Forgot password: an emailed code, then (admins and hospitals) the authenticator
 * code, then a new password. Every answer reads the same whether or not the email
 * has an account, so the page cannot be used to find out who is registered.
 */
export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('email') ?? '');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [appCode, setAppCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; restart: boolean } | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: any) {
      const text = err.message || 'Something went wrong. Please try again.';
      setError({ text, restart: /timed out|expired|too many wrong/i.test(text) });
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStep('email');
    setCode('');
    setToken('');
    setAppCode('');
    setPassword('');
    setConfirm('');
    setError(null);
  };

  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    run(async () => {
      await apiFetch('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setCode('');
      setStep('code');
      setResendIn(60);
    });
  };

  const checkCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const result = await apiFetch('/auth/password/verify', { method: 'POST', body: JSON.stringify({ email: email.trim(), code }) });
      setToken(result.token);
      setStep(result.second_step ? 'authenticator' : 'password');
    });
  };

  const checkApp = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await apiFetch('/auth/password/second-step', { method: 'POST', body: JSON.stringify({ token, code: appCode.trim() }) });
      setStep('password');
    });
  };

  const problems = passwordProblems(password);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (problems.length) {
      setError({ text: `Your new password needs ${problems.join(', ')}.`, restart: false });
      return;
    }
    if (password !== confirm) {
      setError({ text: 'The two passwords do not match.', restart: false });
      return;
    }
    run(async () => {
      await apiFetch('/auth/password/reset', { method: 'POST', body: JSON.stringify({ token, password }) });
      setStep('done');
    });
  };

  const [title, intro] = TITLES[step];
  return (
    <div className="min-h-screen flex flex-col bg-[#f8f6f6] relative overflow-hidden">
      <header className="w-full px-4 sm:px-6 lg:px-20 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-[#ee2b2b]/10 sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-[#ee2b2b] p-1.5 rounded-lg text-white">
            <span className="material-symbols-outlined text-2xl">vital_signs</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">LifeLink <span className="text-[#ee2b2b]">AI</span></h1>
        </Link>
        <Link to="/login" className="text-sm font-bold text-slate-700 hover:text-[#ee2b2b] transition-colors">Sign in</Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-110 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-[#ee2b2b]">
                {step === 'done' ? 'check_circle' : step === 'authenticator' ? 'shield_lock' : step === 'code' ? 'mark_email_unread' : 'lock_reset'}
              </span>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900">{title}</h2>
            <p className="text-slate-500 font-medium">
              {step === 'code'
                ? <>If <strong className="text-slate-700 break-all">{email.trim()}</strong> has a LifeLink account, we have sent it a 6-digit code. It works for 15 minutes; check your spam folder too.</>
                : intro}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-[0_10px_25px_-5px_rgba(242,13,13,0.05)]">
            {error && (
              <div role="alert" className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-bold border border-red-100">
                {error.text}
                {error.restart && <button type="button" onClick={restart} className="block mt-2 underline">Start again</button>}
              </div>
            )}

            {step === 'email' && (
              <form onSubmit={sendCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="reset-email" className="text-sm font-bold text-slate-700 ml-1">Email address</label>
                  <input id="reset-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="name@example.com" />
                </div>
                <button type="submit" disabled={busy} className={primary}>{busy ? 'Sending…' : 'Send code'}</button>
              </form>
            )}

            {step === 'code' && (
              <form onSubmit={checkCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="reset-code" className="text-sm font-bold text-slate-700 ml-1">Code from the email</label>
                  <input
                    id="reset-code" required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456"
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className={codeInput}
                  />
                </div>
                <button type="submit" disabled={busy || code.length !== 6} className={primary}>{busy ? 'Checking…' : 'Continue'}</button>
                <div className="flex items-center justify-between gap-3">
                  <button type="button" disabled={busy || resendIn > 0} onClick={() => sendCode()} className={quiet}>
                    {resendIn > 0 ? `Send a new code in ${resendIn} s` : 'Send a new code'}
                  </button>
                  <button type="button" onClick={restart} className="text-xs font-bold text-slate-500 hover:text-slate-700">Use a different email</button>
                </div>
              </form>
            )}

            {step === 'authenticator' && (
              <form onSubmit={checkApp} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="reset-app-code" className="text-sm font-bold text-slate-700 ml-1">{useBackup ? 'Backup code' : 'Code from your authenticator app'}</label>
                  <input
                    id="reset-app-code" required autoFocus autoComplete="one-time-code"
                    inputMode={useBackup ? 'text' : 'numeric'} maxLength={useBackup ? 9 : 6} placeholder={useBackup ? 'XXXX-XXXX' : '123456'}
                    value={appCode}
                    onChange={(e) => setAppCode(useBackup ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={codeInput}
                  />
                </div>
                <button type="submit" disabled={busy || (useBackup ? appCode.trim().length < 8 : appCode.length !== 6)} className={primary}>
                  {busy ? 'Checking…' : 'Continue'}
                </button>
                <button type="button" onClick={() => { setUseBackup(!useBackup); setAppCode(''); setError(null); }} className={quiet}>
                  {useBackup ? 'Use the authenticator app instead' : 'Lost your phone? Use a backup code'}
                </button>
                {useBackup && (
                  <p className="text-xs text-slate-500">No backup codes either? Ask your LifeLink admin to reset two-step verification for your account, then try again.</p>
                )}
              </form>
            )}

            {step === 'password' && (
              <form onSubmit={save} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="text-sm font-bold text-slate-700 ml-1">New password</label>
                  <div className="relative">
                    <input
                      id="new-password" required autoFocus autoComplete="new-password" type={showPassword ? 'text' : 'password'}
                      value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} pr-12`}
                    />
                    <button
                      type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#ee2b2b] transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                  {PASSWORD_RULES.map(([label, ok]) => (
                    <li key={label} className={`flex items-center gap-1.5 ${ok(password) ? 'text-green-700' : 'text-slate-400'}`}>
                      <span className="material-symbols-outlined text-sm">{ok(password) ? 'check_circle' : 'radio_button_unchecked'}</span>{label}
                    </li>
                  ))}
                </ul>
                <div className="space-y-1.5">
                  <label htmlFor="confirm-password" className="text-sm font-bold text-slate-700 ml-1">Type it again</label>
                  <input
                    id="confirm-password" required autoComplete="new-password" type={showPassword ? 'text' : 'password'}
                    value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input}
                  />
                </div>
                <button type="submit" disabled={busy} className={primary}>{busy ? 'Saving…' : 'Change password'}</button>
              </form>
            )}

            {step === 'done' && (
              <Link to={`/login?email=${encodeURIComponent(email.trim())}`} className={`${primary} block text-center`}>Sign in</Link>
            )}
          </div>

          {step !== 'done' && (
            <p className="text-center text-sm text-slate-500">
              Remembered it? <Link to="/login" className="font-bold text-[#ee2b2b] hover:underline">Sign in</Link>
            </p>
          )}
        </motion.div>
      </main>
    </div>
  );
}
