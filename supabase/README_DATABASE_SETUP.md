# DentalOS Database Setup Guide

## Overview
This guide explains how to initialize your DentalOS database using the provided SQL script.

## Files
- **init_database.sql** - Complete database initialization script

## What the Script Does

1. **Drops all existing tables** - Removes all data, table structures, and backup tables (`backup_public_users`, `backup_auth_users`)
2. **Creates all necessary tables**:
   - `users` - System users (Admin, Receptionist, Dentist, Accountant)
   - `patients` - Patient records
   - `treatments` - Available dental treatments
   - `appointments` - Patient appointments
   - `invoices` - Billing invoices
   - `invoice_treatments` - Junction table for invoice items
   - `payments` - Payment records

3. **Sets up Row Level Security (RLS)** - Configures access control policies
4. **Creates admin user**:
   - Email: `admin@clinic.com`
   - Password: `KingKira16`
   - Role: Admin

5. **Inserts sample treatments** - 8 common dental treatments

## How to Run the Script

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `init_database.sql`
5. Paste it into the SQL editor
6. Click **Run** button

### Option 2: Using Supabase CLI

```bash
# Make sure you're in the project directory
cd c:\Users\kirub\Downloads\softwares\dentalos

# Run the SQL file
supabase db reset
psql -h your-db-host -U postgres -d postgres -f supabase/init_database.sql
```

### Option 3: Using psql directly

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.xetoenxvfyjpcoxzgjfm.supabase.co:5432/postgres" -f supabase/init_database.sql
```

## After Running the Script

### 1. Verify the Setup

The script will output verification messages showing:
- Number of tables created
- Admin user creation status
- Record counts for each table

### 2. Login with Admin Credentials

Use these credentials to log in to your application:
- **Email**: `admin@clinic.com`
- **Password**: `KingKira16`

### 3. Create Additional Users

As an admin, you can now create additional users through your application:
- Receptionists
- Dentists
- Accountants

## Important Notes

⚠️ **WARNING**: This script will **DELETE ALL EXISTING DATA**. Make sure to backup any important data before running it.

✅ **What's Included**:
- Complete database schema
- Row Level Security policies
- Automatic triggers for timestamps
- Sample treatment data
- Admin user with full access

🔒 **Security Features**:
- RLS enabled on all tables
- Role-based access control
- Encrypted password storage
- Proper foreign key constraints

## Troubleshooting

### Error: "permission denied for schema auth"
- Make sure you're running the script as a superuser (postgres role)
- In Supabase Dashboard, the SQL Editor runs with proper permissions

### Error: "relation already exists"
- The script includes DROP TABLE statements, so this shouldn't happen
- If it does, manually drop the tables first or run the DROP statements separately

### Admin user not created
- Check the auth.users table: `SELECT * FROM auth.users WHERE email = 'admin@clinic.com';`
- Check the public.users table: `SELECT * FROM public.users WHERE email = 'admin@clinic.com';`
- If missing, run the STEP 7 section of the script again

## Database Schema Overview

```
auth.users (Supabase managed)
    ↓ (trigger)
public.users (id, full_name, email, role, avatar_url)
    ↓
public.patients (id, name, dob, phone, email, address, medical_history)
    ↓
public.appointments (id, patient_id, dentist_id, start_time, end_time, status, notes)
    ↓
public.invoices (id, appointment_id, patient_id, amount, issue_date, due_date, status)
    ↓
public.payments (id, invoice_id, amount, payment_date, method)

public.treatments (id, name, description, cost)
    ↓
public.invoice_treatments (id, invoice_id, treatment_id, quantity, unit_price)
```

## Next Steps

After successfully running the script:

1. ✅ Test login with admin credentials
2. ✅ Create additional users (dentists, receptionists, etc.)
3. ✅ Add more patients
4. ✅ Schedule appointments
5. ✅ Create invoices and process payments

## Support

If you encounter any issues:
1. Check the Supabase logs in the Dashboard
2. Verify your database connection settings
3. Ensure you have the correct permissions
4. Review the error messages in the SQL output
