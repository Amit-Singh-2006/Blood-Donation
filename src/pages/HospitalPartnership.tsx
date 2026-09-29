import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatMinutes, useNetworkAnalytics } from '../lib/network';

const FEATURES = [
    { icon: 'hub', title: 'Matching in Seconds', desc: 'Every request is matched against ABO/Rh-compatible donors near your hospital, nearest first, keeping rare O- blood for the patients who need it.' },
    { icon: 'fact_check', title: 'Eligibility Checks', desc: 'Donors inside their rest period (90 days for men, 120 for women) or marked unavailable are never alerted. The blood centre still screens every donor.' },
    { icon: 'notifications_active', title: 'Alerts That Escalate', desc: 'Donors get SMS, WhatsApp or in-app alerts with one-tap YES/NO. If nobody answers, the next donors are alerted automatically until the request is covered.' },
    { icon: 'call', title: 'Direct Donor Contact', desc: 'As soon as a donor confirms you see their first name and phone number to coordinate, and you record the donation or a no-show with one tap.' },
    { icon: 'family_restroom', title: 'Family Tracking Link', desc: "Each request comes with a link and QR code for the patient's family: live progress, never donor identities." },
    { icon: 'payments', title: 'Free for Hospitals', desc: 'LifeLink costs hospitals nothing. Donation stays voluntary and unpaid, as India\'s National Blood Policy requires.' },
];

const STEPS = [
    { icon: 'how_to_reg', title: 'Register your hospital', desc: 'Create a hospital account with your registration or licence number and contact details.' },
    { icon: 'verified', title: 'Get verified', desc: 'A LifeLink admin checks your registration details. Only verified hospitals can alert donors.' },
    { icon: 'emergency', title: 'Raise requests', desc: 'Request blood from your dashboard or the AI assistant, and share the tracking link with the family.' },
];

export default function HospitalPartnership() {
    const { data: stats } = useNetworkAnalytics();

    return (
        <div className="min-h-screen bg-[#f8f6f6] flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
                <Link to="/" className="flex items-center gap-2">
                    <div className="bg-[#ee2b2b] p-1.5 rounded-lg text-white">
                        <span className="material-symbols-outlined text-xl">vital_signs</span>
                    </div>
                    <h1 className="text-xl font-extrabold text-slate-900">LifeLink <span className="text-[#ee2b2b]">AI</span></h1>
                </Link>
                <Link to="/" className="flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-[#ee2b2b] transition-colors">
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    Home
                </Link>
            </header>

            {/* Hero */}
            <div className="bg-gradient-to-br from-[#ee2b2b] via-rose-600 to-orange-500 text-white py-24 px-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <span className="material-symbols-outlined text-[20rem] absolute -right-20 -bottom-20">local_hospital</span>
                </div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10">
                    <span className="material-symbols-outlined text-6xl mb-4 block opacity-80">domain_add</span>
                    <h1 className="text-4xl md:text-5xl font-black mb-4">Hospital Partnership</h1>
                    <p className="text-white/80 max-w-2xl mx-auto text-lg">Reach compatible, eligible donors near your hospital in seconds, and follow every request until the blood arrives.</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        {[
                            stats && `${stats.donor_pool.registered} registered donors`,
                            stats && `${stats.donor_pool.eligible_now} eligible right now`,
                            stats && `First donor in ${formatMinutes(stats.requests.median_minutes_to_first_donor).toLowerCase()} (median)`,
                        ].filter(Boolean).map((stat) => (
                            <div key={stat as string} className="bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full text-sm font-black border border-white/20">
                                {stat}
                            </div>
                        ))}
                    </div>
                    {stats && <p className="text-white/60 text-xs mt-3">Live from the LifeLink network</p>}
                </motion.div>
            </div>

            {/* What you get */}
            <section className="max-w-5xl mx-auto w-full py-20 px-6">
                <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
                    <h2 className="text-3xl font-black text-slate-900 mb-3">What Your Hospital Gets</h2>
                    <p className="text-slate-500 max-w-xl mx-auto">Everything below works today in the hospital dashboard.</p>
                </motion.div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {FEATURES.map((card, i) => (
                        <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                            <span className="material-symbols-outlined text-3xl text-[#ee2b2b] mb-3 block">{card.icon}</span>
                            <h3 className="font-black text-slate-900 mb-2">{card.title}</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* How to join */}
            <section className="bg-white py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
                        <h2 className="text-3xl font-black text-slate-900 mb-3">How to Join</h2>
                        <p className="text-slate-500">Three steps from sign-up to your first request.</p>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {STEPS.map((step, i) => (
                            <div key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-8">
                                <span className="text-xs font-black text-[#ee2b2b]">STEP {i + 1}</span>
                                <span className="material-symbols-outlined text-3xl text-slate-800 block my-3">{step.icon}</span>
                                <h3 className="font-black text-slate-900 mb-2">{step.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                    <div className="text-center mt-12">
                        <Link to="/register-hospital" className="inline-flex items-center gap-2 bg-[#ee2b2b] text-white px-8 py-4 rounded-xl font-black text-sm hover:bg-[#ee2b2b]/90 shadow-xl shadow-[#ee2b2b]/20 transition-all">
                            <span className="material-symbols-outlined">local_hospital</span>
                            Register Your Hospital
                        </Link>
                        <p className="text-xs text-slate-400 mt-3">Already registered? <Link to="/login" className="font-bold text-[#ee2b2b] hover:underline">Sign in</Link></p>
                    </div>
                </div>
            </section>

            <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 font-medium">
                © 2026 LifeLink AI. All rights reserved. &nbsp;·&nbsp;
                <Link to="/support" className="hover:text-[#ee2b2b] font-bold">Support</Link>
            </footer>
        </div>
    );
}
