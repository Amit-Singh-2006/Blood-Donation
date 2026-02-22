import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Mail, MapPin, Droplets, Calendar, CheckCircle2, ArrowRight, Lock, Upload, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DonorRegistration() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [points, setPoints] = useState(0);

  // Form state for calculating points
  const [formData, setFormData] = useState({
    name: '', dob: '', bloodGroup: '', gender: '', 
    phone: '', email: '', 
    country: '', state: '', district: '',
    password: '', confirmPassword: '',
    bloodDoc: null as File | null,
    historyDoc: null as File | null,
  });

  // Calculate completeness points
  useEffect(() => {
    let currentPoints = 0;
    if (formData.name && formData.dob && formData.gender && formData.country && formData.state && formData.district) currentPoints += 20;
    if (formData.phone && formData.email) currentPoints += 20;
    if (formData.bloodGroup) currentPoints += 10;
    if (formData.bloodDoc) currentPoints += 30; // High value for verification
    if (formData.historyDoc) currentPoints += 20; // Bonus for history
    setPoints(currentPoints);
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'bloodDoc' | 'historyDoc') => {
    if (e.target.files && e.target.files.length > 0) {
      setFormData(prev => ({ ...prev, [field]: e.target.files![0] }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      
      // Pass points to next screen if needed, redirecting to donor app after success
      setTimeout(() => {
        navigate('/donor', { state: { initialPoints: points } });
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
          <p className="text-slate-600 mb-6">Welcome to the LifeLink AI network. You are now ready to save lives.</p>
          <p className="text-sm text-slate-400">Redirecting to dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900">Donor Registration</h1>
        <p className="text-slate-600 mt-2">Join our AI-enhanced network and become a hero today.</p>
      </div>

      <motion.form 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-8"
      >
        {/* Points Indicator */}
        <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-xl border border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-white p-2 text-red-500 rounded-lg shadow-sm">
                    <Award className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm">Profile Completeness Reward</h3>
                    <p className="text-xs text-slate-500">Earn up to 100 XP start bonus.</p>
                </div>
            </div>
            <div className="text-right">
                <span className="text-2xl font-black text-red-600">{points}</span><span className="text-sm font-bold text-red-400">/100 XP</span>
                <div className="w-32 h-1.5 bg-red-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(points / 100) * 100}%` }} />
                </div>
            </div>
        </div>

        {/* 1. Personal Details */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Personal Details</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-red-500" /> Full Name
              </label>
              <input 
                name="name" onChange={handleChange} value={formData.name} required 
                type="text" placeholder="John Doe"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-red-500" /> Date of Birth
              </label>
              <input 
                name="dob" onChange={handleChange} value={formData.dob} required 
                type="date" 
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-red-500" /> Gender
              </label>
              <select 
                name="gender" onChange={handleChange} value={formData.gender} required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all bg-white"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 gap-2 flex items-center"><MapPin className="w-4 h-4 text-red-500"/> Country</label>
                <input name="country" onChange={handleChange} value={formData.country} required type="text" placeholder="Country" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">State / Province</label>
                <input name="state" onChange={handleChange} value={formData.state} required type="text" placeholder="State" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">District / City</label>
                <input name="district" onChange={handleChange} value={formData.district} required type="text" placeholder="District" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all" />
              </div>
            </div>
        </div>

        {/* 2. Contact Information */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Contact Information</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Phone className="w-4 h-4 text-red-500" /> Phone Number
              </label>
              <input 
                name="phone" onChange={handleChange} value={formData.phone} required 
                type="tel" placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Mail className="w-4 h-4 text-red-500" /> Email Address
              </label>
              <input 
                name="email" onChange={handleChange} value={formData.email} required 
                type="email" placeholder="john@example.com"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* 3. Medical Information */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Medical Information</h3>
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Droplets className="w-4 h-4 text-red-500" /> Blood Group
              </label>
              <select 
                name="bloodGroup" onChange={handleChange} value={formData.bloodGroup} required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all bg-white"
              >
                <option value="">Select Blood Type</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-2"><Upload className="w-4 h-4 text-red-500" /> Verification Document</span>
                <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">+30 XP</span>
              </label>
              <div className="relative">
                <input 
                  type="file" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange(e, 'bloodDoc')}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-red-50 file:text-red-600 hover:file:bg-red-100 transition-all border border-slate-200 rounded-lg"
                />
              </div>
              <p className="text-xs text-slate-400">Upload lab report or previous donor card.</p>
            </div>
            
            <div className="space-y-2 md:col-span-2">
               <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-2"><Upload className="w-4 h-4 text-red-500" /> Previous Donation History (Optional)</span>
                <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">+20 XP</span>
              </label>
              <input 
                type="file" accept=".pdf,.jpg,.jpeg,.png" multiple
                onChange={(e) => handleFileChange(e, 'historyDoc')}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-slate-100 file:text-slate-600 hover:file:bg-slate-200 cursor-pointer border border-dashed border-slate-300 p-2 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* 4. Account Security */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Account Security</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Lock className="w-4 h-4 text-red-500" /> Password
              </label>
              <input 
                name="password" onChange={handleChange} value={formData.password} required minLength={8}
                type="password" placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" /> Confirm Password
              </label>
              <input 
                name="confirmPassword" onChange={handleChange} value={formData.confirmPassword} required 
                type="password" placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
              />
              {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500 font-bold">Passwords do not match.</p>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input type="checkbox" required className="mt-1 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500" />
            <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
              I consent to sharing my location and contact details with hospitals during emergencies. I understand that I can toggle my availability status at any time.
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
              Complete Registration <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </motion.form>
    </div>
  );
}
