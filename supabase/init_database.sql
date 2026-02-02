-- =====================================================
-- DentalOS Database Initialization Script (v2)
-- =====================================================
-- This script will:
-- 1. Drop ALL existing tables (including backups and old tables)
-- 2. Create all necessary tables
-- 3. Set up admin user (admin@clinic.com / KingKira16)
-- 4. Configure Row Level Security (RLS)
-- 5. Create necessary functions and triggers
-- =====================================================

-- =====================================================
-- STEP 1: Clean up existing database
-- =====================================================

-- Drop existing tables (cascade to remove dependencies)
-- We use CASCADE to ensure all dependent objects (keys, constraints) are also removed
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.invoice_treatments CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE; -- Drop potential old table
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.treatments CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop backup tables that might be causing RLS warnings
DROP TABLE IF EXISTS public.backup_public_users CASCADE;
DROP TABLE IF EXISTS public.backup_auth_users CASCADE;

-- Drop existing functions to ensure clean slate
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- =====================================================
-- STEP 2: Create tables
-- =====================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Receptionist', 'Dentist', 'Accountant')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients table
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    dob DATE NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    medical_history TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Treatments table
CREATE TABLE public.treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    cost DECIMAL(10, 2) NOT NULL CHECK (cost >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments table
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    dentist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Scheduled', 'Completed', 'Canceled', 'Checked In')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Invoices table
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Paid', 'Unpaid', 'Overdue')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_due_date CHECK (due_date >= issue_date)
);

-- Invoice Treatments junction table
CREATE TABLE public.invoice_treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    method TEXT NOT NULL CHECK (method IN ('Cash', 'Card', 'Transfer')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 3: Create indexes for better performance
-- =====================================================

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_patients_name ON public.patients(name);
CREATE INDEX idx_patients_phone ON public.patients(phone);
CREATE INDEX idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX idx_appointments_dentist_id ON public.appointments(dentist_id);
CREATE INDEX idx_appointments_start_time ON public.appointments(start_time);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_invoices_patient_id ON public.invoices(patient_id);
CREATE INDEX idx_invoices_appointment_id ON public.invoices(appointment_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX idx_invoice_treatments_invoice_id ON public.invoice_treatments(invoice_id);
CREATE INDEX idx_invoice_treatments_treatment_id ON public.invoice_treatments(treatment_id);

-- =====================================================
-- STEP 4: Create functions and triggers
-- =====================================================

-- Function to automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, full_name, email, role, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'Receptionist'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/8.x/initials/svg?seed=' || COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_treatments_updated_at BEFORE UPDATE ON public.treatments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 5: Enable Row Level Security (RLS)
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 6: Create RLS Policies
-- =====================================================

-- Users policies
-- Note: We allow all authenticated users to view all users to avoid recursion
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (auth.role() = 'authenticated');

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Allow INSERT for new user creation (handled by handle_new_user trigger)
-- This is permissive because user creation is controlled by Supabase Auth
CREATE POLICY "Allow user creation" ON public.users
    FOR INSERT WITH CHECK (true);

-- Only allow DELETE for service_role (admins should use Supabase Dashboard)
CREATE POLICY "Service role can delete users" ON public.users
    FOR DELETE USING (auth.role() = 'service_role');

-- Patients policies
CREATE POLICY "Authenticated users can view patients" ON public.patients
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Receptionists and Admins can insert patients" ON public.patients
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('Admin', 'Receptionist')
        )
    );

CREATE POLICY "Receptionists and Admins can update patients" ON public.patients
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('Admin', 'Receptionist')
        )
    );

CREATE POLICY "Admins can delete patients" ON public.patients
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'Admin'
        )
    );

-- Treatments policies
CREATE POLICY "Authenticated users can view treatments" ON public.treatments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Dentists and Admins can manage treatments" ON public.treatments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('Admin', 'Dentist')
        )
    );

-- Appointments policies
CREATE POLICY "Authenticated users can view appointments" ON public.appointments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Receptionists and Admins can create appointments" ON public.appointments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('Admin', 'Receptionist', 'Dentist')
        )
    );

CREATE POLICY "Receptionists, Dentists and Admins can update appointments" ON public.appointments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('Admin', 'Receptionist', 'Dentist')
        )
    );

CREATE POLICY "Admins can delete appointments" ON public.appointments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'Admin'
        )
    );

-- Invoices policies
CREATE POLICY "Authenticated users can view invoices" ON public.invoices
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants and Admins can manage invoices" ON public.invoices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('Admin', 'Accountant')
        )
    );

-- Invoice Treatments policies
CREATE POLICY "Authenticated users can view invoice treatments" ON public.invoice_treatments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants and Admins can manage invoice treatments" ON public.invoice_treatments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('Admin', 'Accountant')
        )
    );

-- Payments policies
CREATE POLICY "Authenticated users can view payments" ON public.payments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants and Admins can manage payments" ON public.payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('Admin', 'Accountant')
        )
    );

-- =====================================================
-- STEP 7: Create admin user
-- =====================================================
-- NOTE: This section creates the admin user in auth.users
-- The trigger will automatically create the corresponding entry in public.users
-- Password: KingKira16
-- Email: admin@clinic.com

DO $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Check if admin user already exists in auth.users to avoid duplicate key errors
    SELECT id INTO new_user_id FROM auth.users WHERE email = 'admin@clinic.com';
    
    IF new_user_id IS NOT NULL THEN
        -- User exists, update password and metadata
        UPDATE auth.users
        SET 
            encrypted_password = crypt('KingKira16', gen_salt('bf')),
            raw_user_meta_data = '{"full_name":"System Admin","role":"Admin","avatar_url":"https://api.dicebear.com/8.x/initials/svg?seed=Admin"}'
        WHERE id = new_user_id;
        
        -- Ensure user exists in public.users (in case it was deleted but auth user remained)
        INSERT INTO public.users (id, full_name, email, role, avatar_url)
        VALUES (new_user_id, 'System Admin', 'admin@clinic.com', 'Admin', 'https://api.dicebear.com/8.x/initials/svg?seed=Admin')
        ON CONFLICT (id) DO UPDATE
        SET 
            full_name = 'System Admin',
            role = 'Admin',
            avatar_url = 'https://api.dicebear.com/8.x/initials/svg?seed=Admin';
            
    ELSE
        -- User does not exist, create new
        new_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            new_user_id,
            'authenticated',
            'authenticated',
            'admin@clinic.com',
            crypt('KingKira16', gen_salt('bf')), -- Bcrypt hash of password
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"System Admin","role":"Admin","avatar_url":"https://api.dicebear.com/8.x/initials/svg?seed=Admin"}',
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );
        
        -- Trigger will handle public.users creation, but we can ensure it here too just in case
    END IF;

END $$;

-- =====================================================
-- STEP 8: Insert sample data
-- =====================================================

-- Sample treatments
INSERT INTO public.treatments (name, description, cost) VALUES
    ('Dental Cleaning', 'Professional teeth cleaning and polishing', 75.00),
    ('Tooth Filling', 'Cavity filling with composite material', 150.00),
    ('Root Canal', 'Root canal treatment for infected tooth', 500.00),
    ('Tooth Extraction', 'Simple tooth extraction', 200.00),
    ('Dental Crown', 'Porcelain crown installation', 800.00),
    ('Teeth Whitening', 'Professional teeth whitening treatment', 300.00),
    ('Dental Implant', 'Single tooth implant with crown', 2500.00),
    ('Orthodontic Consultation', 'Initial consultation for braces', 50.00);

-- =====================================================
-- STEP 9: Grant necessary permissions
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant all privileges on all tables to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant all privileges on all sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated;

-- Grant execute on all functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- =====================================================
-- STEP 10: Verification
-- =====================================================

-- Simple select to verify tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
