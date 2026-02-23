import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Tier = ({ name, color, icon, features, cta }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className={`rounded-2xl border p-8 space-y-6 ${color}`}
    >
        <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl">{icon}</span>
            <h3 className="text-xl font-black">{name}</h3>
        </div>
        <ul className="space-y-2">
            {features.map((f: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="material-symbols-outlined text-base mt-0.5">check_circle</span>
                    {f}
                </li>
            ))}
        </ul>
        <button className="w-full py-3 rounded-xl font-black text-sm border-2 border-current hover:opacity-80 transition-all active:scale-95">
            {cta}
        </button>
    </motion.div>
);

export default function HospitalPartnership() {
    const [formSent, setFormSent] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', hospital: '', beds: '', city: '' });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormSent(true);
    };

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
                    Back to Login
                </Link>
            </header>

            {/* Hero */}
            <div className="bg-gradient-to-br from-[#ee2b2b] via-rose-600 to-orange-500 text-white py-24 px-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <span className="material-symbols-outlined text-[20rem] absolute -right-20 -bottom-20">local_hospital</span>
                </div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10">
                    <span className="material-symbols-outlined text-6xl mb-4 block opacity-80">domain_add</span>
                    <h1 className="text-4xl md:text-5xl font-black mb-4">Hospital Partnership Program</h1>
                    <p className="text-white/80 max-w-2xl mx-auto text-lg">Join the LifeLink AI network to receive real-time blood availability data, AI-powered donor matching, and emergency supply forecasting — saving more lives every day.</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-6">
                        {['156+ Partner Hospitals', '12.4 Min Avg Response', '98.2% AI Accuracy'].map((stat) => (
                            <div key={stat} className="bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full text-sm font-black border border-white/20">
                                {stat}
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Why Partner Section */}
            <section className="max-w-5xl mx-auto w-full py-20 px-6">
                <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
                    <h2 className="text-3xl font-black text-slate-900 mb-3">Why Partner with LifeLink AI?</h2>
                    <p className="text-slate-500 max-w-xl mx-auto">We bridge the critical gap between blood availability and patient need using cutting-edge AI infrastructure.</p>
                </motion.div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: 'hub', title: 'AI-Powered Matching', desc: 'Our AI engine finds the most compatible, geographically closest donors within seconds of an urgent request.' },
                        { icon: 'insights', title: 'Demand Forecasting', desc: 'Predict blood shortages up to 7 days in advance using regional and seasonal AI models.' },
                        { icon: 'verified_user', title: 'Verified Donor Pool', desc: 'Every donor is medically verified and eligibility-checked before appearing in your request feed.' },
                        { icon: 'bolt', title: 'Real-Time Alerts', desc: 'Receive instant notifications when matching donors become available for your urgent O- or rare group needs.' },
                        { icon: 'analytics', title: 'Analytics Dashboard', desc: 'Monitor your hospital\'s blood request history, match rates, and inventory health through a dedicated admin panel.' },
                        { icon: 'support_agent', title: '24/7 Support', desc: 'Dedicated hospital partnership support team available around the clock for critical assistance.' },
                    ].map((card, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                            <span className="material-symbols-outlined text-3xl text-[#ee2b2b] mb-3 block">{card.icon}</span>
                            <h3 className="font-black text-slate-900 mb-2">{card.title}</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Partnership Tiers */}
            <section className="bg-white py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
                        <h2 className="text-3xl font-black text-slate-900 mb-3">Partnership Tiers</h2>
                        <p className="text-slate-500">Choose the level of integration that fits your facility's needs.</p>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <Tier
                            name="Essential"
                            color="border-slate-200 text-slate-800 bg-slate-50"
                            icon="local_hospital"
                            features={[
                                'AI donor matching access',
                                'Emergency blood alerts',
                                'Basic demand forecast',
                                'Email support',
                                'Up to 5 staff accounts',
                            ]}
                            cta="Get Started Free"
                        />
                        <Tier
                            name="Advanced"
                            color="border-[#ee2b2b]/30 text-[#ee2b2b] bg-red-50"
                            icon="medical_services"
                            features={[
                                'Everything in Essential',
                                'Real-time inventory sync',
                                'Cross-region rare blood search',
                                'Dedicated account manager',
                                'Up to 20 staff accounts',
                                'Priority match queue',
                            ]}
                            cta="Apply for Advanced"
                        />
                        <Tier
                            name="Trauma Center"
                            color="border-slate-800 text-slate-900 bg-slate-900 text-white"
                            icon="emergency"
                            features={[
                                'Everything in Advanced',
                                'Direct API integration',
                                'Custom AI model tuning',
                                'SLA-backed 99.9% uptime',
                                'Unlimited staff accounts',
                                '24/7 dedicated hotline',
                            ]}
                            cta="Contact Enterprise Team"
                        />
                    </div>
                </div>
            </section>

            {/* Application Form */}
            <section className="max-w-2xl mx-auto w-full py-20 px-6">
                <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
                    <h2 className="text-3xl font-black text-slate-900 mb-2">Apply to Join the Network</h2>
                    <p className="text-slate-500">Fill out the form below and our partnership team will reach out within 48 hours.</p>
                </motion.div>

                {formSent ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl border border-emerald-200 p-12 text-center shadow-sm">
                        <span className="material-symbols-outlined text-5xl text-emerald-500 mb-4 block">check_circle</span>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Application Received!</h3>
                        <p className="text-slate-500">Thank you for your interest in partnering with LifeLink AI. Our team will contact <strong>{form.email}</strong> within 24–48 business hours.</p>
                    </motion.div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-5">
                        {[
                            { label: 'Your Full Name', key: 'name', placeholder: 'Dr. Rebecca Moore', icon: 'person', type: 'text' },
                            { label: 'Work Email', key: 'email', placeholder: 'r.moore@hospital.com', icon: 'mail', type: 'email' },
                            { label: 'Hospital / Clinic Name', key: 'hospital', placeholder: 'City General Hospital', icon: 'local_hospital', type: 'text' },
                            { label: 'City / Region', key: 'city', placeholder: 'San Francisco, CA', icon: 'location_on', type: 'text' },
                            { label: 'Approximate Bed Count', key: 'beds', placeholder: '250', icon: 'bed', type: 'number' },
                        ].map(({ label, key, placeholder, icon, type }) => (
                            <div key={key} className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">{icon}</span>
                                    <input
                                        type={type}
                                        required
                                        value={(form as any)[key]}
                                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                        placeholder={placeholder}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b]/50 transition-all"
                                    />
                                </div>
                            </div>
                        ))}
                        <button type="submit" className="w-full py-4 bg-[#ee2b2b] text-white rounded-xl font-black text-sm hover:bg-[#ee2b2b]/90 shadow-xl shadow-[#ee2b2b]/20 transition-all active:scale-95 mt-2">
                            Submit Partnership Application
                        </button>
                    </form>
                )}
            </section>

            <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 font-medium">
                © 2026 LifeLink AI. All rights reserved. &nbsp;·&nbsp;
                <Link to="/support" className="hover:text-[#ee2b2b] font-bold">Support</Link>
            </footer>
        </div>
    );
}
