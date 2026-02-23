import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Support() {
    const [formSent, setFormSent] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', subject: 'General Inquiry', message: '' });

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
            <div className="bg-gradient-to-br from-slate-900 to-slate-700 text-white py-20 px-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-5">
                    <span className="material-symbols-outlined text-[20rem] absolute -right-20 -bottom-16">support_agent</span>
                </div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10">
                    <span className="material-symbols-outlined text-6xl mb-4 block opacity-70">support_agent</span>
                    <h1 className="text-4xl font-black mb-3">Contact & Support</h1>
                    <p className="text-slate-400 max-w-xl mx-auto text-base">We're here around the clock. Reach our team through any of the channels below — for emergencies, call us directly.</p>
                </motion.div>
            </div>

            {/* Contact Cards */}
            <section className="max-w-5xl mx-auto w-full py-16 px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                    {[
                        {
                            icon: 'emergency',
                            title: 'Emergency Hotline',
                            desc: 'For critical blood shortage emergencies — available 24/7.',
                            value: '+1 (800) 555-0199',
                            action: 'tel:+18005550199',
                            cta: 'Call Now',
                            color: 'bg-red-50 border-red-200 text-[#ee2b2b]',
                            btnColor: 'bg-[#ee2b2b] text-white hover:bg-[#ee2b2b]/90',
                        },
                        {
                            icon: 'mail',
                            title: 'General Support',
                            desc: 'Questions about your account, donations, or the platform.',
                            value: 'support@lifelink.ai',
                            action: 'mailto:support@lifelink.ai',
                            cta: 'Send Email',
                            color: 'bg-blue-50 border-blue-200 text-blue-600',
                            btnColor: 'bg-blue-600 text-white hover:bg-blue-700',
                        },
                        {
                            icon: 'business',
                            title: 'Hospital Partnerships',
                            desc: 'For medical institutions looking to join our network.',
                            value: 'partners@lifelink.ai',
                            action: 'mailto:partners@lifelink.ai',
                            cta: 'Contact Partners Team',
                            color: 'bg-emerald-50 border-emerald-200 text-emerald-600',
                            btnColor: 'bg-emerald-600 text-white hover:bg-emerald-700',
                        },
                    ].map((card, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className={`rounded-2xl border p-8 space-y-4 ${card.color}`}
                        >
                            <span className="material-symbols-outlined text-4xl block">{card.icon}</span>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">{card.title}</h3>
                                <p className="text-sm text-slate-500 mt-1">{card.desc}</p>
                            </div>
                            <p className="font-black text-sm">{card.value}</p>
                            <a
                                href={card.action}
                                className={`block text-center py-3 rounded-xl font-black text-sm transition-all active:scale-95 ${card.btnColor}`}
                            >
                                {card.cta}
                            </a>
                        </motion.div>
                    ))}
                </div>

                {/* Office Hours */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="bg-white rounded-2xl border border-slate-200 p-8 mb-16 shadow-sm"
                >
                    <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#ee2b2b]">schedule</span>
                        Support Availability
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { label: 'Emergency Line', hours: '24 / 7 / 365', note: 'Always available', color: 'text-[#ee2b2b]' },
                            { label: 'General Support (Email)', hours: 'Mon – Fri, 9AM – 8PM', note: 'Response within 4 hours', color: 'text-blue-600' },
                            { label: 'Partnership Inquiries', hours: 'Mon – Fri, 10AM – 6PM', note: 'Response within 24 hours', color: 'text-emerald-600' },
                        ].map((item, i) => (
                            <div key={i} className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                                <p className={`font-black text-base ${item.color}`}>{item.hours}</p>
                                <p className="text-xs text-slate-400">{item.note}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Contact Form */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-2xl mx-auto"
                >
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Send Us a Message</h2>
                        <p className="text-slate-500">Fill out the form and we'll get back to you as soon as possible.</p>
                    </div>

                    {formSent ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl border border-emerald-200 p-12 text-center shadow-sm"
                        >
                            <span className="material-symbols-outlined text-5xl text-emerald-500 mb-4 block">mark_email_read</span>
                            <h3 className="text-2xl font-black text-slate-900 mb-2">Message Sent!</h3>
                            <p className="text-slate-500">
                                Thank you, <strong>{form.name}</strong>. We've received your message and will reply to <strong>{form.email}</strong> shortly.
                            </p>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">person</span>
                                        <input
                                            required
                                            value={form.name}
                                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                            placeholder="Your name"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b]/50 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                                        <input
                                            type="email"
                                            required
                                            value={form.email}
                                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                            placeholder="you@example.com"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b]/50 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</label>
                                <select
                                    value={form.subject}
                                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/20 transition-all"
                                >
                                    <option>General Inquiry</option>
                                    <option>Account & Login Issues</option>
                                    <option>Donation Process</option>
                                    <option>Hospital Partnership Inquiry</option>
                                    <option>Emergency Blood Request</option>
                                    <option>Report a Technical Issue</option>
                                    <option>Privacy or Data Concern</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Message</label>
                                <textarea
                                    required
                                    rows={5}
                                    value={form.message}
                                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                                    placeholder="Describe your issue or question in detail..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b]/50 transition-all resize-none"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-4 bg-[#ee2b2b] text-white rounded-xl font-black text-sm hover:bg-[#ee2b2b]/90 shadow-xl shadow-[#ee2b2b]/20 transition-all active:scale-95"
                            >
                                Send Message
                            </button>
                        </form>
                    )}
                </motion.div>
            </section>

            <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 font-medium">
                © 2026 LifeLink AI. All rights reserved.
            </footer>
        </div>
    );
}
