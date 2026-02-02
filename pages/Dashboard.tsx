
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import AdminDashboard from './dashboards/AdminDashboard';
import ReceptionistDashboard from './dashboards/ReceptionistDashboard';
import DentistDashboard from './dashboards/DentistDashboard';
import AccountantDashboard from './dashboards/AccountantDashboard';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  const getDashboardInfo = () => {
    switch (user?.role) {
      case Role.Admin:
        return { component: <AdminDashboard />, title: 'Admin Dashboard', subtitle: 'Overview of clinic operations and key metrics.' };
      case Role.Receptionist:
        return { component: <ReceptionistDashboard />, title: 'Receptionist Dashboard', subtitle: 'Manage daily tasks efficiently.' };
      case Role.Dentist:
        return { component: <DentistDashboard />, title: 'Dentist Dashboard', subtitle: 'View your schedule and patient records.' };
      case Role.Accountant:
        return { component: <AccountantDashboard />, title: 'Accountant Dashboard', subtitle: 'Track finances and invoicing.' };
      default:
        return { component: <div className="text-white">No dashboard available for this role.</div>, title: 'Dashboard', subtitle: '' };
    }
  };

  const { component, title, subtitle } = getDashboardInfo();

  return (
    <div className="space-y-8">
       <div>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
         <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
       </div>
      {component}
    </div>
  );
};

export default Dashboard;
