import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { saveUser } from '../lib/session';
import { isNativeApp } from '../lib/app';
import { PASSWORD_RULES, passwordProblems } from '../lib/password';
import { INDIAN_STATES, PIN_CODE } from '../lib/india';
import TwoStepVerification, { type SecondStepChallenge } from '../components/TwoStepVerification';

type Step = 'hospital' | 'location' | 'account' | 'review';

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'hospital', label: 'Hospital', icon: 'local_hospital' },
  { key: 'location', label: 'Location', icon: 'location_on' },
  { key: 'account', label: 'Account', icon: 'person' },
  { key: 'review', label: 'Review', icon: 'verified_user' },
];

const HOSPITAL_TYPES = ['Government', 'Private', 'Trust / NGO', 'Public-Private'];

// Mobile (optionally +91) or a landline with its STD code
const PHONE = /^(\+91)?[6-9]\d{9}$|^0\d{9,10}$/;
const compactPhone = (p: string) => p.replace(/[\s()-]/g, '');

const inputClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ee2b2b]/20 focus:border-[#ee2b2b] transition-all outline-none text-slate-900 placeholder:text-slate-400';

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-slate-700 ml-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 ml-1">{hint}</p>}
    </div>
  );
}

export default function HospitalRegistration() {
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<SecondStepChallenge | null>(null);
  const [step, setStep] = useState<Step>('hospital');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState('');
  const [form, setForm] = useState({
    hospitalName: '', hospitalType: '', registrationNumber: '',
    address: '', city: '', state: '', pincode: '',
    email: '', phone: '', password: '', confirm: '',
  });
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const index = STEPS.findIndex((s) => s.key === step);

  // Exact coordinates let the network rank donors by distance, not just city
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationNote('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const round = (v: number) => Math.round(v * 1e6) / 1e6;
        setCoords({ latitude: round(pos.coords.latitude), longitude: round(pos.coords.longitude) });
        setLocationNote('Location saved. Only use this while you are at the hospital.');
        setLocating(false);
      },
      () => {
        setLocationNote('Could not get your location. Donors will be matched by city instead.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // What still needs fixing on a step, in words (empty when the step is complete)
  const stepProblem = (s: Step): string => {
    if (s === 'hospital') {
      if (form.hospitalName.trim().length < 3) return 'Enter the hospital name.';
      if (!form.hospitalType) return 'Choose the type of hospital.';
      if (form.registrationNumber.trim().length < 3) return 'Enter the Clinical Establishment registration or blood centre licence number.';
    }
    if (s === 'location') {
      if (form.address.trim().length < 5) return 'Enter the hospital address.';
      if (form.city.trim().length < 2) return 'Enter the city.';
      if (!form.state) return 'Choose the state or union territory.';
      if (!PIN_CODE.test(form.pincode)) return 'A PIN code has 6 digits and does not start with 0.';
    }
    if (s === 'account') {
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Enter a valid email address.';
      if (!PHONE.test(compactPhone(form.phone))) return 'Enter a 10-digit mobile number, or a landline with its STD code.';
      const problems = passwordProblems(form.password);
      if (problems.length) return `Your password needs ${problems.join(', ')}.`;
      if (form.password !== form.confirm) return 'The two passwords do not match.';
    }
    if (s === 'review' && !agreed) return 'Please confirm the details are accurate.';
    return '';
  };

  const next = () => {
    const problem = stepProblem(step);
    if (problem) { setError(problem); return; }
    setError('');
    setStep(STEPS[index + 1]!.key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => {
    setError('');
    if (index > 0) setStep(STEPS[index - 1]!.key);
  };

  const submit = async () => {
    const problem = STEPS.map((s) => stepProblem(s.key)).find(Boolean);
    if (problem) { setError(problem); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          role: 'hospital',
          remember: isNativeApp(),
          name: form.hospitalName.trim(),
          email: form.email.trim(),
          password: form.password,
          hospital_name: form.hospitalName.trim(),
          hospital_type: form.hospitalType,
          registration_number: form.registrationNumber.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state,
          pincode: form.pincode,
          contact_number: compactPhone(form.phone),
          ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        }),
      });
      // The new hospital account sets up its authenticator app before the first session
      if (res.mfa) {
        setChallenge(res.mfa);
        return;
      }
      saveUser(res.user);
      navigate('/hospital', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reviewRows: [string, string][] = [
    ['Hospital', form.hospitalName],
    ['Type', form.hospitalType],
    ['Registration / licence no.', form.registrationNumber],
    ['Address', [form.address, form.city, form.state, form.pincode].filter(Boolean).join(', ')],
    ['Exact location', coords ? `${coords.latitude}, ${coords.longitude}` : 'Not shared (matched by city)'],
    ['Sign-in email', form.email],
    ['Phone', form.phone],
  ];

  return (
    <div className="min-h-screen bg-[#f8f6f6] flex flex-col">
      {challenge && (
        <TwoStepVerification
          challenge={challenge}
          onDone={(user) => { saveUser(user); navigate('/hospital', { replace: true }); }}
          onCancel={() => navigate('/login')}
        />
      )}
      <header className="w-full px-4 sm:px-6 lg:px-20 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-[#ee2b2b]/10">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-[#ee2b2b] p-1.5 rounded-lg text-white">
            <span className="material-symbols-outlined text-2xl">vital_signs</span>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900">LifeLink <span className="text-[#ee2b2b]">AI</span></span>
        </Link>
        <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-[#ee2b2b]">Sign in</Link>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-slate-200 text-sm font-bold text-slate-600">
            <span className="material-symbols-outlined text-[#ee2b2b] text-lg">add_business</span> Hospital registration
          </span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">Register your hospital</h1>
          <p className="text-slate-500 max-w-xl mx-auto">
            Takes about 3 minutes. The LifeLink admin for your city checks your registration before your blood requests can alert donors.
          </p>
        </div>

        {/* Progress: compact on phones, full stepper on larger screens */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
          <div className="sm:hidden space-y-2">
            <p className="text-sm font-bold text-slate-900">Step {index + 1} of {STEPS.length}: {STEPS[index]!.label}</p>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#ee2b2b] rounded-full transition-all" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
            </div>
          </div>
          <ol className="hidden sm:flex items-center">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center ${i <= index ? 'bg-[#ee2b2b] text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <span className="material-symbols-outlined text-lg">{i < index ? 'check' : s.icon}</span>
                  </span>
                  <span className={`text-sm font-bold ${i === index ? 'text-[#ee2b2b]' : i < index ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <span className={`flex-1 h-0.5 mx-3 ${i < index ? 'bg-[#ee2b2b]' : 'bg-slate-200'}`} />}
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-sm">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-5">
              {step === 'hospital' && (
                <>
                  <h2 className="text-xl font-black text-slate-900">About the hospital</h2>
                  <Field label="Hospital name" htmlFor="h-name">
                    <input id="h-name" value={form.hospitalName} onChange={set('hospitalName')} className={inputClass} placeholder="e.g. District Hospital, Nashik" />
                  </Field>
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-slate-700 ml-1">Type of hospital</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {HOSPITAL_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, hospitalType: t }))}
                          aria-pressed={form.hospitalType === t}
                          className={`py-2.5 px-3 rounded-xl text-sm font-bold border-2 transition-all ${form.hospitalType === t ? 'border-[#ee2b2b] bg-[#ee2b2b]/5 text-[#ee2b2b]' : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field label="Registration or licence number" htmlFor="h-reg" hint="Your Clinical Establishment registration number, or your blood centre licence number under the Drugs and Cosmetics Rules.">
                    <input id="h-reg" value={form.registrationNumber} onChange={set('registrationNumber')} className={inputClass} placeholder="As printed on your certificate" />
                  </Field>
                </>
              )}

              {step === 'location' && (
                <>
                  <h2 className="text-xl font-black text-slate-900">Where is it?</h2>
                  <Field label="Address" htmlFor="h-address">
                    <input id="h-address" value={form.address} onChange={set('address')} className={inputClass} placeholder="Building, street, area, landmark" autoComplete="street-address" />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label="City" htmlFor="h-city">
                      <input id="h-city" value={form.city} onChange={set('city')} className={inputClass} placeholder="e.g. Nashik" autoComplete="address-level2" />
                    </Field>
                    <Field label="State / UT" htmlFor="h-state">
                      <select id="h-state" value={form.state} onChange={set('state')} className={inputClass}>
                        <option value="">Select</option>
                        {INDIAN_STATES.map((st) => <option key={st}>{st}</option>)}
                      </select>
                    </Field>
                    <Field label="PIN code" htmlFor="h-pin">
                      <input
                        id="h-pin"
                        inputMode="numeric"
                        maxLength={6}
                        value={form.pincode}
                        onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '') }))}
                        className={inputClass}
                        placeholder="e.g. 422001"
                        autoComplete="postal-code"
                      />
                    </Field>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="material-symbols-outlined text-blue-500">my_location</span>
                    <div className="flex-1 text-sm text-blue-900/80">
                      <p><strong>Optional:</strong> share the hospital's exact location so the nearest donors are asked first. Without it, donors are matched by city.</p>
                      {coords && <p className="font-bold text-blue-900 mt-1">📍 {coords.latitude}, {coords.longitude}</p>}
                      {locationNote && <p className="text-xs mt-1">{locationNote}</p>}
                    </div>
                    <button type="button" onClick={useCurrentLocation} disabled={locating} className="px-4 py-2 rounded-lg bg-white border border-blue-200 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap">
                      {locating ? 'Locating…' : coords ? 'Update location' : 'Use my location'}
                    </button>
                  </div>
                </>
              )}

              {step === 'account' && (
                <>
                  <h2 className="text-xl font-black text-slate-900">Your sign-in details</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Email" htmlFor="h-email" hint="You will sign in with this.">
                      <input id="h-email" type="email" value={form.email} onChange={set('email')} className={inputClass} placeholder="bloodbank@yourhospital.in" autoComplete="email" />
                    </Field>
                    <Field label="Phone" htmlFor="h-phone" hint="A mobile number can also receive LifeLink SMS updates.">
                      <input id="h-phone" type="tel" value={form.phone} onChange={set('phone')} className={inputClass} placeholder="+91 98765 43210" autoComplete="tel" />
                    </Field>
                  </div>
                  <Field label="Password" htmlFor="h-password">
                    <div className="relative">
                      <input id="h-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} className={`${inputClass} pr-12`} autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#ee2b2b]">
                        <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1">
                      {PASSWORD_RULES.map(([label, ok]) => (
                        <li key={label} className={`text-xs font-bold flex items-center gap-1 ${ok(form.password) ? 'text-green-700' : 'text-slate-400'}`}>
                          <span className="material-symbols-outlined text-sm">{ok(form.password) ? 'check_circle' : 'radio_button_unchecked'}</span>{label}
                        </li>
                      ))}
                    </ul>
                  </Field>
                  <Field label="Confirm password" htmlFor="h-confirm">
                    <input id="h-confirm" type={showPassword ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')} className={inputClass} autoComplete="new-password" />
                  </Field>
                </>
              )}

              {step === 'review' && (
                <>
                  <h2 className="text-xl font-black text-slate-900">Check and submit</h2>
                  <dl className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                    {reviewRows.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-1 sm:grid-cols-3 gap-1 p-3 text-sm">
                        <dt className="text-slate-500 font-bold">{k}</dt>
                        <dd className="sm:col-span-2 text-slate-900 wrap-break-word">{v || '–'}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-sm text-slate-600">
                    <p className="flex gap-2"><span className="material-symbols-outlined text-[#ee2b2b]">fact_check</span>
                      <span>The LifeLink admin for <strong className="text-slate-900">{form.city || 'your city'}</strong> checks your registration number against the state's Clinical Establishments register or your blood centre licence, and may call you to confirm.</span></p>
                    <p className="flex gap-2"><span className="material-symbols-outlined text-[#ee2b2b]">lock_clock</span>
                      <span>You can sign in and set up your inventory straight away. Blood requests start alerting donors once you are verified.</span></p>
                  </div>
                  <label className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-slate-800 cursor-pointer">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 w-5 h-5 accent-[#ee2b2b]" />
                    <span className="text-sm">I am authorised to register this hospital, and the details above are accurate. I agree to the <Link to="/terms" className="underline font-bold">Terms</Link> and <Link to="/privacy" className="underline font-bold">Privacy Policy</Link>.</span>
                  </label>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {error && <p role="alert" className="mt-6 text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>}

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="button"
              onClick={back}
              disabled={index === 0}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all disabled:invisible"
            >
              <span className="material-symbols-outlined">arrow_back</span> Back
            </button>
            <button
              type="button"
              onClick={step === 'review' ? submit : next}
              disabled={submitting}
              className="w-full sm:w-auto bg-[#ee2b2b] text-white px-8 py-3.5 rounded-xl font-black shadow-lg shadow-[#ee2b2b]/20 hover:bg-[#ee2b2b]/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Registering…' : step === 'review' ? 'Register hospital' : 'Continue'}
              <span className="material-symbols-outlined">{step === 'review' ? 'how_to_reg' : 'arrow_forward'}</span>
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-slate-500">
          Already registered? <Link to="/login" className="font-bold text-[#ee2b2b] hover:underline">Sign in</Link>
        </p>
      </main>
    </div>
  );
}
