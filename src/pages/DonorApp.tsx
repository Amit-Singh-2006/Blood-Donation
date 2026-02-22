import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, Link } from 'react-router-dom';
import ChatBot from '../components/ChatBot';
import FeedbackModal from '../components/FeedbackModal';

export default function DonorApp() {
  const location = useLocation();
  const [isAvailable, setIsAvailable] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [requestAccepted, setRequestAccepted] = useState(false);

  // Determine active tab based on URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/centers')) return 'centers';
    if (path.includes('/impact')) return 'impact';
    if (path.includes('/community')) return 'community';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  const handleAcceptRequest = () => {
    setRequestAccepted(true);
    alert("Thank you! The hospital has been notified. Please proceed to the location.");
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 relative">
      {/* Hero: Availability Toggle */}
      <div className="mb-10 bg-white rounded-xl p-6 border border-[#ee2b2b]/10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#ee2b2b]/10 rounded-xl">
            <span className="material-symbols-outlined text-[#ee2b2b] text-3xl">sensors</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Real-time Availability</h2>
            <p className="text-sm text-slate-500">Toggle active status to receive urgent blood requests via AI matching.</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <span className={`text-sm font-bold uppercase tracking-wider ${!isAvailable ? 'text-slate-400' : 'text-slate-300'}`}>Unavailable</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={isAvailable}
              onChange={() => setIsAvailable(!isAvailable)}
            />
            <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#ee2b2b]"></div>
          </label>
          <span className={`text-sm font-bold uppercase tracking-wider ${isAvailable ? 'text-[#ee2b2b]' : 'text-slate-300'}`}>Available</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-8 border-b border-slate-200 overflow-x-auto">
        <Link 
          to="/donor"
          className={`pb-4 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'dashboard' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Dashboard
        </Link>
        <Link 
          to="/donor/centers"
          className={`pb-4 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'centers' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Donation Centers
        </Link>
        <Link 
          to="/donor/impact"
          className={`pb-4 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'impact' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Impact Report
        </Link>
        <Link 
          to="/donor/community"
          className={`pb-4 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'community' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Community
        </Link>
      </div>

      {activeTab === 'dashboard' && (
        <DashboardView 
          requestAccepted={requestAccepted} 
          onAccept={handleAcceptRequest} 
          onRate={() => setShowFeedback(true)}
        />
      )}
      {activeTab === 'centers' && <DonationCentersView />}
      {activeTab === 'impact' && <RewardsView />}
      {activeTab === 'community' && <CommunityView />}

      <ChatBot />

      <FeedbackModal 
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        targetType="hospital"
        targetName="City General Hospital"
      />
    </div>
  );
}

function DashboardView({ requestAccepted, onAccept, onRate }: { requestAccepted: boolean; onAccept: () => void; onRate: () => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Pending Requests */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900">
            <span className="material-symbols-outlined text-[#ee2b2b]">emergency</span>
            Pending Requests
          </h3>
          <span className="text-xs font-bold bg-[#ee2b2b]/10 text-[#ee2b2b] px-3 py-1 rounded-full uppercase">3 Live Matches</span>
        </div>
        {/* Urgent Card 1 */}
        {!requestAccepted ? (
          <div className="bg-white rounded-xl overflow-hidden border border-[#ee2b2b]/20 shadow-lg shadow-[#ee2b2b]/5 group">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-1/3 relative h-48 md:h-auto bg-slate-200">
                <img alt="Hospital" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCrWeWyQ1R-dF8F2VRM6ryKAtUU_cohDmLDJvdojeJRsLiIIXrT5rL1SjuIiV5GizM90CNYs5jKNegH8txwab0j1RGaaMrSkaAlFcT5sszOXOLsTUroZ40maGv9Yn5yK3QYsGFnnRzmnBoZXGV9Zl5192oDqT3lTibLJkrP-0o1LmICUIUvAdFGzqLBVOXnQM8MrJ6YUSF12tej8Mor-3gEXUj53dEgqbK5d7BccuG_HEsdNMOvLA8IfkHLboc6sNUQmF8lrBBCu94" />
                <div className="absolute top-3 left-3 bg-[#ee2b2b] text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-tighter">AI Predicted Urgent</div>
              </div>
              <div className="p-6 md:w-2/3 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-xl font-bold text-slate-900">City General Hospital</h4>
                    <span className="text-3xl font-black text-[#ee2b2b]">O-</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">near_me</span> 2.4 miles</span>
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span> Needs by 4:00 PM</span>
                  </div>
                  <div className="bg-[#ee2b2b]/5 p-3 rounded-lg border border-[#ee2b2b]/10 mb-6">
                    <p className="text-sm text-slate-700">
                      <strong className="text-[#ee2b2b] font-bold">AI Impact Prediction:</strong> Your O- donation could support a critical surgical procedure scheduled for tonight. High impact priority.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={onAccept}
                    className="flex-1 bg-[#ee2b2b] hover:bg-[#ee2b2b]/90 text-white font-bold py-3 rounded-lg transition-all shadow-md shadow-[#ee2b2b]/20"
                  >
                    Accept Request
                  </button>
                  <button className="w-12 h-12 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    <span className="material-symbols-outlined text-slate-600">map</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 rounded-xl p-6 border border-green-200 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>
            <h3 className="text-xl font-bold text-green-800">Request Accepted!</h3>
            <p className="text-green-700">Please proceed to City General Hospital. The staff has been notified of your arrival.</p>
            <button className="text-sm font-bold text-green-700 hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">navigation</span>
              Get Directions
            </button>
          </div>
        )}

        {/* History Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 overflow-hidden">
          <h3 className="text-lg font-bold mb-6 text-slate-900">Donation History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  <th className="pb-4 font-semibold">Date</th>
                  <th className="pb-4 font-semibold">Location</th>
                  <th className="pb-4 font-semibold">Type</th>
                  <th className="pb-4 font-semibold">Status</th>
                  <th className="pb-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr className="group">
                  <td className="py-4 text-sm font-medium text-slate-900">Oct 12, 2023</td>
                  <td className="py-4 text-sm text-slate-600">Red Cross Center #4</td>
                  <td className="py-4 text-sm text-slate-600">Whole Blood</td>
                  <td className="py-4">
                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase">Verified</span>
                  </td>
                  <td className="py-4 text-right">
                    <button onClick={onRate} className="text-xs font-bold text-[#ee2b2b] hover:bg-[#ee2b2b]/5 px-3 py-1.5 rounded-lg transition-colors">
                      Rate Hospital
                    </button>
                  </td>
                </tr>
                <tr className="group">
                  <td className="py-4 text-sm font-medium text-slate-900">July 04, 2023</td>
                  <td className="py-4 text-sm text-slate-600">St. Jude Medical</td>
                  <td className="py-4 text-sm text-slate-600">Power Red</td>
                  <td className="py-4">
                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase">Verified</span>
                  </td>
                  <td className="py-4 text-right">
                    <span className="text-xs font-bold text-slate-400">Rated</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column: Stats & Performance */}
      <div className="space-y-8">
        {/* Performance Stats */}
        <div className="bg-[#ee2b2b] text-white rounded-xl p-6 shadow-xl shadow-[#ee2b2b]/20 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-6">Total Impact</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-4xl font-black mb-1">12</p>
                <p className="text-[10px] font-bold uppercase opacity-80">Donations</p>
              </div>
              <div>
                <p className="text-4xl font-black mb-1">36</p>
                <p className="text-[10px] font-bold uppercase opacity-80">Lives Saved</p>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold">Next Milestone: Gallon Club</span>
                <span className="text-xs">85%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-1.5">
                <div className="bg-white rounded-full h-1.5 w-[85%]"></div>
              </div>
            </div>
          </div>
          {/* Abstract Pattern for Background */}
          <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 opacity-10">
            <span className="material-symbols-outlined text-[120px]">hub</span>
          </div>
        </div>

        {/* Badges */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Earned Badges</h3>
            <a href="#" className="text-[#ee2b2b] text-xs font-bold hover:underline">View All</a>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined text-2xl">workspace_premium</span>
              </div>
              <span className="text-[10px] font-bold text-slate-600">First Responder</span>
            </div>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 bg-[#ee2b2b]/10 rounded-full flex items-center justify-center text-[#ee2b2b]">
                <span className="material-symbols-outlined text-2xl">volunteer_activism</span>
              </div>
              <span className="text-[10px] font-bold text-slate-600">Lifesaver</span>
            </div>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <span className="material-symbols-outlined text-2xl">bolt</span>
              </div>
              <span className="text-[10px] font-bold text-slate-600">Quick React</span>
            </div>
          </div>
        </div>

        {/* Map Widget */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Centers Near You</h3>
            <span className="text-[10px] text-slate-400">San Francisco, CA</span>
          </div>
          <div className="h-48 bg-slate-200 relative">
            <img alt="Map View" className="w-full h-full object-cover grayscale opacity-60" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQv5H3unlG5_AmOlS9h45HtaApX0js3IFcNkO_5gPwHh64vPlyqVb18f97Gwlblq21VrccZk8lVg0cFHolcS-ZVZeE8gOSBWMBuvfogaU7NcmdChyLLklumMK1_FYsFfidRkukviJ01e90m7jaOAvdI6O003dNWa4x_uib2OqWfzVHELdGgZNzEUlGtuSai7gRr-KRgrQwW2CqMRo9M-vj6TJxJDCFZMyqPYyC4e0057KYc-R-Z_u_GG5UBeR6JqL-5FNMTE3zGe8" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 bg-[#ee2b2b] rounded-full border-2 border-white animate-pulse shadow-lg"></div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#ee2b2b] text-sm mt-0.5">location_on</span>
              <div>
                <p className="text-xs font-bold text-slate-900">Bay Area Donor Hub</p>
                <p className="text-[10px] text-slate-500">Open until 8:00 PM</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DonationCentersView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="h-40 bg-slate-200 relative">
            <img 
              src={`https://picsum.photos/seed/center${i}/400/200`} 
              alt="Donation Center" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-slate-700">
              {i * 1.2} miles away
            </div>
          </div>
          <div className="p-5">
            <h3 className="font-bold text-lg text-slate-900 mb-1">Red Cross Center #{i}</h3>
            <p className="text-sm text-slate-500 mb-4">123 Medical Drive, Suite {100 + i}</p>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-600 mb-4">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                Open until 6pm
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">local_parking</span>
                Free Parking
              </span>
            </div>
            <button className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors">
              Schedule Appointment
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommunityView() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="font-bold text-lg mb-4">Community Feed</h3>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 pb-6 border-b border-slate-100 last:border-0 last:pb-0">
                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0">
                   <img src={`https://picsum.photos/seed/user${i}/100/100`} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-slate-900">Alex Johnson</span>
                    <span className="text-xs text-slate-400">• 2h ago</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    Just completed my 5th donation at City General! The staff was amazing and the process was super smooth. Feeling great about helping out! 🩸💪
                  </p>
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1 text-slate-400 hover:text-[#ee2b2b] text-xs font-bold transition-colors">
                      <span className="material-symbols-outlined text-sm">favorite</span>
                      24 Likes
                    </button>
                    <button className="flex items-center gap-1 text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors">
                      <span className="material-symbols-outlined text-sm">chat_bubble</span>
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-[#ee2b2b] text-white rounded-xl p-6 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-bold text-lg mb-2">Upcoming Drive</h3>
            <p className="text-sm text-white/90 mb-4">Join us at the Community Center this Saturday for our monthly blood drive.</p>
            <button className="bg-white text-[#ee2b2b] px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">
              Register Now
            </button>
          </div>
          <div className="absolute -bottom-4 -right-4 opacity-20">
            <span className="material-symbols-outlined text-9xl">campaign</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-sm text-slate-900 mb-4 uppercase tracking-wider">Top Contributors</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-4">{i}</span>
                  <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                    <img src={`https://picsum.photos/seed/top${i}/100/100`} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">User {i}</span>
                </div>
                <span className="text-xs font-bold text-[#ee2b2b]">{1000 - (i * 50)} XP</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RewardsView() {
  return (
    <div className="space-y-8">
      {/* Hero Section: Rank Progress */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-8 shadow-sm border border-slate-200 relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#ee2b2b]/5 rounded-bl-full pointer-events-none"></div>
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-[#ee2b2b]/30 flex items-center justify-center p-1 bg-white shadow-xl">
                <div className="w-full h-full rounded-full bg-[#ee2b2b] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-5xl">shield</span>
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest border-2 border-white">Tier 4</div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                <h1 className="text-3xl font-extrabold text-slate-900">Guardian Level</h1>
                <span className="material-symbols-outlined text-[#ee2b2b]">verified</span>
              </div>
              <p className="text-slate-500 text-base mb-6">You are in the top 5% of donors in Seattle. Keep it up!</p>
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-[#ee2b2b]">450 / 1000 XP</span>
                  <span className="text-slate-400">Next: Life Sentinel</span>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div className="h-full bg-[#ee2b2b] rounded-full transition-all duration-1000" style={{ width: '45%' }}></div>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">info</span>
                  550 XP remaining to unlock Sentinel status and exclusive rewards.
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* AI Insights / CTA Card */}
        <div className="bg-[#ee2b2b]/5 border border-[#ee2b2b]/20 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 text-[#ee2b2b]">
              <span className="material-symbols-outlined text-xl">psychology</span>
              <h3 className="font-bold text-sm uppercase tracking-wider">AI Insight</h3>
            </div>
            <p className="text-slate-800 font-medium text-lg leading-snug">
              Local hospitals are low on <span className="text-[#ee2b2b] font-bold">O-Negative</span> today.
            </p>
            <p className="text-slate-600 text-sm mt-2">
              Donate within 48 hours to earn a <span className="font-bold">2x XP Multiplier</span> and the "First Responder" badge.
            </p>
          </div>
          <button className="mt-6 w-full py-4 bg-[#ee2b2b] hover:bg-[#ee2b2b]/90 text-white font-bold rounded-lg shadow-lg shadow-[#ee2b2b]/30 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">calendar_today</span>
            Schedule Donation
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Achievements Grid */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
              <span className="material-symbols-outlined text-amber-500">military_tech</span>
              Earned Badges
            </h2>
            <span className="text-slate-400 text-sm">8 of 24 Unlocked</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {/* Badge 1 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm group hover:border-[#ee2b2b]/50 transition-all cursor-help relative">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white shadow-lg mb-3 bg-gradient-to-br from-yellow-400 to-orange-500">
                <span className="material-symbols-outlined text-3xl">volunteer_activism</span>
              </div>
              <h5 className="text-sm font-bold text-center mb-1 text-slate-900">Life Saver</h5>
              <p className="text-[10px] text-center text-slate-500 uppercase font-bold">5+ Donations</p>
            </div>
            {/* Badge 2 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm group hover:border-[#ee2b2b]/50 transition-all cursor-help">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white shadow-lg mb-3 bg-gradient-to-br from-slate-300 to-slate-500">
                <span className="material-symbols-outlined text-3xl">emergency</span>
              </div>
              <h5 className="text-sm font-bold text-center mb-1 text-slate-900">First Responder</h5>
              <p className="text-[10px] text-center text-slate-500 uppercase font-bold">Fast Acceptance</p>
            </div>
            {/* Badge 3 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm group hover:border-[#ee2b2b]/50 transition-all cursor-help">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white shadow-lg mb-3 bg-gradient-to-br from-orange-400 to-amber-700">
                <span className="material-symbols-outlined text-3xl">groups</span>
              </div>
              <h5 className="text-sm font-bold text-center mb-1 text-slate-900">Champion</h5>
              <p className="text-[10px] text-center text-slate-500 uppercase font-bold">Community Leader</p>
            </div>
          </div>
        </div>

        {/* Leaderboard Sidebar */}
        <aside className="flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden relative">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                <span className="material-symbols-outlined text-[#ee2b2b]">leaderboard</span>
                Local Heroes
              </h2>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">SEATTLE AREA</span>
            </div>
            <div className="space-y-4">
              {/* Top Donor 1 */}
              <div className="flex items-center gap-4 group">
                <span className="text-amber-500 font-bold w-4">1</span>
                <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-amber-500 overflow-hidden">
                  <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDLIdArSZ__mE6omwUR7nj27VRxIjaZTbQuCtEdYYKKljhGdq4NZKxzFmc6so8VbIP8rRjfSnjkmv9n0Rz6rhJqPElh41d_Gu0oPaC9ppsh9bN1Fdl_FxkTRve4SrhaopJy6AoxIpJmJW-mM9qBsAKmmQFlPp-7HJnz6XBX10pPmqBBqxVSvZiUcCSySR7kvYvpqNVoP_mqcHrT48L1W2hGS72TNQjfzDTduOBty-m3xbrUQlS-r-E7Yk2AJcSuAX4gumqgtekRLWY" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate text-slate-900">Sarah Mitchell</p>
                  <p className="text-xs text-slate-400">2,450 XP</p>
                </div>
                <span className="material-symbols-outlined text-green-500 text-sm">trending_up</span>
              </div>
              {/* You */}
              <div className="pt-4 border-t border-slate-100 flex items-center gap-4 bg-[#ee2b2b]/5 -mx-6 px-6 py-3">
                <span className="text-[#ee2b2b] font-bold w-4">12</span>
                <div className="w-10 h-10 rounded-full bg-[#ee2b2b] overflow-hidden border-2 border-[#ee2b2b]">
                  <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAmGCUAhVMR3Z5uQEP8UfkbMl8lgDvYah8rKZvWQnL27Bot_HUjAcoK0syZ3ECT-hAvVModhklCNJfq8b5EzHUO6_yBoToF_ZSL_1U-8tN9A0QoG_aBX1HEUdgnGRqkwM1rH2bNoxSh6rBHv57Knas2PPdArZ20LJqowRklrJ9-BlpFUZxtBUJJonEWR-DcnO-sKDEhBpT3Y76GWDrw5Jy8w2Ne1XFrRTSxLj0qdyjTnGpL6qtUZX-03S1EjZRwP25DStZYz0qdEkg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate text-slate-900">You (Guardian)</p>
                  <p className="text-xs text-[#ee2b2b] font-bold">450 XP</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
