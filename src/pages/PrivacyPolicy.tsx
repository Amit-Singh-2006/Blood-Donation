import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="space-y-3"
    >
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-[#ee2b2b] inline-block"></span>
            {title}
        </h2>
        <div className="text-slate-600 leading-relaxed space-y-3 pl-4">{children}</div>
    </motion.div>
);

export default function PrivacyPolicy() {
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
            <div className="bg-gradient-to-br from-[#ee2b2b] to-rose-700 text-white py-20 px-6 text-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <span className="material-symbols-outlined text-6xl mb-4 block opacity-80">shield_lock</span>
                    <h1 className="text-4xl font-black mb-3">Privacy Policy</h1>
                    <p className="text-white/80 max-w-xl mx-auto text-base">Your privacy is at the core of everything we do. This policy explains how LifeLink AI collects, uses, and protects your data.</p>
                    <p className="text-white/50 text-sm mt-4">Last updated: February 23, 2026</p>
                </motion.div>
            </div>

            {/* Content */}
            <main className="flex-1 max-w-3xl mx-auto w-full py-16 px-6 space-y-12">
                <Section title="Information We Collect">
                    <p>We collect information necessary to connect blood donors with hospitals in life-saving emergencies. This includes:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Personal identifiers:</strong> Full name, email address, phone number</li>
                        <li><strong>Medical data:</strong> Blood type, donation history, eligibility status</li>
                        <li><strong>Location data:</strong> City/region for proximity-based matching (never shared without consent)</li>
                        <li><strong>Usage data:</strong> App interactions, login timestamps, feature usage patterns</li>
                    </ul>
                </Section>

                <Section title="How We Use Your Information">
                    <p>Your data is used exclusively to operate and improve the LifeLink AI network:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Matching eligible donors with urgent hospital blood requests via AI</li>
                        <li>Sending emergency alerts and campaign notifications</li>
                        <li>Verifying donor eligibility and maintaining safe donation intervals</li>
                        <li>Generating anonymized analytics for public health research</li>
                    </ul>
                    <p>We never sell your personal data to third parties. Period.</p>
                </Section>

                <Section title="Data Security">
                    <p>We employ industry-leading security measures to protect your information:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>End-to-end AES-256 encryption for all sensitive data in transit and at rest</li>
                        <li>HIPAA-compliant medical data handling protocols</li>
                        <li>Regular third-party security audits and penetration testing</li>
                        <li>Role-based access control — only authorized personnel can view your records</li>
                        <li>Two-factor authentication available for all accounts</li>
                    </ul>
                </Section>

                <Section title="Data Sharing">
                    <p>Your data is shared only in limited circumstances:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Hospitals:</strong> Only your blood type and availability status are shared during active emergencies</li>
                        <li><strong>Legal Requirements:</strong> We may disclose data when required by law or to protect public safety</li>
                        <li><strong>Service Providers:</strong> Trusted partners who help operate our platform (subject to strict data agreements)</li>
                    </ul>
                </Section>

                <Section title="Your Rights">
                    <p>You have full control over your data:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Access:</strong> Request a full copy of your stored data at any time</li>
                        <li><strong>Correction:</strong> Update or correct any inaccurate information</li>
                        <li><strong>Deletion:</strong> Request account and data deletion (subject to legal retention requirements)</li>
                        <li><strong>Opt-out:</strong> Unsubscribe from non-critical communications at any time</li>
                    </ul>
                    <p>To exercise these rights, contact: <a href="mailto:privacy@lifelink.ai" className="text-[#ee2b2b] font-bold hover:underline">privacy@lifelink.ai</a></p>
                </Section>

                <Section title="Cookies & Tracking">
                    <p>We use minimal, essential cookies to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Maintain your authenticated session securely</li>
                        <li>Remember your preferences (e.g., availability toggle)</li>
                        <li>Measure core platform performance (no third-party ad tracking)</li>
                    </ul>
                </Section>

                <Section title="Contact Us">
                    <p>For any privacy-related questions or concerns:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>📧 <a href="mailto:privacy@lifelink.ai" className="text-[#ee2b2b] font-bold hover:underline">privacy@lifelink.ai</a></li>
                        <li>📞 +1 (800) 555-0199 (Privacy Hotline — 24/7)</li>
                        <li>📍 LifeLink AI Privacy Team, 123 Lifesaver Blvd, San Francisco, CA 94105</li>
                    </ul>
                </Section>
            </main>

            <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 font-medium">
                © 2026 LifeLink AI. All rights reserved. &nbsp;·&nbsp;
                <Link to="/support" className="hover:text-[#ee2b2b] font-bold">Support</Link>
            </footer>
        </div>
    );
}
