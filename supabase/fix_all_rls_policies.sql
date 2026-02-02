-- =====================================================
-- COMPLETE FIX: All RLS Policies Using Helper Function
-- =====================================================
-- This script fixes ALL RLS policies to avoid infinite recursion
-- by using a SECURITY DEFINER function that bypasses RLS
-- =====================================================

-- Step 1: Create a helper function to get user role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.users
    WHERE id = user_id;
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user creation" ON public.users;
DROP POLICY IF EXISTS "Service role can delete users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view patients" ON public.patients;
DROP POLICY IF EXISTS "Receptionists and Admins can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Receptionists and Admins can update patients" ON public.patients;
DROP POLICY IF EXISTS "Admins can delete patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can view treatments" ON public.treatments;
DROP POLICY IF EXISTS "Dentists and Admins can manage treatments" ON public.treatments;
DROP POLICY IF EXISTS "Authenticated users can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Receptionists and Admins can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Receptionists, Dentists and Admins can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins can delete appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Accountants and Admins can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can view invoice treatments" ON public.invoice_treatments;
DROP POLICY IF EXISTS "Accountants and Admins can manage invoice treatments" ON public.invoice_treatments;
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;
DROP POLICY IF EXISTS "Accountants and Admins can manage payments" ON public.payments;

-- Step 3: Recreate ALL policies using the helper function

-- =====================================================
-- Users table policies
-- =====================================================
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Allow user creation" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can delete users" ON public.users
    FOR DELETE USING (auth.role() = 'service_role');

-- =====================================================
-- Patients table policies
-- =====================================================
CREATE POLICY "Authenticated users can view patients" ON public.patients
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Receptionists and Admins can insert patients" ON public.patients
    FOR INSERT WITH CHECK (
        public.get_user_role(auth.uid()) IN ('Admin', 'Receptionist')
    );

CREATE POLICY "Receptionists and Admins can update patients" ON public.patients
    FOR UPDATE USING (
        public.get_user_role(auth.uid()) IN ('Admin', 'Receptionist')
    );

CREATE POLICY "Admins can delete patients" ON public.patients
    FOR DELETE USING (
        public.get_user_role(auth.uid()) = 'Admin'
    );

-- =====================================================
-- Treatments table policies
-- =====================================================
CREATE POLICY "Authenticated users can view treatments" ON public.treatments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Dentists and Admins can insert treatments" ON public.treatments
    FOR INSERT WITH CHECK (
        public.get_user_role(auth.uid()) IN ('Admin', 'Dentist')
    );

CREATE POLICY "Dentists and Admins can update treatments" ON public.treatments
    FOR UPDATE USING (
        public.get_user_role(auth.uid()) IN ('Admin', 'Dentist')
    );

CREATE POLICY "Dentists and Admins can delete treatments" ON public.treatments
    FOR DELETE USING (
        public.get_user_role(auth.uid()) IN ('Admin', 'Dentist')
    );

-- =====================================================
-- Appointments table policies
-- =====================================================
CREATE POLICY "Authenticated users can view appointments" ON public.appointments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can create appointments" ON public.appointments
    FOR INSERT WITH CHECK (
        public.get_user_role(auth.uid()) IN ('Admin', 'Receptionist', 'Dentist')
    );

CREATE POLICY "Staff can update appointments" ON public.appointments
    FOR UPDATE USING (
        public.get_user_role(auth.uid()) IN ('Admin', 'Receptionist', 'Dentist')
    );

CREATE POLICY "Admins can delete appointments" ON public.appointments
    FOR DELETE USING (
        public.get_user_role(auth.uid()) = 'Admin'
    );

-- =====================================================
-- Invoices table policies
-- =====================================================
CREATE POLICY "Authenticated users can view invoices" ON public.invoices
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants and Admins can insert invoices" ON public.invoices
    FOR INSERT WITH CHECK (
        public.get_user_role(auth.uid()) IN ('Admin', 'Accountant')
    );

CREATE POLICY "Accountants and Admins can update invoices" ON public.invoices
    FOR UPDATE USING (
        public.get_user_role(auth.uid()) IN ('Admin', 'Accountant')
    );

CREATE POLICY "Accountants and Admins can delete invoices" ON public.invoices
    FOR DELETE USING (
        public.get_user_role(auth.uid()) IN ('Admin', 'Accountant')
    );

-- =====================================================
-- Invoice Treatments table policies
-- =====================================================
CREATE POLICY "Authenticated users can view invoice treatments" ON public.invoice_treatments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants and Admins can insert invoice treatments" ON public.invoice_treatments
    FOR INSERT WITH CHECK (
        public.get_user_role(auth.uid()) IN ('Admin', 'Accountant')
    );

CREATE POLICY "Accountants and Admins can update invoice treatments" ON public.invoice_treatments
    FOR UPDATE USING (
        public.get_user_role(auth.uid()) IN ('Admin', 'Accountant')
    );

CREATE POLICY "Accountants and Admins can delete invoice treatments" ON public.invoice_treatments
    FOR DELETE USING (
        public.get_user_role(auth.uid()) IN ('Admin', 'Accountant')
    );

-- =====================================================
-- Payments table policies
-- =====================================================
CREATE POLICY "Authenticated users can view payments" ON public.payments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants and Admins can insert payments" ON public.payments
    FOR INSERT WITH CHECK (
        public.get_user_role(auth.uid()) IN ('Admin', 'Accountant')
    );

CREATE POLICY "Accountants and Admins can update payments" ON public.payments
    FOR UPDATE USING (
        public.get_user_role(auth.uid()) IN ('Admin', 'Accountant')
    );

CREATE POLICY "Accountants and Admins can delete payments" ON public.payments
    FOR DELETE USING (
        public.get_user_role(auth.uid()) IN ('Admin', 'Accountant')
    );

-- =====================================================
-- Verification
-- =====================================================
-- Check that all policies are created correctly
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
