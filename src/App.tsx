import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Report from './pages/Report';
import Reports from './pages/Reports';
import EditReport from './pages/EditReport';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import MapPage from './pages/MapPage';
import Observers from './pages/Observers';
import ElectionRounds from './pages/ElectionRounds';
import PollingStations from './pages/PollingStations';
import Forms from './pages/Forms';
import Evidence from './pages/Evidence';
import Notifications from './pages/Notifications';
import Administration from './pages/Administration';
import Layout from './components/Layout';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" />;

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />

      {/* Authenticated Workspace Routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/elections" element={<ElectionRounds />} />
        <Route path="/polling-stations" element={<PollingStations />} />
        <Route path="/forms" element={<Forms />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/:id/edit" element={<ProtectedRoute adminOnly><EditReport /></ProtectedRoute>} />
        <Route path="/report" element={<Report />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />
        <Route path="/evidence" element={<Evidence />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/observers" element={<Observers />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/admin" element={<Administration />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}
