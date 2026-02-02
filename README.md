
# DentalOS - Clinic Management System

**DentalOS** is a modern, full-featured web application designed to streamline the daily operations of a dental clinic. It offers a unified platform for managing patients, appointments, billing, and staff, featuring robust role-based access control to ensure data security and operational efficiency.

## 🚀 Quick Start

1.  **Clone or Download** the repository.
2.  **Serve** the project directory (e.g., `npx serve .`).
3.  **Open** the local URL in your browser.

## 👑 Admin Setup (SQL Script)

To fulfill your request to create the admin `admin@clinic.com` with password `KingKira16` and remove other users, run the following SQL script in your **Supabase SQL Editor**.

**⚠️ WARNING: This script deletes all existing users to start fresh.**

```sql
-- 1. Enable encryption extension (Required for password hashing)
create extension if not exists pgcrypto;

-- 2. CLEAR ALL USERS (Resets the database users)
TRUNCATE TABLE public.users CASCADE;
TRUNCATE TABLE auth.users CASCADE;

-- 3. CREATE ADMIN USER (admin@clinic.com / KingKira16)
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  -- Insert into auth.users (Identity Provider)
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
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'admin@clinic.com',
    crypt('KingKira16', gen_salt('bf')), -- Sets password to KingKira16
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"System Admin","role":"Admin"}',
    now(),
    now(),
    '',
    ''
  );

  -- Insert into public.users (Application Profile)
  INSERT INTO public.users (id, full_name, email, role, avatar_url)
  VALUES (
    new_user_id, 
    'System Admin', 
    'admin@clinic.com', 
    'Admin',
    'https://api.dicebear.com/8.x/initials/svg?seed=Admin'
  );
  
END $$;
```

## ✨ Features

### 👥 Role-Based Access
*   **Admin:** Full control over Staff, Settings, and Reports.
*   **Receptionist:** Manages Patients, Appointments, and Check-ins.
*   **Dentist:** Views Schedule, Patient Records, and Treatments.
*   **Accountant:** Manages Invoices, Payments, and Financial Reports.

### 🏥 Core Modules
*   **Dashboard:** Real-time overview of daily operations.
*   **Patients:** Electronic Medical Records (EMR) with history.
*   **Appointments:** Scheduling with drag-and-drop simplicity.
*   **Billing:** Invoice generation and payment tracking.
*   **Treatments:** Configurable service catalog.

## 🛠️ Technology Stack

*   **Frontend:** React 19, TypeScript, Tailwind CSS
*   **Icons:** Lucide React
*   **Backend:** Supabase (PostgreSQL, Auth)
