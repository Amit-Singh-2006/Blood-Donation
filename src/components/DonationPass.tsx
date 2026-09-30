import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { passQrValue } from '../lib/pass';

/** The pass a donor shows at the hospital gate: QR plus the same ID in words. */
export default function DonationPass({ code, hospital, large = false }: { code: string; hospital?: string; large?: boolean }) {
  return (
    <div className={`rounded-2xl border-2 border-dashed border-[#ee2b2b]/40 bg-white p-4 flex ${large ? 'flex-col' : 'flex-col sm:flex-row'} items-center gap-4`}>
      <div className="bg-white p-2 rounded-xl">
        <QRCodeSVG value={passQrValue(code)} size={large ? 240 : 132} level="M" marginSize={2} />
      </div>
      <div className={large ? 'text-center' : 'text-center sm:text-left'}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Donation pass</p>
        <p className={`font-mono font-black tracking-wider text-slate-900 ${large ? 'text-3xl' : 'text-2xl'}`}>{code}</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Show this at {hospital ?? 'the hospital'} with a photo ID. Staff scan it to confirm you are the donor they are expecting.
        </p>
      </div>
    </div>
  );
}
