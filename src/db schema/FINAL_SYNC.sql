-- ============================================================================
-- FINAL SYNC - Run this to ensure all tables, functions, and real-time are properly configured
-- This file consolidates all fixes and ensures proper synchronization
-- ============================================================================

-- ============================================================================
-- 1. VERIFY AND FIX BLOOD_REQUESTS TABLE STRUCTURE
-- ============================================================================

-- Add missing columns to blood_requests if they don't exist
DO $$
BEGIN
  -- Add accepted_donors_count if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'blood_requests' 
    AND column_name = 'accepted_donors_count'
  ) THEN
    ALTER TABLE public.blood_requests 
    ADD COLUMN accepted_donors_count int DEFAULT 0;
  END IF;

  -- Add request_number if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'blood_requests' 
    AND column_name = 'request_number'
  ) THEN
    ALTER TABLE public.blood_requests 
    ADD COLUMN request_number text UNIQUE;
    
    -- Generate request numbers for existing records
    UPDATE public.blood_requests 
    SET request_number = 'REQ-' || LPAD(EXTRACT(YEAR FROM created_at)::text, 4, '0') || '-' || LPAD(id::text, 8, '0')
    WHERE request_number IS NULL;
  END IF;

  -- Add geom column if missing (for PostGIS)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'blood_requests' 
    AND column_name = 'geom'
  ) THEN
    ALTER TABLE public.blood_requests 
    ADD COLUMN geom geometry(Point, 4326);
    
    -- Populate geom from latitude/longitude
    UPDATE public.blood_requests 
    SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 2. VERIFY AND FIX HOSPITALS TABLE STRUCTURE
-- ============================================================================

DO $$
BEGIN
  -- Add geom column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hospitals' 
    AND column_name = 'geom'
  ) THEN
    ALTER TABLE public.hospitals 
    ADD COLUMN geom geometry(Point, 4326);
    
    -- Populate geom from latitude/longitude
    UPDATE public.hospitals 
    SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. VERIFY AND FIX DONOR_LOCATIONS TABLE STRUCTURE
-- ============================================================================

DO $$
BEGIN
  -- Add geom column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donor_locations' 
    AND column_name = 'geom'
  ) THEN
    ALTER TABLE public.donor_locations 
    ADD COLUMN geom geometry(Point, 4326);
    
    -- Populate geom from latitude/longitude
    UPDATE public.donor_locations 
    SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. CREATE OR UPDATE CALCULATE_DISTANCE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 float, lon1 float, 
    lat2 float, lon2 float
) RETURNS float AS $$
DECLARE
    earth_radius float := 6371; -- Earth's radius in kilometers
    dlat float;
    dlon float;
    a float;
    c float;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    
    a := sin(dlat/2) * sin(dlat/2) + 
         cos(radians(lat1)) * cos(radians(lat2)) * 
         sin(dlon/2) * sin(dlon/2);
    
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    
    RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 5. UPDATE FIND_NEARBY_DONORS FUNCTION (WITH DROP)
-- ============================================================================

DROP FUNCTION IF EXISTS find_nearby_donors(uuid, double precision);

CREATE OR REPLACE FUNCTION find_nearby_donors(
    p_request_id uuid,
    p_max_distance float DEFAULT NULL
) RETURNS TABLE (
    donor_id uuid,
    donor_name text,
    blood_type text,
    distance_km float,
    contact_phone text,
    donor_city text,
    last_donation date,
    total_donations int,
    donor_latitude float,
    donor_longitude float,
    has_responded boolean,
    response_type text,
    response_status text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        u.full_name,
        d.blood_type,
        calculate_distance(
            dl.latitude, dl.longitude,
            br.latitude, br.longitude
        ) as distance,
        u.phone,
        dl.city,
        d.last_donation_date,
        d.total_donations,
        dl.latitude,
        dl.longitude,
        EXISTS(SELECT 1 FROM donor_responses dr WHERE dr.donor_id = d.id AND dr.request_id = p_request_id) as has_responded,
        (SELECT dr.response_type FROM donor_responses dr WHERE dr.donor_id = d.id AND dr.request_id = p_request_id LIMIT 1) as response_type,
        (SELECT dr.response_status FROM donor_responses dr WHERE dr.donor_id = d.id AND dr.request_id = p_request_id LIMIT 1) as response_status
    FROM blood_requests br
    JOIN donors d ON (
        d.blood_type = br.required_blood_type 
        OR d.blood_type = 'O-'
        OR (d.blood_type = 'O+' AND br.required_blood_type IN ('O+', 'A+', 'B+', 'AB+'))
        OR (d.blood_type = 'A-' AND br.required_blood_type IN ('A-', 'A+', 'AB-', 'AB+'))
        OR (d.blood_type = 'A+' AND br.required_blood_type IN ('A+', 'AB+'))
        OR (d.blood_type = 'B-' AND br.required_blood_type IN ('B-', 'B+', 'AB-', 'AB+'))
        OR (d.blood_type = 'B+' AND br.required_blood_type IN ('B+', 'AB+'))
        OR (d.blood_type = 'AB-' AND br.required_blood_type IN ('AB-', 'AB+'))
    )
    JOIN donor_locations dl ON d.id = dl.donor_id AND dl.is_primary = true
    JOIN users u ON d.user_id = u.id
    WHERE 
        br.id = p_request_id
        AND d.is_available = true
        AND d.health_status = 'eligible'
        AND (d.next_eligible_date IS NULL OR d.next_eligible_date <= CURRENT_DATE)
        AND calculate_distance(dl.latitude, dl.longitude, br.latitude, br.longitude) <= 
            COALESCE(p_max_distance, 
                CASE 
                    WHEN br.priority = 'urgent' THEN 50
                    WHEN br.priority = 'high' THEN 30
                    ELSE 20
                END
            )
    ORDER BY 
        CASE 
            WHEN EXISTS(SELECT 1 FROM donor_responses dr WHERE dr.donor_id = d.id AND dr.request_id = p_request_id AND dr.response_type = 'available') THEN 1
            WHEN EXISTS(SELECT 1 FROM donor_responses dr WHERE dr.donor_id = d.id AND dr.request_id = p_request_id AND dr.response_type = 'interested') THEN 2
            ELSE 3
        END,
        distance ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. UPDATE FIND_NEARBY_REQUESTS FUNCTION (WITH DROP)
-- ============================================================================

DROP FUNCTION IF EXISTS find_nearby_requests(uuid, double precision);

CREATE OR REPLACE FUNCTION find_nearby_requests(
    p_donor_id uuid,
    p_max_distance float DEFAULT 20
) RETURNS TABLE (
    request_id uuid,
    request_number text,
    hospital_name text,
    required_blood_type text,
    units_required int,
    priority text,
    distance_km float,
    hospital_city text,
    hospital_address text,
    hospital_latitude float,
    hospital_longitude float,
    required_by timestamptz,
    request_status text,
    has_responded boolean,
    response_type text,
    accepted_donors_count int
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        br.id,
        br.request_number,
        h.name,
        br.required_blood_type,
        br.units_required,
        br.priority,
        calculate_distance(
            dl.latitude, dl.longitude,
            br.latitude, br.longitude
        ) as distance,
        h.city,
        h.address,
        h.latitude,
        h.longitude,
        br.required_by,
        br.status,
        EXISTS(SELECT 1 FROM donor_responses dr WHERE dr.donor_id = p_donor_id AND dr.request_id = br.id) as has_responded,
        (SELECT dr.response_type FROM donor_responses dr WHERE dr.donor_id = p_donor_id AND dr.request_id = br.id LIMIT 1) as response_type,
        br.accepted_donors_count
    FROM donors d
    JOIN donor_locations dl ON d.id = dl.donor_id AND dl.is_primary = true
    JOIN blood_requests br ON (
        d.blood_type = br.required_blood_type 
        OR d.blood_type = 'O-'
        OR (d.blood_type = 'O+' AND br.required_blood_type IN ('O+', 'A+', 'B+', 'AB+'))
        OR (d.blood_type = 'A-' AND br.required_blood_type IN ('A-', 'A+', 'AB-', 'AB+'))
        OR (d.blood_type = 'A+' AND br.required_blood_type IN ('A+', 'AB+'))
        OR (d.blood_type = 'B-' AND br.required_blood_type IN ('B-', 'B+', 'AB-', 'AB+'))
        OR (d.blood_type = 'B+' AND br.required_blood_type IN ('B+', 'AB+'))
        OR (d.blood_type = 'AB-' AND br.required_blood_type IN ('AB-', 'AB+'))
    )
    JOIN hospitals h ON br.hospital_id = h.id
    WHERE 
        d.id = p_donor_id
        AND br.status IN ('pending', 'matching', 'urgent', 'notified', 'partial')
        AND calculate_distance(dl.latitude, dl.longitude, br.latitude, br.longitude) <= p_max_distance
    ORDER BY 
        CASE br.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            ELSE 4
        END,
        distance ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. ENABLE REAL-TIME (WITH CONDITIONAL CHECKS)
-- ============================================================================

DO $$
BEGIN
  -- Enable for blood_requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'blood_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blood_requests;
  END IF;

  -- Enable for donor_responses
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'donor_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.donor_responses;
  END IF;

  -- Enable for notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  -- Enable for matches
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;
END $$;

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on RPC functions
GRANT EXECUTE ON FUNCTION calculate_distance(float, float, float, float) TO authenticated;
GRANT EXECUTE ON FUNCTION find_nearby_donors(uuid, float) TO authenticated;
GRANT EXECUTE ON FUNCTION find_nearby_requests(uuid, float) TO authenticated;
GRANT EXECUTE ON FUNCTION record_donor_response(uuid, uuid, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_request_responses(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_donor_responses(uuid, boolean) TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON public.donor_responses TO authenticated;
GRANT SELECT ON public.blood_requests TO authenticated;
GRANT SELECT ON public.donors TO authenticated;
GRANT SELECT ON public.hospitals TO authenticated;
GRANT SELECT ON public.donor_locations TO authenticated;
GRANT SELECT ON public.users TO authenticated;

-- ============================================================================
-- 9. VERIFICATION QUERIES
-- ============================================================================

-- Check if all required tables exist
DO $$
DECLARE
  missing_tables text[];
BEGIN
  SELECT array_agg(table_name)
  INTO missing_tables
  FROM (VALUES 
    ('users'),
    ('donors'),
    ('donor_locations'),
    ('hospitals'),
    ('blood_requests'),
    ('donor_responses'),
    ('matches'),
    ('notifications')
  ) AS required_tables(table_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = required_tables.table_name
  );

  IF missing_tables IS NOT NULL THEN
    RAISE NOTICE 'Missing tables: %', array_to_string(missing_tables, ', ');
  ELSE
    RAISE NOTICE 'All required tables exist ✓';
  END IF;
END $$;

-- Check if all required functions exist
DO $$
DECLARE
  missing_functions text[];
BEGIN
  SELECT array_agg(function_name)
  INTO missing_functions
  FROM (VALUES 
    ('calculate_distance'),
    ('find_nearby_donors'),
    ('find_nearby_requests'),
    ('record_donor_response'),
    ('get_request_responses'),
    ('get_donor_responses')
  ) AS required_functions(function_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = required_functions.function_name
  );

  IF missing_functions IS NOT NULL THEN
    RAISE NOTICE 'Missing functions: %', array_to_string(missing_functions, ', ');
  ELSE
    RAISE NOTICE 'All required functions exist ✓';
  END IF;
END $$;

-- Check real-time publications
SELECT 
  'Real-time enabled for: ' || string_agg(tablename, ', ') as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND schemaname = 'public'
AND tablename IN ('blood_requests', 'donor_responses', 'notifications', 'matches');

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'FINAL SYNC COMPLETED SUCCESSFULLY';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'All tables, functions, and real-time settings synced!';
  RAISE NOTICE 'You can now use the application.';
  RAISE NOTICE '=======================================================';
END $$;
