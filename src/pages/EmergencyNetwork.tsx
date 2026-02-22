import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, ArrowLeft } from 'lucide-react';

export default function EmergencyNetwork() {
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
            </main>

            <footer className="w-full p-8 border-t border-slate-200 mt-auto bg-white">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs font-bold text-slate-400 max-w">© 2024 LifeLink AI. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
