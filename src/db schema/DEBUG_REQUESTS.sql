-- ============================================================================
-- DEBUG - WHY REQUESTS NOT SHOWING ON MAP/NEARBY REQUESTS
-- Run these queries to diagnose the issue
-- ============================================================================

-- ============================================================================
-- 1. CHECK IF DONORS EXIST AND HAVE LOCATIONS
-- ============================================================================

-- Check donor table
SELECT 
  d.id as donor_id,
  u.email,
  d.blood_type,
  d.is_available,
  d.health_status,
  d.next_eligible_date,
  CASE 
    WHEN d.next_eligible_date IS NULL THEN 'Eligible (no date set)'
    WHEN d.next_eligible_date <= CURRENT_DATE THEN 'Eligible (date passed)'
    ELSE 'Not eligible until ' || d.next_eligible_date::text
  END as eligibility_status
FROM donors d
JOIN users u ON d.user_id = u.id
ORDER BY u.email;

-- Check donor locations
SELECT 
  u.email,
  d.blood_type,
  dl.latitude,
  dl.longitude,
  dl.city,
  dl.is_primary,
  ST_AsText(dl.geom) as geom_wkt
FROM donors d
JOIN users u ON d.user_id = u.id
LEFT JOIN donor_locations dl ON d.id = dl.donor_id
ORDER BY u.email, dl.is_primary DESC;

-- ============================================================================
-- 2. CHECK IF BLOOD REQUESTS EXIST AND HAVE LOCATIONS
-- ============================================================================

-- Check blood requests
SELECT 
  br.id,
  br.request_number,
  br.required_blood_type,
  br.units_required,
  br.priority,
  br.status,
  br.latitude,
  br.longitude,
  ST_AsText(br.geom) as geom_wkt,
  h.name as hospital_name,
  h.city as hospital_city
FROM blood_requests br
JOIN hospitals h ON br.hospital_id = h.id
WHERE br.status IN ('pending', 'matching', 'urgent', 'notified', 'partial')
ORDER BY br.created_at DESC;

-- ============================================================================
-- 3. TEST FIND_NEARBY_REQUESTS FUNCTION
-- ============================================================================

-- For donor@gmail.com (O+)
DO $$
DECLARE
  v_donor_id uuid;
  v_donor_email text;
  v_donor_blood text;
BEGIN
  SELECT d.id, u.email, d.blood_type INTO v_donor_id, v_donor_email, v_donor_blood
  FROM donors d
  JOIN users u ON d.user_id = u.id
  WHERE u.email = 'donor@gmail.com';
  
  IF v_donor_id IS NOT NULL THEN
    RAISE NOTICE 'Testing for Donor: % (%) - Blood Type: %', v_donor_email, v_donor_id, v_donor_blood;
    RAISE NOTICE 'Results:';
    RAISE NOTICE '========================================';
  ELSE
    RAISE NOTICE 'Donor not found: donor@gmail.com';
  END IF;
END $$;

-- Actual query for donor@gmail.com
SELECT 
  'donor@gmail.com' as for_donor,
  request_id,
  request_number,
  hospital_name,
  required_blood_type,
  units_required,
  priority,
  distance_km,
  hospital_city,
  hospital_latitude,
  hospital_longitude,
  required_by,
  request_status,
  has_responded
FROM find_nearby_requests(
  (SELECT id FROM donors WHERE user_id = 'e01bdb4b-093f-467d-ba2b-a93086151aa2'),
  50 -- 50km radius
)
ORDER BY priority, distance_km;

-- ============================================================================
-- 4. MANUAL DISTANCE CALCULATION TEST
-- ============================================================================

-- Calculate distances manually between donor and requests
SELECT 
  u.email as donor_email,
  d.blood_type as donor_blood,
  dl.city as donor_city,
  dl.latitude as donor_lat,
  dl.longitude as donor_lng,
  br.request_number,
  br.required_blood_type,
  br.priority,
  br.status,
  h.name as hospital_name,
  br.latitude as hospital_lat,
  br.longitude as hospital_lng,
  calculate_distance(dl.latitude, dl.longitude, br.latitude, br.longitude) as distance_km,
  CASE 
    WHEN d.blood_type = br.required_blood_type THEN 'Exact Match'
    WHEN d.blood_type = 'O-' THEN 'Universal Donor'
    WHEN d.blood_type = 'O+' AND br.required_blood_type IN ('O+', 'A+', 'B+', 'AB+') THEN 'Compatible'
    WHEN d.blood_type = 'A-' AND br.required_blood_type IN ('A-', 'A+', 'AB-', 'AB+') THEN 'Compatible'
    WHEN d.blood_type = 'A+' AND br.required_blood_type IN ('A+', 'AB+') THEN 'Compatible'
    WHEN d.blood_type = 'B-' AND br.required_blood_type IN ('B-', 'B+', 'AB-', 'AB+') THEN 'Compatible'
    WHEN d.blood_type = 'B+' AND br.required_blood_type IN ('B+', 'AB+') THEN 'Compatible'
    WHEN d.blood_type = 'AB-' AND br.required_blood_type IN ('AB-', 'AB+') THEN 'Compatible'
    ELSE 'Not Compatible'
  END as compatibility
FROM donors d
JOIN users u ON d.user_id = u.id
LEFT JOIN donor_locations dl ON d.id = dl.donor_id AND dl.is_primary = true
CROSS JOIN blood_requests br
JOIN hospitals h ON br.hospital_id = h.id
WHERE br.status IN ('pending', 'matching', 'urgent', 'notified', 'partial')
  AND u.email IN ('donor@gmail.com', 'donor1@gmail.com')
ORDER BY u.email, distance_km;

-- ============================================================================
-- 5. CHECK IF FUNCTIONS EXIST
-- ============================================================================

-- Check if find_nearby_requests exists
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'find_nearby_requests';

-- Check if calculate_distance exists
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'calculate_distance';

-- ============================================================================
-- 6. CHECK FOR MISSING DONOR LOCATIONS
-- ============================================================================

-- Find donors without locations
SELECT 
  u.email,
  d.id as donor_id,
  d.blood_type,
  d.is_available,
  'NO LOCATION' as issue
FROM donors d
JOIN users u ON d.user_id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM donor_locations dl 
  WHERE dl.donor_id = d.id AND dl.is_primary = true
);

-- ============================================================================
-- 7. CHECK FOR MISSING REQUEST LOCATIONS
-- ============================================================================

-- Find requests without proper locations
SELECT 
  br.request_number,
  br.required_blood_type,
  br.latitude,
  br.longitude,
  CASE 
    WHEN br.latitude IS NULL OR br.longitude IS NULL THEN 'MISSING LAT/LNG'
    WHEN br.geom IS NULL THEN 'MISSING GEOM'
    ELSE 'OK'
  END as location_status
FROM blood_requests br
WHERE br.status IN ('pending', 'matching', 'urgent', 'notified', 'partial');

-- ============================================================================
-- 8. FIX MISSING GEOM COLUMNS (IF NEEDED)
-- ============================================================================

-- Fix donor_locations missing geom
UPDATE donor_locations
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Fix blood_requests missing geom
UPDATE blood_requests
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Fix hospitals missing geom
UPDATE hospitals
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================================================
-- 9. COUNT EVERYTHING
-- ============================================================================

SELECT 
  'Total Users' as metric, COUNT(*)::text as count FROM users
UNION ALL
SELECT 'Total Donors', COUNT(*)::text FROM donors
UNION ALL
SELECT 'Available Donors', COUNT(*)::text FROM donors WHERE is_available = true
UNION ALL
SELECT 'Donors with Location', COUNT(DISTINCT donor_id)::text FROM donor_locations
UNION ALL
SELECT 'Hospitals', COUNT(*)::text FROM hospitals
UNION ALL
SELECT 'Active Blood Requests', COUNT(*)::text FROM blood_requests WHERE status IN ('pending', 'matching', 'urgent', 'notified', 'partial')
UNION ALL
SELECT 'Donor Responses', COUNT(*)::text FROM donor_responses;

-- ============================================================================
-- 10. TEST BLOOD TYPE COMPATIBILITY
-- ============================================================================

-- Show which donors can donate to which requests
SELECT 
  d.blood_type as donor_blood,
  br.required_blood_type as request_blood,
  COUNT(*) as donor_count,
  CASE 
    WHEN d.blood_type = br.required_blood_type 
      OR d.blood_type = 'O-'
      OR (d.blood_type = 'O+' AND br.required_blood_type IN ('O+', 'A+', 'B+', 'AB+'))
      OR (d.blood_type = 'A-' AND br.required_blood_type IN ('A-', 'A+', 'AB-', 'AB+'))
      OR (d.blood_type = 'A+' AND br.required_blood_type IN ('A+', 'AB+'))
      OR (d.blood_type = 'B-' AND br.required_blood_type IN ('B-', 'B+', 'AB-', 'AB+'))
      OR (d.blood_type = 'B+' AND br.required_blood_type IN ('B+', 'AB+'))
      OR (d.blood_type = 'AB-' AND br.required_blood_type IN ('AB-', 'AB+'))
    THEN 'Compatible ✓'
    ELSE 'Not Compatible ✗'
  END as compatibility_status
FROM donors d
CROSS JOIN blood_requests br
WHERE br.status IN ('pending', 'matching', 'urgent')
  AND d.is_available = true
  AND d.health_status = 'eligible'
GROUP BY d.blood_type, br.required_blood_type
ORDER BY d.blood_type, br.required_blood_type;

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================

DO $$
DECLARE
  donor_count int;
  donor_with_location_count int;
  request_count int;
  hospital_count int;
BEGIN
  SELECT COUNT(*) INTO donor_count FROM donors WHERE is_available = true;
  SELECT COUNT(DISTINCT donor_id) INTO donor_with_location_count FROM donor_locations;
  SELECT COUNT(*) INTO request_count FROM blood_requests WHERE status IN ('pending', 'matching', 'urgent');
  SELECT COUNT(*) INTO hospital_count FROM hospitals;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SYSTEM STATUS SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Available Donors: %', donor_count;
  RAISE NOTICE 'Donors with Location: %', donor_with_location_count;
  RAISE NOTICE 'Active Requests: %', request_count;
  RAISE NOTICE 'Hospitals: %', hospital_count;
  RAISE NOTICE '========================================';
  
  IF donor_with_location_count = 0 THEN
    RAISE NOTICE '⚠️  NO DONORS HAVE LOCATIONS SET!';
    RAISE NOTICE 'Action: Run hospital-seed-data-UPDATED.sql';
  END IF;
  
  IF request_count = 0 THEN
    RAISE NOTICE '⚠️  NO ACTIVE BLOOD REQUESTS!';
    RAISE NOTICE 'Action: Run hospital-seed-data-UPDATED.sql';
  END IF;
  
  RAISE NOTICE '';
END $$;
