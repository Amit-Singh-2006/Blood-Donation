import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ContactEmail from '../components/ContactEmail';
import { GRIEVANCE_OFFICER_NAME, LEGAL_UPDATED } from '../lib/contact';

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
                    Home
                </Link>
            </header>

            {/* Hero */}
            <div className="bg-gradient-to-br from-[#ee2b2b] to-rose-700 text-white py-20 px-6 text-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <span className="material-symbols-outlined text-6xl mb-4 block opacity-80">shield_lock</span>
                    <h1 className="text-4xl font-black mb-3">Privacy Policy</h1>
                    <p className="text-white/80 max-w-xl mx-auto text-base">How LifeLink AI collects, uses and protects your personal data, and your rights under the Digital Personal Data Protection Act, 2023.</p>
                    <p className="text-white/50 text-sm mt-4">Last updated: {LEGAL_UPDATED}</p>
                </motion.div>
            </div>

            {/* Content */}
            <main className="flex-1 max-w-3xl mx-auto w-full py-16 px-6 space-y-12">
                <Section title="Who We Are">
                    <p>The LifeLink AI team ("LifeLink", "we") decides why and how your personal data is processed on the Service, and is the Data Fiduciary for it under the Digital Personal Data Protection Act, 2023 ("DPDP Act"). This policy also meets our obligations under the Information Technology Act, 2000 and the rules made under it.</p>
                </Section>

                <Section title="Personal Data We Collect">
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Account:</strong> name, email address and password (stored only as a hash)</li>
                        <li><strong>Donor profile:</strong> phone number, blood group, gender, date of birth, city and, if you share it, location; availability, preferred alert channel, last donation date and donation history</li>
                        <li><strong>Hospital accounts:</strong> facility name, city and contact number, and the staff member's account details</li>
                        <li><strong>Blood requests:</strong> blood group, units, urgency, hospital and an internal patient reference. Hospitals must not enter patient names.</li>
                        <li><strong>Your replies:</strong> whether and when you accepted or declined a request</li>
                        <li><strong>AI assistant:</strong> the messages you type into the chat assistant</li>
                        <li><strong>Technical data:</strong> a sign-in session cookie, and IP addresses in server logs used for security and rate limiting</li>
                    </ul>
                </Section>

                <Section title="Why We Use It">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>To find compatible, eligible donors near a hospital and alert them by SMS, WhatsApp or in the app</li>
                        <li>To coordinate a donation once you accept, and to track the request for the hospital and the patient's family</li>
                        <li>To apply donor safety rules, such as the rest period between donations (90 days for men, 120 days for women)</li>
                        <li>To keep the Service secure and prevent misuse, such as fake requests</li>
                        <li>To produce statistics that do not identify anyone</li>
                    </ul>
                    <p>We never sell your personal data, and we do not use it for advertising.</p>
                </Section>

                <Section title="Consent">
                    <p>We process your personal data on the basis of the consent you give when you register. You can withdraw consent at any time, as easily as you gave it, by contacting <ContactEmail />. Withdrawing consent does not affect processing that already took place, but it means we can no longer alert you for requests.</p>
                    <p>The DPDP Act also allows certain processing without consent, for example to respond to a medical emergency involving a threat to someone's life or health, or to comply with the law. We rely on this only where it applies.</p>
                </Section>

                <Section title="Who Can See Your Data">
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Hospitals:</strong> when you are alerted for a request, the hospital sees your blood group and distance. If you accept, it also sees your first name and phone number so it can coordinate your donation.</li>
                        <li><strong>Patients' families:</strong> they see request progress only (counts, blood groups and distances), never donor names or phone numbers.</li>
                        <li><strong>Service providers</strong> who process data for us under contract (Data Processors): website hosting (Vercel), database (Supabase, hosted in India), workflow automation (n8n), SMS (Twilio), WhatsApp messaging (Meta), sign-in (Google Firebase) and the AI assistant (Groq). Please do not share health details in the AI chat.</li>
                        <li><strong>Authorities:</strong> when disclosure is required by Indian law, for example under a lawful order.</li>
                    </ul>
                </Section>

                <Section title="Where Your Data Is Stored">
                    <p>Our main database is hosted in India. Some of our service providers process data outside India. Any such transfer complies with Section 16 of the DPDP Act, which allows transfers except to countries restricted by the Central Government.</p>
                </Section>

                <Section title="How Long We Keep It">
                    <p>We keep your personal data while your account is active. When you withdraw consent or delete your account, or once the data is no longer needed for the purpose it was collected for, we erase it unless we must keep it to comply with the law. Statistics that do not identify anyone may be kept.</p>
                    <p>Blood centres keep their own donation records, as the Drugs and Cosmetics Rules, 1945 require. Those records are outside LifeLink.</p>
                </Section>

                <Section title="How We Protect It">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>All traffic to LifeLink is encrypted in transit (HTTPS)</li>
                        <li>Passwords are stored only as salted bcrypt hashes, never in plain text</li>
                        <li>Sessions use secure, HttpOnly cookies that scripts on the page cannot read</li>
                        <li>The database is closed to direct public access; only the LifeLink server can read it</li>
                        <li>Role-based access control: donors, hospitals and admins only see what their role needs</li>
                    </ul>
                    <p>If a personal data breach occurs, we will inform the Data Protection Board of India and the affected users, as the DPDP Act requires.</p>
                </Section>

                <Section title="Your Rights">
                    <p>Under the DPDP Act you have the right to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Access:</strong> a summary of your personal data, how we process it, and who we have shared it with</li>
                        <li><strong>Correction and erasure:</strong> have inaccurate or incomplete data corrected or updated, and data we no longer need erased</li>
                        <li><strong>Withdraw consent</strong> at any time</li>
                        <li><strong>Grievance redressal:</strong> have your complaint handled by our Grievance Officer</li>
                        <li><strong>Nominate</strong> another person to exercise your rights if you die or become unable to do so</li>
                    </ul>
                    <p>To use these rights, contact <ContactEmail />. If you are not satisfied with our response, you can complain to the Data Protection Board of India.</p>
                    <p>The DPDP Act also asks you to give accurate information, not to impersonate anyone, and not to file false complaints.</p>
                </Section>

                <Section title="Children">
                    <p>LifeLink is only for people aged 18 or over, and blood donors must be at least 18. We do not knowingly collect personal data of children. If we learn that we have, we will delete it.</p>
                </Section>

                <Section title="Cookies and Local Storage">
                    <p>We use a single essential cookie to keep you signed in. Your browser's local storage keeps a copy of your basic profile and preferences. We do not use advertising or cross-site tracking cookies.</p>
                </Section>

                <Section title="Grievance Officer">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Name: {GRIEVANCE_OFFICER_NAME || 'to be appointed'}</li>
                        <li>Contact: <ContactEmail /></li>
                    </ul>
                    <p>We acknowledge complaints within 24 hours and aim to resolve them within 15 days of receipt.</p>
                </Section>

                <Section title="Changes to This Policy">
                    <p>We will update this policy when our processing or the law changes, and tell registered users about material changes. See also our <Link to="/terms" className="text-[#ee2b2b] font-bold hover:underline">Terms of Service</Link>.</p>
                </Section>
            </main>

            <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 font-medium">
                © 2026 LifeLink AI. All rights reserved. &nbsp;·&nbsp;
                <Link to="/support" className="hover:text-[#ee2b2b] font-bold">Support</Link>
            </footer>
        </div>
    );
}
