import { ReactNode, useState } from 'react';
import { apiFetch } from '../lib/api';
import { DOCUMENTS, DocumentKind, StoredDocument, documentLabel, formatSize, typeLabel } from '../lib/documents';
import DocumentViewer, { ViewedDocument } from './DocumentViewer';

export interface ReviewHospital {
  id: number;
  hospital_name: string;
  hospital_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contact_number: string | null;
  registration_number: string | null;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean;
  email: string;
  created_at: string | null;
  mfa_enabled: boolean;
  verification_status: 'not_submitted' | 'pending' | 'changes_requested' | 'verified';
  verification_note: string | null;
  verification_submitted_at: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
  verified_without_documents: boolean;
  registration_authority: string | null;
  hfr_id: string | null;
  blood_centre_licence: string | null;
  authorised_person: string | null;
  authorised_designation: string | null;
  documents: StoredDocument[];
  missing_documents: DocumentKind[];
  documents_digest: string;
  history: { action: string; detail: string | null; created_at: string; actor_name: string | null }[];
}

const STATUS: Record<ReviewHospital['verification_status'], { label: string; tone: string }> = {
  pending: { label: 'Waiting for your review', tone: 'bg-amber-100 text-amber-800' },
  changes_requested: { label: 'Changes requested', tone: 'bg-red-100 text-red-800' },
  not_submitted: { label: 'No documents yet', tone: 'bg-slate-100 text-slate-600' },
  verified: { label: 'Verified', tone: 'bg-emerald-100 text-emerald-700' },
};

const ACTIONS: Record<string, string> = {
  uploaded: 'Uploaded', removed: 'Removed', submitted: 'Sent for review',
  approved: 'Approved', changes_requested: 'Asked for changes', revoked: 'Revoked',
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

/** One hospital's verification, as an admin reviews it. */
export default function HospitalReview({ h, busy, onChanged, onResetTwoStep }: {
  h: ReviewHospital; busy: boolean; onChanged: () => Promise<void> | void; onResetTwoStep: (h: ReviewHospital) => void;
}) {
  const [open, setOpen] = useState(h.verification_status === 'pending');
  const [viewing, setViewing] = useState<ViewedDocument | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [checks, setChecks] = useState({ documents_match: false, phone_confirmed: false });
  const [noteFor, setNoteFor] = useState<'request_changes' | 'revoke' | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const status = STATUS[h.verification_status];
  const allOpened = h.documents.every((d) => opened.has(d.kind));
  const canApprove = h.verification_status === 'pending' && h.missing_documents.length === 0 && allOpened && checks.documents_match && checks.phone_confirmed;

  const decide = async (body: Record<string, unknown>, question?: string) => {
    if (question && !window.confirm(question)) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/admin/hospitals/${h.id}/verification`, { method: 'PUT', body: JSON.stringify(body) });
      setNoteFor(null);
      setNote('');
      await onChanged();
    } catch (err: any) {
      setError(err.message || 'Could not save the decision.');
    } finally {
      setSaving(false);
    }
  };

  const details: [string, ReactNode][] = [
    ['Type', h.hospital_type],
    ['Registration no.', h.registration_number],
    ['Issued by', h.registration_authority],
    ['ABDM facility ID', h.hfr_id && (
      <>{h.hfr_id} · <a href="https://facility.abdm.gov.in/" target="_blank" rel="noopener noreferrer" className="font-bold text-[#ee2b2b] hover:underline">look it up</a></>
    )],
    ['Blood centre licence', h.blood_centre_licence],
    ['Named in the letter', [h.authorised_person, h.authorised_designation].filter(Boolean).join(', ')],
    ['Sent for review', when(h.verification_submitted_at)],
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} onOpened={() => setOpened((s) => new Set(s).add(viewing.kind))} />}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-extrabold text-slate-900">{h.hospital_name}</h4>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${status.tone}`}>{status.label}</span>
            {h.verified_without_documents && <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-100 text-amber-800">No documents on file</span>}
          </div>
          <p className="text-xs text-slate-500 mt-1">{[h.address, h.city, h.state, h.pincode].filter(Boolean).join(', ') || '—'}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {h.contact_number || 'no phone'} · {h.email}
            {h.latitude != null && h.longitude != null && (
              <> · <a className="font-bold text-[#ee2b2b] hover:underline" href={`https://www.google.com/maps?q=${h.latitude},${h.longitude}`} target="_blank" rel="noreferrer">map</a></>
            )}
            {h.created_at ? ` · registered ${new Date(h.created_at).toLocaleDateString('en-IN')}` : ''}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Two-step verification: <span className={h.mfa_enabled ? 'font-bold text-green-700' : 'font-bold text-amber-700'}>{h.mfa_enabled ? 'on' : 'set up at next sign-in'}</span>
            {h.mfa_enabled && <> · <button type="button" disabled={busy} onClick={() => onResetTwoStep(h)} className="font-bold text-[#ee2b2b] hover:underline disabled:opacity-50">reset (lost phone)</button></>}
          </p>
          {h.verification_status === 'verified' && h.verified_at && (
            <p className="text-xs text-slate-500 mt-0.5">Verified {when(h.verified_at)}{h.verified_by_name ? ` by ${h.verified_by_name}` : ''}</p>
          )}
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="px-4 py-2 rounded-lg text-xs font-bold shrink-0 border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1">
          {open ? 'Hide review' : h.verification_status === 'pending' ? 'Review' : 'Details'}
          <span className="material-symbols-outlined text-sm">{open ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 pt-4 space-y-5">
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {details.map(([label, value]) => (
              <div key={label} className="flex justify-between sm:block gap-3">
                <dt className="font-bold text-slate-400">{label}</dt>
                <dd className="font-bold text-slate-800 text-right sm:text-left wrap-break-word">{value || '—'}</dd>
              </div>
            ))}
          </dl>

          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Documents</p>
            {DOCUMENTS.map((d) => {
              const file = h.documents.find((x) => x.kind === d.kind);
              if (!file) {
                return d.required ? (
                  <p key={d.kind} className="text-xs font-bold text-amber-700">{d.label}: not uploaded</p>
                ) : null;
              }
              return (
                <div key={d.kind} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-800">{d.label}</span>
                  <span className="text-slate-500">{typeLabel(file.content_type)} · {formatSize(file.size_bytes)} · {when(file.uploaded_at)}</span>
                  <button type="button" onClick={() => setViewing({ endpoint: `/admin/hospitals/${h.id}/documents/${d.kind}`, kind: d.kind, content_type: file.content_type, title: `${documentLabel(d.kind)}: ${h.hospital_name}` })}
                    className="px-3 py-1 rounded-lg border border-slate-200 font-black text-slate-700 hover:bg-slate-50">
                    View
                  </button>
                  {opened.has(d.kind) && <span className="text-green-700 font-bold flex items-center gap-0.5"><span className="material-symbols-outlined text-sm">check</span>opened</span>}
                </div>
              );
            })}
          </div>

          {h.verification_status === 'changes_requested' && h.verification_note && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-900">
              <p className="font-black mb-1">Your note to the hospital</p>
              <p className="whitespace-pre-line">{h.verification_note}</p>
              <p className="mt-1 text-red-700">Waiting for the hospital to fix it and send again.</p>
            </div>
          )}
          {h.verification_status === 'not_submitted' && (
            <p className="text-xs text-slate-500">The hospital has not sent its documents for review yet.</p>
          )}

          {h.verification_status === 'pending' && (
            <div className="bg-red-50/60 border border-red-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-[#ee2b2b]">Before you approve</p>
              <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#ee2b2b]" checked={checks.documents_match}
                  onChange={(e) => setChecks({ ...checks, documents_match: e.target.checked })} />
                <span>The documents name this hospital at this address, the registration is current, and the number matches the official register (state register or the ABDM registry).</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#ee2b2b]" checked={checks.phone_confirmed}
                  onChange={(e) => setChecks({ ...checks, phone_confirmed: e.target.checked })} />
                <span>I phoned the hospital on a number from a public source (its website, Google Maps or the ABDM registry), not the one given here, and they confirmed {h.authorised_person || 'the person named in the letter'} runs this account.</span>
              </label>
              {!allOpened && <p className="text-xs font-bold text-amber-700">Open every document before approving.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!canApprove || saving}
                  onClick={() => decide({ action: 'approve', checks, documents_digest: h.documents_digest }, `Verify ${h.hospital_name}? Its requests will start alerting real donors.`)}
                  className="px-4 py-2 rounded-lg text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                  {saving && !noteFor ? 'Saving…' : 'Approve'}
                </button>
                <button type="button" disabled={saving} onClick={() => setNoteFor(noteFor === 'request_changes' ? null : 'request_changes')}
                  className="px-4 py-2 rounded-lg text-xs font-black bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  Ask for changes
                </button>
              </div>
            </div>
          )}

          {h.verification_status === 'verified' && (
            <button type="button" disabled={saving} onClick={() => setNoteFor(noteFor === 'revoke' ? null : 'revoke')}
              className="px-4 py-2 rounded-lg text-xs font-black bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {h.verified_without_documents ? 'Revoke and ask for documents' : 'Revoke verification'}
            </button>
          )}

          {noteFor && (
            <div className="space-y-2">
              <label htmlFor={`note-${h.id}`} className="text-xs font-bold text-slate-700">
                {noteFor === 'revoke' ? 'Why verification is revoked, and what the hospital should do' : 'What the hospital needs to change'}
              </label>
              <textarea id={`note-${h.id}`} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] outline-none"
                placeholder={noteFor === 'revoke' ? 'e.g. The registration certificate expired on 30 September. Please upload the renewed one.' : 'e.g. The letter is not signed. Please upload a signed and stamped copy.'} />
              <p className="text-[11px] text-slate-400">The hospital sees this note on its dashboard and by email.</p>
              <button type="button" disabled={saving || note.trim().length < 10}
                onClick={() => decide({ action: noteFor, note: note.trim() }, noteFor === 'revoke' ? `Revoke verification for ${h.hospital_name}? It will no longer be able to alert donors.` : undefined)}
                className="px-4 py-2 rounded-lg text-xs font-black bg-[#ee2b2b] text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Saving…' : noteFor === 'revoke' ? 'Revoke verification' : 'Send to the hospital'}
              </button>
            </div>
          )}

          {error && <p className="text-sm font-bold text-red-700">{error}</p>}

          {h.history.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">History</p>
              <ul className="text-xs text-slate-600 space-y-0.5">
                {h.history.map((e, i) => (
                  <li key={i}>
                    <span className="font-bold text-slate-800">{ACTIONS[e.action] ?? e.action}</span>
                    {e.detail && ['uploaded', 'removed'].includes(e.action) ? ` ${e.detail}` : ''}
                    {e.actor_name ? ` · ${e.actor_name}` : ''} · {when(e.created_at)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
