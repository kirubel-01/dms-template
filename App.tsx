import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginScreen from './pages/LoginScreen';
import { Role } from './types';
import ToastContainer from './components/Toast';
import { Loader2 } from 'lucide-react';

// Lazy load page components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Staff = lazy(() => import('./pages/Staff'));
const Treatments = lazy(() => import('./pages/Treatments'));
const Settings = lazy(() => import('./pages/Settings'));
const Reports = lazy(() => import('./pages/Reports'));


const ProtectedRoute: React.FC<{ children: React.ReactNode; roles: Role[] }> = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-900">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <HashRouter>
      <Layout>
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-blue-500" size={48} />
          </div>
        }>
          <div className="animate-fade-in">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/patients" element={<ProtectedRoute roles={[Role.Admin, Role.Receptionist, Role.Dentist]}><Patients /></ProtectedRoute>} />
              <Route path="/appointments" element={<ProtectedRoute roles={[Role.Admin, Role.Receptionist, Role.Dentist]}><Appointments /></ProtectedRoute>} />
              <Route path="/treatments" element={<ProtectedRoute roles={[Role.Admin, Role.Dentist]}><Treatments /></ProtectedRoute>} />
              <Route path="/billing" element={<ProtectedRoute roles={[Role.Admin, Role.Receptionist, Role.Accountant]}><Invoices /></ProtectedRoute>} />
              <Route path="/staff" element={<ProtectedRoute roles={[Role.Admin]}><Staff /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute roles={[Role.Admin, Role.Receptionist, Role.Accountant]}><Reports /></ProtectedRoute>} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </Suspense>
      </Layout>
    </HashRouter>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <div className="bg-slate-50 dark:bg-gray-900 min-h-screen text-slate-800 dark:text-slate-200">
        <AppContent />
        <ToastContainer />
      </div>
    </AuthProvider>
  );
};

export default App;