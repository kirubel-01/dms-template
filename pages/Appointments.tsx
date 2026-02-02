
import React, { useState, useEffect, useCallback } from 'react';
import { Appointment, Patient, AppUser, Role, AppointmentStatus } from '../types';
import { supabase } from '../lib/supabaseClient';
import { PlusCircle, Search, Edit, Trash2, Calendar } from 'lucide-react';
import Modal from '../components/Modal';
import { useToast } from '../contexts/ToastContext';
import EmptyState from '../components/EmptyState';
import { Loader2 } from 'lucide-react';
import SkeletonLoader from '../components/SkeletonLoader';
import Pagination from '../components/Pagination';

const initialFormData = {
  patient_id: '',
  dentist_id: '',
  start_time: '',
  end_time: '',
  status: AppointmentStatus.Scheduled,
  notes: '',
};

type FilterType = 'All' | 'Today' | 'This Week' | 'This Month';
const ITEMS_PER_PAGE = 10;

const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dentists, setDentists] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionStates, setActionStates] = useState<{ [key: string]: boolean }>({});
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const { addToast } = useToast();
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('appointments')
        .select('*, patients(name), users(full_name)', { count: 'exact' });

      const today = new Date();
      if (filter === 'Today') {
        const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const endOfToday = new Date(today.setHours(23, 59, 59, 999)).toISOString();
        query = query.gte('start_time', startOfToday).lte('start_time', endOfToday);
      } else if (filter === 'This Week') {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
        startOfWeek.setHours(0,0,0,0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        query = query.gte('start_time', startOfWeek.toISOString()).lt('start_time', endOfWeek.toISOString());
      } else if (filter === 'This Month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        query = query.gte('start_time', startOfMonth).lte('start_time', endOfMonth.toISOString());
      }
      
      if (debouncedSearchTerm) {
        query = query.ilike('patients.name', `%${debouncedSearchTerm}%`);
      }

      const { data, error, count } = await query
        .order('start_time', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      
      setAppointments((data as any) || []);
      setTotalCount(count || 0);

    } catch (error: any) {
      addToast('Error fetching appointments: ' + error.message, 'error');
      console.error("Fetch appointments error:", error);
    } finally {
      setLoading(false);
    }
  }, [addToast, currentPage, debouncedSearchTerm, filter]);

  const fetchDropdownData = useCallback(async () => {
    const { data: patientData } = await supabase.from('patients').select('id, name').order('name');
    setPatients(patientData || []);
    const { data: dentistData } = await supabase.from('users').select('id, full_name').eq('role', Role.Dentist).order('full_name');
    setDentists((dentistData as AppUser[]) || []);
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);
  
  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const openModal = (appointment: Appointment | null = null) => {
    if (appointment) {
      setIsEditMode(true);
      setSelectedAppointment(appointment);
      setFormData({
        patient_id: appointment.patient_id,
        dentist_id: appointment.dentist_id,
        start_time: new Date(new Date(appointment.start_time).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16),
        end_time: new Date(new Date(appointment.end_time).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16),
        status: appointment.status,
        notes: appointment.notes,
      });
    } else {
      setIsEditMode(false);
      setSelectedAppointment(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const submissionData = {
      ...formData,
      start_time: new Date(formData.start_time).toISOString(),
      end_time: new Date(formData.end_time).toISOString(),
    };

    let error;
    if (isEditMode && selectedAppointment) {
      ({ error } = await supabase.from('appointments').update(submissionData).eq('id', selectedAppointment.id));
      if (!error) addToast('Appointment updated successfully!', 'success');
    } else {
      ({ error } = await supabase.from('appointments').insert([submissionData]));
      if (!error) {
        addToast('Appointment created successfully!', 'success');
      }
    }
    
    if (error) {
        addToast(`Error: ${error.message}`, 'error');
    } else {
        fetchAppointments();
        closeModal();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (appointmentId: string) => {
    if (window.confirm('Are you sure you want to delete this appointment?')) {
      setActionStates(prev => ({ ...prev, [appointmentId]: true }));
      const { error } = await supabase.from('appointments').delete().eq('id', appointmentId);
      if (error) addToast(`Error deleting appointment: ${error.message}`, 'error');
      else {
        addToast('Appointment deleted successfully.', 'success');
        fetchAppointments();
      }
       setActionStates(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  const getStatusChip = (status: AppointmentStatus) => {
    switch (status) {
        case AppointmentStatus.Scheduled: return 'bg-slate-100 text-slate-800';
        case AppointmentStatus.CheckedIn: return 'bg-blue-100 text-blue-800';
        case AppointmentStatus.Completed: return 'bg-green-100 text-green-800';
        case AppointmentStatus.Canceled: return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Appointments</h1>
        <button onClick={() => openModal()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700">
          <PlusCircle size={20} />
          <span>New Appointment</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md space-y-4">
        <div className="flex space-x-2">
          {(['All', 'Today', 'This Week', 'This Month'] as FilterType[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 text-sm font-medium rounded-full ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" placeholder="Search by patient..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-6 py-3">Date & Time</th><th scope="col" className="px-6 py-3">Patient</th><th scope="col" className="px-6 py-3">Dentist</th><th scope="col" className="px-6 py-3">Status</th><th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonLoader rows={ITEMS_PER_PAGE} columns={5} />
              ) : appointments.length > 0 ? (
                appointments.map(app => (
                  <tr key={app.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                      <div>{new Date(app.start_time).toLocaleDateString()}</div><div className="text-xs text-gray-500">{new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-6 py-4" title={app.notes || 'No notes'}>{app.patients?.name || 'N/A'}</td>
                    <td className="px-6 py-4">{app.users?.full_name || 'N/A'}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusChip(app.status)}`}>{app.status}</span></td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openModal(app)} title="Edit" className="text-blue-500 hover:text-blue-700 disabled:opacity-50" disabled={actionStates[app.id]}><Edit size={18} /></button>
                      <button onClick={() => handleDelete(app.id)} title="Delete" className="text-red-500 hover:text-red-700 disabled:opacity-50" disabled={actionStates[app.id]}>
                        {actionStates[app.id] ? <Loader2 size={18} className="animate-spin"/> : <Trash2 size={18} />}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5}><EmptyState icon={Calendar} message="No appointments found." actionText="Schedule First Appointment" onAction={() => openModal()}/></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalCount={totalCount} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditMode ? 'Edit Appointment' : 'New Appointment'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Patient</label>
              <select name="patient_id" value={formData.patient_id} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                <option value="" disabled>Select a patient</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Dentist</label>
              <select name="dentist_id" value={formData.dentist_id} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                <option value="" disabled>Select a dentist</option>
                {dentists.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium">Start Time</label><input type="datetime-local" name="start_time" value={formData.start_time} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" /></div>
                <div><label className="block text-sm font-medium">End Time</label><input type="datetime-local" name="end_time" value={formData.end_time} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" /></div>
            </div>
            <div><label className="block text-sm font-medium">Status</label><select name="status" value={formData.status} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">{Object.values(AppointmentStatus).map(status => <option key={status} value={status}>{status}</option>)}</select></div>
            <div><label className="block text-sm font-medium">Notes</label><textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" placeholder="e.g., Patient reports toothache..."></textarea></div>
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center disabled:bg-blue-400">
                   {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditMode ? 'Save Changes' : 'Create Appointment'}
                </button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

export default Appointments;
