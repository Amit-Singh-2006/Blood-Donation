import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ContactEmail from '../components/ContactEmail';
import { EMERGENCY, GRIEVANCE_OFFICER_NAME, LEGAL_UPDATED } from '../lib/contact';

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
                    Home
                </Link>
            </header>

            {/* Hero */}
            <div className="bg-gradient-to-br from-red-50 via-rose-50 to-white text-slate-900 py-20 px-6 text-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <span className="material-symbols-outlined text-6xl mb-4 block text-[#ee2b2b]">gavel</span>
                    <h1 className="text-4xl font-black mb-3">Terms of Service</h1>
                    <p className="text-slate-600 max-w-xl mx-auto text-base">These terms govern your use of LifeLink AI in India. Please read them carefully.</p>
                    <p className="text-slate-500 text-sm mt-4">Last updated: {LEGAL_UPDATED}</p>
                </motion.div>
            </div>

            {/* Content */}
            <main className="flex-1 max-w-3xl mx-auto w-full py-16 px-6 space-y-12">
                <Section title="About These Terms">
                    <p>These Terms of Service ("Terms") are an agreement between you and the LifeLink AI team ("LifeLink", "we", "us") for your use of the LifeLink AI website, apps and messages (the "Service").</p>
                    <p>These Terms are an electronic record under the Information Technology Act, 2000 and the rules made under it, and are published in accordance with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021. They do not need a physical or digital signature.</p>
                    <p>By creating an account or using the Service you agree to these Terms and to our <Link to="/privacy" className="text-[#ee2b2b] font-bold hover:underline">Privacy Policy</Link>.</p>
                </Section>

                <Section title="Who Can Use LifeLink">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>You must be at least 18 years old and able to enter into a binding contract under the Indian Contract Act, 1872.</li>
                        <li><strong>Donors</strong> must meet the donor selection criteria of the National Blood Transfusion Council (NBTC), including being 18 to 65 years old and weighing at least 45 kg. The blood centre's medical officer makes the final decision on whether you can donate.</li>
                        <li><strong>Hospitals</strong> must be registered healthcare establishments or blood centres, and the account must be operated by staff authorised to raise blood requests on their behalf.</li>
                    </ul>
                </Section>

                <Section title="What LifeLink Is, and Is Not">
                    <p>LifeLink is a technology platform that connects voluntary blood donors with hospitals that need blood for a patient. It alerts compatible donors, records their replies and shows the hospital and the patient's family how the request is progressing.</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>LifeLink is <strong>not a blood centre</strong>. We do not collect, test, process, store, sell or supply blood. Collection, testing and transfusion are carried out only by blood centres licensed under the Drugs and Cosmetics Act, 1940 and the Drugs and Cosmetics Rules, 1945, following NBTC guidelines.</li>
                        <li>LifeLink does <strong>not give medical advice</strong>. Clinical decisions are made by the treating hospital and the blood centre.</li>
                        <li>LifeLink is <strong>not an emergency service</strong>. In a medical emergency call {EMERGENCY.allEmergencies}, or {EMERGENCY.ambulance} for an ambulance.</li>
                        <li>We cannot guarantee that a donor will respond, arrive in time or be found eligible, or that blood will be available.</li>
                    </ul>
                </Section>

                <Section title="Voluntary, Unpaid Donation">
                    <p>India's National Blood Policy requires blood donation to be voluntary and non-remunerated, and paid or professional donation is prohibited. On LifeLink:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>No one may offer, ask for or accept money, goods or any other consideration in exchange for donating blood.</li>
                        <li>XP points, badges, ranks and certificates are a way of saying thank you. They have no monetary value, cannot be exchanged for cash, and are not payment for donating.</li>
                        <li>Please report anyone who asks for or offers payment for blood through LifeLink using <ContactEmail />.</li>
                    </ul>
                </Section>

                <Section title="Donor Responsibilities">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Give accurate, complete information about yourself, your blood group and your last donation, and keep it up to date.</li>
                        <li>Keep your availability current. Accept a request only if you intend to go, and use the NO link if your plans change so the next donor can be alerted.</li>
                        <li>Answer the blood centre's health questions honestly and follow its instructions. Donation carries small but real risks, which the blood centre will explain.</li>
                        <li>You may decline any request at any time, without giving a reason.</li>
                    </ul>
                </Section>

                <Section title="Hospital Responsibilities">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Raise requests only for a genuine clinical need of a real patient, through authorised staff.</li>
                        <li>Do not enter patient names or other identifying details. Use your internal reference (for example, a ward or bed number).</li>
                        <li>Use a donor's name and phone number only to coordinate that donation. Do not share, sell or reuse donor details, or contact donors for any other purpose.</li>
                        <li>Do not charge donors, or ask them for payment, for donating.</li>
                        <li>Comply with the Drugs and Cosmetics Act, 1940, NBTC guidelines and the Digital Personal Data Protection Act, 2023 for the personal data you receive through LifeLink.</li>
                        <li>Record donations, no-shows and cancellations promptly, so donors are not left waiting or alerted without need. Keep your hospital access links private.</li>
                    </ul>
                </Section>

                <Section title="Patients' Families">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>A tracking code is private to the request. Share it only with people who need to follow the request.</li>
                        <li>The tracker shows progress, never donor identities. Please do not try to find, contact or approach donors; the hospital coordinates with them.</li>
                    </ul>
                </Section>

                <Section title="Prohibited Conduct">
                    <p>You must not:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Raise fake, exaggerated or duplicate blood requests, or impersonate a person, hospital or medical professional</li>
                        <li>Seek or offer payment for blood, or harass, threaten or pressure donors</li>
                        <li>Access other users' accounts or data, scrape the Service, or interfere with its security or operation</li>
                        <li>Use the Service for anything unlawful, including anything prohibited by the Information Technology Act, 2000</li>
                    </ul>
                    <p>We may report conduct that endangers patients or donors to the relevant authorities.</p>
                </Section>

                <Section title="Suspension and Account Deletion">
                    <p>We may suspend or close an account that breaks these Terms, gives false medical or personal information, or puts patients or donors at risk. Where it is safe and lawful, we will tell you why.</p>
                    <p>You may delete your account at any time by contacting <ContactEmail />. We then handle your data as described in our <Link to="/privacy" className="text-[#ee2b2b] font-bold hover:underline">Privacy Policy</Link>.</p>
                </Section>

                <Section title="Intellectual Property">
                    <p>The LifeLink name, design and software belong to the LifeLink AI team, except for open-source components, which remain under their own licences. You may not copy, modify or commercially exploit the Service without our written permission.</p>
                </Section>

                <Section title="Disclaimer and Limitation of Liability">
                    <p>The Service is provided free of charge and "as is". To the extent permitted by applicable Indian law, including the Consumer Protection Act, 2019:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>We are not responsible for clinical decisions, or for the collection, testing or transfusion of blood, which are the responsibility of hospitals and blood centres</li>
                        <li>We are not liable if a donor does not respond, arrive or qualify, or for delays caused by network outages or third-party services such as SMS and WhatsApp providers</li>
                        <li>Nothing in these Terms limits any liability that cannot be limited under Indian law</li>
                    </ul>
                </Section>

                <Section title="Governing Law and Disputes">
                    <p>These Terms are governed by the laws of India. Please first raise any concern with our Grievance Officer so we can try to resolve it. Any dispute that cannot be resolved this way is subject to the jurisdiction of the competent courts in India.</p>
                </Section>

                <Section title="Grievance Officer">
                    <p>In accordance with the Information Technology Act, 2000 and the rules made under it, you can contact our Grievance Officer about these Terms, content on the Service or your personal data:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Name: {GRIEVANCE_OFFICER_NAME || 'to be appointed'}</li>
                        <li>Contact: <ContactEmail /></li>
                    </ul>
                    <p>We acknowledge complaints within 24 hours and aim to resolve them within 15 days of receipt.</p>
                </Section>

                <Section title="Changes to These Terms">
                    <p>We may update these Terms as the Service or the law changes. We will tell registered users about material changes before they take effect. Continuing to use the Service after that means you accept the updated Terms.</p>
                </Section>
            </main>

            <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 font-medium">
                © 2026 LifeLink AI. All rights reserved. &nbsp;·&nbsp;
                <Link to="/support" className="hover:text-[#ee2b2b] font-bold">Support</Link>
            </footer>
        </div>
    );
}
