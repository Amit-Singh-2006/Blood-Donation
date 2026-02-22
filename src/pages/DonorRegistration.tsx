import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Step = 'personal' | 'medical' | 'contact' | 'location';

export default function DonorRegistration() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('personal');
  const [formData, setFormData] = useState({
    fullName: '',
    dob: '',
    gender: '',
    bloodGroup: '',
    weight: '',
    lastDonation: '',
    medicalConditions: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    consent: false
  });

  const steps: { key: Step; label: string; icon: string }[] = [
    { key: 'personal', label: 'Personal', icon: 'person' },
    { key: 'medical', label: 'Medical', icon: 'medical_services' },
    { key: 'contact', label: 'Contact', icon: 'call' },
    { key: 'location', label: 'Location', icon: 'location_on' },
  ];

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

  const handleSubmit = () => {
    // Simulate successful registration
    navigate('/donor');
  };

  return (
    <div className="min-h-screen bg-[#f8f6f6] flex flex-col pt-20 pb-12 px-6 lg:px-20 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#ee2b2b]/5 rounded-full blur-[100px] -z-10 -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] -z-10 translate-x-1/2 translate-y-1/2"></div>

      <div className="max-w-3xl mx-auto w-full space-y-8 relative">
        <div className="text-center space-y-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm mb-4"
          >
            <span className="material-symbols-outlined text-[#ee2b2b] text-xl">volunteer_activism</span>
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Become a LifeLink Hero</span>
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">
            Register as a <span className="text-[#ee2b2b]">Lifesaver</span>
          </h1>
          <p className="text-slate-500 max-w-lg mx-auto font-medium text-lg mt-4">
            Join the world's most advanced AI-powered blood donation network.
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white p-6 shadow-sm">
          <div className="flex justify-between items-center px-4 md:px-10">
            {steps.map((step, idx) => {
              const isActive = currentStep === step.key;
              const isPast = steps.findIndex(s => s.key === currentStep) > idx;

              return (
                <div key={step.key} className="flex flex-col items-center gap-2 relative flex-1">
                  {idx !== 0 && (
                    <div className={cn(
                      "absolute right-1/2 top-4 w-full h-0.5 -translate-y-1/2 -z-10 transition-colors duration-500",
                      isPast ? "bg-[#ee2b2b]" : "bg-slate-100"
                    )}></div>
                  )}
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300",
                    isActive ? "bg-[#ee2b2b] text-white shadow-xl shadow-[#ee2b2b]/30 scale-110" :
                      isPast ? "bg-[#ee2b2b] text-white" : "bg-slate-100 text-slate-400"
                  )}>
                    <span className="material-symbols-outlined text-sm">
                      {isPast ? 'check' : step.icon}
                    </span>
                  </div>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-tighter",
                    isActive ? "text-[#ee2b2b]" : isPast ? "text-slate-900" : "text-slate-400"
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Body */}
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 md:p-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.05)]">
          <AnimatePresence mode="wait">
            {currentStep === 'personal' && (
              <motion.div
                key="personal"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Personal Details</h3>
                  <p className="text-slate-500 font-medium">Tell us more about yourself.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => updateFormData('fullName', e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#ee2b2b]/5 focus:border-[#ee2b2b] focus:bg-white transition-all text-slate-900 font-bold placeholder:font-medium"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => updateFormData('dob', e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#ee2b2b]/5 focus:border-[#ee2b2b] focus:bg-white transition-all text-slate-900 font-bold uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Gender Identity</label>
                  <div className="flex flex-wrap gap-4">
                    {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map(g => (
                      <button
                        key={g}
                        onClick={() => updateFormData('gender', g)}
                        className={cn(
                          "px-6 py-3 rounded-xl text-sm font-bold border-2 transition-all",
                          formData.gender === g
                            ? "border-[#ee2b2b] bg-[#ee2b2b]/5 text-[#ee2b2b]"
                            : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 'medical' && (
              <motion.div
                key="medical"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Medical Information</h3>
                  <p className="text-slate-500 font-medium">Critical data for emergency matching.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Blood Group</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                        <button
                          key={type}
                          onClick={() => updateFormData('bloodGroup', type)}
                          className={cn(
                            "aspect-square rounded-xl text-xs font-black border-2 transition-all flex items-center justify-center",
                            formData.bloodGroup === type
                              ? "bg-[#ee2b2b] text-white border-[#ee2b2b] shadow-lg shadow-[#ee2b2b]/20"
                              : "bg-slate-50 text-slate-500 border-slate-100 hover:border-[#ee2b2b]"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Weight (kg)</label>
                      <input
                        type="number"
                        value={formData.weight}
                        onChange={(e) => updateFormData('weight', e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#ee2b2b]/5 focus:border-[#ee2b2b] transition-all text-slate-900 font-bold"
                        placeholder="70"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Last Donation Date</label>
                      <input
                        type="date"
                        value={formData.lastDonation}
                        onChange={(e) => updateFormData('lastDonation', e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#ee2b2b]/5 focus:border-[#ee2b2b] transition-all text-slate-900 font-bold"
                      />
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 italic leading-tight">Leave blank if this is your first time.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Any Medical Conditions?</label>
                  <textarea
                    value={formData.medicalConditions}
                    onChange={(e) => updateFormData('medicalConditions', e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#ee2b2b]/5 focus:border-[#ee2b2b] transition-all text-slate-900 font-bold min-h-[100px] resize-none"
                    placeholder="List medications or conditions..."
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 'contact' && (
              <motion.div
                key="contact"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Communication</h3>
                  <p className="text-slate-500 font-medium">How should we reach you for emergencies?</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">mail</span>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateFormData('email', e.target.value)}
                        className="w-full pl-14 pr-5 py-4 bg-slate-50 border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#ee2b2b]/5 focus:border-[#ee2b2b] transition-all text-slate-900 font-bold"
                        placeholder="hero@example.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Phone Number</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">phone_iphone</span>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateFormData('phone', e.target.value)}
                        className="w-full pl-14 pr-5 py-4 bg-slate-50 border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#ee2b2b]/5 focus:border-[#ee2b2b] transition-all text-slate-900 font-bold"
                        placeholder="+91 00000 00000"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-900 rounded-[2rem] text-white flex items-center justify-between shadow-2xl shadow-slate-900/10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-[#ee2b2b]">
                      <span className="material-symbols-outlined">verified_user</span>
                    </div>
                    <div>
                      <h4 className="font-black text-sm">Emergency Consent</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">I agree to be notified for emergency requests</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="w-6 h-6 rounded-lg accent-[#ee2b2b] bg-white/10 border-none"
                    checked={formData.consent}
                    onChange={(e) => updateFormData('consent', e.target.checked)}
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 'location' && (
              <motion.div
                key="location"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Final Step: Location</h3>
                  <p className="text-slate-500 font-medium">To help AI find the nearest hospital in need.</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Full Address</label>
                    <input
                      type="text"
                      className="w-full px-5 py-4 bg-slate-50 border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#ee2b2b]/5 focus:border-[#ee2b2b] transition-all text-slate-900 font-bold"
                      placeholder="Street, Landmark, Apartment"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">City</label>
                      <input type="text" className="w-full px-5 py-4 bg-slate-50 border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#ee2b2b]/5 focus:border-[#ee2b2b] transition-all text-slate-900 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">State</label>
                      <input type="text" className="w-full px-5 py-4 bg-slate-50 border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#ee2b2b]/5 focus:border-[#ee2b2b] transition-all text-slate-900 font-bold" />
                    </div>
                    <div className="space-y-2 md:col-span-1 col-span-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">ZIP Code</label>
                      <input type="text" className="w-full px-5 py-4 bg-slate-50 border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#ee2b2b]/5 focus:border-[#ee2b2b] transition-all text-slate-900 font-bold" />
                    </div>
                  </div>
                </div>

                <div className="p-8 border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/50 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-[#ee2b2b]/50 hover:bg-[#ee2b2b]/5 transition-all">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-[#ee2b2b] group-hover:scale-110 shadow-sm transition-all mb-4">
                    <span className="material-symbols-outlined text-3xl">my_location</span>
                  </div>
                  <h4 className="font-bold text-slate-900">Auto-detect Location</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Faster and more accurate for AI matching</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 'personal'}
              className="px-8 py-3 rounded-xl font-black text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all disabled:opacity-0"
            >
              PREVIOUS
            </button>
            <button
              onClick={currentStep === 'location' ? handleSubmit : handleNext}
              className="bg-[#ee2b2b] text-white px-10 py-4 rounded-2xl font-black text-sm shadow-2xl shadow-[#ee2b2b]/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              {currentStep === 'location' ? 'COMPLETE ONBOARDING' : 'CONTINUE'}
              <span className="material-symbols-outlined text-sm">
                {currentStep === 'location' ? 'done_all' : 'arrow_forward'}
              </span>
            </button>
          </div>
        </div>

        {/* Support Link */}
        <p className="text-center text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
          Need help? <button className="text-[#ee2b2b] hover:underline">Contact Support</button>
        </p>
      </div>
    </div>
  );
}
