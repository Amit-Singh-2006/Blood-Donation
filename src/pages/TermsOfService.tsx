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

export default function TermsOfService() {
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
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white py-20 px-6 text-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <span className="material-symbols-outlined text-6xl mb-4 block opacity-70">gavel</span>
                    <h1 className="text-4xl font-black mb-3">Terms of Service</h1>
                    <p className="text-slate-400 max-w-xl mx-auto text-base">By using LifeLink AI, you agree to these terms. Please read them carefully — they govern your use of our life-saving platform.</p>
                    <p className="text-slate-500 text-sm mt-4">Effective Date: February 23, 2026</p>
                </motion.div>
            </div>

            {/* Content */}
            <main className="flex-1 max-w-3xl mx-auto w-full py-16 px-6 space-y-12">
                <Section title="Acceptance of Terms">
                    <p>By accessing or using the LifeLink AI platform (the "Service"), you confirm that you are at least 18 years of age and have read, understood, and agree to be bound by these Terms of Service and our Privacy Policy.</p>
                    <p>If you are using the Service on behalf of a medical institution, you represent that you have authority to bind that institution to these terms.</p>
                </Section>

                <Section title="Use of the Platform">
                    <p>LifeLink AI is a blood donation coordination platform. You agree to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Provide accurate, truthful information about your health and eligibility</li>
                        <li>Not impersonate any person, institution, or medical professional</li>
                        <li>Not use the platform for any unlawful or harmful purpose</li>
                        <li>Not attempt to access other users' accounts or data</li>
                        <li>Not interfere with or disrupt the integrity or performance of the Service</li>
                    </ul>
                </Section>

                <Section title="Donor Responsibilities">
                    <p>As a registered blood donor, you acknowledge that:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>You meet the minimum health and eligibility requirements for blood donation in your jurisdiction</li>
                        <li>You will provide honest health declarations before each donation event</li>
                        <li>You understand blood donation carries minimal but real health risks</li>
                        <li>Availability status must be kept accurate — false availability may delay critical patient care</li>
                        <li>LifeLink AI matches donors with hospitals, but the donation process is governed by the hospital's medical staff</li>
                    </ul>
                </Section>

                <Section title="Hospital Partner Obligations">
                    <p>Hospitals registered on LifeLink AI agree to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Use donor information solely for blood transfusion and emergency medical purposes</li>
                        <li>Maintain strict confidentiality of all donor-identifiable data</li>
                        <li>Comply with all applicable health care regulations and donor rights</li>
                        <li>Report donation outcomes to improve AI matching accuracy</li>
                    </ul>
                </Section>

                <Section title="Intellectual Property">
                    <p>All content, algorithms, designs, and features of LifeLink AI are the exclusive property of LifeLink AI, Inc. and are protected by copyright and intellectual property laws.</p>
                    <p>You may not reproduce, modify, distribute, or commercialize any part of the Service without written consent.</p>
                </Section>

                <Section title="Limitation of Liability">
                    <p>LifeLink AI is a coordination and matching platform — we do not provide medical advice or guarantee the availability of blood at any time. To the maximum extent permitted by law:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>We are not liable for any health outcomes resulting from donations arranged through the platform</li>
                        <li>We are not responsible for delays caused by technical outages, natural disasters, or third-party failures</li>
                        <li>Our total liability for any claim shall not exceed the amount you paid us in the past 12 months</li>
                    </ul>
                </Section>

                <Section title="Termination">
                    <p>We reserve the right to suspend or terminate your access to LifeLink AI at any time, without notice, for:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Violation of these Terms</li>
                        <li>Providing false medical or personal information</li>
                        <li>Behavior that endangers other users or patients</li>
                    </ul>
                    <p>You may delete your account at any time by contacting <a href="mailto:support@lifelink.ai" className="text-[#ee2b2b] font-bold hover:underline">support@lifelink.ai</a>.</p>
                </Section>

                <Section title="Changes to Terms">
                    <p>We may update these Terms periodically. We will notify registered users via email of any material changes. Continued use of the platform after changes constitutes acceptance of the new Terms.</p>
                </Section>

                <Section title="Contact & Disputes">
                    <p>For questions or legal concerns regarding these Terms:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>📧 <a href="mailto:legal@lifelink.ai" className="text-[#ee2b2b] font-bold hover:underline">legal@lifelink.ai</a></li>
                        <li>📞 +1 (800) 555-0199</li>
                        <li>Disputes shall be governed by the laws of the State of California, USA</li>
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
