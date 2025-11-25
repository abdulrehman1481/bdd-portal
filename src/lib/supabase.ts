import { createClient } from '@supabase/supabase-js';

// Use placeholder values if environment variables are not set
// This allows the app to build without errors
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types based on your database schema
export type UserRole = 'donor' | 'hospital' | 'admin';

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';

export interface User {
  id: string;
  auth_id: string;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface Donor {
  id: string;
  user_id: string;
  blood_type: BloodType;
  date_of_birth: string;
  gender?: string;
  weight_kg?: number;
  height_cm?: number;
  last_donation_date?: string;
  next_eligible_date?: string;
  total_donations: number;
  health_status: string;
  is_available: boolean;
}

export interface Hospital {
  id: string;
  user_id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
  is_verified: boolean;
  total_requests: number;
  fulfilled_requests: number;
}

export interface BloodRequest {
  id: string;
  request_number: string;
  hospital_id: string;
  required_blood_type: BloodType;
  units_required: number;
  units_fulfilled: number;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: string;
  required_by: string;
  created_at: string;
}
