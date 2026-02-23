import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';

/* ── Animated counter ── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
    const [val, setVal] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true });
    useEffect(() => {
        if (!inView) return;
        let start = 0;
        const step = to / 60;
        const id = setInterval(() => {
            start += step;
            if (start >= to) { setVal(to); clearInterval(id); }
            else setVal(Math.floor(start));
        }, 16);
        return () => clearInterval(id);
    }, [inView, to]);
    return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

const fadeUp = { hidden: { opacity: 0, y: 32 }, show: { opacity: 1, y: 0, transition: { duration: 0.55 } } };
const stagger = { show: { transition: { staggerChildren: 0.12 } } };

export default function HomePage() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-[#fafafa] text-slate-900 overflow-x-hidden font-sans">

            {/* ── NAV ── */}
            <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <div className="bg-[#ee2b2b] p-1.5 rounded-lg text-white shadow-md shadow-[#ee2b2b]/30">
                            <span className="material-symbols-outlined text-xl">vital_signs</span>
                        </div>
                        <span className="text-xl font-extrabold tracking-tight">LifeLink <span className="text-[#ee2b2b]">AI</span></span>
                    </Link>

                    {/* Desktop nav */}
                    <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
                        <a href="#how-it-works" className="hover:text-[#ee2b2b] transition-colors">How It Works</a>
                        <a href="#features" className="hover:text-[#ee2b2b] transition-colors">Features</a>
                        <a href="#impact" className="hover:text-[#ee2b2b] transition-colors">Impact</a>
                        <Link to="/support" className="hover:text-[#ee2b2b] transition-colors">Support</Link>
                    </nav>

                    {/* CTA */}
                    <div className="flex items-center gap-3">
                        <Link
                            to="/login"
                            className="hidden sm:block text-sm font-bold text-slate-700 hover:text-[#ee2b2b] transition-colors"
                        >
                            Log In
                        </Link>
                        <Link
                            to="/login"
                            className="bg-[#ee2b2b] text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-[#ee2b2b]/25 hover:bg-[#ee2b2b]/90 transition-all active:scale-95"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            {/* ── HERO ── */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
                {/* Background blobs */}
                <div className="absolute inset-0 -z-10">
                    <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-[#ee2b2b]/8 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-rose-300/15 rounded-full blur-[100px]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#ee2b2b]/4 to-rose-100/20 rounded-full blur-[80px]" />
                </div>

                {/* Animated heartbeat line */}
                <svg className="absolute inset-0 w-full h-full opacity-[0.04] -z-10" viewBox="0 0 1440 800" preserveAspectRatio="none">
                    <motion.path
                        d="M0,400 L200,400 L260,200 L320,600 L380,300 L440,500 L500,400 L1440,400"
                        stroke="#ee2b2b" strokeWidth="3" fill="none"
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                        transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop', repeatDelay: 1 }}
                    />
                </svg>

                <div className="max-w-5xl mx-auto px-6 text-center">
                    {/* Badge */}
                    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="inline-flex items-center gap-2 bg-[#ee2b2b]/8 border border-[#ee2b2b]/20 text-[#ee2b2b] px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-8"
                    >
                        <span className="w-2 h-2 rounded-full bg-[#ee2b2b] animate-pulse" />
                        AI-Powered Blood Donation Network
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }}
                        className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6"
                    >
                        Every Second Counts.{' '}
                        <span className="relative inline-block">
                            <span className="text-[#ee2b2b]">LifeLink</span>
                            <motion.span
                                className="absolute -bottom-1 left-0 h-1 bg-[#ee2b2b]/30 rounded-full"
                                initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ delay: 0.8, duration: 0.6 }}
                            />
                        </span>{' '}
                        Bridges the Gap.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                        className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-10"
                    >
                        LifeLink AI connects blood donors with hospitals in real time using intelligent matching, predictive demand forecasting, and emergency alerts — saving lives across the network.
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center"
                    >
                        <Link
                            to="/register-donor"
                            className="inline-flex items-center justify-center gap-2 bg-[#ee2b2b] text-white px-8 py-4 rounded-2xl text-base font-black shadow-2xl shadow-[#ee2b2b]/30 hover:bg-[#ee2b2b]/90 hover:scale-[1.03] transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined">favorite</span>
                            Become a Donor
                        </Link>
                        <Link
                            to="/register-hospital"
                            className="inline-flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-800 px-8 py-4 rounded-2xl text-base font-black hover:border-[#ee2b2b]/30 hover:shadow-lg transition-all"
                        >
                            <span className="material-symbols-outlined text-[#ee2b2b]">local_hospital</span>
                            Partner Hospital
                        </Link>
                    </motion.div>

                    {/* Trust badges */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                        className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-semibold"
                    >
                        {['HIPAA Compliant', 'AES-256 Encrypted', 'Verified Donors Only', '24/7 Emergency Network'].map(t => (
                            <span key={t} className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm text-emerald-400">verified</span>
                                {t}
                            </span>
                        ))}
                    </motion.div>
                </div>

                {/* Scroll indicator */}
                <motion.div
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-300"
                    animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}
                >
                    <span className="text-[10px] font-bold uppercase tracking-widest">Scroll</span>
                    <span className="material-symbols-outlined text-base">expand_more</span>
                </motion.div>
            </section>

            {/* ── STATS ── */}
            <section id="impact" className="bg-[#ee2b2b] py-20 px-6">
                <motion.div
                    variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
                    className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-white text-center"
                >
                    {[
                        { value: 12847, suffix: '+', label: 'Lives Saved' },
                        { value: 156, suffix: '+', label: 'Partner Hospitals' },
                        { value: 98, suffix: '%', label: 'AI Match Accuracy' },
                        { value: 12, suffix: ' min', label: 'Avg. Response Time' },
                    ].map(({ value, suffix, label }) => (
                        <motion.div key={label} variants={fadeUp}>
                            <p className="text-4xl md:text-5xl font-black mb-2">
                                <Counter to={value} suffix={suffix} />
                            </p>
                            <p className="text-white/70 text-sm font-bold uppercase tracking-wider">{label}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section id="how-it-works" className="py-24 px-6 bg-white">
                <div className="max-w-5xl mx-auto">
                    <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-16">
                        <p className="text-[#ee2b2b] text-xs font-black uppercase tracking-widest mb-3">The Process</p>
                        <h2 className="text-4xl font-black">How LifeLink AI Works</h2>
                        <p className="text-slate-500 mt-3 max-w-xl mx-auto">Three simple steps connect a donor to a patient in need within minutes.</p>
                    </motion.div>

                    <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-8"
                    >
                        {[
                            { step: '01', icon: 'how_to_reg', title: 'Register & Verify', desc: 'Donors sign up, verify their blood type, and set their availability status. AI checks eligibility automatically.' },
                            { step: '02', icon: 'hub', title: 'AI Matches in Real-Time', desc: 'When a hospital raises an urgent request, our engine scans the network and finds the nearest compatible donor in seconds.' },
                            { step: '03', icon: 'emergency', title: 'Save a Life', desc: 'The matched donor receives an alert, confirms, and heads to the hospital. Every match is tracked and rewarded with XP tokens.' },
                        ].map(({ step, icon, title, desc }) => (
                            <motion.div key={step} variants={fadeUp}
                                className="relative bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:border-[#ee2b2b]/20 hover:shadow-xl transition-all group"
                            >
                                <span className="absolute top-6 right-6 text-6xl font-black text-slate-100 group-hover:text-[#ee2b2b]/10 transition-colors select-none">
                                    {step}
                                </span>
                                <div className="w-14 h-14 bg-[#ee2b2b]/10 text-[#ee2b2b] rounded-2xl flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined text-3xl">{icon}</span>
                                </div>
                                <h3 className="text-lg font-black mb-2">{title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section id="features" className="py-24 px-6 bg-[#fafafa]">
                <div className="max-w-6xl mx-auto">
                    <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-16">
                        <p className="text-[#ee2b2b] text-xs font-black uppercase tracking-widest mb-3">Capabilities</p>
                        <h2 className="text-4xl font-black">Built to Save Lives, Not Just Connect Them</h2>
                    </motion.div>

                    <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {[
                            { icon: 'psychology', color: 'bg-violet-50 text-violet-600', title: 'Intelligent Matching', desc: 'AI ranks donors by compatibility, proximity, donation history, and response rate — not just blood type.' },
                            { icon: 'insights', color: 'bg-blue-50 text-blue-600', title: 'Demand Forecasting', desc: 'Predicts regional blood shortages up to 7 days in advance using hospital load and seasonal models.' },
                            { icon: 'notifications_active', color: 'bg-amber-50 text-amber-600', title: 'Emergency Alerts', desc: 'Instant push, SMS, and email alerts during critical shortages — with one-tap confirmation.' },
                            { icon: 'token', color: 'bg-emerald-50 text-emerald-600', title: 'Donor Rewards (XP)', desc: 'Donors earn XP tokens for every verified donation, redeemable for healthcare benefits and discounts.' },
                            { icon: 'bar_chart', color: 'bg-[#ee2b2b]/10 text-[#ee2b2b]', title: 'Real-Time Analytics', desc: 'Hospitals and admins get live dashboards showing inventory, match rates, and regional demand.' },
                            { icon: 'verified_user', color: 'bg-teal-50 text-teal-600', title: 'HIPAA-Grade Security', desc: 'End-to-end AES-256 encryption, role-based access, and regular third-party audits keep data safe.' },
                        ].map(({ icon, color, title, desc }) => (
                            <motion.div key={title} variants={fadeUp}
                                className="bg-white rounded-2xl border border-slate-100 p-7 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all"
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${color}`}>
                                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                                </div>
                                <h3 className="font-black text-slate-900 mb-2">{title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── WHO IS IT FOR ── */}
            <section className="py-24 px-6 bg-white">
                <div className="max-w-5xl mx-auto">
                    <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-16">
                        <p className="text-[#ee2b2b] text-xs font-black uppercase tracking-widest mb-3">Who It's For</p>
                        <h2 className="text-4xl font-black">Three Roles. One Mission.</h2>
                    </motion.div>

                    <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                        {[
                            {
                                icon: 'favorite',
                                title: 'Donors',
                                color: 'from-rose-500 to-[#ee2b2b]',
                                route: '/register-donor',
                                points: ['Set availability status', 'Receive AI-matched alerts', 'Track donation history', 'Earn XP rewards', 'Build your donor rank'],
                            },
                            {
                                icon: 'local_hospital',
                                title: 'Hospitals',
                                color: 'from-blue-500 to-indigo-600',
                                route: '/register-hospital',
                                points: ['Real-time blood requests', 'AI donor matching', 'Blood inventory dashboard', 'Demand forecast reports', 'Cross-region rare blood search'],
                            },
                            {
                                icon: 'admin_panel_settings',
                                title: 'Admins',
                                color: 'from-slate-700 to-slate-900',
                                route: '/register-admin',
                                points: ['Full network oversight', 'Hospital & donor management', 'Regional analytics', 'AI engine configuration', 'Export PDF reports'],
                            },
                        ].map(({ icon, title, color, route, points }) => (
                            <motion.div key={title} variants={fadeUp}
                                className="rounded-3xl overflow-hidden shadow-lg border border-slate-100 hover:shadow-2xl transition-shadow"
                            >
                                <div className={`bg-gradient-to-br ${color} p-8 text-white`}>
                                    <span className="material-symbols-outlined text-5xl opacity-80 block mb-3">{icon}</span>
                                    <h3 className="text-2xl font-black">{title}</h3>
                                </div>
                                <div className="bg-white p-8 space-y-3">
                                    {points.map(p => (
                                        <div key={p} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                                            <span className="material-symbols-outlined text-[#ee2b2b] text-base">check_circle</span>
                                            {p}
                                        </div>
                                    ))}
                                    <Link
                                        to={route}
                                        className="mt-4 block text-center py-3 rounded-xl font-black text-sm bg-slate-50 border border-slate-200 text-slate-700 hover:bg-[#ee2b2b] hover:text-white hover:border-[#ee2b2b] transition-all"
                                    >
                                        Get Started as {title}
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── TESTIMONIALS ── */}
            <section className="py-24 px-6 bg-slate-900 text-white">
                <div className="max-w-5xl mx-auto">
                    <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-16">
                        <p className="text-[#ee2b2b] text-xs font-black uppercase tracking-widest mb-3">Stories</p>
                        <h2 className="text-4xl font-black">Real People. Real Impact.</h2>
                    </motion.div>

                    <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                        {[
                            { name: 'Dr. Ananya Mehta', role: 'Chief of Surgery, Apollo Hospital', quote: '"LifeLink AI matched a rare AB- donor for our emergency case in under 8 minutes. It was nothing short of miraculous."', avatar: 'https://i.pravatar.cc/100?img=47' },
                            { name: 'Rohan Verma', role: 'Blood Donor, Diamond Rank', quote: '"I\'ve donated 14 times through LifeLink AI. The XP system keeps me motivated and knowing I\'ve saved lives is priceless."', avatar: 'https://i.pravatar.cc/100?img=12' },
                            { name: 'Sarah Chen', role: 'Network Administrator', quote: '"The admin dashboard gives us complete visibility into regional supply chains. The AI demand forecast has been 97% accurate this quarter."', avatar: 'https://i.pravatar.cc/100?img=31' },
                        ].map(({ name, role, quote, avatar }) => (
                            <motion.div key={name} variants={fadeUp}
                                className="bg-white/5 border border-white/10 rounded-2xl p-7 hover:bg-white/10 transition-colors"
                            >
                                <p className="text-sm text-slate-300 leading-relaxed mb-6 italic">{quote}</p>
                                <div className="flex items-center gap-3">
                                    <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover" />
                                    <div>
                                        <p className="font-black text-sm">{name}</p>
                                        <p className="text-xs text-slate-400">{role}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── FINAL CTA ── */}
            <section className="py-28 px-6 bg-gradient-to-br from-[#ee2b2b] to-rose-700 text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <span className="material-symbols-outlined text-[30rem] absolute -right-24 -bottom-24 select-none">favorite</span>
                </div>
                <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="relative z-10 max-w-3xl mx-auto">
                    <motion.h2 variants={fadeUp} className="text-5xl font-black mb-6 leading-tight">
                        Join the Network.<br />Give the Gift of Life.
                    </motion.h2>
                    <motion.p variants={fadeUp} className="text-white/80 text-lg mb-10 max-w-xl mx-auto">
                        Whether you're a donor, a hospital, or an administrator — LifeLink AI needs you. Every account created is a step toward a world where no one dies waiting for blood.
                    </motion.p>
                    <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            to="/register-donor"
                            className="inline-flex items-center justify-center gap-2 bg-white text-[#ee2b2b] px-10 py-4 rounded-2xl text-base font-black shadow-2xl hover:scale-[1.03] transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined">favorite</span>
                            Register as Donor
                        </Link>
                        <Link
                            to="/register-hospital"
                            className="inline-flex items-center justify-center gap-2 border-2 border-white/40 text-white px-10 py-4 rounded-2xl text-base font-black hover:bg-white/10 transition-all"
                        >
                            <span className="material-symbols-outlined">local_hospital</span>
                            Register as Hospital
                        </Link>
                    </motion.div>
                </motion.div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="bg-slate-900 text-slate-400 py-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between gap-10 mb-10">
                        <div className="space-y-3 max-w-xs">
                            <div className="flex items-center gap-2">
                                <div className="bg-[#ee2b2b] p-1.5 rounded-lg text-white">
                                    <span className="material-symbols-outlined text-lg">vital_signs</span>
                                </div>
                                <span className="text-white font-extrabold text-lg">LifeLink <span className="text-[#ee2b2b]">AI</span></span>
                            </div>
                            <p className="text-sm leading-relaxed">AI-powered blood donation network bridging donors and hospitals in life-critical moments.</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
                            <div className="space-y-3">
                                <p className="text-white font-black text-xs uppercase tracking-widest">Platform</p>
                                <Link to="/login" className="block hover:text-[#ee2b2b] transition-colors">Log In</Link>
                                <Link to="/login" className="block hover:text-[#ee2b2b] transition-colors">Create Account</Link>
                                <Link to="/partnership" className="block hover:text-[#ee2b2b] transition-colors">Hospital Partnership</Link>
                            </div>
                            <div className="space-y-3">
                                <p className="text-white font-black text-xs uppercase tracking-widest">Legal</p>
                                <Link to="/privacy" className="block hover:text-[#ee2b2b] transition-colors">Privacy Policy</Link>
                                <Link to="/terms" className="block hover:text-[#ee2b2b] transition-colors">Terms of Service</Link>
                            </div>
                            <div className="space-y-3">
                                <p className="text-white font-black text-xs uppercase tracking-widest">Help</p>
                                <Link to="/support" className="block hover:text-[#ee2b2b] transition-colors">Support</Link>
                                <a href="mailto:emergency@lifelink.ai" className="block hover:text-[#ee2b2b] transition-colors">Emergency Line</a>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-xs">© 2026 LifeLink AI. All rights reserved.</p>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="material-symbols-outlined text-emerald-400 text-sm">verified_user</span>
                            HIPAA Compliant &nbsp;·&nbsp; AES-256 Encrypted &nbsp;·&nbsp; 24/7 Emergency Network
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
