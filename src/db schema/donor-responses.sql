-- ============================================================================
-- DONOR RESPONSES SYSTEM
-- Tracks donor availability responses to blood requests
-- Enables real-time updates when donors mark themselves as available
-- 
-- Run this AFTER dbschema.sql and notifications-system.sql
-- ============================================================================

-- ============================================================================
-- 1. CREATE DONOR_RESPONSES TABLE
-- ============================================================================

DROP TABLE IF EXISTS public.donor_responses CASCADE;

CREATE TABLE public.donor_responses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid REFERENCES public.blood_requests(id) ON DELETE CASCADE NOT NULL,
  donor_id uuid REFERENCES public.donors(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Response details
  response_type text NOT NULL CHECK (response_type IN ('available', 'interested', 'not_available', 'withdrawn')),
  response_status text DEFAULT 'pending' CHECK (response_status IN ('pending', 'confirmed', 'scheduled', 'completed', 'cancelled')),
  
  -- Availability info
  available_from timestamptz,
  available_until timestamptz,
  preferred_time text, -- 'morning', 'afternoon', 'evening', 'anytime'
  
  -- Location and distance
  distance_km float,
  travel_time_minutes int,
  
  -- Communication
  contact_method text CHECK (contact_method IN ('phone', 'email', 'app')),
  notes text,
  hospital_contacted_at timestamptz,
  hospital_confirmed_at timestamptz,
  
  -- Appointment scheduling
  scheduled_date timestamptz,
  scheduled_location text,
  appointment_confirmed boolean DEFAULT false,
  reminder_sent boolean DEFAULT false,
  
  -- Completion tracking
  donation_completed boolean DEFAULT false,
  completed_at timestamptz,
  donation_id uuid, -- Reference to donation_history.id
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one response per donor per request
  UNIQUE(request_id, donor_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_donor_responses_request_id ON public.donor_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_donor_responses_donor_id ON public.donor_responses(donor_id);
CREATE INDEX IF NOT EXISTS idx_donor_responses_user_id ON public.donor_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_donor_responses_status ON public.donor_responses(response_status);
CREATE INDEX IF NOT EXISTS idx_donor_responses_type ON public.donor_responses(response_type);
CREATE INDEX IF NOT EXISTS idx_donor_responses_created_at ON public.donor_responses(created_at DESC);

-- ============================================================================
-- 2. FUNCTION TO RECORD DONOR RESPONSE
-- ============================================================================

CREATE OR REPLACE FUNCTION record_donor_response(
  p_request_id uuid,
  p_donor_id uuid,
  p_user_id uuid,
  p_response_type text,
  p_notes text DEFAULT NULL,
  p_preferred_time text DEFAULT 'anytime',
  p_contact_method text DEFAULT 'app'
)
RETURNS uuid AS $$
DECLARE
  v_response_id uuid;
  v_distance float;
  v_hospital_id uuid;
  v_hospital_name text;
  v_donor_name text;
BEGIN
  -- Get request and hospital details
  SELECT br.hospital_id, h.name, calculate_distance(
    dl.latitude, dl.longitude,
    br.latitude, br.longitude
  )
  INTO v_hospital_id, v_hospital_name, v_distance
  FROM blood_requests br
  JOIN hospitals h ON h.id = br.hospital_id
  JOIN donors d ON d.id = p_donor_id
  LEFT JOIN donor_locations dl ON dl.donor_id = d.id AND dl.is_primary = true
  WHERE br.id = p_request_id;
  
  -- Get donor name
  SELECT u.full_name INTO v_donor_name
  FROM users u
  WHERE u.id = p_user_id;
  
  -- Insert or update response
  INSERT INTO public.donor_responses (
    request_id,
    donor_id,
    user_id,
    response_type,
    response_status,
    notes,
    preferred_time,
    contact_method,
    distance_km,
    available_from,
    available_until
  )
  VALUES (
    p_request_id,
    p_donor_id,
    p_user_id,
    p_response_type,
    CASE WHEN p_response_type = 'available' THEN 'confirmed' ELSE 'pending' END,
    p_notes,
    p_preferred_time,
    p_contact_method,
    v_distance,
    CASE WHEN p_response_type = 'available' THEN now() ELSE NULL END,
    CASE WHEN p_response_type = 'available' THEN now() + interval '24 hours' ELSE NULL END
  )
  ON CONFLICT (request_id, donor_id) 
  DO UPDATE SET
    response_type = EXCLUDED.response_type,
    response_status = EXCLUDED.response_status,
    notes = EXCLUDED.notes,
    preferred_time = EXCLUDED.preferred_time,
    contact_method = EXCLUDED.contact_method,
    updated_at = now()
  RETURNING id INTO v_response_id;
  
  -- Update blood request counts
  UPDATE blood_requests
  SET 
    accepted_donors_count = (
      SELECT COUNT(*) 
      FROM donor_responses 
      WHERE request_id = p_request_id 
      AND response_type IN ('available', 'interested')
    ),
    updated_at = now()
  WHERE id = p_request_id;
  
  -- Create notification for hospital
  IF p_response_type IN ('available', 'interested') THEN
    INSERT INTO public.notifications (
      user_id,
      notification_type,
      title,
      message,
      metadata
    )
    SELECT 
      h.user_id,
      'match_found',
      format('Donor Available: %s', v_donor_name),
      format('%s has marked themselves as %s for your blood request. Distance: %.1f km', 
        v_donor_name, p_response_type, v_distance),
      jsonb_build_object(
        'request_id', p_request_id,
        'donor_id', p_donor_id,
        'response_id', v_response_id,
        'response_type', p_response_type,
        'distance_km', v_distance
      )
    FROM hospitals h
    WHERE h.id = v_hospital_id;
  END IF;
  
  RETURN v_response_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. FUNCTION TO GET RESPONSES FOR A REQUEST
-- ============================================================================

CREATE OR REPLACE FUNCTION get_request_responses(
  p_request_id uuid,
  p_response_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  donor_id uuid,
  donor_name text,
  donor_blood_type text,
  donor_email text,
  donor_phone text,
  donor_city text,
  response_type text,
  response_status text,
  distance_km float,
  preferred_time text,
  notes text,
  total_donations int,
  last_donation_date date,
  created_at timestamptz,
  scheduled_date timestamptz,
  appointment_confirmed boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dr.id,
    dr.donor_id,
    u.full_name as donor_name,
    d.blood_type as donor_blood_type,
    u.email as donor_email,
    u.phone as donor_phone,
    dl.city as donor_city,
    dr.response_type,
    dr.response_status,
    dr.distance_km,
    dr.preferred_time,
    dr.notes,
    d.total_donations,
    d.last_donation_date,
    dr.created_at,
    dr.scheduled_date,
    dr.appointment_confirmed
  FROM public.donor_responses dr
  JOIN public.donors d ON dr.donor_id = d.id
  JOIN public.users u ON dr.user_id = u.id
  LEFT JOIN public.donor_locations dl ON dl.donor_id = d.id AND dl.is_primary = true
  WHERE 
    dr.request_id = p_request_id
    AND (p_response_type IS NULL OR dr.response_type = p_response_type)
  ORDER BY 
    CASE dr.response_type
      WHEN 'available' THEN 1
      WHEN 'interested' THEN 2
      ELSE 3
    END,
    dr.distance_km ASC,
    dr.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. FUNCTION TO GET DONOR'S RESPONSES
-- ============================================================================

CREATE OR REPLACE FUNCTION get_donor_responses(
  p_donor_id uuid,
  p_active_only boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  request_id uuid,
  request_number text,
  hospital_name text,
  hospital_city text,
  blood_type text,
  units_required int,
  priority text,
  response_type text,
  response_status text,
  distance_km float,
  required_by timestamptz,
  scheduled_date timestamptz,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dr.id,
    dr.request_id,
    br.request_number,
    h.name as hospital_name,
    h.city as hospital_city,
    br.required_blood_type as blood_type,
    br.units_required,
    br.priority,
    dr.response_type,
    dr.response_status,
    dr.distance_km,
    br.required_by,
    dr.scheduled_date,
    dr.created_at
  FROM public.donor_responses dr
  JOIN public.blood_requests br ON dr.request_id = br.id
  JOIN public.hospitals h ON br.hospital_id = h.id
  WHERE 
    dr.donor_id = p_donor_id
    AND (NOT p_active_only OR br.status IN ('pending', 'matching', 'notified', 'partial'))
  ORDER BY dr.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. UPDATE TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER donor_responses_updated_at 
BEFORE UPDATE ON public.donor_responses
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 6. VIEW FOR ACTIVE RESPONSES WITH FULL DETAILS
-- ============================================================================

CREATE OR REPLACE VIEW active_donor_responses_view AS
SELECT 
  dr.id,
  dr.request_id,
  dr.donor_id,
  dr.user_id,
  dr.response_type,
  dr.response_status,
  dr.distance_km,
  dr.preferred_time,
  dr.notes,
  dr.scheduled_date,
  dr.appointment_confirmed,
  dr.created_at,
  dr.updated_at,
  
  -- Donor details
  d.blood_type as donor_blood_type,
  d.total_donations,
  d.last_donation_date,
  u.full_name as donor_name,
  u.email as donor_email,
  u.phone as donor_phone,
  dl.city as donor_city,
  dl.address as donor_address,
  dl.latitude as donor_latitude,
  dl.longitude as donor_longitude,
  
  -- Request details
  br.request_number,
  br.required_blood_type,
  br.units_required,
  br.priority,
  br.status as request_status,
  br.required_by,
  
  -- Hospital details
  h.id as hospital_id,
  h.name as hospital_name,
  h.city as hospital_city,
  h.address as hospital_address,
  h.phone as hospital_phone,
  h.latitude as hospital_latitude,
  h.longitude as hospital_longitude
FROM public.donor_responses dr
JOIN public.donors d ON dr.donor_id = d.id
JOIN public.users u ON dr.user_id = u.id
JOIN public.blood_requests br ON dr.request_id = br.id
JOIN public.hospitals h ON br.hospital_id = h.id
LEFT JOIN public.donor_locations dl ON dl.donor_id = d.id AND dl.is_primary = true
WHERE br.status IN ('pending', 'matching', 'notified', 'partial')
ORDER BY dr.created_at DESC;

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.donor_responses TO authenticated;
GRANT EXECUTE ON FUNCTION record_donor_response(uuid, uuid, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_request_responses(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_donor_responses(uuid, boolean) TO authenticated;
GRANT SELECT ON active_donor_responses_view TO authenticated;

-- ============================================================================
-- 8. ENABLE REAL-TIME FOR DONOR_RESPONSES
-- ============================================================================

-- Enable real-time replication for the donor_responses table (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'donor_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.donor_responses;
  END IF;
END $$;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

/*
-- 1. Donor marks themselves as available for a request:
SELECT record_donor_response(
  'request-uuid-here',
  'donor-uuid-here',
  'user-uuid-here',
  'available',
  'I can come today afternoon',
  'afternoon',
  'phone'
);

-- 2. Get all responses for a request:
SELECT * FROM get_request_responses('request-uuid-here');

-- 3. Get only available donors for a request:
SELECT * FROM get_request_responses('request-uuid-here', 'available');

-- 4. Get donor's response history:
SELECT * FROM get_donor_responses('donor-uuid-here');

-- 5. View active responses with full details:
SELECT * FROM active_donor_responses_view 
WHERE request_id = 'request-uuid-here';

-- 6. Count available donors for each request:
SELECT 
  br.request_number,
  br.required_blood_type,
  COUNT(CASE WHEN dr.response_type = 'available' THEN 1 END) as available_count,
  COUNT(CASE WHEN dr.response_type = 'interested' THEN 1 END) as interested_count
FROM blood_requests br
LEFT JOIN donor_responses dr ON br.id = dr.request_id
GROUP BY br.id, br.request_number, br.required_blood_type;
*/
