-- ============================================================================
-- LOCATION-BASED MATCHING SCHEMA - OPTIMIZED FOR BLOOD DONATION
-- This schema adds location support and buffer zone matching
-- Run this AFTER the main dbschema.sql
-- ============================================================================

-- ============================================================================
-- 1. SPATIAL FUNCTIONS FOR DISTANCE CALCULATION
-- ============================================================================

-- Function to calculate distance between two points in kilometers
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
-- 2. MATCHING VIEW WITH BUFFER ZONES
-- ============================================================================

-- View to find eligible donors within buffer zones for blood requests
CREATE OR REPLACE VIEW available_donors_with_distance AS
SELECT 
    d.id as donor_id,
    d.user_id,
    d.blood_type,
    d.is_available,
    d.health_status,
    d.next_eligible_date,
    dl.latitude as donor_latitude,
    dl.longitude as donor_longitude,
    dl.city as donor_city,
    dl.address as donor_address,
    br.id as request_id,
    br.hospital_id,
    br.required_blood_type,
    br.priority,
    br.latitude as request_latitude,
    br.longitude as request_longitude,
    calculate_distance(
        dl.latitude, dl.longitude,
        br.latitude, br.longitude
    ) as distance_km,
    CASE 
        WHEN br.priority = 'urgent' THEN 50  -- 50km for urgent
        WHEN br.priority = 'high' THEN 30    -- 30km for high
        ELSE 20                               -- 20km for normal
    END as buffer_zone_km,
    -- Check if donor is within buffer zone
    calculate_distance(dl.latitude, dl.longitude, br.latitude, br.longitude) <= 
    CASE 
        WHEN br.priority = 'urgent' THEN 50
        WHEN br.priority = 'high' THEN 30
        ELSE 20
    END as is_within_zone
FROM donors d
JOIN donor_locations dl ON d.id = dl.donor_id AND dl.is_primary = true
CROSS JOIN blood_requests br
WHERE 
    d.is_available = true
    AND d.health_status = 'eligible'
    AND (d.next_eligible_date IS NULL OR d.next_eligible_date <= CURRENT_DATE)
    AND br.status IN ('pending', 'matching', 'urgent')
    AND (
        d.blood_type = br.required_blood_type 
        OR 
        -- Universal donor compatibility
        (d.blood_type = 'O-') 
        OR
        -- Compatible blood types
        (d.blood_type = 'O+' AND br.required_blood_type IN ('O+', 'A+', 'B+', 'AB+'))
        OR
        (d.blood_type = 'A-' AND br.required_blood_type IN ('A-', 'A+', 'AB-', 'AB+'))
        OR
        (d.blood_type = 'A+' AND br.required_blood_type IN ('A+', 'AB+'))
        OR
        (d.blood_type = 'B-' AND br.required_blood_type IN ('B-', 'B+', 'AB-', 'AB+'))
        OR
        (d.blood_type = 'B+' AND br.required_blood_type IN ('B+', 'AB+'))
        OR
        (d.blood_type = 'AB-' AND br.required_blood_type IN ('AB-', 'AB+'))
    );

-- ============================================================================
-- 3. FUNCTION TO FIND NEARBY DONORS FOR A REQUEST
-- ============================================================================

-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS find_nearby_donors(uuid, double precision);

CREATE OR REPLACE FUNCTION find_nearby_donors(
    p_request_id uuid,
    p_max_distance float DEFAULT NULL -- If null, uses priority-based buffer
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
-- 4. FUNCTION TO FIND NEARBY REQUESTS FOR A DONOR
-- ============================================================================

-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS find_nearby_requests(uuid, double precision);

CREATE OR REPLACE FUNCTION find_nearby_requests(
    p_donor_id uuid,
    p_max_distance float DEFAULT 20 -- Default 20km radius
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
-- 5. FUNCTION TO SEARCH HOSPITALS BY BLOOD TYPE AVAILABILITY
-- ============================================================================

CREATE OR REPLACE FUNCTION search_hospitals_by_blood_type(
    p_blood_type text,
    p_latitude float,
    p_longitude float,
    p_max_distance float DEFAULT 50
) RETURNS TABLE (
    hospital_id uuid,
    hospital_name text,
    distance_km float,
    city text,
    address text,
    phone text,
    has_stock boolean,
    current_units int,
    is_verified boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.name,
        calculate_distance(p_latitude, p_longitude, h.latitude, h.longitude) as distance,
        h.city,
        h.address,
        h.phone,
        COALESCE((h.blood_bank_capacity->p_blood_type->>'units')::int > 0, false) as has_stock,
        COALESCE((h.blood_bank_capacity->p_blood_type->>'units')::int, 0) as units,
        h.is_verified
    FROM hospitals h
    WHERE 
        calculate_distance(p_latitude, p_longitude, h.latitude, h.longitude) <= p_max_distance
        AND h.is_verified = true
    ORDER BY 
        has_stock DESC,
        distance ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Spatial indexes already exist from main schema, add additional ones
CREATE INDEX IF NOT EXISTS idx_blood_requests_status_priority 
ON blood_requests(status, priority);

CREATE INDEX IF NOT EXISTS idx_donors_available_eligible 
ON donors(is_available, health_status) 
WHERE is_available = true AND health_status = 'eligible';

CREATE INDEX IF NOT EXISTS idx_donor_locations_primary 
ON donor_locations(donor_id, is_primary) 
WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_hospitals_verified 
ON hospitals(is_verified) 
WHERE is_verified = true;

-- ============================================================================
-- 7. TRIGGER TO AUTO-MATCH DONORS WHEN REQUEST IS CREATED
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_auto_match_donors ON blood_requests;

CREATE OR REPLACE FUNCTION auto_match_donors()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert matches for all eligible donors within buffer zone
    INSERT INTO matches (
        request_id, 
        donor_id, 
        distance_meters,
        match_score,
        blood_compatible,
        availability_matched,
        eligibility_status,
        notification_status,
        donor_response
    )
    SELECT 
        NEW.id,
        donor_id,
        distance_km * 1000, -- Convert km to meters
        -- Calculate match score (higher is better)
        100 - (distance_km * 2) + 
        CASE 
            WHEN blood_type = NEW.required_blood_type THEN 20  -- Exact match bonus
            WHEN blood_type = 'O-' THEN 15  -- Universal donor bonus
            ELSE 0
        END as score,
        true, -- blood_compatible
        true, -- availability_matched
        'eligible', -- eligibility_status
        'pending', -- notification_status
        'pending' -- donor_response
    FROM available_donors_with_distance
    WHERE 
        request_id = NEW.id
        AND is_within_zone = true
    ORDER BY distance_km ASC
    LIMIT 50; -- Limit to 50 closest donors
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_match_donors
AFTER INSERT ON blood_requests
FOR EACH ROW
EXECUTE FUNCTION auto_match_donors();

-- ============================================================================
-- 8. HELPER VIEW FOR DASHBOARD STATISTICS
-- ============================================================================

CREATE OR REPLACE VIEW donation_statistics AS
SELECT 
    'total_donors' as metric,
    COUNT(*)::text as value
FROM donors
WHERE is_available = true

UNION ALL

SELECT 
    'active_requests' as metric,
    COUNT(*)::text as value
FROM blood_requests
WHERE status IN ('pending', 'matching', 'urgent')

UNION ALL

SELECT 
    'successful_donations' as metric,
    COUNT(*)::text as value
FROM donation_history

UNION ALL

SELECT 
    'hospitals_verified' as metric,
    COUNT(*)::text as value
FROM hospitals
WHERE is_verified = true;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

/*
-- Find donors within 30km of a request
SELECT * FROM find_nearby_donors('request-uuid-here', 30);

-- Find requests within 20km of a donor
SELECT * FROM find_nearby_requests('donor-uuid-here', 20);

-- Search hospitals with O+ blood within 50km
SELECT * FROM search_hospitals_by_blood_type('O+', 40.7128, -74.0060, 50);

-- Get all statistics
SELECT * FROM donation_statistics;

-- View auto-matched donors for a request
SELECT * FROM available_donors_with_distance 
WHERE request_id = 'request-uuid-here' 
AND is_within_zone = true
ORDER BY distance_km;
*/
