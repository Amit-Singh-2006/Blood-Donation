import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import ChatBot from '../components/ChatBot';
import FeedbackModal from '../components/FeedbackModal';

export default function DonorApp() {
  const location = useLocation();
  const [isAvailable, setIsAvailable] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [requestAccepted, setRequestAccepted] = useState(false);
  const [requestRejected, setRequestRejected] = useState(false);
  const [userPoints, setUserPoints] = useState(location.state?.initialPoints || 450);
  const [userTokens, setUserTokens] = useState(24000);
  const [requestExpired, setRequestExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3 * 60 * 60); // 3 hours in seconds
  const [pendingAppointments, setPendingAppointments] = useState<{ date: string, time: string, hospital: string, id: number }[]>([]);
  const [hospitalRated, setHospitalRated] = useState(false);
  const [feedPosts, setFeedPosts] = useState([
    { id: 1, user: "Alex Johnson", time: "2h ago", content: "Just completed my 5th donation at City General! The staff was amazing and the process was super smooth. Feeling great about helping out! 🩸💪", likes: 24, replies: [], showReplyInput: false, isLiked: false }
  ]);

  // Determine active tab based on URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/centers')) return 'centers';
    if (path.includes('/impact')) return 'impact';
    if (path.includes('/community')) return 'community';
    if (path.includes('/pending')) return 'pending';
    if (path.includes('/settings')) return 'settings';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  const handleAcceptRequest = () => {
    setRequestAccepted(true);
    alert("Thank you! The hospital has been notified. Please proceed to the location.");
  };

  const handleRejectRequest = () => {
    setRequestRejected(true);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const openNavigation = () => {
    window.open("https://www.google.com/maps/dir/?api=1&destination=City+General+Hospital", "_blank");
  };

  return (
    <div className={`max-w-7xl mx-auto px-6 ${activeTab === 'centers' ? 'py-4' : 'py-8'} relative`}>
      {/* Hero: Availability Toggle */}
      {activeTab !== 'centers' && (
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
      )}

      {/* Tabs */}
      {activeTab !== 'centers' && (
        <div className="flex gap-6 mb-8 border-b border-slate-200 overflow-x-auto">
          <Link
            to="/donor"
            className={`pb-4 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'dashboard' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Dashboard
          </Link>
          <Link
            to="/donor/centers"
            className={`pb-4 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${(activeTab as string) === 'centers' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Donation Centers
          </Link>
          <Link
            to="/donor/pending"
            className={`pb-4 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'pending' ? 'border-[#ee2b2b] text-[#ee2b2b]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Pending Donations
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
      )}

      {activeTab === 'dashboard' && (
        <DashboardView
          requestAccepted={requestAccepted}
          onAccept={handleAcceptRequest}
          requestRejected={requestRejected}
          onReject={handleRejectRequest}
          onRate={() => setShowFeedback(true)}
          requestExpired={requestExpired}
          timeLeft={formatTime(timeLeft)}
          isAvailable={isAvailable}
          openNavigation={openNavigation}
          hospitalRated={hospitalRated}
          userBloodType="O-"
          demandBloodType="O-"
          rewardTokens={2000}
        />
      )}
      {activeTab === 'centers' && <DonationCentersView onBook={(appt) => setPendingAppointments([...pendingAppointments, appt])} />}
      {activeTab === 'pending' && <PendingDonationsView userPoints={userPoints} appointments={pendingAppointments} onCancel={(id) => setPendingAppointments(pendingAppointments.filter(a => a.id !== id))} />}
      {activeTab === 'impact' && <RewardsView userTokens={userTokens} setUserTokens={setUserTokens} />}
      {activeTab === 'community' && <CommunityView feedPosts={feedPosts} setFeedPosts={setFeedPosts} />}
      {activeTab === 'settings' && <SettingsView />}

      <ChatBot />

      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        targetType="hospital"
        targetName="Red Cross Center #4"
        onSubmit={(comment) => {
          setHospitalRated(true);
          setFeedPosts(prev => [{
            id: Date.now(),
            user: "Alex Johnson",
            time: "Just now",
            content: comment,
            likes: 0,
            replies: [],
            showReplyInput: false,
            isLiked: false
          }, ...prev]);
        }}
      />
    </div>
  );
}

function DashboardView({
  requestAccepted, onAccept, requestRejected, onReject, onRate, requestExpired, timeLeft, isAvailable, openNavigation, hospitalRated, userBloodType, demandBloodType, rewardTokens
}: {
  requestAccepted: boolean; onAccept: () => void; requestRejected: boolean; onReject: () => void; onRate: () => void;
  requestExpired: boolean; timeLeft: string; isAvailable: boolean; openNavigation: () => void;
  hospitalRated: boolean; userBloodType: string; demandBloodType: string; rewardTokens: number;
}) {
  const isMatch = userBloodType === demandBloodType;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Pending Requests */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900">
            <span className="material-symbols-outlined text-[#ee2b2b]">emergency</span>
            Pending Requests
          </h3>
          {isAvailable && !requestRejected && !requestAccepted && isMatch && (
            <span className="text-xs font-bold bg-[#ee2b2b]/10 text-[#ee2b2b] px-3 py-1 rounded-full uppercase">1 Live Match</span>
          )}
        </div>

        {/* Donation Timeline Info */}
        <div className="bg-white rounded-xl p-4 border border-blue-100 flex items-start gap-4 mb-6 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <span className="material-symbols-outlined">calendar_clock</span>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Donation Eligibility</h4>
            <p className="text-sm text-slate-600 mt-1">
              Your last donation was on <strong className="text-slate-900">Oct 12, 2023</strong>.
              You are currently <span className="font-bold text-green-600 uppercase text-xs tracking-wider">Eligible</span> to donate.
              <br /><span className="text-xs text-slate-400 mt-1 block">(Usually, you must wait 56 days between whole blood donations.)</span>
            </p>
          </div>
        </div>

        {requestAccepted ? (
          <div className="bg-green-50 rounded-xl p-6 border border-green-200 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>
            <h3 className="text-xl font-bold text-green-800">Request Accepted!</h3>
            <p className="text-green-700">Please proceed to City General Hospital. The staff has been notified of your arrival.</p>
            <button onClick={openNavigation} className="text-sm font-bold text-green-700 hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">navigation</span>
              Get Directions
            </button>
          </div>
        ) : isAvailable && !requestRejected ? (
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
                    <span className="flex items-center gap-1 text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded"><span className="material-symbols-outlined text-sm">toll</span> +{rewardTokens.toLocaleString()} Tokens</span>
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
                  <button
                    onClick={onReject}
                    className="flex-none bg-white hover:bg-slate-50 text-slate-600 font-bold py-3 px-6 rounded-lg transition-all border border-slate-200"
                  >
                    Reject
                  </button>
                  <button onClick={openNavigation} className="w-12 h-12 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    <span className="material-symbols-outlined text-slate-600">map</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl text-slate-400 mb-3">
              {isAvailable ? "event_busy" : "power_settings_new"}
            </span>
            <h4 className="text-lg font-bold text-slate-900 mb-2">
              {isAvailable ? "No matching requests" : "AI Matching Paused"}
            </h4>
            <p className="text-sm text-slate-500 max-w-sm">
              {isAvailable ? "We will notify you immediately if your blood type is needed." : "Turn on your availability to start receiving live emergency requests from nearby hospitals."}
            </p>
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
                    {hospitalRated ? (
                      <span className="text-xs font-bold text-slate-400">Rated</span>
                    ) : (
                      <button onClick={onRate} className="text-xs font-bold text-[#ee2b2b] hover:bg-[#ee2b2b]/5 px-3 py-1.5 rounded-lg transition-colors">
                        Rate Hospital
                      </button>
                    )}
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
            <Link to="/donor/impact" className="text-[#ee2b2b] text-xs font-bold hover:underline">View All</Link>
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

function DonationCentersView({ onBook }: { onBook: (appt: any) => void }) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date(2023, 10, 1));
  const [selectedDate, setSelectedDate] = useState<number | null>(5);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedHospital, setSelectedHospital] = useState("City Central Medical Center");

  const handleSchedule = () => {
    if (!selectedDate || !selectedTime) {
      alert("Please select a date and time slot first.");
      return;
    }
    alert(`Appointment successfully scheduled at ${selectedHospital}!`);
    onBook({ date: `Nov ${selectedDate}`, time: selectedTime, hospital: selectedHospital, id: Date.now() });
    navigate('/donor/pending');
  };

  return (
    <div className="flex flex-col gap-8 -mt-2 pb-24">
      {/* Breadcrumbs & Title */}
      <div className="flex flex-col gap-2">
        <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <Link className="hover:text-[#ee2b2b]" to="/donor">Dashboard</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-slate-900">Book Appointment</span>
        </nav>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">Schedule Your Donation</h2>
            <p className="text-slate-500 max-w-2xl mt-1">Our AI predicts high demand for O- and A+ types this week. Your donation could save up to three lives.</p>
          </div>
          <div className="flex items-center gap-2 bg-[#ee2b2b]/10 text-[#ee2b2b] px-4 py-2 rounded-lg border border-[#ee2b2b]/20">
            <span className="material-symbols-outlined animate-pulse">priority_high</span>
            <span className="text-sm font-bold uppercase">Critical Shortage: O Negative</span>
          </div>
        </div>
      </div>

      {/* Booking Interface Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Calendar View */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Date</span>
              <h3 className="text-xl font-bold text-slate-900">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><span className="material-symbols-outlined">chevron_left</span></button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><span className="material-symbols-outlined">chevron_right</span></button>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-7 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square"></div>
              ))}
              {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                const isSelected = selectedDate === day;
                const hasSpots = [6, 11].includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(day)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-semibold transition-all relative ${isSelected
                      ? "bg-[#ee2b2b] text-white font-bold shadow-lg shadow-[#ee2b2b]/20 scale-110 z-10"
                      : "hover:bg-slate-100 text-slate-900"
                      }`}
                  >
                    {day}
                    {isSelected && <span className="w-1 h-1 bg-white rounded-full mt-1"></span>}
                    {!isSelected && hasSpots && <span className="absolute bottom-2 w-1 h-1 bg-[#ee2b2b]/40 rounded-full"></span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50 flex flex-wrap gap-4 text-xs font-bold uppercase tracking-widest text-slate-500">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#ee2b2b]"></span> Selected</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#ee2b2b]/40"></span> Available</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-300"></span> Fully Booked</div>
          </div>
        </div>

        {/* Right: Hospital & Time Panel */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Select Hospital & Time</h3>
              <span className="text-sm font-bold text-[#ee2b2b]">3 centers nearby</span>
            </div>
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
              {[
                { name: "City Central Medical Center", distance: "1.2 miles away", address: "450 Main St.", demand: "Urgent: O-", style: "text-[#ee2b2b] bg-[#ee2b2b]/10" },
                { name: "St. Jude Community Clinic", distance: "2.8 miles away", address: "89 Hope Blvd.", demand: "Demand: A+", style: "text-slate-500 bg-slate-100" },
                { name: "North Valley Blood Bank", distance: "5.1 miles away", address: "12 Oak Ridge Rd.", demand: "Limited Slots", style: "text-slate-500 bg-slate-100" }
              ].map(hosp => {
                const isSelected = selectedHospital === hosp.name;
                return (
                  <div
                    key={hosp.name}
                    onClick={() => { setSelectedHospital(hosp.name); setSelectedTime(null); }}
                    className={`bg-white p-5 rounded-xl border ${isSelected ? 'border-2 border-[#ee2b2b]' : 'border-slate-200 hover:border-[#ee2b2b]/30'} shadow-sm relative group cursor-pointer transition-all`}
                  >
                    {isSelected && (
                      <div className="absolute -right-1 -top-1">
                        <span className="bg-[#ee2b2b] text-white text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-widest">Selected</span>
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-slate-900 text-lg leading-tight">{hosp.name}</h4>
                        <p className="text-slate-500 text-sm flex items-center gap-1 mt-1">
                          <span className="material-symbols-outlined text-sm">location_on</span> {hosp.distance} · {hosp.address}
                        </p>
                      </div>
                      <div className={`${hosp.style} text-[10px] font-black px-2 py-1 rounded uppercase tracking-tighter`}>{hosp.demand}</div>
                    </div>
                    {isSelected ? (
                      <div className="space-y-3">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Available Slots (Nov {selectedDate})</p>
                        <div className="grid grid-cols-3 gap-2">
                          {["09:00 AM", "10:30 AM", "11:00 AM", "01:30 PM", "03:30 PM"].map(time => (
                            <button
                              key={time}
                              onClick={(e) => { e.stopPropagation(); setSelectedTime(time); }}
                              className={`py-2 px-1 text-xs font-bold rounded-lg transition-colors ${selectedTime === time ? "border-2 border-[#ee2b2b] bg-[#ee2b2b] text-white shadow-md" : "border border-slate-200 hover:border-[#ee2b2b]/50 hover:bg-[#ee2b2b]/5"}`}
                            >
                              {time}
                            </button>
                          ))}
                          <button className="py-2 px-1 text-xs font-bold border border-slate-200 rounded-lg opacity-40 cursor-not-allowed line-through">02:00 PM</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 text-xs font-bold text-slate-400">
                        <span>Click to view slots</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Booking Summary Footer */}
      {(selectedDate || selectedTime) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] p-4 sm:p-6 z-40 animate-in slide-in-from-bottom flex justify-center">
          <div className="max-w-7xl w-full flex flex-col sm:flex-row items-center justify-between gap-6 pl-0">
            <div className="flex items-center gap-6 divide-x divide-slate-200 w-full sm:w-auto overflow-x-auto">
              <div className="flex flex-col min-w-max">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</span>
                <p className="font-bold text-slate-900">Sunday, Nov {selectedDate} {selectedTime ? `@ ${selectedTime}` : ''}</p>
              </div>
              <div className="flex flex-col pl-6 min-w-max">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</span>
                <p className="font-bold text-slate-900">{selectedHospital}</p>
              </div>
              <div className="hidden lg:flex flex-col pl-6 min-w-max">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimated Duration</span>
                <p className="font-bold text-slate-900">45-60 mins</p>
              </div>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto shrink-0">
              <button className="px-6 py-3 text-slate-600 font-bold hover:text-slate-900 transition-colors hidden sm:block">
                Save to Drafts
              </button>
              <button
                onClick={handleSchedule}
                className="flex-1 sm:flex-none bg-[#ee2b2b] hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg shadow-[#ee2b2b]/20 transition-all transform active:scale-95 flex items-center justify-center gap-2"
              >
                Schedule Appointment
                <span className="material-symbols-outlined">calendar_add_on</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Modal Helper */}
      <div className="fixed bottom-32 md:bottom-28 right-8 z-30">
        <div className="bg-white p-3 rounded-full shadow-2xl border border-slate-200 flex items-center gap-3 pr-6 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-[#ee2b2b]/10 text-[#ee2b2b] flex items-center justify-center">
            <span className="material-symbols-outlined">map</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase">Current Area</span>
            <span className="text-xs font-bold">Manhattan, NY</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingDonationsView({ userPoints, appointments, onCancel }: { userPoints: number, appointments: any[], onCancel: (id: number) => void }) {
  const navigate = useNavigate();
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Registration Status */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <h3 className="font-bold text-lg mb-4 text-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-green-500">how_to_reg</span>
          Registration Status
        </h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-700">Profile Complete</span>
          <span className="text-sm font-bold text-green-600">100%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div className="bg-green-500 rounded-full h-2 w-full"></div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Upcoming scheduled donations */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="font-bold text-lg mb-4 text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">event_upcoming</span>
            Upcoming Donations
          </h3>
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No upcoming appointments. <Link to="/donor/centers" className="text-[#ee2b2b] hover:underline font-bold">Schedule one now!</Link></p>
            ) : (
              appointments.map(appt => (
                <div key={appt.id} className="border border-blue-100 bg-blue-50 rounded-lg p-4 flex gap-4 items-start">
                  <div className="bg-white p-3 rounded-lg text-center min-w-[60px] border border-blue-100 flex flex-col justify-center items-center">
                    <p className="text-xs font-bold text-slate-500 uppercase">{appt.date}</p>
                    <p className="text-lg font-black text-blue-600 leading-tight mt-1">{appt.time.split(' ')[0]}</p>
                    <p className="text-[10px] font-black text-slate-400 leading-tight">{appt.time.split(' ')[1]}</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Whole Blood Donation</h4>
                    <p className="text-sm text-slate-600 mt-1">{appt.hospital}</p>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => { onCancel(appt.id); navigate('/donor/centers'); }} className="text-xs font-bold bg-white border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 transition-colors shadow-sm">Reschedule</button>
                      <button onClick={() => onCancel(appt.id)} className="text-xs font-bold text-red-600 hover:text-red-700 bg-white border border-red-100 px-3 py-1.5 rounded transition-colors shadow-sm">Cancel</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* History Summary and Points */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="font-bold text-lg mb-4 text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">stars</span>
            Impact Summary
          </h3>
          <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-xl border border-red-100 text-center mb-6">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Total Points Earned</p>
            <p className="text-4xl font-black text-red-600">{userPoints} <span className="text-lg text-red-400">XP</span></p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Recent Activity</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Profile Completion Bonus</span>
                <span className="font-bold text-green-600">+100 XP</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Verified Blood Group Docs</span>
                <span className="font-bold text-green-600">+30 XP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommunityView({ feedPosts, setFeedPosts }: { feedPosts: any[], setFeedPosts: any }) {
  const [isRegistered, setIsRegistered] = useState(false);
  const [replyText, setReplyText] = useState("");

  const handleToggleLike = (postId: number) => {
    setFeedPosts(posts => posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          isLiked: !post.isLiked,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1
        };
      }
      return post;
    }));
  };

  const handleRegisterDrive = () => {
    setIsRegistered(true);
    alert("Successfully registered for the upcoming blood drive! We've sent details to your email.");
  };

  const handleToggleReply = (postId: number) => {
    setFeedPosts(posts => posts.map(post =>
      post.id === postId ? { ...post, showReplyInput: !post.showReplyInput } : post
    ));
  };

  const submitReply = (postId: number) => {
    if (!replyText.trim()) return;
    setFeedPosts(posts => posts.map(post => {
      if (post.id === postId) {
        return { ...post, showReplyInput: false, replies: [...post.replies, replyText] };
      }
      return post;
    }));
    setReplyText("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="font-bold text-lg mb-4">Community Feed</h3>
          <div className="space-y-6">
            {feedPosts.map((post) => (
              <div key={post.id} className="flex gap-4 pb-6 border-b border-slate-100 last:border-0 last:pb-0">
                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0">
                  <img src={`https://picsum.photos/seed/user${post.id}/100/100`} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-slate-900">{post.user}</span>
                    <span className="text-xs text-slate-400">• {post.time}</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    {post.content}
                  </p>

                  {/* Render Replies */}
                  {post.replies.map((reply: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 p-3 rounded-lg mt-2 mb-3 ml-4 border border-slate-100 text-sm text-slate-700">
                      <span className="font-bold text-slate-900 mr-2">You:</span>{reply}
                    </div>
                  ))}

                  <div className="flex items-center gap-4 text-xs font-bold">
                    <button onClick={() => handleToggleLike(post.id)} className={`flex items-center gap-1 transition-colors ${post.isLiked ? 'text-[#ee2b2b]' : 'text-slate-400 hover:text-[#ee2b2b]'}`}>
                      <svg
                        className={`w-5 h-5 transition-colors duration-200 ${post.isLiked
                          ? 'text-[#ee2b2b] fill-[#ee2b2b]'
                          : 'text-slate-400 fill-transparent stroke-2'
                          }`}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={post.isLiked ? '0' : '2'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                      </svg>
                      {post.likes} Likes
                    </button>
                    <button onClick={() => handleToggleReply(post.id)} className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
                      <span className="material-symbols-outlined text-sm">chat_bubble</span>
                      Reply
                    </button>
                  </div>

                  {/* Reply Input */}
                  {post.showReplyInput && (
                    <div className="mt-3 flex gap-2 w-full">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-300"
                      />
                      <button onClick={() => submitReply(post.id)} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold">Send</button>
                    </div>
                  )}
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

function RewardsView({ userTokens, setUserTokens }: { userTokens: number, setUserTokens: (val: number) => void }) {
  const navigate = useNavigate();
  const [showAllFacilities, setShowAllFacilities] = useState(false);

  const handleRedeem = (cost: number, name: string) => {
    if (userTokens >= cost) {
      setUserTokens(userTokens - cost);
      alert(`🎉 Successfully redeemed: ${name}! Instructions have been sent to your email.`);
    } else {
      alert(`Not enough tokens! You need ${cost - userTokens} more tokens to redeem ${name}.`);
    }
  };

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
          <button onClick={() => navigate('/donor/centers')} className="mt-6 w-full py-4 bg-[#ee2b2b] hover:bg-[#ee2b2b]/90 text-white font-bold rounded-lg shadow-lg shadow-[#ee2b2b]/30 transition-all flex items-center justify-center gap-2">
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

          {/* Tokens & Hospital Facilities */}
          <div className="mt-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
                <span className="material-symbols-outlined text-green-500">toll</span>
                Reward Tokens & Facilities
              </h2>
              <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-xl border border-green-200 shadow-sm">
                <span className="font-black text-xl">{userTokens.toLocaleString()}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Available</span>
              </div>
            </div>

            <p className="text-sm text-slate-500 mb-6 font-medium">
              You earn <span className="font-bold text-[#ee2b2b]">2,000 tokens</span> for each successful donation! Redeem your tokens for free checkups and facilities at our partner hospitals.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-[#ee2b2b]/50 hover:shadow-md transition-all">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined">health_and_safety</span>
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">City General</span>
                  </div>
                  <h4 className="font-bold text-slate-900 leading-tight">Comprehensive Health Checkup</h4>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">Full body screening including vitals, blood profile, and doctor consultation.</p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-black text-green-600">10,000 <span className="text-[10px]">Tokens</span></span>
                  <button className="text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => handleRedeem(10000, 'Comprehensive Health Checkup')} disabled={userTokens < 10000}>Redeem</button>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-[#ee2b2b]/50 hover:shadow-md transition-all">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined">dentistry</span>
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">St. Jude Medical</span>
                  </div>
                  <h4 className="font-bold text-slate-900 leading-tight">Dental Cleaning & Scaling</h4>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">Professional dental cleaning and regular maintenance consultation.</p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-black text-green-600">8,000 <span className="text-[10px]">Tokens</span></span>
                  <button className="text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => handleRedeem(8000, 'Dental Cleaning & Scaling')} disabled={userTokens < 8000}>Redeem</button>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-[#ee2b2b]/50 hover:shadow-md transition-all">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined">visibility</span>
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">North Valley</span>
                  </div>
                  <h4 className="font-bold text-slate-900 leading-tight">Vision Diagnostic Test</h4>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">Complete eye checkup, prescription update, and retina scanning.</p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-black text-green-600">5,000 <span className="text-[10px]">Tokens</span></span>
                  <button className="text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => handleRedeem(5000, 'Vision Diagnostic Test')} disabled={userTokens < 5000}>Redeem</button>
                </div>
              </div>

              {!showAllFacilities ? (
                <div onClick={() => setShowAllFacilities(true)} className="bg-slate-50 p-5 rounded-xl border border-slate-200 border-dashed flex flex-col justify-center items-center group hover:bg-[#ee2b2b]/5 transition-all outline-none cursor-pointer">
                  <span className="material-symbols-outlined text-4xl text-slate-400 group-hover:text-[#ee2b2b] mb-2 transition-colors">dataset</span>
                  <h4 className="font-bold text-slate-700 group-hover:text-[#ee2b2b] transition-colors">View All Facilities</h4>
                  <p className="text-xs text-slate-500 mt-1">20+ hospital partners</p>
                </div>
              ) : (
                <>
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-[#ee2b2b]/50 hover:shadow-md transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center">
                          <span className="material-symbols-outlined">psychology</span>
                        </div>
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Lakeside Care</span>
                      </div>
                      <h4 className="font-bold text-slate-900 leading-tight">Mental Health Consultation</h4>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">1-hour confidential session with a certified therapist.</p>
                    </div>
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-black text-green-600">6,000 <span className="text-[10px]">Tokens</span></span>
                      <button className="text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => handleRedeem(6000, 'Mental Health Consultation')} disabled={userTokens < 6000}>Redeem</button>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-[#ee2b2b]/50 hover:shadow-md transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center">
                          <span className="material-symbols-outlined">favorite</span>
                        </div>
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Heart Center</span>
                      </div>
                      <h4 className="font-bold text-slate-900 leading-tight">ECG & Heart Screening</h4>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">Basic cardiovascular screening for early detection.</p>
                    </div>
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-black text-green-600">12,000 <span className="text-[10px]">Tokens</span></span>
                      <button className="text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => handleRedeem(12000, 'ECG & Heart Screening')} disabled={userTokens < 12000}>Redeem</button>
                    </div>
                  </div>

                  <div onClick={() => setShowAllFacilities(false)} className="bg-slate-50 p-5 rounded-xl border border-slate-200 border-dashed flex flex-col justify-center items-center group hover:bg-[#ee2b2b]/5 transition-all outline-none cursor-pointer">
                    <span className="material-symbols-outlined text-4xl text-slate-400 group-hover:text-[#ee2b2b] mb-2 transition-colors">unfold_less</span>
                    <h4 className="font-bold text-slate-700 group-hover:text-[#ee2b2b] transition-colors">Show Less</h4>
                  </div>
                </>
              )}
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

function SettingsView() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#ee2b2b]">settings</span>
          Account Settings
        </h2>
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg border-slate-100 bg-slate-50">
            <div>
              <h4 className="font-bold text-slate-900">Push Notifications</h4>
              <p className="text-sm text-slate-500">Receive alerts for emergency matches</p>
            </div>
            <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-pointer">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg border-slate-100 bg-slate-50">
            <div>
              <h4 className="font-bold text-slate-900">Location Services</h4>
              <p className="text-sm text-slate-500">Allow AI to find nearest hospitals for matching</p>
            </div>
            <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-pointer">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
            </div>
          </div>
        </div>
        <button className="mt-8 px-6 py-3 w-full sm:w-auto bg-[#ee2b2b] text-white rounded-lg font-bold hover:bg-[#ee2b2b]/90 transition-all shadow-md">
          Save Changes
        </button>
      </div>
    </div>
  );
}
