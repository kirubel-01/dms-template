import React, { useState, useEffect, useCallback } from 'react';
import { AppUser, Role } from '../types';
import { supabase } from '../lib/supabaseClient';
import { PlusCircle, Search, Edit, Trash2, User as UserIcon } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from '../components/EmptyState';
import { Loader2 } from 'lucide-react';
import PasswordStrength from '../components/PasswordStrength';
import SkeletonLoader from '../components/SkeletonLoader';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 10;

const Staff: React.FC = () => {
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionStates, setActionStates] = useState<{ [key: string]: boolean }>({});

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const { user: adminUser } = useAuth();

  const [addFormData, setAddFormData] = useState({ fullName: '', email: '', password: '', role: Role.Receptionist });
  const [editFormData, setEditFormData] = useState({ fullName: '', role: Role.Receptionist });
  
  const { addToast } = useToast();
  
  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSearchTerm(searchTerm);
        setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase.from('users').select('*', { count: 'exact' });

      if (debouncedSearchTerm) {
          query = query.or(`full_name.ilike.%${debouncedSearchTerm}%,email.ilike.%${debouncedSearchTerm}%,role.ilike.%${debouncedSearchTerm}%`);
      }

      const { data, error, count } = await query
          .order('full_name', { ascending: true })
          .range(from, to);

      if (error) throw error;
      
      setStaff((data as AppUser[]) || []);
      setTotalCount(count || 0);

    } catch (error: any) {
      addToast('Error fetching staff: ' + error.message, 'error');
      console.error("Fetch staff error:", error);
    } finally {
      setLoading(false);
    }
  }, [addToast, currentPage, debouncedSearchTerm]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);
  
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: addFormData.email,
        password: addFormData.password,
        options: { data: { full_name: addFormData.fullName, role: addFormData.role, avatar_url: `https://api.dicebear.com/8.x/initials/svg?seed=${addFormData.fullName}` } }
      });
      if (authError) throw authError;

      if (authData.user) {
        addToast('Staff member created! They must confirm their email to log in.', 'success');
        setIsAddModalOpen(false);
        setAddFormData({ fullName: '', email: '', password: '', role: Role.Receptionist });
        fetchStaff();
      }
    } catch (error: any) {
      addToast(`Error creating staff: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('users').update({ full_name: editFormData.fullName, role: editFormData.role }).eq('id', selectedUser.id);
      if(error) throw error;
      
      addToast('Staff member updated successfully!', 'success');
      setIsEditModalOpen(false);
      fetchStaff();
    } catch (error: any) {
      addToast(`Error updating staff: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = async (userId: string) => {
    if (adminUser?.id === userId) {
      addToast("You cannot delete your own account.", 'error');
      return;
    }
    if (window.confirm('Are you sure you want to permanently delete this staff member? This cannot be undone.')) {
      setActionStates(prev => ({ ...prev, [userId]: true }));
      try {
        // This requires a Supabase Edge Function named 'delete-user' to securely handle user deletion.
        const { error } = await supabase.functions.invoke('delete-user', { body: { user_id: userId } });
        if (error) throw new Error(error.message);
        addToast('Staff member deleted successfully.', 'success');
        fetchStaff();
      } catch (error: any) {
        addToast(`Error deleting staff: ${error.message}. Ensure the 'delete-user' Edge Function is deployed.`, 'error');
      } finally {
        setActionStates(prev => ({ ...prev, [userId]: false }));
      }
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedUser || !selectedUser.email) return;
    setActionStates(prev => ({ ...prev, passwordReset: true }));
    const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email);
    if (error) addToast(`Error sending password reset: ${error.message}`, 'error');
    else {
        addToast(`Password reset link sent to ${selectedUser.email}.`, 'success');
        setIsEditModalOpen(false);
    }
    setActionStates(prev => ({ ...prev, passwordReset: false }));
  };

  const openEditModal = (user: AppUser) => {
    setSelectedUser(user);
    setEditFormData({ fullName: user.full_name, role: user.role });
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Staff Management</h1>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700">
          <PlusCircle size={20} /><span>Add Staff</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" placeholder="Search by name, email, or role..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-6 py-3">Name</th><th scope="col" className="px-6 py-3">Email</th><th scope="col" className="px-6 py-3">Role</th><th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonLoader rows={ITEMS_PER_PAGE} columns={4} />
              ) : staff.length > 0 ? (
                staff.map(user => (
                  <tr key={user.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white flex items-center">
                        <img src={user.avatar_url} alt={user.full_name} className="w-10 h-10 rounded-full mr-4 object-cover"/>{user.full_name}
                    </td>
                    <td className="px-6 py-4">{user.email}</td><td className="px-6 py-4">{user.role}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => openEditModal(user)} className="text-blue-500 hover:text-blue-700 disabled:opacity-50" disabled={actionStates[user.id]}><Edit size={18} /></button>
                        <button disabled={adminUser?.id === user.id || actionStates[user.id]} onClick={() => handleDeleteStaff(user.id)} className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed">
                          {actionStates[user.id] ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4}><EmptyState icon={UserIcon} message={debouncedSearchTerm ? `No staff found for "${debouncedSearchTerm}"` : "No staff members found."} actionText={!debouncedSearchTerm ? "Add First Staff Member" : undefined} onAction={!debouncedSearchTerm ? () => setIsAddModalOpen(true) : undefined} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalCount={totalCount} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
      </div>

       <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Staff Member">
          <form onSubmit={handleAddStaff} className="space-y-4">
              <div><label className="block text-sm font-medium">Full Name</label><input type="text" required value={addFormData.fullName} onChange={e => setAddFormData({...addFormData, fullName: e.target.value})} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" /></div>
              <div><label className="block text-sm font-medium">Email</label><input type="email" required value={addFormData.email} onChange={e => setAddFormData({...addFormData, email: e.target.value})} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" /></div>
              <div><label className="block text-sm font-medium">Password</label><input type="password" required value={addFormData.password} onChange={e => setAddFormData({...addFormData, password: e.target.value})} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" /><PasswordStrength password={addFormData.password} /></div>
              <div><label className="block text-sm font-medium">Role</label><select value={addFormData.role} onChange={e => setAddFormData({...addFormData, role: e.target.value as Role})} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">{Object.values(Role).map(role => <option key={role} value={role}>{role}</option>)}</select></div>
              <div className="flex justify-end pt-4 space-x-2">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center disabled:bg-blue-400">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create</button>
              </div>
          </form>
       </Modal>
       
       <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Staff Member">
          <form onSubmit={handleUpdateStaff} className="space-y-4">
              <div><label className="block text-sm font-medium">Full Name</label><input type="text" required value={editFormData.fullName} onChange={e => setEditFormData({...editFormData, fullName: e.target.value})} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" /></div>
              <div><label className="block text-sm font-medium">Email</label><input type="email" disabled value={selectedUser?.email || ''} className="mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-gray-600 border rounded-md text-gray-500" /></div>
              <div><label className="block text-sm font-medium">Role</label><select value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value as Role})} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">{Object.values(Role).map(role => <option key={role} value={role}>{role}</option>)}</select></div>
              <div className="flex justify-end pt-4 space-x-2">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center disabled:bg-blue-400">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</button>
              </div>
          </form>
           <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-md font-semibold">Password Management</h3><p className="text-sm text-gray-500 mt-1">Send the user a password reset link.</p>
            <button type="button" onClick={handlePasswordReset} disabled={actionStates.passwordReset} className="mt-3 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 flex items-center disabled:bg-yellow-300">
                {actionStates.passwordReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send Reset Link
            </button>
        </div>
       </Modal>
    </div>
  );
};

export default Staff;