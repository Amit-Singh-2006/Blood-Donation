import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Mail, MapPin, Building, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HospitalRegistration() {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate API call
        setTimeout(() => {
            setIsSubmitting(false);
            setIsSuccess(true);

            // Redirect to hospital dashboard after success
            setTimeout(() => {
                navigate('/hospital');
            }, 2000);
        }, 1500);
    };

    if (isSuccess) {
        return (
            <div className="min-h-[600px] flex items-center justify-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center p-8 bg-white rounded-2xl shadow-xl border border-green-100 max-w-md"
                >
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Registration Successful!</h2>
                    <p className="text-slate-600 mb-6">Welcome to the LifeLink AI network. Your hospital account is ready.</p>
                    <p className="text-sm text-slate-400">Redirecting to dashboard...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-10">
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-slate-900">Hospital Registration</h1>
                <p className="text-slate-600 mt-2">Join our AI-enhanced network and streamline blood donation matching.</p>
            </div>

            <motion.form
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                onSubmit={handleSubmit}
                className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6"
            >
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <Building className="w-4 h-4" /> Hospital Name
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="City General Hospital"
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <FileText className="w-4 h-4" /> License Number
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="LIC-12345678"
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <User className="w-4 h-4" /> Contact Person
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="Dr. Smith"
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <Phone className="w-4 h-4" /> Emergency Phone
                        </label>
                        <input
                            required
                            type="tel"
                            placeholder="+1 (800) 123-4567"
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <Mail className="w-4 h-4" /> Official Email
                        </label>
                        <input
                            required
                            type="email"
                            placeholder="admin@hospital.com"
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Full Address
                    </label>
                    <textarea
                        required
                        rows={3}
                        placeholder="Enter full hospital address..."
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all resize-none"
                    />
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" required className="mt-1 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500" />
                        <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                            I agree to the terms of service and verify that this institution is legally authorized to collect and process blood donations.
                        </span>
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-lg hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Registering...
                        </>
                    ) : (
                        <>
                            Register Hospital <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </motion.form>
        </div>
    );
}
