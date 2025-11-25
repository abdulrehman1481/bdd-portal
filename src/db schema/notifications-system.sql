-- ============================================================================
-- NOTIFICATIONS SYSTEM FOR 20KM RADIUS BLOOD REQUEST ALERTS
-- This creates a notification system that alerts donors within 20km radius
-- when a hospital creates a blood request matching their blood type
-- 
-- IMPORTANT: Run this AFTER dbschema.sql and location-matching.sql
-- Dependencies: users, donors, donor_locations, hospitals, blood_requests tables
--               calculate_distance() function
-- ============================================================================

-- ============================================================================
-- 1. CREATE NOTIFICATIONS TABLE
-- ============================================================================

-- Drop existing notifications table if it exists (to recreate with proper structure)
DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  donor_id uuid,
  request_id uuid,
  notification_type text NOT NULL CHECK (notification_type IN ('blood_request', 'match_found', 'request_fulfilled', 'reminder')),
  title text NOT NULL,
  message text NOT NULL,
  distance_km float,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Add foreign key constraints only if the tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'donors') THEN
    ALTER TABLE public.notifications 
    ADD CONSTRAINT fk_notifications_donor_id 
    FOREIGN KEY (donor_id) REFERENCES public.donors(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blood_requests') THEN
    ALTER TABLE public.notifications 
    ADD CONSTRAINT fk_notifications_request_id 
    FOREIGN KEY (request_id) REFERENCES public.blood_requests(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_donor_id ON public.notifications(donor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_request_id ON public.notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ============================================================================
-- 2. FUNCTION TO NOTIFY DONORS WITHIN RADIUS
-- ============================================================================

-- Ensure calculate_distance function exists (from location-matching.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'calculate_distance' 
    AND pg_catalog.pg_get_function_result(oid) = 'double precision'
  ) THEN
    RAISE EXCEPTION 'calculate_distance() function not found. Please run location-matching.sql first.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION notify_nearby_donors_on_request()
RETURNS TRIGGER AS $$
DECLARE
  donor_record RECORD;
  distance float;
  notification_radius float;
  donor_count integer := 0;
BEGIN
  -- Determine notification radius based on priority
  notification_radius := CASE 
    WHEN NEW.priority = 'urgent' THEN 50  -- 50km for urgent
    WHEN NEW.priority = 'high' THEN 30    -- 30km for high
    ELSE 20                                -- 20km for normal/low
  END;

  -- Find all eligible donors within radius and matching blood type
  FOR donor_record IN
    SELECT 
      d.id as donor_id,
      d.user_id,
      d.blood_type,
      u.full_name as donor_name,
      u.email,
      u.phone,
      dl.latitude as donor_latitude,
      dl.longitude as donor_longitude,
      dl.city as donor_city,
      calculate_distance(
        dl.latitude, dl.longitude,
        NEW.latitude, NEW.longitude
      ) as dist,
      h.name as hospital_name,
      h.city as hospital_city
    FROM donors d
    JOIN donor_locations dl ON d.id = dl.donor_id AND dl.is_primary = true
    JOIN users u ON d.user_id = u.id
    JOIN hospitals h ON h.id = NEW.hospital_id
    WHERE 
      d.is_available = true
      AND d.health_status = 'eligible'
      AND (d.next_eligible_date IS NULL OR d.next_eligible_date <= CURRENT_DATE)
      AND (
        -- Exact match or compatible blood types
        d.blood_type = NEW.required_blood_type 
        OR d.blood_type = 'O-'  -- Universal donor
        OR (d.blood_type = 'O+' AND NEW.required_blood_type IN ('O+', 'A+', 'B+', 'AB+'))
        OR (d.blood_type = 'A-' AND NEW.required_blood_type IN ('A-', 'A+', 'AB-', 'AB+'))
        OR (d.blood_type = 'A+' AND NEW.required_blood_type IN ('A+', 'AB+'))
        OR (d.blood_type = 'B-' AND NEW.required_blood_type IN ('B-', 'B+', 'AB-', 'AB+'))
        OR (d.blood_type = 'B+' AND NEW.required_blood_type IN ('B+', 'AB+'))
        OR (d.blood_type = 'AB-' AND NEW.required_blood_type IN ('AB-', 'AB+'))
      )
      AND calculate_distance(dl.latitude, dl.longitude, NEW.latitude, NEW.longitude) <= notification_radius
  LOOP
    -- Create notification for each matching donor
    INSERT INTO public.notifications (
      user_id,
      donor_id,
      request_id,
      notification_type,
      title,
      message,
      distance_km,
      metadata
    ) VALUES (
      donor_record.user_id,
      donor_record.donor_id,
      NEW.id,
      'blood_request',
      format('Urgent: %s Blood Needed Nearby!', NEW.required_blood_type),
      format(
        '%s in %s needs %s units of %s blood (%s priority). You are %.1f km away. Can you help?',
        donor_record.hospital_name,
        donor_record.hospital_city,
        NEW.units_required,
        NEW.required_blood_type,
        NEW.priority,
        donor_record.dist
      ),
      donor_record.dist,
      jsonb_build_object(
        'hospital_name', donor_record.hospital_name,
        'hospital_city', donor_record.hospital_city,
        'blood_type', NEW.required_blood_type,
        'units_required', NEW.units_required,
        'priority', NEW.priority,
        'request_number', NEW.request_number,
        'donor_blood_type', donor_record.blood_type,
        'donor_city', donor_record.donor_city
      )
    );
    
    donor_count := donor_count + 1;
  END LOOP;

  -- Log the notification count
  RAISE NOTICE 'Notified % donors within % km for request %', donor_count, notification_radius, NEW.request_number;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. CREATE TRIGGER FOR NEW BLOOD REQUESTS
-- ============================================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_notify_donors_on_new_request ON public.blood_requests;

-- Create trigger that fires after a new blood request is inserted
CREATE TRIGGER trigger_notify_donors_on_new_request
  AFTER INSERT ON public.blood_requests
  FOR EACH ROW
  WHEN (NEW.status IN ('pending', 'matching', 'urgent'))
  EXECUTE FUNCTION notify_nearby_donors_on_request();

-- ============================================================================
-- 4. FUNCTION TO GET USER NOTIFICATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_notifications(
  p_user_id uuid,
  p_limit integer DEFAULT 50,
  p_unread_only boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  notification_type text,
  title text,
  message text,
  distance_km float,
  is_read boolean,
  created_at timestamptz,
  request_id uuid,
  request_number text,
  hospital_name text,
  blood_type text,
  priority text,
  units_required integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.notification_type,
    n.title,
    n.message,
    n.distance_km,
    n.is_read,
    n.created_at,
    br.id as request_id,
    br.request_number,
    h.name as hospital_name,
    br.required_blood_type as blood_type,
    br.priority,
    br.units_required
  FROM public.notifications n
  LEFT JOIN public.blood_requests br ON n.request_id = br.id
  LEFT JOIN public.hospitals h ON br.hospital_id = h.id
  WHERE 
    n.user_id = p_user_id
    AND (NOT p_unread_only OR n.is_read = false)
  ORDER BY n.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. FUNCTION TO MARK NOTIFICATION AS READ
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id uuid,
  p_user_id uuid
)
RETURNS boolean AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.notifications
  SET 
    is_read = true,
    read_at = now()
  WHERE 
    id = p_notification_id
    AND user_id = p_user_id
    AND is_read = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNCTION TO MARK ALL NOTIFICATIONS AS READ
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_all_notifications_read(
  p_user_id uuid
)
RETURNS integer AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.notifications
  SET 
    is_read = true,
    read_at = now()
  WHERE 
    user_id = p_user_id
    AND is_read = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. FUNCTION TO GET UNREAD NOTIFICATION COUNT
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unread_notification_count(
  p_user_id uuid
)
RETURNS integer AS $$
DECLARE
  unread_count integer;
BEGIN
  SELECT COUNT(*)
  INTO unread_count
  FROM public.notifications
  WHERE 
    user_id = p_user_id
    AND is_read = false;
  
  RETURN unread_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. VIEW FOR ACTIVE NOTIFICATIONS WITH DETAILS
-- ============================================================================

CREATE OR REPLACE VIEW active_notifications_view AS
SELECT 
  n.id,
  n.user_id,
  n.donor_id,
  n.request_id,
  n.notification_type,
  n.title,
  n.message,
  n.distance_km,
  n.is_read,
  n.created_at,
  n.read_at,
  d.blood_type as donor_blood_type,
  u.full_name as donor_name,
  u.email as donor_email,
  u.phone as donor_phone,
  br.request_number,
  br.required_blood_type,
  br.units_required,
  br.priority,
  br.status as request_status,
  br.required_by,
  h.name as hospital_name,
  h.city as hospital_city,
  h.phone as hospital_phone,
  CASE 
    WHEN n.created_at > now() - interval '1 hour' THEN 'just_now'
    WHEN n.created_at > now() - interval '24 hours' THEN 'today'
    WHEN n.created_at > now() - interval '7 days' THEN 'this_week'
    ELSE 'older'
  END as time_category
FROM public.notifications n
LEFT JOIN public.donors d ON n.donor_id = d.id
LEFT JOIN public.users u ON n.user_id = u.id
LEFT JOIN public.blood_requests br ON n.request_id = br.id
LEFT JOIN public.hospitals h ON br.hospital_id = h.id
WHERE br.status IN ('pending', 'matching', 'notified', 'urgent')
ORDER BY n.created_at DESC;

-- ============================================================================
-- 9. GRANT PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_notifications(uuid, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count(uuid) TO authenticated;
GRANT SELECT ON active_notifications_view TO authenticated;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

/*
-- Get all notifications for a user:
SELECT * FROM get_user_notifications('user-uuid-here');

-- Get only unread notifications:
SELECT * FROM get_user_notifications('user-uuid-here', 20, true);

-- Mark a notification as read:
SELECT mark_notification_read('notification-uuid-here', 'user-uuid-here');

-- Mark all as read:
SELECT mark_all_notifications_read('user-uuid-here');

-- Get unread count:
SELECT get_unread_notification_count('user-uuid-here');

-- View active notifications with full details:
SELECT * FROM active_notifications_view WHERE user_id = 'user-uuid-here';
*/
