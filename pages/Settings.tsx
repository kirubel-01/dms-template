import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { Loader2 } from 'lucide-react';

const Settings: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const avatarFileRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();
    
    useEffect(() => {
        if(user) {
            setFullName(user.full_name);
            setEmail(user.email);
        }
    }, [user]);

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!user) return;
        setIsSubmitting(true);

        const { error } = await supabase
            .from('users')
            .update({ full_name: fullName })
            .eq('id', user.id);
        
        if (error) {
            addToast('Error updating profile: ' + error.message, 'error');
        } else {
            addToast('Profile updated successfully!', 'success');
            await refreshUser();
        }
        setIsSubmitting(false);
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0 || !user) {
        return;
      }

      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      setIsUploading(true);

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);

      if (uploadError) {
        addToast(`Error uploading avatar: ${uploadError.message}`, 'error');
        setIsUploading(false);
        return;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicURL = data.publicUrl;

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicURL })
        .eq('id', user.id);
      
      if (updateError) {
        addToast(`Error updating avatar URL: ${updateError.message}`, 'error');
      } else {
        addToast('Avatar updated successfully!', 'success');
        await refreshUser();
      }
      setIsUploading(false);
    };
    
    if (!user) return null;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-2xl mx-auto">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h2>
                <form className="space-y-4" onSubmit={handleProfileUpdate}>
                    <div className="flex items-center space-x-4">
                        <img className="h-20 w-20 rounded-full" src={user.avatar_url} alt="User avatar" />
                        <input type="file" ref={avatarFileRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
                        <button 
                          type="button" 
                          onClick={() => avatarFileRef.current?.click()}
                          disabled={isUploading}
                          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center disabled:opacity-50"
                        >
                           {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                           {isUploading ? 'Uploading...' : 'Change Photo'}
                        </button>
                    </div>
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                        <input type="text" id="name" value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white" />
                    </div>
                     <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                        <input type="email" id="email" value={email} disabled className="mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="pt-2">
                        <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center disabled:bg-blue-400">
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Settings;
