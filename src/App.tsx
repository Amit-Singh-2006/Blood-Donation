import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import HospitalDashboard from './pages/HospitalDashboard';
import DonorApp from './pages/DonorApp';
import Analytics from './pages/Analytics';
import LiveTracking from './pages/LiveTracking';
import DonorRegistration from './pages/DonorRegistration';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Login />} />
        <Route path="register-donor" element={<DonorRegistration />} />

        {/* Admin Routes */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/hospitals" element={<AdminDashboard />} />
          <Route path="admin/donors" element={<AdminDashboard />} />
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
          <Route path="donor/impact" element={<DonorApp />} />
          <Route path="donor/community" element={<DonorApp />} />
        </Route>

        {/* Shared Routes */}
        <Route path="analytics" element={<Analytics />} />
        <Route path="tracking" element={<LiveTracking />} />
      </Route>
    </Routes>
  );
}
