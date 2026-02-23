import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, ArrowLeft } from 'lucide-react';

export default function ImpactReports() {
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

            <footer className="w-full p-8 border-t border-slate-200 mt-auto bg-white">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs font-bold text-slate-400 max-w">© 2024 LifeLink AI. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
