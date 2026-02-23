import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithGoogle } = useAuth();
  const [role, setRole] = useState<'donor' | 'hospital' | 'admin'>('donor');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmergencyAvailable, setIsEmergencyAvailable] = useState(false);
  const [isRegistering, setIsRegistering] = useState(location.pathname === '/register-donor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [hospitalKey, setHospitalKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate admin special key
    if (role === 'admin' && adminKey !== '7291admin') {
      setError('Invalid Admin Access Key. Please contact your system administrator.');
      setIsLoading(false);
      return;
    }

    // Validate hospital special key
    if (role === 'hospital' && hospitalKey !== 'HOSP-7291') {
      setError('Invalid Hospital ID. Access denied.');
      setIsLoading(false);
      return;
    }

    try {
      let authResponse;
      if (isRegistering) {
        // Register
        const registerData = {
          name,
          email,
          password,
          role,
          ...(role === 'donor' && { blood_group: bloodGroup }),
        };
        authResponse = await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify(registerData),
        });
      } else {
        // Login
        authResponse = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      }

      localStorage.setItem('token', authResponse.token);
      localStorage.setItem('user', JSON.stringify(authResponse.user));

      // Ensure the user's actual role matches the selected login tab
      const userRole = authResponse.user.role;
      if (userRole !== role) {
        // Role mismatch — reject login and clear storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setError(`Invalid credentials. Please use the correct login tab for your account type.`);
        return;
      }

      // Navigate based on role
      if (userRole === 'donor') navigate('/donor');
      else if (userRole === 'hospital') navigate('/hospital');
      else if (userRole === 'admin') navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);

    // Require keys before allowing Google Sign-In for specific roles
    if (role === 'admin') {
      if (adminKey !== '7291admin') {
        setError('Invalid Admin Access Key. Please enter the correct key before signing in with Google.');
        return;
      }
    }

    if (role === 'hospital') {
      if (hospitalKey !== 'HOSP-7291') {
        setError('Invalid Hospital ID. Please enter a valid ID before signing in with Google.');
        return;
      }
    }

    setIsLoading(true);
    try {
      await loginWithGoogle(role);
      if (role === 'donor') navigate('/donor');
      else if (role === 'hospital') navigate('/hospital');
      else if (role === 'admin') navigate('/admin');
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setError('Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    if (role === 'hospital' && !isRegistering) {
      navigate('/register-hospital');
    } else if (role === 'admin' && !isRegistering) {
      navigate('/register-admin');
    } else {
      setIsRegistering(!isRegistering);
      setError(null);
      navigate(isRegistering ? '/' : '/register-donor');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f6f6] relative overflow-hidden">
      {/* Top Navigation */}
      <header className="w-full px-6 lg:px-20 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-[#ee2b2b]/10 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-[#ee2b2b] p-1.5 rounded-lg text-white">
            <span className="material-symbols-outlined text-2xl">vital_signs</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">LifeLink <span className="text-[#ee2b2b]">AI</span></h1>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/how-it-works" className="text-sm font-semibold hover:text-[#ee2b2b] transition-colors">How it Works</Link>
          <Link to="/emergency-network" className="text-sm font-semibold hover:text-[#ee2b2b] transition-colors">Emergency Network</Link>
          <Link to="/impact-reports" className="text-sm font-semibold hover:text-[#ee2b2b] transition-colors">Impact Reports</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link
            to="/support"
            className="text-sm font-bold text-slate-600 hover:text-[#ee2b2b] transition-colors"
          >
            Support
          </Link>
          <button
            onClick={() => navigate(`/register-${role}`)}
            className="bg-[#ee2b2b] text-white px-5 py-2 rounded-lg text-sm font-bold shadow-lg shadow-[#ee2b2b]/20 hover:bg-[#ee2b2b]/90 transition-all active:scale-95"
          >
            Join Network
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative">
        {/* Decorative Elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-[#ee2b2b]/5 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#ee2b2b]/10 rounded-full blur-3xl -z-10"></div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[480px] space-y-8"
        >
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-black tracking-tight text-slate-900">Unified Login</h2>
            <p className="text-slate-500 font-medium">Bridging the gap between hospitals and donors with AI.</p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-6 shadow-[0_10px_25px_-5px_rgba(242,13,13,0.05),0_8px_10px_-6px_rgba(0,0,0,0.01)]">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-100 italic">
                {error}
              </div>
            )}

            {/* Role Selector */}
            <div className="bg-slate-100 p-1.5 rounded-xl flex">
              <button
                onClick={() => setRole('donor')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${role === 'donor' ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <span className="material-symbols-outlined text-lg">person</span>
                Donor
              </button>
              <button
                onClick={() => setRole('hospital')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${role === 'hospital' ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <span className="material-symbols-outlined text-lg">local_hospital</span>
                Hospital
              </button>
              <button
                onClick={() => setRole('admin')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${role === 'admin' ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                Admin
              </button>
            </div>

            {/* Input Group */}
            <form onSubmit={handleLogin} className="space-y-4">
              {isRegistering && (
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 ml-1">Full Name</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ee2b2b] transition-colors">badge</span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 ml-1">Email address</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ee2b2b] transition-colors">mail</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              {isRegistering && role === 'donor' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 ml-1">Blood Type</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ee2b2b] transition-colors">bloodtype</span>
                    <select
                      required
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400 appearance-none"
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
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
                  <a className="text-xs font-bold text-[#ee2b2b] hover:underline" href="#">Forgot?</a>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ee2b2b] transition-colors">lock</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#ee2b2b] transition-colors">
                    <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {/* Admin Special Key Field */}
              {role === 'admin' && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1.5"
                >
                  <label className="text-sm font-black text-[#ee2b2b] ml-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">shield_lock</span>
                    Admin Access Key
                  </label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#ee2b2b]/60 group-focus-within:text-[#ee2b2b] transition-colors">key</span>
                    <input
                      type="password"
                      required={role === 'admin'}
                      value={adminKey}
                      onChange={(e) => setAdminKey(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-red-50 border border-[#ee2b2b]/20 rounded-lg focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400 font-mono tracking-widest"
                      placeholder="LIFELINK-ADMIN-••••"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1 font-medium">🔐 This key is issued by LifeLink AI system administrators only.</p>
                </motion.div>
              )}

              {/* Hospital ID Field */}
              {role === 'hospital' && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1.5"
                >
                  <label className="text-sm font-black text-slate-700 ml-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-[#ee2b2b]">badge</span>
                    Hospital ID / Access Key
                  </label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ee2b2b] transition-colors">domain_verification</span>
                    <input
                      type="text"
                      required={role === 'hospital'}
                      value={hospitalKey}
                      onChange={(e) => setHospitalKey(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all text-slate-900 placeholder:text-slate-400 font-bold"
                      placeholder="HOSP-••••"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1 font-medium italic">Required for verified medical facility access.</p>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#ee2b2b] text-white py-4 rounded-lg font-bold text-lg shadow-xl shadow-[#ee2b2b]/20 hover:bg-[#ee2b2b]/90 active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <span className="relative px-4 bg-white text-xs font-bold text-slate-400 uppercase tracking-widest">or continue with</span>
            </div>

            {/* Social Auth */}
            <button type="button" onClick={handleGoogleSignIn} disabled={isLoading} className="w-full flex items-center justify-center gap-3 py-3.5 border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
              Google Account
            </button>
          </div>

          <p className="text-center text-sm font-semibold text-slate-500">
            {isRegistering ? 'Already have an account?' : 'New to LifeLink AI?'}
            <button type="button" onClick={toggleMode} className="text-[#ee2b2b] hover:underline ml-1">
              {isRegistering ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full p-8 border-t border-slate-200 text-center">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="material-symbols-outlined text-sm">verified_user</span>
            <span className="text-xs font-bold uppercase tracking-tighter">Secure & Encrypted Matching</span>
          </div>
          <div className="flex gap-6">
            <Link className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b]" to="/privacy">Privacy Policy</Link>
            <Link className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b]" to="/terms">Terms of Service</Link>
            <Link className="text-xs font-bold text-slate-500 hover:text-[#ee2b2b]" to="/partnership">Hospital Partnership</Link>
          </div>
          <p className="text-xs font-bold text-slate-400">© 2024 LifeLink AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
