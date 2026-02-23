import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';

type Step = 'basic' | 'location' | 'contact' | 'infrastructure' | 'verification';

export default function HospitalRegistration() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState<Step>('basic');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        hospitalName: '',
        registrationId: '',
        hospitalType: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        email: '',
        password: '', // Added from main
        phone: '',
        emergencyHotline: '',
        website: '',
        bedCapacity: '',
        icuBeds: '',
        hasBloodBank: 'no',
        bloodGroups: [] as string[],
        specializations: [] as string[],
    });

    const steps: { key: Step; label: string; icon: string }[] = [
        { key: 'basic', label: 'Basic Info', icon: 'hospital' },
        { key: 'location', label: 'Location', icon: 'location_on' },
        { key: 'contact', label: 'Contact', icon: 'call' },
        { key: 'infrastructure', label: 'Infrastructure', icon: 'meeting_room' },
        { key: 'verification', label: 'Verification', icon: 'verified_user' },
    ];

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            const response = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    name: formData.hospitalName,
                    email: formData.email,
                    password: formData.password || 'password123', // Use a default if not set, or ensure it's collected
                    role: 'hospital',
                    hospital_name: formData.hospitalName,
                    city: formData.city,
                    contact_number: formData.phone
                }),
            });
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            navigate('/hospital');
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNext = () => {
        const currentIndex = steps.findIndex(s => s.key === currentStep);
        if (currentIndex < steps.length - 1) {
            setCurrentStep(steps[currentIndex + 1].key);
        }
    };

    const handleBack = () => {
        const currentIndex = steps.findIndex(s => s.key === currentStep);
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1].key);
        }
    };

    const updateFormData = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleSelection = (field: 'bloodGroups' | 'specializations', value: string) => {
        setFormData(prev => {
            const current = prev[field];
            const updated = current.includes(value)
                ? current.filter(i => i !== value)
                : [...current, value];
            return { ...prev, [field]: updated };
        });
    };

    return (
        <div className="min-h-screen bg-[#f8f6f6] flex flex-col pt-20 pb-12 px-6 lg:px-20 relative overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#ee2b2b]/5 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] -z-10 -translate-x-1/2 translate-y-1/2"></div>

            <div className="max-w-4xl mx-auto w-full space-y-8 relative">
                {/* Header */}
                <div className="text-center space-y-2">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm mb-4"
                    >
                        <span className="material-symbols-outlined text-[#ee2b2b] text-xl">add_business</span>
                        <span className="text-sm font-bold text-slate-600">Hospital Onboarding</span>
                    </motion.div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                        Join the <span className="text-[#ee2b2b]">LifeLink AI</span> Network
                    </h1>
                    <p className="text-slate-500 max-w-2xl mx-auto font-medium text-lg">
                        Connect your facility with thousands of donors and save lives more efficiently with our AI-driven emergency response system.
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="bg-white/50 backdrop-blur-md rounded-2xl border border-white p-6 shadow-sm overflow-x-auto">
                    <div className="flex justify-between items-center min-w-[600px]">
                        {steps.map((step, idx) => {
                            const isActive = currentStep === step.key;
                            const isPast = steps.findIndex(s => s.key === currentStep) > idx;

                            return (
                                <div key={step.key} className="flex flex-col items-center gap-3 relative flex-1">
                                    {idx !== 0 && (
                                        <div className={`absolute right-1/2 top-4 w-full h-0.5 -translate-y-1/2 -z-10 ${isPast ? 'bg-[#ee2b2b]' : 'bg-slate-200'}`}></div>
                                    )}
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-[#ee2b2b] text-white shadow-lg shadow-[#ee2b2b]/30 scale-110' :
                                        isPast ? 'bg-[#ee2b2b] text-white' : 'bg-slate-200 text-slate-500'
                                        }`}>
                                        {isPast ? (
                                            <span className="material-symbols-outlined text-sm">check</span>
                                        ) : (
                                            <span className="material-symbols-outlined text-sm">{step.icon}</span>
                                        )}
                                    </div>
                                    <span className={`text-xs font-black uppercase tracking-widest ${isActive ? 'text-[#ee2b2b]' : isPast ? 'text-slate-900' : 'text-slate-400'}`}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Form Container */}
                <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)]">
                    <AnimatePresence mode="wait">
                        {currentStep === 'basic' && (
                            <motion.div
                                key="basic"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-slate-900">Facility Basics</h3>
                                    <p className="text-slate-500 font-medium">Start with the fundamental details of your hospital.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Hospital Name</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">domain</span>
                                            <input
                                                type="text"
                                                value={formData.hospitalName}
                                                onChange={(e) => updateFormData('hospitalName', e.target.value)}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400"
                                                placeholder="City General Hospital"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Registration ID / License No.</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">registered</span>
                                            <input
                                                type="text"
                                                value={formData.registrationId}
                                                onChange={(e) => updateFormData('registrationId', e.target.value)}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400"
                                                placeholder="HOSP-2024-XXXX"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-slate-700 ml-1">Establishment Type</label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {['Government', 'Private', 'NGO', 'Public-Private'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => updateFormData('hospitalType', type)}
                                                className={`py-3 px-4 rounded-xl text-sm font-bold border-2 transition-all ${formData.hospitalType === type
                                                    ? 'border-[#ee2b2b] bg-[#ee2b2b]/5 text-[#ee2b2b]'
                                                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 'location' && (
                            <motion.div
                                key="location"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-slate-900">Location Details</h3>
                                    <p className="text-slate-500 font-medium">Where is your hospital located?</p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-slate-700 ml-1">Full Address</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">map</span>
                                        <input
                                            type="text"
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400"
                                            placeholder="Street, Landmark, Area"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700 ml-1">City</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700 ml-1">State</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700 ml-1">ZIP Code</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>

                                <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-4">
                                    <span className="material-symbols-outlined text-blue-500">info</span>
                                    <p className="text-sm font-bold text-blue-900/70 leading-relaxed">
                                        Accurate location data helps LifeLink AI calculate real-time emergency travel duration for ambulances and donors.
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 'contact' && (
                            <motion.div
                                key="contact"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-slate-900">Communication</h3>
                                    <p className="text-slate-500 font-medium">How should donors and the network reach you?</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Official Email</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">mail</span>
                                            <input
                                                type="email"
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900"
                                                placeholder="contact@hospital.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Emergency Hotline (24/7)</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-red-500 font-black">emergency</span>
                                            <input
                                                type="tel"
                                                className="w-full pl-12 pr-4 py-3.5 bg-red-50/50 border-red-100 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-slate-900 placeholder:text-red-300 font-bold"
                                                placeholder="+1-800-EMERGENCY"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Phone Number</label>
                                        <input
                                            type="tel"
                                            className="w-full px-4 py-3.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Website (Optional)</label>
                                        <input
                                            type="url"
                                            className="w-full px-4 py-3.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900"
                                            placeholder="https://www.hospital.com"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 'infrastructure' && (
                            <motion.div
                                key="infrastructure"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-slate-900">Medical Infrastructure</h3>
                                    <p className="text-slate-500 font-medium">Verify your capacity for handling donors and patients.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-500 text-lg">bed</span>
                                            Beds & Capacity
                                        </h4>
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-black text-slate-500">Total Bed Capacity</label>
                                                <input className="w-full px-4 py-3 bg-white border-slate-200 rounded-xl text-sm font-bold" type="number" placeholder="0" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-black text-slate-500">Available ICU Beds</label>
                                                <input className="w-full px-4 py-3 bg-white border-slate-200 rounded-xl text-sm font-bold" type="number" placeholder="0" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-[#ee2b2b]/5 rounded-2xl border border-[#ee2b2b]/10 space-y-4">
                                        <h4 className="text-sm font-black text-[#ee2b2b] uppercase tracking-widest flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[#ee2b2b] text-lg">bloodtype</span>
                                            Blood Bank Services
                                        </h4>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-slate-700">Official Blood Bank Support?</label>
                                            <div className="flex gap-4">
                                                {['Yes', 'No'].map(v => (
                                                    <button
                                                        key={v}
                                                        onClick={() => updateFormData('hasBloodBank', v.toLowerCase())}
                                                        className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${formData.hasBloodBank === v.toLowerCase()
                                                            ? 'border-[#ee2b2b] bg-[#ee2b2b] text-white shadow-lg shadow-[#ee2b2b]/20'
                                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                                            }`}
                                                    >
                                                        {v}
                                                    </button>
                                                ))}
                                            </div>
                                            {formData.hasBloodBank === 'yes' && (
                                                <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <label className="text-xs font-black text-[#ee2b2b] mb-2 block uppercase">Available Types</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                                                            <button
                                                                key={type}
                                                                onClick={() => toggleSelection('bloodGroups', type)}
                                                                className={`w-10 h-10 rounded-lg text-[10px] font-black border transition-all ${formData.bloodGroups.includes(type)
                                                                    ? 'bg-[#ee2b2b] text-white border-[#ee2b2b]'
                                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-[#ee2b2b]'
                                                                    }`}
                                                            >
                                                                {type}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700 ml-1">Specialized Departments</label>
                                    <div className="flex flex-wrap gap-3">
                                        {['Emergency', 'Cardiology', 'Neurology', 'Oncology', 'Pediatrics', 'Trauma', 'Radiology', 'Surgery'].map(dept => (
                                            <button
                                                key={dept}
                                                onClick={() => toggleSelection('specializations', dept)}
                                                className={`px-4 py-2 rounded-full text-xs font-black border transition-all ${formData.specializations.includes(dept)
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-900/10'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-900/50'
                                                    }`}
                                            >
                                                {dept}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 'verification' && (
                            <motion.div
                                key="verification"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-slate-900">Final Verification</h3>
                                    <p className="text-slate-500 font-medium">Upload necessary accreditation documents to go live.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center justify-center text-center group hover:border-[#ee2b2b] hover:bg-[#ee2b2b]/5 transition-all cursor-pointer">
                                            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#ee2b2b] group-hover:scale-110 transition-all shadow-sm mb-4">
                                                <span className="material-symbols-outlined text-3xl">upload_file</span>
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900">Hospital License</h4>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">PDF, JPG up to 10MB</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center justify-center text-center group hover:border-[#ee2b2b] hover:bg-[#ee2b2b]/5 transition-all cursor-pointer">
                                            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#ee2b2b] group-hover:scale-110 transition-all shadow-sm mb-4">
                                                <span className="material-symbols-outlined text-3xl">verified</span>
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900">Accreditation (NABH/JCI)</h4>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Certification Document</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-900 rounded-3xl flex items-center justify-between text-white shadow-2xl shadow-slate-900/20">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-green-400">shield_check</span>
                                        </div>
                                        <div>
                                            <h4 className="font-black text-sm">Compliance Statement</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">I certify that all provided information is accurate</p>
                                        </div>
                                    </div>
                                    <input type="checkbox" className="w-6 h-6 rounded-lg bg-white/10 border-none accent-[#ee2b2b]" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Actions */}
                    <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between">
                        <button
                            onClick={handleBack}
                            disabled={currentStep === 'basic'}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all disabled:opacity-30"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                            Back
                        </button>
                        <button
                            onClick={currentStep === 'verification' ? handleSubmit : handleNext}
                            disabled={isSubmitting}
                            className="bg-[#ee2b2b] text-white px-10 py-4 rounded-xl font-black shadow-xl shadow-[#ee2b2b]/20 hover:bg-[#ee2b2b]/90 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Processing...' : currentStep === 'verification' ? 'Complete Onboarding' : 'Continue'}
                            <span className="material-symbols-outlined">
                                {currentStep === 'verification' ? 'done_all' : 'arrow_forward'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Footer Link */}
                <p className="text-center text-sm font-semibold text-slate-500">
                    Already have an account?
                    <button onClick={() => navigate('/')} className="text-[#ee2b2b] hover:underline ml-1">Sign in</button>
                </p>
                {error && <p className="text-center text-red-500 font-bold mt-4">{error}</p>}
            </div>
        </div>
    );
}
