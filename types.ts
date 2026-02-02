
import { User } from "@supabase/supabase-js";

export enum Role {
  Admin = 'Admin',
  Receptionist = 'Receptionist',
  Dentist = 'Dentist',
  Accountant = 'Accountant',
}

// Note: This is Supabase's User type, not our custom one from the `users` table
export interface AuthUser extends User {
  // We can extend this if needed
}

export interface AppUser {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  avatar_url?: string;
  email_confirmed_at?: string;
}

export interface Patient {
  id:string;
  name: string;
  dob: string;
  phone: string;
  email?: string;
  address: string;
  medical_history: string;
  created_at: string;
}

export interface Treatment {
  id: string;
  name: string;
  description: string;
  cost: number;
  created_at: string;
}

export enum AppointmentStatus {
  Scheduled = 'Scheduled',
  Completed = 'Completed',
  Canceled = 'Canceled',
  CheckedIn = 'Checked In',
}

export interface Appointment {
  id: string;
  patient_id: string;
  dentist_id: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string;
  created_at: string;
  patients: { name: string };
  users: { full_name: string };
}

export interface PatientAppointment extends Omit<Appointment, 'patients'> {
  // This is for the patient history view, where we don't need the nested patient name
}

export enum InvoiceStatus {
  Paid = 'Paid',
  Unpaid = 'Unpaid',
  Overdue = 'Overdue',
}

export interface InvoiceTreatment {
    name: string;
    cost: number;
}

export interface Invoice {
  id: string;
  appointment_id: string;
  patient_id: string;
  amount: number;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  created_at: string;
  patients: { name: string };
  payments?: Payment[];
  appointments?: Appointment;
  invoice_treatments?: InvoiceTreatment[]; // for UI, not from DB directly
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  method: 'Cash' | 'Card' | 'Transfer';
  created_at: string;
}
