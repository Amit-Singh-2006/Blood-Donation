import React from 'react';

export default function Analytics() {
  return (
    <div className="flex-1 p-8 max-w-[1400px] mx-auto w-full">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Analytics & Insights</h2>
          <p className="text-slate-500 mt-1">Real-time monitoring of global blood supply and regional demand.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined text-lg">download</span>
            Export Data
          </button>
        </div>
      </header>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 mb-8">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="material-symbols-outlined">filter_list</span>
          <span className="text-sm font-bold uppercase tracking-wider">Filters:</span>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-700">
          Region: <span className="text-[#ee2b2b]">North America</span>
          <span className="material-symbols-outlined text-lg">expand_more</span>
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-700">
          Period: <span className="text-[#ee2b2b]">Last 30 Days</span>
          <span className="material-symbols-outlined text-lg">expand_more</span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">sync</span>
            Last updated: 2 mins ago
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <span className="material-symbols-outlined">group</span>
            </div>
            <span className="text-green-500 text-xs font-bold bg-green-50 px-2 py-1 rounded-full">+12.5%</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Total Active Donors</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">24,840</h3>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
            <span className="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded-full">-3.2%</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Pending Requests</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">1,156</h3>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 border-b-[#ee2b2b]/40 border-b-4">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#ee2b2b]/10 text-[#ee2b2b] rounded-lg">
              <span className="material-symbols-outlined">check_circle</span>
            </div>
            <span className="text-green-500 text-xs font-bold bg-green-50 px-2 py-1 rounded-full">+4.1%</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Fulfillment Rate</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">94.2%</h3>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-red-50">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <span className="material-symbols-outlined">warning</span>
            </div>
            <span className="text-red-600 text-xs font-bold bg-white px-2 py-1 rounded-full shadow-sm">CRITICAL</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Critical Shortages</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">12</h3>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Blood Type Distribution */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-bold text-slate-900">Blood Type Distribution</h4>
            <span className="material-symbols-outlined text-slate-400 cursor-pointer">more_vert</span>
          </div>
          <div className="flex justify-center mb-6">
            <div className="relative w-48 h-48 rounded-full flex items-center justify-center" style={{ background: 'conic-gradient(#ee2b2b 0% 35%, #fca5a5 35% 60%, #fee2e2 60% 85%, #991b1b 85% 100%)' }}>
              <div className="bg-white w-32 h-32 rounded-full flex flex-col items-center justify-center shadow-inner">
                <span className="text-2xl font-bold text-slate-900">8,402</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Units Total</span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ee2b2b]"></div>
                <span className="text-sm font-semibold text-slate-700">O Positive</span>
              </div>
              <span className="text-sm font-bold">35%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <span className="text-sm font-semibold text-slate-700">A Positive</span>
              </div>
              <span className="text-sm font-bold">25%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-200"></div>
                <span className="text-sm font-semibold text-slate-700">O Negative</span>
              </div>
              <span className="text-sm font-bold">25%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-800"></div>
                <span className="text-sm font-semibold text-slate-700">AB Negative</span>
              </div>
              <span className="text-sm font-bold">15%</span>
            </div>
          </div>
        </div>

        {/* Fulfillment Rate Chart (Bar) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="font-bold text-slate-900">Request Fulfillment Rate</h4>
              <p className="text-xs text-slate-500">Comparing Supply Availability vs Hospital Demand</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-slate-200"></div>
                <span className="text-xs font-semibold text-slate-500 uppercase">Demand</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-[#ee2b2b]"></div>
                <span className="text-xs font-semibold text-slate-500 uppercase">Supply</span>
              </div>
            </div>
          </div>
          <div className="flex items-end justify-between h-64 gap-2 pb-2 border-b border-slate-100">
            {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((type, i) => (
              <div key={type} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center gap-1 h-full">
                  <div className="w-4 bg-slate-200 rounded-t" style={{ height: `${Math.random() * 50 + 40}%` }}></div>
                  <div className="w-4 bg-[#ee2b2b] rounded-t" style={{ height: `${Math.random() * 50 + 30}%` }}></div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">{type}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-4">
            <span className="material-symbols-outlined text-[#ee2b2b]">info</span>
            <p className="text-sm text-slate-600">Demand for <span className="font-bold text-slate-900">O-Negative</span> has spiked by 18% in the last 48 hours. Dispatching reserves to Central General Hospital.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
