import React, { useState, useEffect, useCallback } from 'react';
import { Treatment } from '../types';
import { supabase } from '../lib/supabaseClient';
import { PlusCircle, Search, Edit, Trash2, Stethoscope } from 'lucide-react';
import Modal from '../components/Modal';
import { useToast } from '../contexts/ToastContext';
import EmptyState from '../components/EmptyState';
import { Loader2 } from 'lucide-react';
import SkeletonLoader from '../components/SkeletonLoader';
import Pagination from '../components/Pagination';

const initialFormData: Omit<Treatment, 'id' | 'created_at'> = {
  name: '',
  description: '',
  cost: 0,
};

const ITEMS_PER_PAGE = 10;

const Treatments: React.FC = () => {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionStates, setActionStates] = useState<{ [key: string]: boolean }>({});
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null);
  const [formData, setFormData] = useState<Omit<Treatment, 'id' | 'created_at'> | Treatment>(initialFormData);
  const { addToast } = useToast();

  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSearchTerm(searchTerm);
        setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchTreatments = useCallback(async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase.from('treatments').select('*', { count: 'exact' });

      if (debouncedSearchTerm) {
          query = query.ilike('name', `%${debouncedSearchTerm}%`);
      }

      const { data, error, count } = await query
          .order('name', { ascending: true })
          .range(from, to);

      if (error) throw error;
      
      setTreatments((data as Treatment[]) || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      addToast('Error fetching treatments: ' + error.message, 'error');
      console.error("Fetch treatments error:", error);
    } finally {
      setLoading(false);
    }
  }, [addToast, currentPage, debouncedSearchTerm]);

  useEffect(() => {
    fetchTreatments();
  }, [fetchTreatments]);

  const openModal = (treatment: Treatment | null = null) => {
    if (treatment) {
      setIsEditMode(true);
      setSelectedTreatment(treatment);
      setFormData(treatment);
    } else {
      setIsEditMode(false);
      setSelectedTreatment(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'cost' ? parseFloat(value) : value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const submissionData = {
        name: formData.name,
        description: formData.description,
        cost: Number(formData.cost) || 0, // Ensure cost is a valid number, default to 0
    };

    try {
      if (isEditMode && selectedTreatment) {
        const { error } = await supabase.from('treatments').update(submissionData).eq('id', selectedTreatment.id);
        if (error) throw error;
        addToast('Treatment updated successfully!', 'success');
      } else {
        const { error } = await supabase.from('treatments').insert([submissionData]);
        if (error) throw error;
        addToast('Treatment added successfully!', 'success');
      }
      fetchTreatments();
      closeModal();
    } catch (error: any) {
      addToast(`Error: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async (treatmentId: string) => {
    if (window.confirm('Are you sure you want to delete this treatment?')) {
        setActionStates(prev => ({...prev, [treatmentId]: true}));
        try {
            const { error } = await supabase.from('treatments').delete().eq('id', treatmentId);
            if (error) throw error;
            addToast('Treatment deleted successfully.', 'success');
            // If the deleted item was the last on a page, go to the previous page.
            if (treatments.length === 1 && currentPage > 1) {
              setCurrentPage(currentPage - 1);
            } else {
              fetchTreatments();
            }
        } catch(error: any) {
            addToast(`Error deleting treatment: ${error.message}`, 'error');
        } finally {
            setActionStates(prev => ({...prev, [treatmentId]: false}));
        }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Treatments</h1>
        <button onClick={() => openModal()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700">
          <PlusCircle size={20} />
          <span>Add Treatment</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by treatment name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-6 py-3">Name</th>
                <th scope="col" className="px-6 py-3">Description</th>
                <th scope="col" className="px-6 py-3">Cost</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                 <SkeletonLoader rows={ITEMS_PER_PAGE} columns={4} />
              ) : treatments.length > 0 ? (
                treatments.map(treatment => (
                  <tr key={treatment.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{treatment.name}</td>
                    <td className="px-6 py-4 max-w-sm truncate">{treatment.description}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">${treatment.cost.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => openModal(treatment)} className="text-blue-500 hover:text-blue-700 disabled:opacity-50" disabled={actionStates[treatment.id]}><Edit size={18} /></button>
                        <button onClick={() => handleDelete(treatment.id)} className="text-red-500 hover:text-red-700 disabled:opacity-50" disabled={actionStates[treatment.id]}>
                          {actionStates[treatment.id] ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
                     <EmptyState
                        icon={Stethoscope}
                        message={debouncedSearchTerm ? `No treatments found for "${debouncedSearchTerm}"` : "No treatments found."}
                        actionText={!debouncedSearchTerm ? "Add First Treatment" : undefined}
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
      
      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditMode ? 'Edit Treatment' : 'Add Treatment'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Treatment Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea name="description" value={formData.description || ''} onChange={handleInputChange} rows={3} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cost ($)</label>
              <input type="number" step="0.01" name="cost" value={formData.cost} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" />
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center disabled:bg-blue-400">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

export default Treatments;