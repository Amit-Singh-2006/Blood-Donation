import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ArrowLeft } from 'lucide-react';

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

            <main className="flex-1 max-w-4xl mx-auto py-16 px-6 space-y-24 w-full">
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
            </main>

            <footer className="w-full p-8 border-t border-slate-200 mt-auto bg-white">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs font-bold text-slate-400 max-w">© 2024 LifeLink AI. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
