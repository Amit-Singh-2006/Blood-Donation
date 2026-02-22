import React, { useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Activity, BarChart3, ArrowLeft } from 'lucide-react';

export default function About() {
    const { hash } = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (hash) {
            setTimeout(() => {
                const element = document.getElementById(hash.replace('#', ''));
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        } else {
            window.scrollTo(0, 0);
        }
    }, [hash]);

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

            <main className="flex-1 max-w-4xl mx-auto py-16 px-6 space-y-24">

                {/* How It Works Section */}
                <motion.section
                    id="how-it-works"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="scroll-mt-28"
                >
                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-blue-100 text-blue-600 p-3 rounded-2xl">
                            <Zap className="w-8 h-8" />
                        </div>
                        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">How it Works</h2>
                    </div>
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                        <p className="text-lg text-slate-600 leading-relaxed mb-6">
                            LifeLink AI leverages advanced machine learning to streamline and optimize the blood donation lifecycle. On the surface, our system seamlessly connects willing donors with the hospitals that desperately need them.
                        </p>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-blue-500 mt-1">check_circle</span>
                                <span className="text-slate-700"><strong>Predictive AI:</strong> Analyzes regional data to predict blood shortages before they happen.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-blue-500 mt-1">check_circle</span>
                                <span className="text-slate-700"><strong>Smart Matching:</strong> Directly connects donors' specific blood types to hospitals that critically lack those resources.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-blue-500 mt-1">check_circle</span>
                                <span className="text-slate-700"><strong>Token Rewards:</strong> Appreciates donors by rewarding them with tokens redeemable for free checkups and medical facilities.</span>
                            </li>
                        </ul>
                    </div>
                </motion.section>

                {/* Emergency Network Section */}
                <motion.section
                    id="emergency-network"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="scroll-mt-28"
                >
                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-[#ee2b2b]/10 text-[#ee2b2b] p-3 rounded-2xl">
                            <Activity className="w-8 h-8" />
                        </div>
                        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Emergency Network</h2>
                    </div>
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                        <p className="text-lg text-slate-600 leading-relaxed mb-6">
                            When crises strike, every second counts. LifeLink AI's Emergency Network functions as a hyper-fast alert system designed to mobilize donors instantly.
                        </p>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                                <h4 className="font-bold text-red-900 mb-2">Live Geolocation</h4>
                                <p className="text-sm text-red-800">Donors are notified strictly based on their real-time proximity to the affected hospital to ensure the fastest response times possible.</p>
                            </div>
                            <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                                <h4 className="font-bold text-red-900 mb-2">Instant Dispatch</h4>
                                <p className="text-sm text-red-800">Hospitals can trigger a live SOS which completely bypasses standard queues, pinging the most eligible donors' devices immediately.</p>
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* Impact Reports Section */}
                <motion.section
                    id="impact-reports"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="scroll-mt-28"
                >
                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-green-100 text-green-600 p-3 rounded-2xl">
                            <BarChart3 className="w-8 h-8" />
                        </div>
                        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Impact Reports</h2>
                    </div>
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                        <p className="text-lg text-slate-600 leading-relaxed overflow-hidden">
                            We believe in radical transparency. Our impact reports reflect the tangible difference our network has made across the country.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                            <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <h3 className="text-3xl font-black text-slate-900">42K</h3>
                                <p className="text-xs font-bold text-slate-500 uppercase mt-1">Lives Saved</p>
                            </div>
                            <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <h3 className="text-3xl font-black text-slate-900">14K</h3>
                                <p className="text-xs font-bold text-slate-500 uppercase mt-1">Active Donors</p>
                            </div>
                            <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <h3 className="text-3xl font-black text-slate-900">120+</h3>
                                <p className="text-xs font-bold text-slate-500 uppercase mt-1">Hospitals</p>
                            </div>
                            <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <h3 className="text-3xl font-black text-[#ee2b2b]">12m</h3>
                                <p className="text-xs font-bold text-slate-500 uppercase mt-1">Avg Response</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 text-center mt-6">
                            Our network successfully matches 94% of requested emergency blood types within the critical first hour. By tracking donations longitudinally, we ensure hospitals never hit zero-inventory on critical blood markers.
                        </p>
                    </div>
                </motion.section>
            </main>

            <footer className="w-full p-8 border-t border-slate-200 mt-12 bg-white">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs font-bold text-slate-400 max-w">© 2024 LifeLink AI. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
