import React, { useState } from 'react';
import Chat from '../components/Chat';

export default function LiveTracking() {
  const [showChat, setShowChat] = useState<string | null>(null);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#120808] text-slate-100 relative">
      {/* Sidebar: Active En Route Donors */}
      <aside className="w-80 h-full bg-[#221010]/90 backdrop-blur-md z-40 flex flex-col shadow-2xl border-r border-[#ee2b2b]/10">
        <div className="p-5 border-b border-[#ee2b2b]/10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg flex items-center gap-2 text-white">
              <span className="material-symbols-outlined text-[#ee2b2b]">route</span>
              En Route
            </h3>
            <span className="bg-[#ee2b2b]/20 text-[#ee2b2b] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">6 Active</span>
          </div>
          <p className="text-xs text-slate-400">Live logistics monitoring</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Donor Card 1 */}
          <div className="p-4 rounded-xl bg-[#ee2b2b]/5 border border-[#ee2b2b]/10 hover:border-[#ee2b2b]/30 transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold text-sm text-white group-hover:text-[#ee2b2b] transition-colors">Sarah Jenkins</p>
                <p className="text-[11px] text-slate-500 font-medium">ETA: 4 mins • 1.2km away</p>
              </div>
              <span className="bg-[#ee2b2b] text-white text-[10px] font-black px-1.5 py-0.5 rounded">O-</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full mb-4 overflow-hidden">
              <div className="h-full bg-[#ee2b2b] rounded-full" style={{ width: '75%' }}></div>
            </div>
            <button 
              onClick={() => setShowChat('Sarah Jenkins')}
              className="w-full py-2 bg-[#120808] hover:bg-[#ee2b2b]/10 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors text-white"
            >
              <span className="material-symbols-outlined text-sm">chat</span>
              Contact Donor
            </button>
          </div>
          {/* Donor Card 2 */}
          <div className="p-4 rounded-xl bg-[#120808] border border-white/5 hover:border-[#ee2b2b]/20 transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold text-sm text-white">Marcus Thorne</p>
                <p className="text-[11px] text-slate-500 font-medium">ETA: 12 mins • 4.8km away</p>
              </div>
              <span className="bg-blue-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded">A+</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full mb-4 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '40%' }}></div>
            </div>
            <button 
              onClick={() => setShowChat('Marcus Thorne')}
              className="w-full py-2 bg-[#120808] hover:bg-[#ee2b2b]/10 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors text-white"
            >
              <span className="material-symbols-outlined text-sm">chat</span>
              Contact Donor
            </button>
          </div>
        </div>
        <div className="p-4 bg-[#ee2b2b]/10 border-t border-[#ee2b2b]/20">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">System Secure & Online</p>
          </div>
        </div>
      </aside>

      {/* Map Area */}
      <div className="flex-1 relative bg-[#1a0b0b] overflow-hidden">
        {/* Mock Map Background */}
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1a0b0b 0%, #0a0505 100%)' }}>
           {/* Grid lines can be simulated with CSS or SVG */}
           <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern height="80" id="grid" patternUnits="userSpaceOnUse" width="80">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(238,43,43,0.1)" strokeWidth="0.5"></path>
              </pattern>
            </defs>
            <rect fill="url(#grid)" height="100%" width="100%"></rect>
          </svg>
        </div>

        {/* Hospital Pulse (Center) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="w-12 h-12 bg-[#ee2b2b] rounded-full flex items-center justify-center z-20 shadow-[0_0_0_0_rgba(238,43,43,0.7)] animate-[pulse_2s_infinite]">
            <span className="material-symbols-outlined text-white text-2xl font-bold">home_health</span>
          </div>
          <div className="mt-2 bg-[#221010]/90 backdrop-blur px-3 py-1 rounded-lg border border-[#ee2b2b]/30 text-[10px] font-bold uppercase tracking-wider text-white">
            City General Hospital
          </div>
        </div>

        {/* Donor Marker 1 */}
        <div className="absolute left-[65%] top-[40%] flex flex-col items-center group cursor-pointer">
          <div className="bg-[#ee2b2b] w-8 h-8 rounded-full rounded-bl-none rotate-[225deg] flex items-center justify-center shadow-lg shadow-[#ee2b2b]/40 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-white text-lg -rotate-[225deg]">water_drop</span>
          </div>
          <div className="absolute -top-10 whitespace-nowrap bg-[#221010] px-3 py-1.5 rounded-lg border border-[#ee2b2b]/20 flex flex-col items-center">
            <span className="text-[11px] font-bold text-white">Sarah J.</span>
            <span className="text-[9px] text-[#ee2b2b] font-black uppercase">4 MINS</span>
          </div>
        </div>

        {/* Map Controls */}
        <div className="absolute top-6 right-6 flex flex-col gap-2">
          <button className="w-10 h-10 bg-[#221010] border border-white/10 rounded-lg flex items-center justify-center hover:bg-[#ee2b2b] transition-colors text-white shadow-xl">
            <span className="material-symbols-outlined">add</span>
          </button>
          <button className="w-10 h-10 bg-[#221010] border border-white/10 rounded-lg flex items-center justify-center hover:bg-[#ee2b2b] transition-colors text-white shadow-xl">
            <span className="material-symbols-outlined">remove</span>
          </button>
        </div>

        {/* Emergency Alert Box */}
        <div className="absolute bottom-6 right-6 w-80 bg-[#221010]/85 backdrop-blur-md p-5 rounded-2xl border-l-4 border-l-[#ee2b2b] shadow-2xl border border-[#ee2b2b]/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ee2b2b]">warning</span>
              <h4 className="font-extrabold text-sm uppercase tracking-tighter text-[#ee2b2b]">Critical Request</h4>
            </div>
            <span className="text-[10px] text-slate-500 font-bold">Active: 12m</span>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400 font-medium">Department</p>
              <p className="font-bold text-sm text-white">Trauma Unit - ER Level 1</p>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-slate-400 font-medium">Requirement</p>
                <p className="font-bold text-sm text-white">5 Units O- Negative</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-medium">Fulfillment</p>
                <p className="font-bold text-sm text-[#ee2b2b]">2/5 In Route</p>
              </div>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#ee2b2b]" style={{ width: '40%' }}></div>
            </div>
            <button className="w-full py-2.5 bg-[#ee2b2b] text-white text-xs font-black uppercase rounded-lg hover:bg-red-600 transition-all shadow-lg shadow-[#ee2b2b]/20 mt-2">
              Manage Request
            </button>
          </div>
        </div>
      </div>

      <Chat isOpen={!!showChat} recipientName={showChat || ''} recipientType="donor" onClose={() => setShowChat(null)} />
    </div>
  );
}
