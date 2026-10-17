import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { ACCEPT, DOCUMENTS, DocumentKind, StoredDocument, formatSize, prepareDocument, typeLabel } from '../lib/documents';
import DocumentViewer, { ViewedDocument } from './DocumentViewer';

interface Verification {
  status: 'not_submitted' | 'pending' | 'changes_requested' | 'verified';
  note: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  verified_without_documents: boolean;
  can_edit: boolean;
  details: Record<DetailField, string>;
  documents: StoredDocument[];
  missing_documents: DocumentKind[];
}

type DetailField = 'registration_number' | 'registration_authority' | 'hfr_id' | 'blood_centre_licence' | 'authorised_person' | 'authorised_designation';

const FIELDS: { key: DetailField; label: string; placeholder: string; hint?: React.ReactNode; optional?: boolean }[] = [
  { key: 'registration_number', label: 'Registration number', placeholder: 'As printed on the certificate' },
  { key: 'registration_authority', label: 'Issued by', placeholder: 'e.g. District Registering Authority, Jalandhar', hint: 'The authority, and the act if it is printed (for example the Punjab Clinical Establishments Act).' },
  {
    key: 'hfr_id', label: 'ABDM Health Facility ID', placeholder: 'e.g. IN0310000123', optional: true,
    hint: <>If your hospital is on the national <a href="https://facility.abdm.gov.in/" target="_blank" rel="noopener noreferrer" className="font-bold text-[#ee2b2b] hover:underline">Health Facility Registry</a>, its ID lets the admin find you there.</>,
  },
  { key: 'blood_centre_licence', label: 'Blood centre licence number', placeholder: 'Only if you run a blood centre', optional: true },
  { key: 'authorised_person', label: 'Name in the authorisation letter', placeholder: 'The staff member who manages LifeLink' },
  { key: 'authorised_designation', label: 'Their designation', placeholder: 'e.g. Blood Bank Officer' },
];

const STATUS: Record<Verification['status'], { label: string; tone: string; icon: string; text: string }> = {
  not_submitted: {
    label: 'Not sent yet', tone: 'bg-slate-100 text-slate-700', icon: 'upload_file',
    text: 'Upload your documents and fill in the details below, then send them for review. Until your hospital is verified, its requests cannot alert donors.',
  },
  pending: {
    label: 'Waiting for review', tone: 'bg-amber-100 text-amber-800', icon: 'hourglass_top',
    text: 'A LifeLink admin for your city is checking your documents against the official registers and will phone your hospital on its publicly listed number. We will email you the result.',
  },
  changes_requested: {
    label: 'Changes needed', tone: 'bg-red-100 text-red-800', icon: 'edit_note',
    text: 'A LifeLink admin needs something changed before verifying your hospital. Fix it below, then send for review again.',
  },
  verified: {
    label: 'Verified', tone: 'bg-green-100 text-green-800', icon: 'verified',
    text: 'Your hospital is verified: its requests alert matching donors. Your documents are locked; ask your LifeLink admin if something needs to change.',
  },
};

const inputClass = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] outline-none text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-60';

const Notice = ({ ok, text }: { ok: boolean; text: string }) => (
  <p role="status" className={`text-sm font-bold ${ok ? 'text-green-700' : 'text-red-700'}`}>{text}</p>
);

const formatDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** The hospital's verification: documents, the details an admin checks, and the result. */
export default function HospitalVerification({ onChange }: { onChange?: () => void }) {
  const [state, setState] = useState<Verification | null>(null);
  const [form, setForm] = useState<Record<DetailField, string> | null>(null);
  const [declared, setDeclared] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Shown next to the part it is about: the uploads or the form
  const [message, setMessage] = useState<{ ok: boolean; text: string; at: 'documents' | 'form' } | null>(null);
  const [viewing, setViewing] = useState<ViewedDocument | null>(null);

  const load = useCallback(async () => {
    try {
      const next: Verification = await apiFetch('/hospital/verification');
      setState(next);
      setForm((f) => f ?? next.details);
    } catch (err: any) {
      setMessage({ ok: false, text: err.message || 'Could not load your verification.', at: 'form' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const upload = async (kind: DocumentKind, file: File | undefined) => {
    if (!file) return;
    setBusy(kind);
    setMessage(null);
    try {
      const body = await prepareDocument(file);
      await apiFetch(`/hospital/verification/documents/${kind}`, { method: 'PUT', body, headers: { 'Content-Type': body.type } });
      await load();
      setMessage({ ok: true, text: `${DOCUMENTS.find((d) => d.kind === kind)?.label} uploaded.`, at: 'documents' });
    } catch (err: any) {
      setMessage({ ok: false, text: err.message || 'Upload failed. Please try again.', at: 'documents' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (kind: DocumentKind) => {
    setBusy(kind);
    setMessage(null);
    try {
      await apiFetch(`/hospital/verification/documents/${kind}`, { method: 'DELETE' });
      await load();
    } catch (err: any) {
      setMessage({ ok: false, text: err.message || 'Could not remove the document.', at: 'documents' });
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy('submit');
    setMessage(null);
    try {
      const next: Verification = await apiFetch('/hospital/verification', { method: 'PUT', body: JSON.stringify({ ...form, declaration: declared }) });
      setState(next);
      setForm(next.details);
      setDeclared(false);
      setMessage({ ok: true, text: 'Sent for review. We will email you when an admin has checked it.', at: 'form' });
      onChange?.();
    } catch (err: any) {
      setMessage({ ok: false, text: err.message || 'Could not send for review.', at: 'form' });
    } finally {
      setBusy(null);
    }
  };

  if (!state || !form) {
    return <div className="bg-white rounded-3xl p-10 border border-slate-100 text-center text-sm font-bold text-slate-400">{message?.text ?? 'Loading your verification…'}</div>;
  }

  const status = STATUS[state.status];
  const fileOf = (kind: DocumentKind) => state.documents.find((d) => d.kind === kind);
  const editable = state.can_edit;
  const ready = state.missing_documents.length === 0;

  return (
    <div className="max-w-3xl space-y-6">
      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />}

      <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1 ${status.tone}`}>
            <span className="material-symbols-outlined text-sm">{status.icon}</span>{status.label}
          </span>
          {state.status === 'pending' && state.submitted_at && <span className="text-xs text-slate-500">Sent {formatDay(state.submitted_at)}</span>}
          {state.status === 'verified' && state.verified_at && <span className="text-xs text-slate-500">Verified {formatDay(state.verified_at)}</span>}
        </div>
        <p className="text-sm text-slate-600">
          {state.verified_without_documents
            ? 'Your hospital was verified before LifeLink asked hospitals for documents. A LifeLink admin may ask you to upload them.'
            : status.text}
        </p>
        {state.status === 'changes_requested' && state.note && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-900">
            <p className="font-black text-xs uppercase tracking-wider text-red-700 mb-1">Note from the admin</p>
            <p className="whitespace-pre-line">{state.note}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-100 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">1. Documents</h3>
          <p className="text-sm text-slate-500">A PDF, or a clear photo or scan (JPG, PNG or WebP), up to 3 MB each. Large photos are resized for you.</p>
        </div>
        {DOCUMENTS.map((d) => {
          const file = fileOf(d.kind);
          return (
            <div key={d.kind} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <div>
                <p className="font-black text-slate-900 text-sm flex flex-wrap items-center gap-2">
                  {d.label}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${d.required ? 'bg-red-100 text-[#ee2b2b]' : 'bg-slate-200 text-slate-600'}`}>
                    {d.required ? 'Required' : 'If you have one'}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-1">{d.hint}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {file ? (
                  <>
                    <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-green-600">check_circle</span>
                      {typeLabel(file.content_type)} · {formatSize(file.size_bytes)} · {formatDay(file.uploaded_at)}
                    </span>
                    <button type="button" onClick={() => setViewing({ endpoint: `/hospital/verification/documents/${d.kind}`, kind: d.kind, content_type: file.content_type })}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-100">
                      View
                    </button>
                  </>
                ) : (
                  <span className="text-xs font-bold text-slate-400">Not uploaded</span>
                )}
                {editable && (
                  <label className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer ${file ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-[#ee2b2b] text-white hover:bg-red-700'} ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
                    {busy === d.kind ? 'Uploading…' : file ? 'Replace' : 'Upload'}
                    <input type="file" accept={ACCEPT} className="sr-only" disabled={!!busy}
                      onChange={(e) => { upload(d.kind, e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                )}
                {editable && file && !d.required && (
                  <button type="button" disabled={!!busy} onClick={() => remove(d.kind)} className="px-3 py-1.5 rounded-lg text-xs font-black text-slate-500 hover:text-[#ee2b2b] disabled:opacity-50">
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {message?.at === 'documents' && <Notice {...message} />}
      </div>

      <form onSubmit={submit} className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-100 shadow-sm space-y-5">
        <div>
          <h3 className="text-lg font-black text-slate-900">2. Details</h3>
          <p className="text-sm text-slate-500">The admin checks these against your documents and the public registers.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label htmlFor={`verify-${f.key}`} className="text-sm font-bold text-slate-700 ml-1">
                {f.label}{f.optional && <span className="font-normal text-slate-400"> (optional)</span>}
              </label>
              <input id={`verify-${f.key}`} className={inputClass} value={form[f.key]} placeholder={f.placeholder} disabled={!editable}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              {f.hint && <p className="text-xs text-slate-500 ml-1">{f.hint}</p>}
            </div>
          ))}
        </div>

        {editable && (
          <>
            <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#ee2b2b]" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
              <span>I confirm these documents are genuine and current, and that I am authorised to register this hospital on LifeLink. False documents lead to removal and may be reported to the authorities.</span>
            </label>
            {!ready && <p className="text-xs font-bold text-amber-700">Upload your registration certificate and authorisation letter first.</p>}
            <button type="submit" disabled={!!busy || !ready || !declared}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#ee2b2b] text-white text-sm font-black hover:bg-red-700 disabled:opacity-50">
              {busy === 'submit' ? 'Sending…' : state.status === 'pending' ? 'Update and keep in review' : 'Send for review'}
            </button>
          </>
        )}
        {message?.at === 'form' && <Notice {...message} />}
      </form>
    </div>
  );
}
