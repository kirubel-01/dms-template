-- =====================================================
-- DentalOS Database Initialization Script - PRODUCTION
-- =====================================================
-- Version: 1.0 - Final Production Release
-- This script provides a complete, clean database setup with:
-- 1. Complete table schema for DentalOS
-- 2. RLS policies using helper function (NO INFINITE RECURSION)
-- 3. Admin user creation (admin@clinic.com / admin123)
-- 4. Sample treatment data
-- 5. All necessary indexes and triggers
-- =====================================================

-- =====================================================
-- STEP 1: Clean up existing database
-- =====================================================

-- Drop existing tables (cascade to remove all dependencies)
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.invoice_treatments CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.treatments CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop backup tables that might exist
DROP TABLE IF EXISTS public.backup_public_users CASCADE;
DROP TABLE IF EXISTS public.backup_auth_users CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;

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

COMMENT ON TABLE public.users IS 'User profiles extending Supabase auth.users with role-based access';
COMMENT ON COLUMN public.users.role IS 'User role: Admin, Receptionist, Dentist, or Accountant';

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

COMMENT ON TABLE public.patients IS 'Patient records with demographics and medical history';

-- Treatments table
CREATE TABLE public.treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    cost DECIMAL(10, 2) NOT NULL CHECK (cost >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.treatments IS 'Catalog of available dental treatments with pricing';

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

COMMENT ON TABLE public.appointments IS 'Patient appointments with dentists';
COMMENT ON COLUMN public.appointments.status IS 'Appointment status: Scheduled, Completed, Canceled, or Checked In';

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

COMMENT ON TABLE public.invoices IS 'Billing invoices for patient appointments';
COMMENT ON COLUMN public.invoices.status IS 'Invoice status: Paid, Unpaid, or Overdue';

-- Invoice Treatments junction table
CREATE TABLE public.invoice_treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.invoice_treatments IS 'Line items linking invoices to treatments with quantities and pricing';

-- Payments table
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    method TEXT NOT NULL CHECK (method IN ('Cash', 'Card', 'Transfer')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.payments IS 'Payment records for invoices';
COMMENT ON COLUMN public.payments.method IS 'Payment method: Cash, Card, or Transfer';

-- =====================================================
-- STEP 3: Create indexes for performance
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
-- STEP 4: Create helper functions
-- =====================================================

-- CRITICAL: Helper function to get user role safely (avoids RLS recursion)
-- This function uses SECURITY DEFINER to bypass RLS when checking roles
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

COMMENT ON FUNCTION public.get_user_role IS 'Safely retrieves user role bypassing RLS to prevent infinite recursion in policies';

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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 5: Create triggers
-- =====================================================

-- Trigger to auto-create user profile on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp triggers
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
-- STEP 6: Enable Row Level Security (RLS)
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: Create RLS Policies (Using Helper Function)
-- =====================================================

-- Users table policies
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Allow user creation" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can delete users" ON public.users
    FOR DELETE USING (auth.role() = 'service_role');

-- Patients table policies
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

-- Treatments table policies
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

-- Appointments table policies
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

-- Invoices table policies
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

-- Invoice Treatments table policies
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

-- Payments table policies
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
-- STEP 8: Create admin user
-- =====================================================

DO $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Check if admin already exists
    SELECT id INTO new_user_id FROM auth.users WHERE email = 'admin@clinic.com';
    
    IF new_user_id IS NOT NULL THEN
        -- Admin exists, update password and ensure profile is correct
        UPDATE auth.users
        SET 
            encrypted_password = crypt('admin123', gen_salt('bf')),
            email_confirmed_at = NOW(),
            raw_user_meta_data = '{"full_name":"System Admin","role":"Admin","avatar_url":"https://api.dicebear.com/8.x/initials/svg?seed=Admin"}'::jsonb
        WHERE id = new_user_id;
        
        INSERT INTO public.users (id, full_name, email, role, avatar_url)
        VALUES (new_user_id, 'System Admin', 'admin@clinic.com', 'Admin', 'https://api.dicebear.com/8.x/initials/svg?seed=Admin')
        ON CONFLICT (id) DO UPDATE
        SET 
            full_name = 'System Admin',
            role = 'Admin',
            avatar_url = 'https://api.dicebear.com/8.x/initials/svg?seed=Admin';
    ELSE
        -- Create new admin user
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
            crypt('admin123', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"System Admin","role":"Admin","avatar_url":"https://api.dicebear.com/8.x/initials/svg?seed=Admin"}'::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );
    END IF;
    
    RAISE NOTICE '✓ Admin user configured: admin@clinic.com / admin123';
END $$;

-- =====================================================
-- STEP 9: Insert sample data
-- =====================================================

INSERT INTO public.treatments (name, description, cost) VALUES
    ('Dental Cleaning', 'Professional teeth cleaning and polishing', 75.00),
    ('Tooth Filling', 'Cavity filling with composite material', 150.00),
    ('Root Canal', 'Root canal treatment for infected tooth', 500.00),
    ('Tooth Extraction', 'Simple tooth extraction', 200.00),
    ('Dental Crown', 'Porcelain crown installation', 800.00),
    ('Teeth Whitening', 'Professional teeth whitening treatment', 300.00),
    ('Dental Implant', 'Single tooth implant with crown', 2500.00),
    ('Orthodontic Consultation', 'Initial consultation for braces', 50.00),
    ('Dental Bridge', '3-unit dental bridge', 1500.00),
    ('Dentures', 'Complete set of dentures', 2000.00)
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 10: Grant permissions
-- =====================================================

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- =====================================================
-- STEP 11: Final verification
-- =====================================================

DO $$
DECLARE
    table_count INTEGER;
    policy_count INTEGER;
    admin_exists BOOLEAN;
    treatment_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public';
    
    -- Check admin
    SELECT EXISTS(SELECT 1 FROM public.users WHERE email = 'admin@clinic.com' AND role = 'Admin')
    INTO admin_exists;
    
    -- Count treatments
    SELECT COUNT(*) INTO treatment_count FROM public.treatments;
    
    RAISE NOTICE '================================================';
    RAISE NOTICE '  DentalOS Database Initialization Complete';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Tables created: %', table_count;
    RAISE NOTICE 'RLS policies: %', policy_count;
    RAISE NOTICE 'Admin user ready: %', CASE WHEN admin_exists THEN '✓ YES' ELSE '✗ NO' END;
    RAISE NOTICE 'Sample treatments: %', treatment_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Login credentials:';
    RAISE NOTICE '  Email: admin@clinic.com';
    RAISE NOTICE '  Password: admin123';
    RAISE NOTICE '================================================';
END $$;
