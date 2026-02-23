import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import HospitalRegistration from './pages/HospitalRegistration';
import DonorRegistration from './pages/DonorRegistration';
import AdminRegistration from './pages/AdminRegistration';
import HowItWorks from './pages/HowItWorks';
import EmergencyNetwork from './pages/EmergencyNetwork';
import ImpactReports from './pages/ImpactReports';
import AdminDashboard from './pages/AdminDashboard';
import HospitalDashboard from './pages/HospitalDashboard';
import DonorApp from './pages/DonorApp';
import Analytics from './pages/Analytics';
import LiveTracking from './pages/LiveTracking';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import HospitalPartnership from './pages/HospitalPartnership';
import Support from './pages/Support';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Login />} />
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

        {/* Admin Routes */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/hospitals" element={<AdminDashboard />} />
          <Route path="admin/donors" element={<AdminDashboard />} />
          <Route path="admin/analytics" element={<AdminDashboard />} />
          <Route path="admin/settings" element={<AdminDashboard />} />
        </Route>

        {/* Hospital Routes */}
        <Route element={<ProtectedRoute allowedRoles={['hospital']} />}>
          <Route path="hospital" element={<HospitalDashboard />} />
          <Route path="hospital/requests" element={<HospitalDashboard />} />
          <Route path="hospital/inventory" element={<HospitalDashboard />} />
        </Route>

        {/* Donor Routes */}
        <Route element={<ProtectedRoute allowedRoles={['donor']} />}>
          <Route path="donor" element={<DonorApp />} />
          <Route path="donor/centers" element={<DonorApp />} />
          <Route path="donor/pending" element={<DonorApp />} />
          <Route path="donor/settings" element={<DonorApp />} />
          <Route path="donor/impact" element={<DonorApp />} />
          <Route path="donor/community" element={<DonorApp />} />
        </Route>

        {/* Shared Routes */}
        <Route path="analytics" element={<Analytics />} />
        <Route path="tracking" element={<LiveTracking />} />
      </Route >
    </Routes >
  );
}
