import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { AppUser } from '../types';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to fetch user profile
const getUserProfile = async (session: Session | null): Promise<AppUser | null> => {
  if (!session?.user) {
    return null;
  }

  const { data: userProfile, error } = await supabase
    .from('users')
    .select('full_name, role, avatar_url')
    .eq('id', session.user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Error fetching user profile:", error);
    return null;
  }

  if (userProfile) {
    return {
      id: session.user.id,
      email: session.user.email!,
      ...userProfile,
    } as AppUser;
  }

  // User exists in auth but not in our profiles table
  return null;
};


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set a timeout to stop loading after 5 seconds
    // This prevents infinite loading if database isn't initialized
    const timeoutId = setTimeout(() => {
      console.warn('Auth timeout: stopping loading state after 5 seconds');
      setLoading(false);
    }, 5000);

    // onAuthStateChange fires on init and on every auth event.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        clearTimeout(timeoutId); // Clear timeout since we got a response
        setSession(session);
        const profile = await getUserProfile(session);
        setUser(profile);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(timeoutId);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const profile = await getUserProfile(session);
    setUser(profile);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
