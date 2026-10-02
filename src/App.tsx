import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import HomePage from './pages/HomePage';
import HospitalRegistration from './pages/HospitalRegistration';
import DonorRegistration from './pages/DonorRegistration';
import AdminRegistration from './pages/AdminRegistration';
import HowItWorks from './pages/HowItWorks';
import EmergencyNetwork from './pages/EmergencyNetwork';
import ImpactReports from './pages/ImpactReports';
import Analytics from './pages/Analytics';
import TrackRequest from './pages/TrackRequest';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import HospitalPartnership from './pages/HospitalPartnership';
import Support from './pages/Support';
import ProtectedRoute from './components/ProtectedRoute';
import { isNativeApp } from './lib/app';
import { refreshSession } from './lib/api';
import { DASHBOARD, Role, lastRole, signedInUsers } from './lib/session';

// Signed-in dashboards pull in PDF/QR libraries; load them only when visited
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const HospitalDashboard = lazy(() => import('./pages/HospitalDashboard'));
const DonorApp = lazy(() => import('./pages/DonorApp'));
const PassPage = lazy(() => import('./pages/PassPage'));
const CampaignPage = lazy(() => import('./pages/CampaignPage'));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center text-sm font-bold text-slate-400">Loading…</div>
);

/**
 * In the Android app, opening it goes straight to the signed-in dashboard (the
 * one used last), like other apps. Only when the app opens: tapping Home inside
 * it still shows the home page.
 */
function useOpenAppOnDashboard() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNativeApp() || window.location.pathname !== '/') return;
    try {
      if (sessionStorage.getItem('lifelink.opened')) return;
      sessionStorage.setItem('lifelink.opened', '1');
    } catch { /* storage unavailable: still open the dashboard */ }
    const open = (roles: Role[]) => {
      if (!roles.length) return;
      const last = lastRole();
      navigate(DASHBOARD[last && roles.includes(last) ? last : roles[0]!], { replace: true });
    };
    const local = signedInUsers().map((u) => u.role as Role);
    if (local.length) return open(local);
    // The page's own record can be lost when Android closes the app: ask the server
    refreshSession().then((users) => open((users ?? []).map((u) => u.role as Role)));
  }, [navigate]);
}

export default function App() {
  useOpenAppOnDashboard();
  return (
    <Suspense fallback={<Loading />}>
    <Routes>
      {/* Public routes - wrapped in Layout (has public navbar/sidebar) */}
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="register-donor" element={<DonorRegistration />} />
        <Route path="register-hospital" element={<HospitalRegistration />} />
        <Route path="register-admin" element={<AdminRegistration />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="emergency-network" element={<EmergencyNetwork />} />
        <Route path="impact-reports" element={<ImpactReports />} />
        <Route path="privacy" element={<PrivacyPolicy />} />
        <Route path="terms" element={<TermsOfService />} />
        <Route path="partnership" element={<HospitalPartnership />} />
        <Route path="support" element={<Support />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="track" element={<TrackRequest />} />
        <Route path="track/:token" element={<TrackRequest />} />
        <Route path="tracking" element={<Navigate to="/track" replace />} />
        <Route path="pass/:code" element={<PassPage />} />
        <Route path="campaign/:id" element={<CampaignPage />} />

        {/* Donor Routes - inside Layout so the topbar renders */}
        <Route element={<ProtectedRoute allowedRoles={['donor']} />}>
          <Route path="donor" element={<DonorApp />} />
          <Route path="donor/centers" element={<DonorApp />} />
          <Route path="donor/settings" element={<DonorApp />} />
          <Route path="donor/impact" element={<DonorApp />} />
          <Route path="donor/campaigns" element={<DonorApp />} />
          <Route path="donor/reviews" element={<DonorApp />} />
          {/* Removed placeholder tabs; old links land on the dashboard */}
          <Route path="donor/pending" element={<Navigate to="/donor" replace />} />
          <Route path="donor/community" element={<Navigate to="/donor" replace />} />
        </Route>
      </Route>

      {/* Dashboard routes - NO Layout wrapper, each dashboard has its own sidebar */}

      {/* Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="admin/hospitals" element={<AdminDashboard />} />
        <Route path="admin/requests" element={<AdminDashboard />} />
        <Route path="admin/donors" element={<AdminDashboard />} />
        <Route path="admin/analytics" element={<AdminDashboard />} />
        <Route path="admin/settings" element={<AdminDashboard />} />
        <Route path="admin/admins" element={<AdminDashboard />} />
        <Route path="admin/campaigns" element={<AdminDashboard />} />
      </Route>

      {/* Hospital Routes */}
      <Route element={<ProtectedRoute allowedRoles={['hospital']} />}>
        <Route path="hospital" element={<HospitalDashboard />} />
        <Route path="hospital/requests" element={<HospitalDashboard />} />
        <Route path="hospital/inventory" element={<HospitalDashboard />} />
        <Route path="hospital/reviews" element={<HospitalDashboard />} />
      </Route>


    </Routes>
    </Suspense>
  );
}
