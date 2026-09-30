import React from 'react';
import { Link, useParams } from 'react-router-dom';
import DonationPass from '../components/DonationPass';
import { extractPassCode } from '../lib/pass';

/**
 * A donor's pass as a big QR code, for donors who replied YES by SMS or
 * WhatsApp: the confirmation page links here. Nothing is looked up; the page
 * only draws the code it was given.
 */
export default function PassPage() {
  const { code = '' } = useParams();
  const pass = extractPassCode(decodeURIComponent(code));

  return (
    <div className="min-h-screen bg-[#fff5f5] flex flex-col items-center justify-center p-4 gap-6">
      <Link to="/" className="flex items-center gap-2">
        <div className="bg-[#ee2b2b] p-1.5 rounded-lg text-white">
          <span className="material-symbols-outlined text-2xl">vital_signs</span>
        </div>
        <span className="text-xl font-extrabold tracking-tight text-slate-900">LifeLink <span className="text-[#ee2b2b]">AI</span></span>
      </Link>
      {pass ? (
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-black text-slate-900">Your donation pass</h1>
          <DonationPass code={pass} large />
          <p className="text-sm text-slate-600">Turn your screen brightness up at the gate. Thank you for coming to donate.</p>
        </div>
      ) : (
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-2">
          <h1 className="text-xl font-black text-slate-900">This pass link is not complete</h1>
          <p className="text-sm text-slate-600">Open the link from your LifeLink confirmation again, or show the hospital your pass ID (it looks like LP-4K7Q-M2XZ).</p>
        </div>
      )}
    </div>
  );
}
