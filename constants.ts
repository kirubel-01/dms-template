
import { Role } from './types';
import { Users, LayoutDashboard, Calendar, Wallet, Stethoscope, User, Settings, FileText } from 'lucide-react';

export const ROLES = [Role.Admin, Role.Receptionist, Role.Dentist, Role.Accountant];

export const NAVIGATION_LINKS = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: [Role.Admin, Role.Receptionist, Role.Dentist, Role.Accountant] },
    { name: 'Appointments', href: '/appointments', icon: Calendar, roles: [Role.Admin, Role.Receptionist, Role.Dentist] },
    { name: 'Patients', href: '/patients', icon: Users, roles: [Role.Admin, Role.Receptionist, Role.Dentist] },
    { name: 'Billing', href: '/billing', icon: Wallet, roles: [Role.Admin, Role.Receptionist, Role.Accountant] },
    { name: 'Reports', href: '/reports', icon: FileText, roles: [Role.Admin, Role.Receptionist, Role.Accountant] },
    { name: 'Treatments', href: '/treatments', icon: Stethoscope, roles: [Role.Admin, Role.Dentist] },
    { name: 'Staff', href: '/staff', icon: User, roles: [Role.Admin] },
];

export const USER_SETTINGS_LINKS = [
    { name: 'Settings', href: '/settings', icon: Settings, roles: [Role.Admin, Role.Receptionist, Role.Dentist, Role.Accountant] },
]
