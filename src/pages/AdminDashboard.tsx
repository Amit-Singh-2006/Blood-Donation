import React from 'react';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10 hidden">
        {/* Hidden in this view as Layout handles it, but kept for structure reference */}
      </header>

      {/* Title & Actions */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Network Health Overview</h2>
          <p className="text-slate-500">Real-time status of LifeLink AI donor-hospital connectivity.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all">
            <span className="material-symbols-outlined text-sm">calendar_today</span>
            <span>Last 30 Days</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#ee2b2b] text-white rounded-lg text-sm font-semibold hover:bg-[#ee2b2b]/90 shadow-lg shadow-[#ee2b2b]/20 transition-all">
            <span className="material-symbols-outlined text-sm">file_download</span>
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#ee2b2b]/10 rounded-lg text-[#ee2b2b]">
              <span className="material-symbols-outlined">volunteer_activism</span>
            </div>
            <span className="flex items-center text-emerald-500 text-sm font-bold">
              <span className="material-symbols-outlined text-sm mr-1">trending_up</span>
              +12%
            </span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Total Active Donors</h3>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">12,402</p>
          <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#ee2b2b] h-full rounded-full" style={{ width: '75%' }}></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <span className="material-symbols-outlined">domain</span>
            </div>
            <span className="flex items-center text-emerald-500 text-sm font-bold">
              <span className="material-symbols-outlined text-sm mr-1">trending_up</span>
              +5%
            </span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Hospital Network Size</h3>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">156 Facilities</p>
          <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: '45%' }}></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <span className="material-symbols-outlined">bolt</span>
            </div>
            <span className="flex items-center text-emerald-500 text-sm font-bold">
              <span className="material-symbols-outlined text-sm mr-1">trending_up</span>
              +18%
            </span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Successful Matches</h3>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">8,920</p>
          <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: '88%' }}></div>
          </div>
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Growth Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Network Growth Trend</h3>
              <p className="text-sm text-slate-500">Matching volume and entity registration</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button className="px-3 py-1 text-xs font-bold rounded-md bg-white shadow-sm text-slate-900">Monthly</button>
              <button className="px-3 py-1 text-xs font-bold rounded-md text-slate-500">Quarterly</button>
            </div>
          </div>
          <div className="flex-1 min-h-[300px] relative">
            {/* Chart Placeholder Visual */}
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 300">
              <defs>
                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f20d0d" stopOpacity="0.2"></stop>
                  <stop offset="100%" stopColor="#f20d0d" stopOpacity="0"></stop>
                </linearGradient>
              </defs>
              <path d="M0,250 Q100,230 200,180 T400,120 T600,80 T800,20 L800,300 L0,300 Z" fill="url(#chartGradient)"></path>
              <path d="M0,250 Q100,230 200,180 T400,120 T600,80 T800,20" fill="none" stroke="#f20d0d" strokeLinecap="round" strokeWidth="4"></path>
              {/* Tooltip Point */}
              <circle cx="600" cy="80" fill="#f20d0d" r="6"></circle>
              <circle cx="600" cy="80" fill="#f20d0d" fillOpacity="0.2" r="12"></circle>
            </svg>
            {/* X-Axis Labels */}
            <div className="flex justify-between mt-4 px-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Jan</span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Feb</span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Mar</span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Apr</span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">May</span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Jun</span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Jul</span>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#ee2b2b]"></span>
                <span className="text-sm font-medium text-slate-600">Total Matches</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-300"></span>
                <span className="text-sm font-medium text-slate-600">New Donors</span>
              </div>
            </div>
            <a href="#" className="text-[#ee2b2b] text-sm font-bold hover:underline flex items-center gap-1">
              View Full Report <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </a>
          </div>
        </div>

        {/* System Feedback Feed */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col shadow-sm max-h-[500px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900">System Feedback</h3>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase">Live</span>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {/* Feedback Item 1 */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 transition-all hover:border-[#ee2b2b]/30">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center text-[10px] font-bold">CG</div>
                  <span className="text-xs font-bold">City General Hospital</span>
                </div>
                <div className="flex text-amber-400">
                  <span className="material-symbols-outlined text-xs">star</span>
                  <span className="material-symbols-outlined text-xs">star</span>
                  <span className="material-symbols-outlined text-xs">star</span>
                  <span className="material-symbols-outlined text-xs">star</span>
                  <span className="material-symbols-outlined text-xs text-slate-300">star</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed italic">"AI prediction accuracy improved our match time by 40%. The emergency routing is seamless."</p>
              <div className="mt-3 flex justify-between items-center text-[10px] text-slate-400 font-medium">
                <span>HOSPITAL ADMIN</span>
                <span>2M AGO</span>
              </div>
            </div>
            {/* Feedback Item 2 */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 transition-all hover:border-[#ee2b2b]/30">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#ee2b2b]/20 flex items-center justify-center text-[#ee2b2b] text-[10px] font-bold">JD</div>
                  <span className="text-xs font-bold">John D. (Donor)</span>
                </div>
                <div className="flex text-amber-400">
                  <span className="material-symbols-outlined text-xs">star</span>
                  <span className="material-symbols-outlined text-xs">star</span>
                  <span className="material-symbols-outlined text-xs">star</span>
                  <span className="material-symbols-outlined text-xs">star</span>
                  <span className="material-symbols-outlined text-xs">star</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed italic">"The donor app is very intuitive. Glad to see where my blood is making a difference."</p>
              <div className="mt-3 flex justify-between items-center text-[10px] text-slate-400 font-medium">
                <span>PLATINUM DONOR</span>
                <span>15M AGO</span>
              </div>
            </div>
          </div>
          <button className="w-full mt-4 py-3 text-xs font-bold text-slate-500 hover:text-[#ee2b2b] border-t border-slate-100 uppercase tracking-widest transition-colors">
            View All Activity
          </button>
        </div>
      </div>

      {/* Secondary Statistics Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-hidden relative">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-900">Active Demand Heatmap</h3>
          <div className="flex gap-2">
            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#ee2b2b]/20"></span> Low
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#ee2b2b]"></span> Critical
            </span>
          </div>
        </div>
        <div className="relative h-64 rounded-lg bg-slate-100 overflow-hidden group">
          {/* Abstract Map Representation */}
          <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDmPQjCMPIgvZldjK00oZrtD2kkSjMBL4ppLPTW4qoYMrn5g0_8EP3XsdrGC88cEeCy6o8CyjSksnKum3thScA5Qg5tvWCAAW1CwzkVqBOx4AR5r_3RZ2HEHOyGKxV1B0ARBA52QGsQw-hUOBsYPLLUAYO_lW8nVx3D10B10Uc2mea7X216YBQREbzS6XRARLm-HVIpf91nhDQuS9VuX6abrWNn10HNm1eKxs4ctqgB3KfGXDJxuxX5s-WO733ZELJ68qo-gAZBr0Q')" }}></div>
          {/* Heatmap Circles */}
          <div className="absolute top-1/4 left-1/3 w-32 h-32 bg-[#ee2b2b]/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-1/2 left-2/3 w-24 h-24 bg-[#ee2b2b] rounded-full blur-2xl opacity-60"></div>
          <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-[#ee2b2b]/40 rounded-full blur-3xl"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-white shadow-xl max-w-xs transform group-hover:scale-105 transition-transform">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#ee2b2b] text-sm">warning</span>
                Critical Demand: O Negative
              </h4>
              <p className="text-xs text-slate-500 mt-2">Northeast District (Zone 4) is reporting 20% inventory. Redirecting AI-recommended donors now.</p>
              <button className="mt-4 w-full py-2 bg-slate-900 text-white text-xs font-bold rounded-lg">View Zone Details</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
