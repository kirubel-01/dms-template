-- =====================================================
-- QUICK FIX: Resolve RLS Infinite Recursion Issue
-- =====================================================
-- This script fixes the "infinite recursion detected in policy for relation users" error
-- You can run this on your existing database without recreating everything
-- =====================================================

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Admins can do everything with users" ON public.users;

-- Recreate the users policies without recursion
-- The issue was that the "Admins can do everything" policy was querying public.users
-- to check if someone is an admin, which creates a circular dependency

-- Allow all authenticated users to view all users (no recursion)
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (auth.role() = 'authenticated');

-- Users can update their own profile (already existed, recreating for completeness)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Allow INSERT for new user creation (handled by handle_new_user trigger)
DROP POLICY IF EXISTS "Allow user creation" ON public.users;
CREATE POLICY "Allow user creation" ON public.users
    FOR INSERT WITH CHECK (true);

-- Only allow DELETE for service_role (admins should use Supabase Dashboard)
DROP POLICY IF EXISTS "Service role can delete users" ON public.users;
CREATE POLICY "Service role can delete users" ON public.users
    FOR DELETE USING (auth.role() = 'service_role');

-- Verification: Check that all policies are created correctly
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
