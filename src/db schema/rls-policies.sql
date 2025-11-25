-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - FIXED VERSION
-- Run this AFTER running the main dbschema.sql
-- ============================================================================

-- First, drop all existing policies if any
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || 
                ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can read their own data
CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT
USING (auth.uid() = auth_id);

-- Users can update their own data
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
USING (auth.uid() = auth_id);

-- Allow insert for authenticated users (signup)
CREATE POLICY "Users can insert own profile"
ON public.users FOR INSERT
WITH CHECK (auth.uid() = auth_id);

-- ============================================================================
-- DONORS TABLE POLICIES
-- ============================================================================

-- Donors can read their own data
CREATE POLICY "Donors can view own data"
ON public.donors FOR SELECT
USING (
  user_id IN (
    SELECT id FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- Hospitals can view available donors (for matching)
CREATE POLICY "Hospitals can view available donors"
ON public.donors FOR SELECT
USING (
  is_available = true
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'hospital'
  )
);

-- Donors can insert their own data
CREATE POLICY "Donors can insert own data"
ON public.donors FOR INSERT
WITH CHECK (
  user_id IN (
    SELECT id FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- Donors can update their own data
CREATE POLICY "Donors can update own data"
ON public.donors FOR UPDATE
USING (
  user_id IN (
    SELECT id FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- ============================================================================
-- DONOR_LOCATIONS TABLE POLICIES
-- ============================================================================

-- Donors can manage their own locations
CREATE POLICY "Donors can view own locations"
ON public.donor_locations FOR SELECT
USING (
  donor_id IN (
    SELECT d.id FROM public.donors d
    JOIN public.users u ON d.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

CREATE POLICY "Donors can insert own locations"
ON public.donor_locations FOR INSERT
WITH CHECK (
  donor_id IN (
    SELECT d.id FROM public.donors d
    JOIN public.users u ON d.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

CREATE POLICY "Donors can update own locations"
ON public.donor_locations FOR UPDATE
USING (
  donor_id IN (
    SELECT d.id FROM public.donors d
    JOIN public.users u ON d.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

-- ============================================================================
-- DONOR_AVAILABILITY TABLE POLICIES
-- ============================================================================

CREATE POLICY "Donors can manage own availability"
ON public.donor_availability FOR ALL
USING (
  donor_id IN (
    SELECT d.id FROM public.donors d
    JOIN public.users u ON d.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

-- ============================================================================
-- HOSPITALS TABLE POLICIES
-- ============================================================================

-- Hospitals can read their own data
CREATE POLICY "Hospitals can view own data"
ON public.hospitals FOR SELECT
USING (
  user_id IN (
    SELECT id FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- Hospitals can insert their own data
CREATE POLICY "Hospitals can insert own data"
ON public.hospitals FOR INSERT
WITH CHECK (
  user_id IN (
    SELECT id FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- Hospitals can update their own data
CREATE POLICY "Hospitals can update own data"
ON public.hospitals FOR UPDATE
USING (
  user_id IN (
    SELECT id FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- Anyone can view verified hospitals (for public directory)
CREATE POLICY "Public can view verified hospitals"
ON public.hospitals FOR SELECT
USING (is_verified = true);

-- ============================================================================
-- BLOOD_REQUESTS TABLE POLICIES
-- ============================================================================

-- Hospitals can view their own requests
CREATE POLICY "Hospitals can view own requests"
ON public.blood_requests FOR SELECT
USING (
  hospital_id IN (
    SELECT h.id FROM public.hospitals h
    JOIN public.users u ON h.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

-- Donors can view active requests
CREATE POLICY "Donors can view active requests"
ON public.blood_requests FOR SELECT
USING (
  status IN ('pending', 'urgent')
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'donor'
  )
);

-- Hospitals can create requests
CREATE POLICY "Hospitals can create requests"
ON public.blood_requests FOR INSERT
WITH CHECK (
  hospital_id IN (
    SELECT h.id FROM public.hospitals h
    JOIN public.users u ON h.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

-- Hospitals can update their own requests
CREATE POLICY "Hospitals can update own requests"
ON public.blood_requests FOR UPDATE
USING (
  hospital_id IN (
    SELECT h.id FROM public.hospitals h
    JOIN public.users u ON h.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

-- ============================================================================
-- MATCHES TABLE POLICIES
-- ============================================================================

-- Donors can view matches for them
CREATE POLICY "Donors can view own matches"
ON public.matches FOR SELECT
USING (
  donor_id IN (
    SELECT d.id FROM public.donors d
    JOIN public.users u ON d.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

-- Hospitals can view matches for their requests
CREATE POLICY "Hospitals can view request matches"
ON public.matches FOR SELECT
USING (
  request_id IN (
    SELECT br.id FROM public.blood_requests br
    JOIN public.hospitals h ON br.hospital_id = h.id
    JOIN public.users u ON h.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

-- System can create matches
CREATE POLICY "System can create matches"
ON public.matches FOR INSERT
WITH CHECK (true);

-- Donors and hospitals can update match status
CREATE POLICY "Users can update match status"
ON public.matches FOR UPDATE
USING (
  donor_id IN (
    SELECT d.id FROM public.donors d
    JOIN public.users u ON d.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
  OR
  request_id IN (
    SELECT br.id FROM public.blood_requests br
    JOIN public.hospitals h ON br.hospital_id = h.id
    JOIN public.users u ON h.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

-- ============================================================================
-- DONATION_HISTORY TABLE POLICIES
-- ============================================================================

-- Donors can view their own donation history
CREATE POLICY "Donors can view own history"
ON public.donation_history FOR SELECT
USING (
  donor_id IN (
    SELECT d.id FROM public.donors d
    JOIN public.users u ON d.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

-- Hospitals can view donations at their facility
CREATE POLICY "Hospitals can view facility donations"
ON public.donation_history FOR SELECT
USING (
  hospital_id IN (
    SELECT h.id FROM public.hospitals h
    JOIN public.users u ON h.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

-- Hospitals can create donation records
CREATE POLICY "Hospitals can create donations"
ON public.donation_history FOR INSERT
WITH CHECK (
  hospital_id IN (
    SELECT h.id FROM public.hospitals h
    JOIN public.users u ON h.user_id = u.id
    WHERE u.auth_id = auth.uid()
  )
);

-- ============================================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (
  user_id IN (
    SELECT id FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (
  user_id IN (
    SELECT id FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- System can create notifications
CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- PUSH_TOKENS TABLE POLICIES
-- ============================================================================

CREATE POLICY "Users can manage own tokens"
ON public.push_tokens FOR ALL
USING (
  user_id IN (
    SELECT id FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- ============================================================================
-- AUDIT_LOGS TABLE POLICIES
-- ============================================================================

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
ON public.audit_logs FOR SELECT
USING (
  user_id IN (
    SELECT id FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- System can insert audit logs
CREATE POLICY "System can create audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- ANALYTICS_EVENTS TABLE POLICIES
-- ============================================================================

-- System can manage analytics
CREATE POLICY "System can manage analytics"
ON public.analytics_events FOR ALL
USING (true);

-- ============================================================================
-- SYSTEM_SETTINGS TABLE POLICIES
-- ============================================================================

-- Everyone can read system settings
CREATE POLICY "Public can read settings"
ON public.system_settings FOR SELECT
USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can manage settings"
ON public.system_settings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'admin'
  )
);
