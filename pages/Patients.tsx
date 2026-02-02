import React, { useState, useEffect, useCallback } from 'react';
import { Patient, PatientAppointment, Invoice } from '../types';
import { supabase } from '../lib/supabaseClient';
import { PlusCircle, Search, Edit, Trash2, Users, Download, History, Wallet, Calendar } from 'lucide-react';
import Modal from '../components/Modal';
import { useToast } from '../contexts/ToastContext';
import EmptyState from '../components/EmptyState';
import { Loader2 } from 'lucide-react';
import SkeletonLoader from '../components/SkeletonLoader';
import Pagination from '../components/Pagination';

const initialFormData: Omit<Patient, 'id' | 'created_at'> = {
  name: '',
  dob: '',
  phone: '',
  email: '',
  address: '',
  medical_history: '',
};

const ITEMS_PER_PAGE = 10;

const Patients: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionStates, setActionStates] = useState<{ [key: string]: boolean }>({});
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const { addToast } = useToast();

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [appointmentHistory, setAppointmentHistory] = useState<PatientAppointment[]>([]);
  const [billingHistory, setBillingHistory] = useState<Invoice[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [patientForHistory, setPatientForHistory] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<'appointments' | 'billing'>('appointments');

  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSearchTerm(searchTerm);
        setCurrentPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase.from('patients').select('*', { count: 'exact' });

      if (debouncedSearchTerm) {
          query = query.or(`name.ilike.%${debouncedSearchTerm}%,email.ilike.%${debouncedSearchTerm}%,phone.ilike.%${debouncedSearchTerm}%`);
      }

      const { data, error, count } = await query
          .order('name', { ascending: true })
          .range(from, to);

      if (error) throw error;
      
      setPatients((data as Patient[]) || []);
      setTotalCount(count || 0);

    } catch (error: any) {
      addToast('Error fetching patients: ' + error.message, 'error');
      console.error("Fetch patients error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, addToast]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleViewHistory = async (patient: Patient) => {
    setPatientForHistory(patient);
    setIsHistoryModalOpen(true);
    setIsHistoryLoading(true);
    setAppointmentHistory([]);
    setBillingHistory([]);
    setActiveTab('appointments');
    try {
      const [appointmentsRes, invoicesRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, users(full_name)')
          .eq('patient_id', patient.id)
          .order('start_time', { ascending: false }),
        supabase
          .from('invoices')
          .select('*, payments(*)')
          .eq('patient_id', patient.id)
          .order('issue_date', { ascending: false })
      ]);
    
      if (appointmentsRes.error) throw appointmentsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;

      setAppointmentHistory((appointmentsRes.data as any) || []);
      setBillingHistory((invoicesRes.data as any) || []);

    } catch (error: any) {
      addToast(`Error fetching history: ${error.message}`, 'error');
      console.error("Fetch history error:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const openModal = (patient: Patient | null = null) => {
    if (patient) {
      setIsEditMode(true);
      setSelectedPatient(patient);
      setFormData(patient);
    } else {
      setIsEditMode(false);
      setSelectedPatient(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (isEditMode && selectedPatient) {
      const { error } = await supabase.from('patients').update(formData).eq('id', selectedPatient.id);
      if (error) {
          addToast(`Error updating patient: ${error.message}`, 'error');
      } else {
        addToast('Patient updated successfully!', 'success');
        fetchPatients();
        closeModal();
      }
    } else {
      const { error } = await supabase.from('patients').insert([formData]);
      if (error) {
          addToast(`Error adding patient: ${error.message}`, 'error');
      } else {
        addToast('Patient added successfully!', 'success');
        fetchPatients();
        closeModal();
      }
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (patientId: string) => {
    if (window.confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
      setActionStates(prev => ({ ...prev, [patientId]: true }));
      const { error } = await supabase.from('patients').delete().eq('id', patientId);
      if (error) addToast(`Error deleting patient: ${error.message}`, 'error');
      else {
        addToast('Patient deleted successfully.', 'success');
        fetchPatients();
      }
      setActionStates(prev => ({ ...prev, [patientId]: false }));
    }
  };

  const handleExport = async () => {
    setActionStates(prev => ({ ...prev, export: true }));
    addToast('Preparing export...', 'info');
    const { data, error } = await supabase.from('patients').select('*').order('name');
    
    if (error) {
      addToast(`Export failed: ${error.message}`, 'error');
    } else if (data) {
      const headers = ['ID', 'Name', 'Date of Birth', 'Phone', 'Email', 'Address', 'Medical History', 'Created At'];
      const headerKeys = ['id', 'name', 'dob', 'phone', 'email', 'address', 'medical_history', 'created_at'];
      
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headerKeys.map(key => {
            const value = (row as any)[key];
            return `"${String(value || '').replace(/"/g, '""')}"`;
          }).join(',')
        )
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'patients_export.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast('Patients exported successfully!', 'success');
    }
    setActionStates(prev => ({ ...prev, export: false }));
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Patients</h1>
        <div className="flex items-center space-x-2">
            <button onClick={handleExport} disabled={actionStates.export} className="bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-700 transition-colors disabled:opacity-50">
                {actionStates.export ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                <span>Export CSV</span>
            </button>
            <button onClick={() => openModal()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors">
              <PlusCircle size={20} />
              <span>Add Patient</span>
            </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-6 py-3">Name</th>
                <th scope="col" className="px-6 py-3">Contact</th>
                <th scope="col" className="px-6 py-3">Date of Birth</th>
                <th scope="col" className="px-6 py-3">Member Since</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonLoader rows={ITEMS_PER_PAGE} columns={5} />
              ) : patients.length > 0 ? (
                patients.map(patient => (
                  <tr key={patient.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{patient.name}</td>
                    <td className="px-6 py-4">
                        <div>{patient.email || '-'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{patient.phone}</div>
                    </td>
                    <td className="px-6 py-4">{patient.dob}</td>
                    <td className="px-6 py-4">{new Date(patient.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => handleViewHistory(patient)} title="View History" className="text-gray-500 hover:text-gray-700 p-1 rounded-full disabled:opacity-50" disabled={actionStates[patient.id]}>
                            <History size={18} />
                        </button>
                        <button onClick={() => openModal(patient)} title="Edit Patient" className="text-blue-500 hover:text-blue-700 p-1 rounded-full disabled:opacity-50" disabled={actionStates[patient.id]}>
                            <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(patient.id)} title="Delete Patient" className="text-red-500 hover:text-red-700 p-1 rounded-full disabled:opacity-50" disabled={actionStates[patient.id]}>
                            {actionStates[patient.id] ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={Users}
                      message={debouncedSearchTerm ? `No patients found for "${debouncedSearchTerm}"` : "No patients found."}
                      actionText={!debouncedSearchTerm ? "Add First Patient" : undefined}
                      onAction={!debouncedSearchTerm ? () => openModal() : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
         <Pagination currentPage={currentPage} totalCount={totalCount} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditMode ? 'Edit Patient' : 'Add New Patient'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth</label>
                    <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" />
                </div>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email (Optional)</label>
                <input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" />
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                <input type="text" name="address" value={formData.address} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Medical History</label>
                <textarea name="medical_history" value={formData.medical_history} onChange={handleInputChange} rows={3} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" />
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center disabled:bg-blue-400">
                   {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditMode ? 'Save Changes' : 'Create Patient'}
                </button>
            </div>
        </form>
      </Modal>

      <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title={`History for ${patientForHistory?.name}`}>
        {isHistoryLoading ? (
          <div className="flex justify-center items-center p-8"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
        ) : (
          <div>
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                <button onClick={() => setActiveTab('appointments')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === 'appointments' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                  <Calendar size={16} className="mr-2" /> Appointments ({appointmentHistory.length})
                </button>
                <button onClick={() => setActiveTab('billing')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === 'billing' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                   <Wallet size={16} className="mr-2" /> Billing ({billingHistory.length})
                </button>
              </nav>
            </div>
            <div className="pt-4">
              {activeTab === 'appointments' && (
                appointmentHistory.length > 0 ? (
                  <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700/50"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Dentist</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Notes</th></tr></thead><tbody className="text-gray-700 dark:text-gray-300">{appointmentHistory.map(app => (<tr key={app.id} className="border-b dark:border-gray-700"><td className="px-4 py-3 whitespace-nowrap">{new Date(app.start_time).toLocaleString()}</td><td className="px-4 py-3">{app.users?.full_name || 'N/A'}</td><td className="px-4 py-3">{app.status}</td><td className="px-4 py-3 truncate max-w-xs">{app.notes || 'N/A'}</td></tr>))}</tbody></table></div>
                ) : <p className="text-center py-8 text-gray-500">No appointment history found.</p>
              )}
              {activeTab === 'billing' && (
                billingHistory.length > 0 ? (
                  <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700/50"><tr><th className="px-4 py-2">Invoice ID</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Amount</th><th className="px-4 py-2">Status</th></tr></thead><tbody className="text-gray-700 dark:text-gray-300">{billingHistory.map(inv => (<tr key={inv.id} className="border-b dark:border-gray-700"><td className="px-4 py-3 font-mono text-xs">{inv.id.substring(0,8)}...</td><td className="px-4 py-3 whitespace-nowrap">{new Date(inv.issue_date).toLocaleDateString()}</td><td className="px-4 py-3">${inv.amount.toFixed(2)}</td><td className="px-4 py-3">{inv.status}</td></tr>))}</tbody></table></div>
                ) : <p className="text-center py-8 text-gray-500">No billing history found.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Patients;