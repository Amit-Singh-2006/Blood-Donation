import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { API_BASE_URL } from '../lib/api';
import { ANDROID_APP_URL } from '../lib/app';
import { AppUpdateNeeded } from '../lib/files';
import {
  CERTIFICATE_CODE, Certificate, CertificateCheck, certificateDay, downloadCertificate, hospitalPlace, normaliseCode,
} from '../lib/certificate';

/**
 * /certificate/:code. Anyone can check that a LifeLink certificate is real:
 * the page shows the donor's first name and initial, the hospital and the
 * date. The donor who just asked for it (from their dashboard) also sees the
 * whole certificate and can save it as a PDF.
 */
export default function CertificatePage() {
  const { code: typed = '' } = useParams();
  const code = normaliseCode(decodeURIComponent(typed));
  const own = (useLocation().state as { certificate?: Certificate } | null)?.certificate;

  return (
    <div className="min-h-screen bg-[#fff5f5] px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {own && own.code === code ? <OwnCertificate certificate={own} /> : (
          <>
            {typed ? <CheckCertificate code={code} /> : (
              <section className="space-y-2">
                <h1 className="text-3xl font-black text-slate-900">Check a LifeLink certificate</h1>
                <p className="text-slate-600">Every LifeLink donation certificate has a code like LC-4K7Q-M2XZ and a QR code. Scan the QR code, or type the code below.</p>
              </section>
            )}
            <CheckAnother />
          </>
        )}
      </div>
    </div>
  );
}

function OwnCertificate({ certificate: c }: { certificate: Certificate }) {
  const qr = useRef<HTMLCanvasElement>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; update?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await downloadCertificate(c, qr.current);
    } catch (err: any) {
      setNotice({ text: err.message || 'Could not save the certificate.', update: err instanceof AppUpdateNeeded });
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(c.verify_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is on screen to copy by hand
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/donor/impact" className="text-sm font-bold text-slate-600 hover:text-[#ee2b2b] flex items-center gap-1">
          <span className="material-symbols-outlined text-lg">arrow_back</span> My impact
        </Link>
        <div className="flex flex-wrap gap-2">
          <button onClick={copy} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">{copied ? 'check' : 'link'}</span>
            {copied ? 'Copied' : 'Copy check link'}
          </button>
          <button onClick={save} disabled={saving} className="px-4 py-2.5 rounded-xl bg-[#ee2b2b] text-white text-sm font-black hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">download</span>
            {saving ? 'Saving…' : 'Save as PDF'}
          </button>
        </div>
      </div>

      {notice && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
          <p>{notice.text}</p>
          {notice.update && <a href={ANDROID_APP_URL} className="inline-block font-black text-[#ee2b2b] underline">Download the newest app</a>}
        </div>
      )}

      <article className="bg-white rounded-2xl border-[6px] border-[#ee2b2b] p-2 shadow-sm">
        <div className="rounded-lg border-2 border-[#fbd5d5] px-6 py-10 sm:px-12 text-center space-y-5">
          <p className="flex items-center justify-center gap-1 text-2xl font-extrabold text-[#ee2b2b]">
            <span className="material-symbols-outlined text-2xl">water_drop</span> LifeLink
          </p>
          <p className="text-xs font-bold tracking-[0.3em] text-slate-500">CERTIFICATE OF APPRECIATION</p>
          <p className="text-slate-500 pt-4">This certificate is presented to</p>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 break-words">{c.donor_name}</h1>
          <p className="text-lg text-slate-700 max-w-2xl mx-auto">
            for voluntarily donating blood at <strong>{hospitalPlace(c)}</strong> on <strong className="whitespace-nowrap">{certificateDay(c.donated_on)}</strong>.
          </p>
          <p className="font-bold text-[#ee2b2b]">One donation can help up to three patients. Thank you.</p>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-left">
            <div className="space-y-1 min-w-0">
              <p className="text-[11px] font-bold tracking-widest text-slate-500">CERTIFICATE CODE</p>
              <p className="text-2xl font-black text-slate-900">{c.code}</p>
              <p className="text-xs text-slate-500">
                Check that it is real: scan the code, or open<br />
                <span className="wrap-anywhere">{c.verify_url.replace(/^https?:\/\//, '')}</span>
              </p>
              <p className="text-xs text-slate-500">Issued by LifeLink on {certificateDay(c.issued_at)}. The hospital recorded this donation on LifeLink.</p>
            </div>
            <QRCodeCanvas ref={qr} value={c.verify_url} size={210} level="M" marginSize={2} className="shrink-0" style={{ width: 136, height: 136 }} />
          </div>
        </div>
      </article>

      <p className="text-sm text-slate-600">
        Anyone with this certificate can check it at the link above. They see only your first name and initial, the hospital and the date, never your contact details.
      </p>
    </>
  );
}

function CheckCertificate({ code }: { code: string }) {
  const [check, setCheck] = useState<CertificateCheck | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setCheck(null);
    setError('');
    if (!CERTIFICATE_CODE.test(code)) {
      setCheck({ valid: false, message: 'That is not a LifeLink certificate code.' });
      return;
    }
    let live = true;
    fetch(`${API_BASE_URL}/certificates/${encodeURIComponent(code)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!live) return;
        if (res.ok || res.status === 404) setCheck({ valid: false, ...body });
        else setError(body.message || 'Could not check the certificate right now. Please try again in a minute.');
      })
      .catch(() => live && setError('Could not reach LifeLink. Check your connection and try again.'));
    return () => { live = false; };
  }, [code]);

  if (error) {
    return <p role="alert" className="bg-white rounded-2xl border border-amber-200 p-6 text-sm text-amber-900">{error}</p>;
  }
  if (!check) {
    return <p className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">Checking {code}…</p>;
  }
  if (!check.valid) {
    return (
      <section className="bg-white rounded-2xl border border-red-100 p-6 sm:p-8 space-y-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-3xl text-[#ee2b2b]">gpp_bad</span>
          <h1 className="text-xl font-black text-slate-900">{check.message || 'No LifeLink certificate has this code.'}</h1>
        </div>
        <p className="text-sm text-slate-600">
          Check the code printed on the certificate: it looks like LC-4K7Q-M2XZ. A certificate whose code is not found here was not issued by LifeLink.
        </p>
      </section>
    );
  }
  return (
    <section className="bg-white rounded-2xl border border-green-200 p-6 sm:p-8 space-y-5">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-4xl text-green-600">verified</span>
        <div>
          <h1 className="text-xl font-black text-slate-900">This is a real LifeLink certificate</h1>
          <p className="text-sm text-slate-500">{check.code}</p>
        </div>
      </div>
      <dl className="grid sm:grid-cols-3 gap-4">
        {[
          ['Donor', check.donor],
          ['Donated at', hospitalPlace(check)],
          ['On', certificateDay(check.donated_on)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[#fff5f5] border border-red-100 p-4">
            <dt className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</dt>
            <dd className="mt-1 font-bold text-slate-900 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-500">
        The hospital recorded this donation on LifeLink. To protect the donor, only their first name and initial are shown here.
      </p>
    </section>
  );
}

function CheckAnother() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (value.trim()) navigate(`/certificate/${encodeURIComponent(normaliseCode(value))}`); }}
      className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-end gap-3"
    >
      <label className="flex-1 space-y-1.5">
        <span className="text-sm font-bold text-slate-700">Check a LifeLink certificate</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="LC-4K7Q-M2XZ"
          autoCapitalize="characters"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#ee2b2b] focus:ring-2 focus:ring-red-100 outline-none uppercase"
        />
      </label>
      <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#ee2b2b] text-white text-sm font-black hover:bg-red-700">Check</button>
    </form>
  );
}
