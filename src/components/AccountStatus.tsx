import { useState } from 'react';
import { apiFetch } from '../lib/api';

export interface AccountStatusChange {
  disabled_at: string | null;
  disabled_reason: string | null;
}

/**
 * Deactivates an abusive donor's or hospital's account, or reactivates it
 * (PUT /admin/users/:id/active). A deactivated account cannot sign in and its
 * sign-ins end; a donor gets no alerts, and a hospital's open requests are
 * cancelled.
 */
export default function AccountStatus({ id, kind, name, disabledAt, reason, onChanged }: {
  id: number; kind: 'donor' | 'hospital'; name: string;
  disabledAt: string | null; reason: string | null;
  onChanged: (change: AccountStatusChange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (active: boolean) => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/admin/users/${id}/active`, { method: 'PUT', body: JSON.stringify(active ? { active } : { active, reason: text.trim() }) });
      onChanged(active ? { disabled_at: null, disabled_reason: null } : { disabled_at: new Date().toISOString(), disabled_reason: text.trim() });
      setOpen(false);
      setText('');
    } catch (err: any) {
      setError(err.message || 'Could not change the account.');
    } finally {
      setBusy(false);
    }
  };

  if (disabledAt) {
    return (
      <div className="space-y-1 text-xs">
        <p>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-100 text-red-800">Deactivated</span>{' '}
          <span className="text-slate-500">{new Date(disabledAt).toLocaleDateString('en-IN')}{reason ? `: ${reason}` : ''}</span>
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => window.confirm(`Reactivate ${name}? ${kind === 'donor' ? 'They can sign in again and switch alerts back on.' : 'It can sign in and send requests again.'}`) && send(true)}
          className="font-bold text-[#ee2b2b] hover:underline disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Reactivate'}
        </button>
        {error && <p role="alert" className="font-bold text-red-700">{error}</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b]">
        Deactivate…
      </button>
    );
  }

  return (
    <div className="space-y-2 min-w-[220px] max-w-sm text-xs">
      <label className="block space-y-1">
        <span className="font-bold text-slate-700">Why, for the record</span>
        <textarea
          rows={2}
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={kind === 'hospital' ? 'e.g. Sent requests for patients who did not exist' : 'e.g. Abusive calls to hospital staff'}
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] outline-none"
        />
      </label>
      <p className="text-slate-500">
        {kind === 'hospital' ? 'It can no longer sign in, and its open requests are cancelled.' : 'They can no longer sign in or get alerts.'}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || text.trim().length < 5}
          onClick={() => send(false)}
          className="px-3 py-1.5 rounded-lg font-black bg-[#ee2b2b] text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Deactivate'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setText(''); setError(''); }} className="px-3 py-1.5 rounded-lg font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="font-bold text-red-700">{error}</p>}
    </div>
  );
}
