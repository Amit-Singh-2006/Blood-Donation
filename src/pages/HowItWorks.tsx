import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ArrowLeft } from 'lucide-react';

// Mirrors what the donor network actually does (n8n/workflows/emergency-dispatch)
const STEPS = [
  {
    icon: 'local_hospital',
    title: 'A verified hospital raises a request',
    text: 'The hospital enters the blood group, units needed, urgency and when it is needed by. Only hospitals our team has verified against their registration number can alert donors.',
  },
  {
    icon: 'join_inner',
    title: 'We find compatible, eligible donors nearby',
    text: 'Donors are matched on red-cell compatibility (ABO and Rh), within 80 km or in the same city, and only if they are past the rest period of 90 days for men or 120 days for women since their last donation. Exact-group donors are asked first and O- donors last, so O- stays available for patients who can only take O-.',
  },
  {
    icon: 'sms',
    title: 'The closest donors are alerted',
    text: 'The best-ranked donors get an SMS (or WhatsApp, when enabled) with a link to reply YES or NO. We alert a few donors at a time so people are not called in for blood that is no longer needed.',
  },
  {
    icon: 'update',
    title: 'The search widens until the need is met',
    text: 'If not enough donors say YES, the next donors are alerted: every 10 minutes for emergencies, 20 for urgent and 60 for normal requests (10 minutes whenever blood is needed within 2 hours). The search stops when the units are covered, the hospital closes the request, every compatible donor has been asked, or after 12 hours.',
  },
  {
    icon: 'family_restroom',
    title: 'The family can follow along',
    text: 'The hospital can share a tracking link or QR code. It shows how many donors are on the way, without revealing who they are.',
  },
  {
    icon: 'volunteer_activism',
    title: 'The donation is recorded',
    text: 'When the hospital confirms a donor gave blood, the donation appears on the donor’s dashboard and their next eligible date is updated.',
  },
];

export default function HowItWorks() {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-[#f8f6f6] font-sans text-slate-900 flex flex-col pt-20">
            <header className="w-full px-6 lg:px-20 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-[#ee2b2b]/10 fixed top-0 z-50">
                <Link to="/" className="flex items-center gap-2">
                    <div className="bg-[#ee2b2b] p-1.5 rounded-lg text-white">
                        <span className="material-symbols-outlined text-2xl">vital_signs</span>
                    </div>
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900">LifeLink <span className="text-[#ee2b2b]">AI</span></h1>
                </Link>
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#ee2b2b] transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Go Back
                </button>
            </header>

            <main className="flex-1 max-w-4xl mx-auto py-16 px-6 space-y-12 w-full">
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-blue-100 text-blue-600 p-3 rounded-2xl">
                            <Zap className="w-8 h-8" />
                        </div>
                        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">How it Works</h2>
                    </div>
                    <p className="text-lg text-slate-600 leading-relaxed mb-8">
                        LifeLink connects hospitals that urgently need blood with voluntary donors nearby. Donation is always voluntary and unpaid, as the National Blood Policy requires.
                    </p>
                    <ol className="space-y-4">
                        {STEPS.map((step, i) => (
                            <li key={step.title} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex gap-4">
                                <div className="shrink-0 w-10 h-10 rounded-xl bg-[#ee2b2b]/10 text-[#ee2b2b] flex items-center justify-center">
                                    <span className="material-symbols-outlined">{step.icon}</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{i + 1}. {step.title}</h3>
                                    <p className="text-sm text-slate-600 leading-relaxed mt-1">{step.text}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </motion.section>

                <section className="bg-red-50 border border-red-100 text-slate-900 rounded-3xl p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div>
                        <h3 className="text-xl font-bold">Ready to help?</h3>
                        <p className="text-sm text-slate-600 mt-1">Register once, and we will only contact you when a patient near you needs your blood group.</p>
                    </div>
                    <div className="flex gap-3">
                        <Link to="/register-donor" className="px-5 py-3 rounded-xl bg-[#ee2b2b] text-white text-sm font-bold hover:bg-[#ee2b2b]/90 transition-colors">Become a donor</Link>
                        <Link to="/register-hospital" className="px-5 py-3 rounded-xl bg-white border border-red-200 text-[#ee2b2b] text-sm font-bold hover:bg-red-100 transition-colors">Register a hospital</Link>
                    </div>
                </section>
            </main>

            <footer className="w-full p-8 border-t border-slate-200 mt-auto bg-white">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs font-bold text-slate-400">© {new Date().getFullYear()} LifeLink AI. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link to="/privacy" className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b] transition-colors">Privacy Policy</Link>
                        <Link to="/terms" className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b] transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
