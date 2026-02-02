import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Appointment, AppointmentStatus, Patient, Invoice } from '../../types';
import { UserPlus, CalendarPlus, LogIn, FileText, Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import SkeletonLoader from '../../components/SkeletonLoader';

const ActionCard: React.FC<{ title: string; icon: React.ElementType; onClick: () => void; }> = ({ title, icon: Icon, onClick }) => (
    <button onClick={onClick} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-gray-700 transition-all duration-200 h-full">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full mb-3">
            <Icon size={24} className="text-blue-600 dark:text-blue-400" />
        </div>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</span>
    </button>
);


const ReceptionistDashboard: React.FC = () => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Patient[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const endOfToday = new Date();
            endOfToday.setHours(23, 59, 59, 999);

            const { data, error } = await supabase
                .from('appointments')
                .select('*, patients(name), users(full_name)')
                .gte('start_time', startOfToday.toISOString())
                .lte('start_time', endOfToday.toISOString())
                .order('start_time', { ascending: true });

            if (error) throw error;
            setAppointments((data as any) || []);
        
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .select('id, amount, due_date, patients(name)')
                .in('status', ['Unpaid', 'Overdue'])
                .order('due_date', { ascending: true })
                .limit(5);
            
            if (invoiceError) throw invoiceError;
            setPendingInvoices((invoiceData as any) || []);

        } catch (error: any) {
             let message = 'An unknown error occurred.';
             if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
                 message = (error as any).message;
             }
             addToast('Could not fetch dashboard data: ' + message, 'error');
             console.error("Dashboard fetch error:", error);
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);
    
    useEffect(() => {
        if (searchTerm.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        const searchPatients = async () => {
            setIsSearching(true);
            try {
                const { data, error } = await supabase
                    .from('patients')
                    .select('id, name, phone')
                    .ilike('name', `%${searchTerm.trim()}%`)
                    .limit(5);

                if (error) throw error;
                setSearchResults(data as Patient[] || []);
            } catch (error: any) {
                addToast('Error searching for patients: ' + error.message, 'error');
                console.error("Patient search error:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const debounceTimer = setTimeout(() => {
            searchPatients();
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [searchTerm, addToast]);


    const handleCheckIn = async (appointmentId: string) => {
        const { error } = await supabase
            .from('appointments')
            .update({ status: AppointmentStatus.CheckedIn })
            .eq('id', appointmentId);
        
        if (error) {
            addToast('Failed to check-in patient.', 'error');
        } else {
            addToast('Patient checked in successfully.', 'success');
            fetchDashboardData(); // Refresh the list
        }
    };

    const getStatusChip = (status: AppointmentStatus) => {
        switch (status) {
            case AppointmentStatus.Scheduled:
                return 'bg-slate-100 text-slate-800';
            case AppointmentStatus.CheckedIn:
                return 'bg-blue-100 text-blue-800';
            case AppointmentStatus.Completed:
                return 'bg-green-100 text-green-800';
            case AppointmentStatus.Canceled:
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };


    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <ActionCard title="New Patient" icon={UserPlus} onClick={() => navigate('/patients')} />
                 <ActionCard title="Book Appointment" icon={CalendarPlus} onClick={() => navigate('/appointments')} />
                 <ActionCard title="Patient Check-In" icon={LogIn} onClick={() => { /* Logic to find next patient or open modal */}} />
                 <ActionCard title="Generate Invoice" icon={FileText} onClick={() => navigate('/billing')} />
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Today's Appointments</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                        <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-gray-700/50">
                            <tr>
                                <th scope="col" className="px-4 py-3 font-medium">Time</th>
                                <th scope="col" className="px-4 py-3 font-medium">Patient</th>
                                <th scope="col" className="px-4 py-3 font-medium">Dentist</th>
                                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                                <th scope="col" className="px-4 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-700 dark:text-slate-300">
                           {loading ? (
                                <SkeletonLoader rows={5} columns={5} />
                           ) : appointments.length > 0 ? (
                                appointments.map(app => (
                                    <tr key={app.id} className="border-b border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                                        <td className="px-4 py-3" title={app.notes || 'No notes for this appointment.'}>{app.patients?.name || 'N/A'}</td>
                                        <td className="px-4 py-3">{app.users?.full_name || 'N/A'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusChip(app.status)}`}>{app.status}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {app.status === AppointmentStatus.Scheduled && (
                                                <button onClick={() => handleCheckIn(app.id)} className="text-blue-600 hover:underline text-sm font-medium">Check In</button>
                                            )}
                                            {app.status !== AppointmentStatus.Scheduled && (
                                                <button onClick={() => navigate('/appointments')} className="text-slate-500 hover:underline text-sm font-medium">View</button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                           ) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-slate-500">
                                        No appointments scheduled for today.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Patient Search</h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search for a patient by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="mt-4 space-y-2 h-48 overflow-y-auto">
                        {isSearching && (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="animate-spin text-blue-500" size={24} />
                            </div>
                        )}
                        {!isSearching && searchResults.length > 0 && (
                            <ul className="divide-y divide-slate-200 dark:divide-gray-700">
                                {searchResults.map(patient => (
                                    <li key={patient.id} className="py-2 flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{patient.name}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{patient.phone}</p>
                                        </div>
                                        <button onClick={() => navigate(`/patients`)} className="text-blue-600 hover:underline text-sm font-medium">View</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {!isSearching && searchTerm.length >= 2 && searchResults.length === 0 && (
                            <p className="text-center text-sm text-slate-500 py-4">No patients found.</p>
                        )}
                        {!isSearching && searchTerm.length < 2 && (
                            <p className="text-center text-sm text-slate-500 py-4">Enter 2 or more characters to search.</p>
                        )}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Pending Invoices</h3>
                     <div className="space-y-2 h-48 overflow-y-auto">
                        {pendingInvoices.length > 0 ? (
                            <ul className="divide-y divide-slate-200 dark:divide-gray-700">
                                {pendingInvoices.map(invoice => (
                                    <li key={invoice.id} className="py-2 flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{invoice.patients?.name}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                ${invoice.amount.toFixed(2)} due on {new Date(invoice.due_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <button onClick={() => navigate(`/billing`)} className="text-blue-600 hover:underline text-sm font-medium">View</button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                             <p className="text-center text-sm text-slate-500 py-4">No pending invoices.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReceptionistDashboard;