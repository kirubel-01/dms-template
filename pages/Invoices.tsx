import React, { useState, useEffect, useCallback } from 'react';
import { Invoice, InvoiceStatus, AppointmentStatus, Treatment } from '../types';
import { supabase } from '../lib/supabaseClient';
import { PlusCircle, Search, Eye, DollarSign, FileText } from 'lucide-react';
import Modal from '../components/Modal';
import { useToast } from '../contexts/ToastContext';
import EmptyState from '../components/EmptyState';
import { Loader2 } from 'lucide-react';
import InvoiceDetailModal from '../components/InvoiceDetailModal';
import SkeletonLoader from '../components/SkeletonLoader';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 10;

interface UninvoicedAppointment {
  id: string;
  start_time: string;
  patient_id: string;
  patient_name: string;
  notes: string;
}

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [availableAppointments, setAvailableAppointments] = useState<UninvoicedAppointment[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceFormData, setInvoiceFormData] = useState({ appointment_id: '', amount: 0, issue_date: new Date().toISOString().split('T')[0], due_date: '' });
  const [selectedTreatments, setSelectedTreatments] = useState<Treatment[]>([]);
  const [paymentFormData, setPaymentFormData] = useState({ amount: 0, payment_date: new Date().toISOString().split('T')[0], method: 'Card' as 'Cash' | 'Card' | 'Transfer' });
  const { addToast } = useToast();

  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSearchTerm(searchTerm);
        setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase.from('invoices').select('*, patients(name)', { count: 'exact' });

      if (debouncedSearchTerm) {
        query = query.ilike('patients.name', `%${debouncedSearchTerm}%`);
      }

      const { data, error, count } = await query
        .order('issue_date', { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      setInvoices((data as any) || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      addToast('Error fetching invoices: ' + error.message, 'error');
      console.error("Fetch invoices error:", error);
    } finally {
      setLoading(false);
    }
  }, [addToast, currentPage, debouncedSearchTerm]);
  
  const fetchSupportingData = useCallback(async () => {
    try {
      const [appointmentsRes, treatmentsRes] = await Promise.all([
        supabase.rpc('get_appointments_without_invoice'),
        supabase.from('treatments').select('*').order('name'),
      ]);
      if (appointmentsRes.error) throw appointmentsRes.error;
      if (treatmentsRes.error) throw treatmentsRes.error;
      setAvailableAppointments(appointmentsRes.data || []);
      setTreatments(treatmentsRes.data || []);
    } catch (error: any) {
      addToast("Error fetching data for invoice creation: " + error.message, 'error');
      console.error("Fetch available appointments error:", error);
    }
  }, [addToast]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);
  
  useEffect(() => {
    if (isCreateModalOpen) {
      fetchSupportingData();
    }
  }, [isCreateModalOpen, fetchSupportingData]);

  useEffect(() => {
    const totalCost = selectedTreatments.reduce((sum, t) => sum + t.cost, 0);
    setInvoiceFormData(prev => ({ ...prev, amount: totalCost }));
  }, [selectedTreatments]);

  const openCreateModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 14); // Due in 14 days
    setInvoiceFormData({ appointment_id: '', amount: 0, issue_date: new Date().toISOString().split('T')[0], due_date: tomorrow.toISOString().split('T')[0] });
    setSelectedTreatments([]);
    setIsCreateModalOpen(true);
  }
  const closeCreateModal = () => setIsCreateModalOpen(false);

  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const remainingBalance = invoice.amount - (invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0);
    setPaymentFormData({ ...paymentFormData, amount: remainingBalance > 0 ? remainingBalance : invoice.amount });
    setIsPaymentModalOpen(true);
  };
  const closePaymentModal = () => setIsPaymentModalOpen(false);

  const handleViewInvoice = async (invoice: Invoice) => {
    try {
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('payment_date');

      if (paymentsError) throw paymentsError;

      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', invoice.appointment_id)
        .single();
      
      if (appointmentError && appointmentError.code !== 'PGRST116') {
        throw appointmentError;
      }

      setSelectedInvoice({ 
        ...invoice, 
        payments: payments || [], 
        appointments: appointmentData as any
      });
      setIsDetailModalOpen(true);

    } catch (error: any) {
      addToast('Could not fetch invoice details: ' + error.message, 'error');
      console.error("Error fetching invoice details:", error);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const selectedApp = availableAppointments.find(app => app.id === invoiceFormData.appointment_id);
    if (!selectedApp) {
      addToast('Please select a valid appointment', 'error');
      setIsSubmitting(false);
      return;
    }
    
    const invoiceData = {
      ...invoiceFormData,
      patient_id: selectedApp.patient_id,
      status: InvoiceStatus.Unpaid,
      amount: Number(invoiceFormData.amount) || 0,
    };

    const { error } = await supabase.from('invoices').insert([invoiceData]);

    if (error) {
        addToast(`Error creating invoice: ${error.message}`, 'error');
    } else {
      addToast('Invoice created successfully!', 'success');
      
      if(selectedTreatments.length > 0) {
        const treatmentsText = selectedTreatments.map(t => `- ${t.name}: $${t.cost.toFixed(2)}`).join('\n');
        const newNotes = `${selectedApp.notes || ''}\n\n---BILLED TREATMENTS---\n${treatmentsText}`;
        await supabase.from('appointments').update({ notes: newNotes }).eq('id', selectedApp.id);
      }
      
      fetchInvoices();
      closeCreateModal();
    }
    setIsSubmitting(false);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setIsSubmitting(true);

    const paymentData = {
        invoice_id: selectedInvoice.id,
        ...paymentFormData,
        amount: Number(paymentFormData.amount) || 0,
    };

    const { error: paymentError } = await supabase.from('payments').insert([paymentData]);
    if (paymentError) {
      addToast(`Error recording payment: ${paymentError.message}`, 'error');
      setIsSubmitting(false);
      return;
    }
    
    const { data: allPayments } = await supabase.from('payments').select('amount').eq('invoice_id', selectedInvoice.id);
    const totalPaid = allPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const newStatus = totalPaid >= selectedInvoice.amount ? InvoiceStatus.Paid : InvoiceStatus.Unpaid;
    const { error: invoiceError } = await supabase.from('invoices').update({ status: newStatus }).eq('id', selectedInvoice.id);

    if (invoiceError) addToast(`Payment recorded, but failed to update status: ${invoiceError.message}`, 'error');
    else addToast('Payment recorded successfully!', 'success');

    fetchInvoices();
    closePaymentModal();
    setIsSubmitting(false);
  };
  
  const handleTreatmentToggle = (treatment: Treatment) => {
    setSelectedTreatments(prev => 
      prev.some(t => t.id === treatment.id)
        ? prev.filter(t => t.id !== treatment.id)
        : [...prev, treatment]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Invoices & Payments</h1>
        <button onClick={openCreateModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700">
          <PlusCircle size={20} /><span>Create Invoice</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" placeholder="Search by patient name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-6 py-3">Invoice ID</th><th scope="col" className="px-6 py-3">Patient</th><th scope="col" className="px-6 py-3">Amount</th><th scope="col" className="px-6 py-3">Issue Date</th><th scope="col" className="px-6 py-3">Due Date</th><th scope="col" className="px-6 py-3">Status</th><th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonLoader rows={ITEMS_PER_PAGE} columns={7} />
              ) : invoices.length > 0 ? (
                invoices.map(inv => (
                  <tr key={inv.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="px-6 py-4 font-mono text-xs text-gray-900 dark:text-white">{inv.id.substring(0,8)}...</td>
                    <td className="px-6 py-4">{inv.patients?.name || 'N/A'}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">${inv.amount.toFixed(2)}</td>
                    <td className="px-6 py-4">{new Date(inv.issue_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">{new Date(inv.due_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${ inv.status === 'Paid' ? 'bg-green-100 text-green-800' : inv.status === 'Unpaid' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{inv.status}</span></td>
                    <td className="px-6 py-4 text-right space-x-4">
                        <button disabled={inv.status === 'Paid'} onClick={() => openPaymentModal(inv)} title="Record Payment" className="text-green-500 hover:text-green-700 disabled:text-gray-400 disabled:cursor-not-allowed"><DollarSign size={18} /></button>
                        <button onClick={() => handleViewInvoice(inv)} title="View Invoice" className="text-blue-500 hover:text-blue-700"><Eye size={18} /></button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7}><EmptyState icon={FileText} message="No invoices found." actionText="Create First Invoice" onAction={openCreateModal} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalCount={totalCount} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
      </div>
      
      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title="Create Invoice from Appointment">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div><label className="block text-sm font-medium">Completed Appointment</label><select required value={invoiceFormData.appointment_id} onChange={e => setInvoiceFormData(prev => ({ ...prev, appointment_id: e.target.value }))} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"><option value="" disabled>Select an appointment</option>{availableAppointments.map(p => <option key={p.id} value={p.id}>{`${new Date(p.start_time).toLocaleDateString()} - ${p.patient_name}`}</option>)}</select></div>
          <div>
            <label className="block text-sm font-medium">Treatments</label>
            <div className="mt-2 border rounded-md max-h-40 overflow-y-auto p-2 space-y-1 bg-slate-50 dark:bg-gray-700/50">
              {treatments.length > 0 ? treatments.map(treatment => (
                <div key={treatment.id} className="flex items-center">
                  <input id={`treatment-${treatment.id}`} type="checkbox" checked={selectedTreatments.some(t => t.id === treatment.id)} onChange={() => handleTreatmentToggle(treatment)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <label htmlFor={`treatment-${treatment.id}`} className="ml-3 flex justify-between w-full text-sm text-gray-700 dark:text-gray-300">
                    <span>{treatment.name}</span>
                    <span>${treatment.cost.toFixed(2)}</span>
                  </label>
                </div>
              )) : <p className="text-xs text-center text-gray-500">No treatments found.</p>}
            </div>
          </div>
          <div><label className="block text-sm font-medium">Total Amount</label><input type="number" step="0.01" required value={invoiceFormData.amount} onChange={e => setInvoiceFormData({...invoiceFormData, amount: parseFloat(e.target.value)})} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium">Issue Date</label><input type="date" required value={invoiceFormData.issue_date} onChange={e => setInvoiceFormData({...invoiceFormData, issue_date: e.target.value})} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" /></div>
            <div><label className="block text-sm font-medium">Due Date</label><input type="date" required value={invoiceFormData.due_date} onChange={e => setInvoiceFormData({...invoiceFormData, due_date: e.target.value})} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" /></div>
          </div>
          <div className="flex justify-end pt-4 space-x-2">
            <button type="button" onClick={closeCreateModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg dark:bg-gray-600 dark:text-gray-200">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center disabled:bg-blue-400">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPaymentModalOpen} onClose={closePaymentModal} title={`Record Payment for Invoice ${selectedInvoice?.id.substring(0,8)}...`}>
        <form onSubmit={handleRecordPayment} className="space-y-4">
            <div><label className="block text-sm font-medium">Payment Amount</label><input type="number" step="0.01" required value={paymentFormData.amount} onChange={e => setPaymentFormData({...paymentFormData, amount: parseFloat(e.target.value)})} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" /></div>
            <div><label className="block text-sm font-medium">Payment Date</label><input type="date" required value={paymentFormData.payment_date} onChange={e => setPaymentFormData({...paymentFormData, payment_date: e.target.value})} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" /></div>
            <div><label className="block text-sm font-medium">Payment Method</label><select value={paymentFormData.method} onChange={e => setPaymentFormData({...paymentFormData, method: e.target.value as any})} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"><option>Card</option><option>Cash</option><option>Transfer</option></select></div>
            <div className="flex justify-end pt-4 space-x-2">
              <button type="button" onClick={closePaymentModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg dark:bg-gray-600 dark:text-gray-200">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center disabled:bg-green-400">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record Payment</button>
            </div>
        </form>
      </Modal>

      {selectedInvoice && (<InvoiceDetailModal invoice={selectedInvoice} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} />)}
    </div>
  );
};

export default Invoices;