import { useEffect, useState } from 'react';
import { documentLabel, openDocument, typeLabel } from '../lib/documents';
import { isNativeApp } from '../lib/app';
import { saveFile } from '../lib/files';

export interface ViewedDocument {
  /** The API path of the file, e.g. /admin/hospitals/12/documents/registration_certificate */
  endpoint: string;
  kind: string;
  content_type: string;
  title?: string;
}

const EXTENSION: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Shows a verification document in the page, with a download link. */
export default function DocumentViewer({ doc, onClose, onOpened }: { doc: ViewedDocument; onClose: () => void; onOpened?: () => void }) {
  const [file, setFile] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState('');
  const url = file?.url ?? null;

  useEffect(() => {
    let live = true;
    let link: string | null = null;
    setFile(null);
    setError('');
    openDocument(doc.endpoint, doc.content_type)
      .then((opened) => {
        link = opened.url;
        if (!live) return URL.revokeObjectURL(opened.url);
        setFile(opened);
        onOpened?.();
      })
      .catch((err) => { if (live) setError(err.message || 'Could not open the document.'); });
    return () => {
      live = false;
      if (link) URL.revokeObjectURL(link);
    };
  }, [doc.endpoint, doc.content_type]); // onOpened reports the first open only

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = doc.title ?? documentLabel(doc.kind);
  const isPdf = doc.content_type === 'application/pdf';
  const fileName = `${doc.kind.replace(/_/g, '-')}.${EXTENSION[doc.content_type] ?? 'bin'}`;
  // The app's WebView cannot show a PDF inside the page: it opens in the phone's PDF viewer instead
  const pdfOutside = isPdf && isNativeApp();
  const save = () => { if (file) saveFile(file.blob, fileName).catch((err) => setError(err.message)); };

  return (
    <div className="fixed inset-0 z-90 bg-slate-900/50 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="document-title" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-100">
          <p id="document-title" className="font-black text-slate-900 truncate">
            {title} <span className="text-xs font-bold text-slate-400">{typeLabel(doc.content_type)}</span>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {url && (
              <button type="button" onClick={save} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">download</span> Download
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-slate-100 flex items-center justify-center overflow-auto">
          {error ? (
            <p className="text-sm text-red-700 p-6">{error}</p>
          ) : !url ? (
            <p className="text-sm font-bold text-slate-400">Opening…</p>
          ) : pdfOutside ? (
            <div className="text-center space-y-3 p-6">
              <p className="text-sm text-slate-600">The app opens PDFs in your phone's PDF viewer.</p>
              <button type="button" onClick={save} className="px-4 py-2.5 rounded-xl bg-[#ee2b2b] text-white text-sm font-black hover:bg-red-700">Open the PDF</button>
            </div>
          ) : isPdf ? (
            <iframe src={url} title={title} className="w-full h-full border-0 bg-white" />
          ) : (
            <img src={url} alt={title} className="max-w-full max-h-full object-contain bg-white" />
          )}
        </div>
      </div>
    </div>
  );
}
