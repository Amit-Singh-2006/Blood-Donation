import { useState } from 'react';
import type { FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiFetch } from '../lib/api';

/** What the server returns after a correct password for an admin or hospital account. */
export interface SecondStepChallenge {
  mode: 'setup' | 'verify';
  token: string;
  role: 'admin' | 'hospital';
  name: string;
  email?: string;
  secret?: string;
  otpauth_url?: string;
}

const codeInput = 'w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-2xl font-black tracking-[0.3em] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b]';
const outline = 'flex-1 py-2.5 rounded-xl border border-red-200 text-[#ee2b2b] text-sm font-bold hover:bg-red-50';

/**
 * The second step of signing in for admins and hospitals. The first time it sets
 * up an authenticator app (QR code, then backup codes); after that it asks for
 * the app's 6-digit code, or a backup code for a lost phone.
 */
export default function TwoStepVerification({ challenge, onDone, onCancel }: {
  challenge: SecondStepChallenge;
  onDone: (user: any) => void;
  onCancel: () => void;
}) {
  const setup = challenge.mode === 'setup';
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; restart: boolean } | null>(null);
  const [backup, setBackup] = useState<{ user: any; codes: string[] } | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState('');
  const account = challenge.role === 'admin' ? 'admin account' : 'hospital account';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ token: challenge.token, code: code.trim() }) });
      if (r.backup_codes) setBackup({ user: r.user, codes: r.backup_codes });
      else onDone(r.user);
    } catch (err: any) {
      const text = err.message || 'Verification failed. Please try again.';
      setError({ text, restart: /timed out|too many/i.test(text) });
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      // Clipboard blocked: the text is on screen to copy by hand
    }
  };

  const download = (codes: string[]) => {
    const text = `LifeLink backup codes for ${challenge.email ?? challenge.name}\nEach code signs you in once if you cannot use your authenticator app.\n\n${codes.join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lifelink-backup-codes.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fixed inset-0 z-100 bg-white/85 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="two-step-title">
      <div className="w-full max-w-md bg-white rounded-3xl border border-red-100 shadow-xl shadow-red-100/60 p-6 sm:p-8 space-y-5 my-auto">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-[#ee2b2b]">{backup ? 'key' : 'shield_lock'}</span>
          </div>
          <h2 id="two-step-title" className="text-xl font-black text-slate-900">
            {backup ? 'Save your backup codes' : setup ? 'Turn on two-step verification' : 'Two-step verification'}
          </h2>
          <p className="text-sm text-slate-500">
            {backup
              ? 'If you lose your phone, each code signs you in once. Keep them somewhere safe, away from your phone.'
              : setup
                ? `Your ${account} needs a code from your phone at every sign-in, so a stolen password alone cannot open ${challenge.name}.`
                : `Enter the code from your authenticator app for ${challenge.name}.`}
          </p>
        </div>

        {backup ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 bg-red-50 border border-red-100 rounded-2xl p-4 font-mono text-sm font-bold text-slate-800 text-center">
              {backup.codes.map((c) => <span key={c}>{c}</span>)}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => copy(backup.codes.join('\n'), 'codes')} className={outline}>{copied === 'codes' ? 'Copied' : 'Copy'}</button>
              <button type="button" onClick={() => download(backup.codes)} className={outline}>Download</button>
            </div>
            <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#ee2b2b]" />
              I have saved these codes somewhere safe
            </label>
            <button type="button" disabled={!saved} onClick={() => onDone(backup.user)} className="w-full py-3.5 rounded-xl bg-[#ee2b2b] text-white font-black hover:bg-red-700 disabled:opacity-40">
              Continue to dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {setup && (
              <ol className="space-y-4 text-sm text-slate-700">
                <li>
                  <span className="font-black text-[#ee2b2b]">1.</span> Install a free authenticator app, such as <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong>.
                </li>
                <li className="space-y-3">
                  <p><span className="font-black text-[#ee2b2b]">2.</span> In the app, tap <strong>+</strong> and scan this QR code.</p>
                  {challenge.otpauth_url && (
                    <div className="flex justify-center">
                      <div className="p-3 bg-white border border-red-100 rounded-2xl">
                        <QRCodeSVG value={challenge.otpauth_url} size={168} level="M" />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 text-center">
                    On your phone already? <a href={challenge.otpauth_url} className="font-bold text-[#ee2b2b] hover:underline">Open in authenticator app</a>
                  </p>
                  {challenge.secret && (
                    <p className="text-xs text-slate-500 text-center">
                      Or type this key: <span className="font-mono font-bold text-slate-800 break-all">{challenge.secret.match(/.{1,4}/g)?.join(' ')}</span>{' '}
                      <button type="button" onClick={() => copy(challenge.secret!, 'key')} className="font-bold text-[#ee2b2b] hover:underline">{copied === 'key' ? 'copied' : 'copy'}</button>
                    </p>
                  )}
                </li>
                <li><span className="font-black text-[#ee2b2b]">3.</span> Enter the 6-digit code the app shows.</li>
              </ol>
            )}

            {error && (
              <div role="alert" className="bg-red-50 text-red-700 p-3 rounded-xl text-sm font-bold border border-red-100">
                {error.text}
                {error.restart && <button type="button" onClick={onCancel} className="block mt-2 underline">Sign in again</button>}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="two-step-code" className="text-sm font-bold text-slate-700">{useBackup ? 'Backup code' : '6-digit code'}</label>
              <input
                id="two-step-code"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(useBackup ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode={useBackup ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                maxLength={useBackup ? 9 : 6}
                placeholder={useBackup ? 'XXXX-XXXX' : '123456'}
                className={codeInput}
              />
            </div>
            <button
              type="submit"
              disabled={busy || (useBackup ? code.trim().length < 8 : code.length !== 6)}
              className="w-full py-3.5 rounded-xl bg-[#ee2b2b] text-white font-black hover:bg-red-700 disabled:opacity-40"
            >
              {busy ? 'Checking…' : setup ? 'Turn on and continue' : 'Verify and sign in'}
            </button>
            <div className="flex items-center justify-between gap-3 text-xs font-bold">
              {setup ? <span /> : (
                <button type="button" onClick={() => { setUseBackup(!useBackup); setCode(''); setError(null); }} className="text-[#ee2b2b] hover:underline text-left">
                  {useBackup ? 'Use the authenticator app instead' : 'Lost your phone? Use a backup code'}
                </button>
              )}
              <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-700 shrink-0">Cancel</button>
            </div>
            {!setup && useBackup && (
              <p className="text-xs text-slate-500">
                No backup codes either? Ask {challenge.role === 'admin' ? 'the national admin' : 'your LifeLink admin'} to reset two-step verification for your account.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
