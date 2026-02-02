import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { Appointment, Patient } from '../../types';
import { Clock, UserCheck, Loader2 } from 'lucide-react';
import Modal from '../../components/Modal';
import { useToast } from '../../contexts/ToastContext';

const DentistDashboard: React.FC = () => {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [patientsSeen, setPatientsSeen] = useState(0);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const endOfToday = new Date();
            endOfToday.setHours(23, 59, 59, 999);
            
            const { data, error } = await supabase
                .from('appointments')
                .select('*, patients(*)')
                .eq('dentist_id', user.id)
                .gte('start_time', startOfToday.toISOString())
                .lte('start_time', endOfToday.toISOString())
                .order('start_time', { ascending: true });
            
            if (error) throw error;
            setAppointments((data as any) || []);

            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - 7);
            startOfWeek.setHours(0, 0, 0, 0);

            const { count, error: seenError } = await supabase
                .from('appointments')
                .select('id', { count: 'exact', head: true })
                .eq('dentist_id', user.id)
                .eq('status', 'Completed')
                .gte('start_time', startOfWeek.toISOString());
            
            if (seenError) throw seenError;
            setPatientsSeen(count || 0);
        } catch (error: any) {
            let message = 'An unknown error occurred.';
            if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
                message = (error as any).message;
            }
            addToast("Error fetching dashboard data: " + message, 'error');
            console.error("Dashboard fetch error:", error);
        } finally {
            setLoading(false);
        }
    }, [user, addToast]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleViewRecord = (appointment: Appointment) => {
      const patientData = appointment.patients as Patient | null;
      if (patientData) {
        setSelectedPatient(patientData);
        setIsRecordModalOpen(true);
      }
    };

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-24"></div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-24"></div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-64"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full mr-4 bg-blue-500">
                        <Clock size={24} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Appointments Today</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{appointments.length}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex items-center">
                    <div className="p-3 rounded-full mr-4 bg-green-500">
                        <UserCheck size={24} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Patients Seen (Week)</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{patientsSeen}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">My Schedule for Today</h3>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th scope="col" className="px-6 py-3">Time</th>
                                <th scope="col" className="px-6 py-3">Patient</th>
                                <th scope="col" className="px-6 py-3">Reason</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                                <th scope="col" className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map(app => (
                                <tr key={app.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className="px-6 py-4">{(app.patients as Patient)?.name || 'N/A'}</td>
                                    <td className="px-6 py-4">{app.notes}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                            app.status === 'Scheduled' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-800'
                                        }`}>{app.status}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => handleViewRecord(app)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200">View Record</button>
                                    </td>
                                </tr>
                            ))}
                             {appointments.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-gray-500">No appointments for today.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <Modal isOpen={isRecordModalOpen} onClose={() => setIsRecordModalOpen(false)} title={`Medical Record: ${selectedPatient?.name}`}>
                {selectedPatient && (
                    <div className="text-sm text-gray-700 dark:text-gray-300 space-y-4">
                        <div><strong className="font-semibold text-gray-900 dark:text-white">Name:</strong> {selectedPatient.name}</div>
                        <div><strong className="font-semibold text-gray-900 dark:text-white">Date of Birth:</strong> {selectedPatient.dob}</div>
                        <div><strong className="font-semibold text-gray-900 dark:text-white">Phone:</strong> {selectedPatient.phone}</div>
                        <div><strong className="font-semibold text-gray-900 dark:text-white">Address:</strong> {selectedPatient.address}</div>
                        <div className="pt-2">
                          <strong className="font-semibold text-gray-900 dark:text-white block mb-1">Medical History:</strong>
                          <div className="p-3 border rounded-md bg-slate-50 dark:bg-gray-700/50 whitespace-pre-wrap">{selectedPatient.medical_history || 'No medical history provided.'}</div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default DentistDashboard;