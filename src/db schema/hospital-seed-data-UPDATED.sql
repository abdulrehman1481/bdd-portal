-- ============================================================================
-- HOSPITAL SEED DATA - UPDATED WITH ACTUAL USER IDS
-- Uses existing authenticated users from your Supabase Auth
-- ============================================================================

-- IMPORTANT: This uses your ACTUAL user IDs from Supabase Auth
-- Make sure these users exist in auth.users before running

-- ============================================================================
-- STEP 1: CLEAN UP EXISTING TEST DATA (OPTIONAL - BE CAREFUL!)
-- ============================================================================

-- Uncomment these lines if you want to start fresh:
-- DELETE FROM public.blood_requests WHERE hospital_id IN (
--   SELECT id FROM public.hospitals WHERE user_id IN (
--     'cedf761a-d880-416f-932b-483abedbb33d',
--     'cd663efb-29d3-42bb-b7c0-9a8790a63f69',
--     '1b07a8c5-b899-4fdc-93a0-d7baa39fa178',
--     '2b5c345e-afef-4e04-9d6d-21b332557ba1'
--   )
-- );
-- DELETE FROM public.hospitals WHERE user_id IN (
--   'cedf761a-d880-416f-932b-483abedbb33d',
--   'cd663efb-29d3-42bb-b7c0-9a8790a63f69',
--   '1b07a8c5-b899-4fdc-93a0-d7baa39fa178',
--   '2b5c345e-afef-4e04-9d6d-21b332557ba1'
-- );

-- ============================================================================
-- STEP 2: UPDATE USERS TABLE WITH HOSPITAL ROLE
-- ============================================================================

-- Update hospital@gmail.com to hospital role
UPDATE public.users 
SET role = 'hospital', 
    full_name = COALESCE(full_name, 'Apollo Hospital Delhi'),
    is_verified = true
WHERE id = 'cedf761a-d880-416f-932b-483abedbb33d';

-- Update hospital1@gmail.com to hospital role
UPDATE public.users 
SET role = 'hospital', 
    full_name = COALESCE(full_name, 'AIIMS New Delhi'),
    is_verified = true
WHERE id = 'cd663efb-29d3-42bb-b7c0-9a8790a63f69';

-- Update hospital2@gmail.com to hospital role
UPDATE public.users 
SET role = 'hospital', 
    full_name = COALESCE(full_name, 'Fortis Hospital Noida'),
    is_verified = true
WHERE id = '1b07a8c5-b899-4fdc-93a0-d7baa39fa178';

-- Update hospital3@gmail.com to hospital role
UPDATE public.users 
SET role = 'hospital', 
    full_name = COALESCE(full_name, 'Max Hospital Gurgaon'),
    is_verified = true
WHERE id = '2b5c345e-afef-4e04-9d6d-21b332557ba1';

-- ============================================================================
-- STEP 3: UPDATE DONORS TO DONOR ROLE
-- ============================================================================

-- Update donor@gmail.com
UPDATE public.users 
SET role = 'donor',
    full_name = COALESCE(full_name, 'Donor User'),
    is_verified = true
WHERE id = 'e01bdb4b-093f-467d-ba2b-a93086151aa2';

-- Update donor1@gmail.com
UPDATE public.users 
SET role = 'donor',
    full_name = COALESCE(full_name, 'Donor One'),
    is_verified = true
WHERE id = '7b609013-0d59-4701-aa0c-8439ef04a940';

-- ============================================================================
-- STEP 4: INSERT/UPDATE HOSPITAL RECORDS
-- ============================================================================

-- Hospital 1: Apollo Hospital Delhi (hospital@gmail.com)
INSERT INTO public.hospitals (
  user_id, name, license_number, hospital_type,
  address, city, state, country, postal_code,
  phone, emergency_phone, email, website,
  geom, latitude, longitude,
  is_verified, verification_date,
  operating_hours, blood_bank_capacity, services, facilities,
  total_requests, fulfilled_requests, rating, rating_count,
  created_at, updated_at
)
VALUES (
  'cedf761a-d880-416f-932b-483abedbb33d', -- hospital@gmail.com
  'Apollo Hospital Delhi',
  'DL-APOLLO-2024-001',
  'private',
  'Mathura Road, Sarita Vihar, New Delhi',
  'New Delhi',
  'Delhi',
  'India',
  '110076',
  '+91-11-26825000',
  '+91-11-26825001',
  'hospital@gmail.com',
  'https://www.apollohospitals.com',
  ST_SetSRID(ST_MakePoint(77.2868, 28.5355), 4326),
  28.5355,
  77.2868,
  true,
  now(),
  '{"monday": {"open": "00:00", "close": "23:59"}, "tuesday": {"open": "00:00", "close": "23:59"}, "wednesday": {"open": "00:00", "close": "23:59"}, "thursday": {"open": "00:00", "close": "23:59"}, "friday": {"open": "00:00", "close": "23:59"}, "saturday": {"open": "00:00", "close": "23:59"}, "sunday": {"open": "00:00", "close": "23:59"}}'::jsonb,
  '{"A+": {"units": 50}, "A-": {"units": 20}, "B+": {"units": 40}, "B-": {"units": 15}, "O+": {"units": 80}, "O-": {"units": 25}, "AB+": {"units": 30}, "AB-": {"units": 10}}'::jsonb,
  '["Emergency Blood Bank", "24x7 Blood Donation Center", "Component Separation", "Apheresis"]'::jsonb,
  '["Parking", "Wheelchair Access", "Cafeteria", "ATM", "Pharmacy"]'::jsonb,
  0, 0, 4.5, 120,
  now(), now()
)
ON CONFLICT (user_id) DO UPDATE SET
  name = EXCLUDED.name,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  geom = EXCLUDED.geom,
  is_verified = EXCLUDED.is_verified,
  updated_at = now();

-- Hospital 2: AIIMS Delhi (hospital1@gmail.com)
INSERT INTO public.hospitals (
  user_id, name, license_number, hospital_type,
  address, city, state, country, postal_code,
  phone, emergency_phone, email, website,
  geom, latitude, longitude,
  is_verified, verification_date,
  operating_hours, blood_bank_capacity, services, facilities,
  total_requests, fulfilled_requests, rating, rating_count,
  created_at, updated_at
)
VALUES (
  'cd663efb-29d3-42bb-b7c0-9a8790a63f69', -- hospital1@gmail.com
  'AIIMS New Delhi',
  'DL-AIIMS-2024-002',
  'government',
  'Ansari Nagar, New Delhi',
  'New Delhi',
  'Delhi',
  'India',
  '110029',
  '+91-11-26588500',
  '+91-11-26588700',
  'hospital1@gmail.com',
  'https://www.aiims.edu',
  ST_SetSRID(ST_MakePoint(77.2100, 28.5672), 4326),
  28.5672,
  77.2100,
  true,
  now(),
  '{"monday": {"open": "00:00", "close": "23:59"}, "tuesday": {"open": "00:00", "close": "23:59"}, "wednesday": {"open": "00:00", "close": "23:59"}, "thursday": {"open": "00:00", "close": "23:59"}, "friday": {"open": "00:00", "close": "23:59"}, "saturday": {"open": "00:00", "close": "23:59"}, "sunday": {"open": "00:00", "close": "23:59"}}'::jsonb,
  '{"A+": {"units": 100}, "A-": {"units": 40}, "B+": {"units": 80}, "B-": {"units": 30}, "O+": {"units": 150}, "O-": {"units": 50}, "AB+": {"units": 60}, "AB-": {"units": 20}}'::jsonb,
  '["Emergency Blood Bank", "24x7 Blood Donation Center", "Component Separation", "Apheresis", "Rare Blood Registry"]'::jsonb,
  '["Parking", "Wheelchair Access", "Cafeteria", "ATM", "Pharmacy", "Public Transport Access"]'::jsonb,
  0, 0, 4.8, 250,
  now(), now()
)
ON CONFLICT (user_id) DO UPDATE SET
  name = EXCLUDED.name,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  geom = EXCLUDED.geom,
  is_verified = EXCLUDED.is_verified,
  updated_at = now();

-- Hospital 3: Fortis Noida (hospital2@gmail.com)
INSERT INTO public.hospitals (
  user_id, name, license_number, hospital_type,
  address, city, state, country, postal_code,
  phone, emergency_phone, email, website,
  geom, latitude, longitude,
  is_verified, verification_date,
  operating_hours, blood_bank_capacity, services, facilities,
  total_requests, fulfilled_requests, rating, rating_count,
  created_at, updated_at
)
VALUES (
  '1b07a8c5-b899-4fdc-93a0-d7baa39fa178', -- hospital2@gmail.com
  'Fortis Hospital Noida',
  'UP-FORTIS-2024-003',
  'private',
  'B-22, Sector 62, Noida',
  'Noida',
  'Uttar Pradesh',
  'India',
  '201301',
  '+91-120-4882200',
  '+91-120-4882250',
  'hospital2@gmail.com',
  'https://www.fortishealthcare.com',
  ST_SetSRID(ST_MakePoint(77.3910, 28.6139), 4326),
  28.6139,
  77.3910,
  true,
  now(),
  '{"monday": {"open": "00:00", "close": "23:59"}, "tuesday": {"open": "00:00", "close": "23:59"}, "wednesday": {"open": "00:00", "close": "23:59"}, "thursday": {"open": "00:00", "close": "23:59"}, "friday": {"open": "00:00", "close": "23:59"}, "saturday": {"open": "00:00", "close": "23:59"}, "sunday": {"open": "00:00", "close": "23:59"}}'::jsonb,
  '{"A+": {"units": 60}, "A-": {"units": 25}, "B+": {"units": 50}, "B-": {"units": 18}, "O+": {"units": 90}, "O-": {"units": 30}, "AB+": {"units": 35}, "AB-": {"units": 12}}'::jsonb,
  '["Emergency Blood Bank", "24x7 Blood Donation Center", "Component Separation", "Apheresis"]'::jsonb,
  '["Parking", "Wheelchair Access", "Cafeteria", "ATM", "Pharmacy", "WiFi"]'::jsonb,
  0, 0, 4.6, 180,
  now(), now()
)
ON CONFLICT (user_id) DO UPDATE SET
  name = EXCLUDED.name,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  geom = EXCLUDED.geom,
  is_verified = EXCLUDED.is_verified,
  updated_at = now();

-- Hospital 4: Max Gurgaon (hospital3@gmail.com)
INSERT INTO public.hospitals (
  user_id, name, license_number, hospital_type,
  address, city, state, country, postal_code,
  phone, emergency_phone, email, website,
  geom, latitude, longitude,
  is_verified, verification_date,
  operating_hours, blood_bank_capacity, services, facilities,
  total_requests, fulfilled_requests, rating, rating_count,
  created_at, updated_at
)
VALUES (
  '2b5c345e-afef-4e04-9d6d-21b332557ba1', -- hospital3@gmail.com
  'Max Hospital Gurgaon',
  'HR-MAX-2024-004',
  'private',
  'Press Enclave Road, Sector 43, Gurgaon',
  'Gurgaon',
  'Haryana',
  'India',
  '122001',
  '+91-124-4842000',
  '+91-124-4842100',
  'hospital3@gmail.com',
  'https://www.maxhealthcare.in',
  ST_SetSRID(ST_MakePoint(77.0654, 28.4420), 4326),
  28.4420,
  77.0654,
  true,
  now(),
  '{"monday": {"open": "00:00", "close": "23:59"}, "tuesday": {"open": "00:00", "close": "23:59"}, "wednesday": {"open": "00:00", "close": "23:59"}, "thursday": {"open": "00:00", "close": "23:59"}, "friday": {"open": "00:00", "close": "23:59"}, "saturday": {"open": "00:00", "close": "23:59"}, "sunday": {"open": "00:00", "close": "23:59"}}'::jsonb,
  '{"A+": {"units": 70}, "A-": {"units": 28}, "B+": {"units": 55}, "B-": {"units": 20}, "O+": {"units": 100}, "O-": {"units": 35}, "AB+": {"units": 40}, "AB-": {"units": 15}}'::jsonb,
  '["Emergency Blood Bank", "24x7 Blood Donation Center", "Component Separation", "Apheresis", "Stem Cell Banking"]'::jsonb,
  '["Parking", "Wheelchair Access", "Cafeteria", "ATM", "Pharmacy", "WiFi", "Helipad"]'::jsonb,
  0, 0, 4.7, 200,
  now(), now()
)
ON CONFLICT (user_id) DO UPDATE SET
  name = EXCLUDED.name,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  geom = EXCLUDED.geom,
  is_verified = EXCLUDED.is_verified,
  updated_at = now();

-- ============================================================================
-- STEP 5: CREATE SAMPLE BLOOD REQUESTS FOR TESTING
-- ============================================================================

-- Request 1: Urgent O+ from Apollo
INSERT INTO public.blood_requests (
  request_number, hospital_id, patient_name, patient_age, patient_gender,
  required_blood_type, units_required, priority, request_type, reason, notes,
  required_by, geom, latitude, longitude, search_radius_km, status,
  auto_match_enabled, matched_donors_count, notified_donors_count, accepted_donors_count,
  created_at, updated_at
)
VALUES (
  'REQ-' || to_char(now(), 'YYYYMMDD') || '-APOLLO-001',
  (SELECT id FROM hospitals WHERE user_id = 'cedf761a-d880-416f-932b-483abedbb33d'),
  'Emergency Patient Alpha',
  35,
  'male',
  'O+',
  3,
  'urgent',
  'emergency',
  'Road accident - Critical blood loss',
  'Patient requires immediate transfusion',
  now() + interval '6 hours',
  ST_SetSRID(ST_MakePoint(77.2868, 28.5355), 4326),
  28.5355,
  77.2868,
  50, -- 50km for urgent
  'pending',
  true,
  0, 0, 0,
  now(), now()
);

-- Request 2: High priority A+ from AIIMS
INSERT INTO public.blood_requests (
  request_number, hospital_id, patient_name, patient_age, patient_gender,
  required_blood_type, units_required, priority, request_type, reason, notes,
  required_by, geom, latitude, longitude, search_radius_km, status,
  auto_match_enabled, matched_donors_count, notified_donors_count, accepted_donors_count,
  created_at, updated_at
)
VALUES (
  'REQ-' || to_char(now(), 'YYYYMMDD') || '-AIIMS-001',
  (SELECT id FROM hospitals WHERE user_id = 'cd663efb-29d3-42bb-b7c0-9a8790a63f69'),
  'Surgery Patient Beta',
  28,
  'female',
  'A+',
  4,
  'high',
  'surgery',
  'Pre-operative requirement for major surgery',
  'Surgery scheduled tomorrow morning',
  now() + interval '24 hours',
  ST_SetSRID(ST_MakePoint(77.2100, 28.5672), 4326),
  28.5672,
  77.2100,
  30, -- 30km for high priority
  'pending',
  true,
  0, 0, 0,
  now(), now()
);

-- Request 3: Normal B+ from Fortis
INSERT INTO public.blood_requests (
  request_number, hospital_id, patient_name, patient_age, patient_gender,
  required_blood_type, units_required, priority, request_type, reason, notes,
  required_by, geom, latitude, longitude, search_radius_km, status,
  auto_match_enabled, matched_donors_count, notified_donors_count, accepted_donors_count,
  created_at, updated_at
)
VALUES (
  'REQ-' || to_char(now(), 'YYYYMMDD') || '-FORTIS-001',
  (SELECT id FROM hospitals WHERE user_id = '1b07a8c5-b899-4fdc-93a0-d7baa39fa178'),
  'Chronic Patient Gamma',
  45,
  'male',
  'B+',
  2,
  'normal',
  'chronic',
  'Thalassemia patient - Regular transfusion',
  'Monthly blood requirement',
  now() + interval '3 days',
  ST_SetSRID(ST_MakePoint(77.3910, 28.6139), 4326),
  28.6139,
  77.3910,
  20, -- 20km for normal
  'pending',
  true,
  0, 0, 0,
  now(), now()
);

-- Request 4: Urgent AB- from Max (Rare blood type)
INSERT INTO public.blood_requests (
  request_number, hospital_id, patient_name, patient_age, patient_gender,
  required_blood_type, units_required, priority, request_type, reason, notes,
  required_by, geom, latitude, longitude, search_radius_km, status,
  auto_match_enabled, matched_donors_count, notified_donors_count, accepted_donors_count,
  created_at, updated_at
)
VALUES (
  'REQ-' || to_char(now(), 'YYYYMMDD') || '-MAX-001',
  (SELECT id FROM hospitals WHERE user_id = '2b5c345e-afef-4e04-9d6d-21b332557ba1'),
  'Critical Patient Delta',
  52,
  'female',
  'AB-',
  2,
  'urgent',
  'emergency',
  'Rare blood type requirement - ICU patient',
  'AB- urgent need, any compatible donor please',
  now() + interval '12 hours',
  ST_SetSRID(ST_MakePoint(77.0654, 28.4420), 4326),
  28.4420,
  77.0654,
  50, -- 50km for urgent rare blood
  'pending',
  true,
  0, 0, 0,
  now(), now()
);

-- ============================================================================
-- STEP 6: CREATE DONOR PROFILES FOR TEST DONOR ACCOUNTS
-- ============================================================================

-- Donor profile for donor@gmail.com
INSERT INTO public.donors (
  user_id, blood_type, date_of_birth, gender, weight_kg, height_cm,
  last_donation_date, next_eligible_date, total_donations,
  health_status, is_available, notification_preferences,
  created_at, updated_at
)
VALUES (
  'e01bdb4b-093f-467d-ba2b-a93086151aa2', -- donor@gmail.com
  'O+',
  '1995-01-15',
  'male',
  75.0,
  175.0,
  now() - interval '4 months',
  now() - interval '1 month', -- Eligible now
  5,
  'eligible',
  true,
  '{"email": true, "sms": true, "push": true}'::jsonb,
  now(), now()
)
ON CONFLICT (user_id) DO UPDATE SET
  blood_type = EXCLUDED.blood_type,
  is_available = EXCLUDED.is_available,
  health_status = EXCLUDED.health_status,
  updated_at = now();

-- Add location for donor@gmail.com (Central Delhi)
INSERT INTO public.donor_locations (
  donor_id, geom, latitude, longitude,
  address, city, state, country, postal_code,
  location_type, is_primary, updated_at
)
VALUES (
  (SELECT id FROM donors WHERE user_id = 'e01bdb4b-093f-467d-ba2b-a93086151aa2'),
  ST_SetSRID(ST_MakePoint(77.2090, 28.6139), 4326),
  28.6139,
  77.2090,
  'Connaught Place',
  'New Delhi',
  'Delhi',
  'India',
  '110001',
  'home',
  true,
  now()
)
ON CONFLICT DO NOTHING;

-- Donor profile for donor1@gmail.com
INSERT INTO public.donors (
  user_id, blood_type, date_of_birth, gender, weight_kg, height_cm,
  last_donation_date, next_eligible_date, total_donations,
  health_status, is_available, notification_preferences,
  created_at, updated_at
)
VALUES (
  '7b609013-0d59-4701-aa0c-8439ef04a940', -- donor1@gmail.com
  'A+',
  '1992-05-20',
  'female',
  62.0,
  165.0,
  now() - interval '5 months',
  now() - interval '2 months', -- Eligible now
  3,
  'eligible',
  true,
  '{"email": true, "sms": true, "push": true}'::jsonb,
  now(), now()
)
ON CONFLICT (user_id) DO UPDATE SET
  blood_type = EXCLUDED.blood_type,
  is_available = EXCLUDED.is_available,
  health_status = EXCLUDED.health_status,
  updated_at = now();

-- Add location for donor1@gmail.com (South Delhi - near Apollo)
INSERT INTO public.donor_locations (
  donor_id, geom, latitude, longitude,
  address, city, state, country, postal_code,
  location_type, is_primary, updated_at
)
VALUES (
  (SELECT id FROM donors WHERE user_id = '7b609013-0d59-4701-aa0c-8439ef04a940'),
  ST_SetSRID(ST_MakePoint(77.2500, 28.5400), 4326),
  28.5400,
  77.2500,
  'Nehru Place',
  'New Delhi',
  'Delhi',
  'India',
  '110019',
  'home',
  true,
  now()
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check hospitals
SELECT id, name, email, city, latitude, longitude, is_verified 
FROM hospitals 
ORDER BY created_at DESC;

-- Check blood requests
SELECT 
  request_number, 
  required_blood_type, 
  units_required, 
  priority, 
  status,
  h.name as hospital_name
FROM blood_requests br
JOIN hospitals h ON br.hospital_id = h.id
ORDER BY br.created_at DESC;

-- Check donors
SELECT 
  u.full_name,
  u.email,
  d.blood_type,
  d.is_available,
  d.health_status,
  dl.city,
  dl.latitude,
  dl.longitude
FROM donors d
JOIN users u ON d.user_id = u.id
LEFT JOIN donor_locations dl ON d.id = dl.donor_id AND dl.is_primary = true
ORDER BY d.created_at DESC;

-- Test find_nearby_requests for first donor
SELECT * FROM find_nearby_requests(
  (SELECT id FROM donors WHERE user_id = 'e01bdb4b-093f-467d-ba2b-a93086151aa2' LIMIT 1),
  50
);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'HOSPITAL SEED DATA LOADED SUCCESSFULLY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Login Credentials:';
  RAISE NOTICE '- Hospital: hospital@gmail.com (Apollo Delhi)';
  RAISE NOTICE '- Hospital: hospital1@gmail.com (AIIMS)';
  RAISE NOTICE '- Hospital: hospital2@gmail.com (Fortis Noida)';
  RAISE NOTICE '- Hospital: hospital3@gmail.com (Max Gurgaon)';
  RAISE NOTICE '- Donor: donor@gmail.com (O+ Blood)';
  RAISE NOTICE '- Donor: donor1@gmail.com (A+ Blood)';
  RAISE NOTICE '';
  RAISE NOTICE '4 Blood Requests Created!';
  RAISE NOTICE '========================================';
END $$;
