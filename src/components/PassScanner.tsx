import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { extractPassCode } from '../lib/pass';

/**
 * Scans a donor's pass with the device camera, or takes the ID typed in by
 * hand (for a damaged screen or a donor who only has the ID from SMS).
 */
export default function PassScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState('');
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;

    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (stopped || !video || !canvas) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
          const code = found ? extractPassCode(found.data) : null;
          if (code) {
            stopped = true;
            onCode(code);
            return;
          }
        }
      }
      timer = window.setTimeout(scan, 250);
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser cannot use the camera. Type the pass ID instead.');
    } else {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then((s) => {
          if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
          stream = s;
          const video = videoRef.current;
          if (video) {
            video.srcObject = s;
            video.play().catch(() => { });
          }
          scan();
        })
        .catch(() => setCameraError('Camera not available or permission denied. Type the pass ID instead.'));
    }

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    const code = extractPassCode(typed);
    if (!code) {
      setTypedError('A pass ID looks like LP-4K7Q-M2XZ.');
      return;
    }
    onCode(code);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Scan donor pass">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-black text-slate-900">Scan donor pass</h3>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-4 space-y-4">
          {cameraError ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">{cameraError}</p>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-8 border-4 border-white/80 rounded-2xl pointer-events-none" />
              <p className="absolute bottom-2 inset-x-0 text-center text-xs font-bold text-white/90">Point the camera at the donor's QR code</p>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          <form onSubmit={submitTyped} className="space-y-2">
            <label htmlFor="pass-id" className="text-xs font-bold text-slate-600">Or type the pass ID</label>
            <div className="flex gap-2">
              <input
                id="pass-id"
                value={typed}
                onChange={(e) => { setTyped(e.target.value); setTypedError(''); }}
                placeholder="LP-XXXX-XXXX"
                autoComplete="off"
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg font-mono uppercase tracking-wider outline-none focus:border-slate-900"
              />
              <button type="submit" className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">Check</button>
            </div>
            {typedError && <p className="text-xs font-bold text-amber-700">{typedError}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
