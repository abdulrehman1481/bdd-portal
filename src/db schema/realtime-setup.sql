-- ============================================================================
-- SUPABASE REAL-TIME SETUP
-- Enables real-time subscriptions for blood requests and donor responses
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. ENABLE REAL-TIME REPLICATION
-- ============================================================================

-- Enable real-time for blood_requests table (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'blood_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blood_requests;
  END IF;
END $$;

-- Enable real-time for donor_responses table (if not already enabled)
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

-- Enable real-time for notifications table (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Enable real-time for matches table (optional, if you want to track matches)
DO $$
BEGIN
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
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on donor_responses if not already enabled
ALTER TABLE public.donor_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Donors can view their own responses
CREATE POLICY "Donors can view own responses" ON public.donor_responses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Donors can insert their own responses
CREATE POLICY "Donors can create responses" ON public.donor_responses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Donors can update their own responses
CREATE POLICY "Donors can update own responses" ON public.donor_responses
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Hospitals can view responses for their requests
CREATE POLICY "Hospitals can view request responses" ON public.donor_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM blood_requests br
      JOIN hospitals h ON h.id = br.hospital_id
      WHERE br.id = donor_responses.request_id
      AND h.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. REAL-TIME HELPER FUNCTIONS
-- ============================================================================

-- Function to get real-time updates for a specific request
CREATE OR REPLACE FUNCTION get_request_realtime_data(p_request_id uuid)
RETURNS TABLE (
  request_id uuid,
  request_number text,
  status text,
  priority text,
  units_required int,
  units_fulfilled int,
  accepted_donors_count int,
  matched_donors_count int,
  response_count_available int,
  response_count_interested int,
  response_count_total int,
  last_updated timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    br.id,
    br.request_number,
    br.status,
    br.priority,
    br.units_required,
    br.units_fulfilled,
    br.accepted_donors_count,
    br.matched_donors_count,
    COUNT(CASE WHEN dr.response_type = 'available' THEN 1 END)::int as available_count,
    COUNT(CASE WHEN dr.response_type = 'interested' THEN 1 END)::int as interested_count,
    COUNT(dr.id)::int as total_responses,
    br.updated_at
  FROM blood_requests br
  LEFT JOIN donor_responses dr ON dr.request_id = br.id
  WHERE br.id = p_request_id
  GROUP BY br.id, br.request_number, br.status, br.priority, 
           br.units_required, br.units_fulfilled, br.accepted_donors_count,
           br.matched_donors_count, br.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_request_realtime_data(uuid) TO authenticated;

-- ============================================================================
-- 4. TRIGGERS TO UPDATE TIMESTAMPS FOR REAL-TIME
-- ============================================================================

-- Trigger to update blood_requests.updated_at when donor_responses changes
CREATE OR REPLACE FUNCTION update_request_on_response_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE blood_requests
  SET updated_at = now()
  WHERE id = COALESCE(NEW.request_id, OLD.request_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_request_on_response ON donor_responses;
CREATE TRIGGER trigger_update_request_on_response
  AFTER INSERT OR UPDATE OR DELETE ON donor_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_request_on_response_change();

-- ============================================================================
-- 5. MATERIALIZED VIEW FOR REAL-TIME DASHBOARD (Optional)
-- ============================================================================

-- Create a materialized view for quick dashboard stats
CREATE MATERIALIZED VIEW IF NOT EXISTS realtime_dashboard_stats AS
SELECT 
  -- Active requests
  (SELECT COUNT(*) FROM blood_requests WHERE status IN ('pending', 'matching', 'notified', 'partial')) as active_requests,
  
  -- Total responses today
  (SELECT COUNT(*) FROM donor_responses WHERE created_at >= CURRENT_DATE) as responses_today,
  
  -- Available donors now
  (SELECT COUNT(DISTINCT donor_id) FROM donor_responses 
   WHERE response_type = 'available' 
   AND created_at >= now() - interval '24 hours') as available_donors_24h,
  
  -- Urgent requests
  (SELECT COUNT(*) FROM blood_requests WHERE priority = 'urgent' AND status IN ('pending', 'matching')) as urgent_requests,
  
  -- Last update timestamp
  now() as last_updated;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_stats_timestamp 
ON realtime_dashboard_stats(last_updated);

-- Function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY realtime_dashboard_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_dashboard_stats() TO authenticated;
GRANT SELECT ON realtime_dashboard_stats TO authenticated;

-- ============================================================================
-- 6. WEBHOOK/NOTIFICATION TRIGGER (Optional)
-- ============================================================================

-- Function to send webhook notification when donor responds
CREATE OR REPLACE FUNCTION notify_hospital_on_donor_response()
RETURNS TRIGGER AS $$
DECLARE
  v_hospital_user_id uuid;
  v_hospital_name text;
  v_donor_name text;
BEGIN
  -- Get hospital and donor details
  SELECT h.user_id, h.name INTO v_hospital_user_id, v_hospital_name
  FROM blood_requests br
  JOIN hospitals h ON h.id = br.hospital_id
  WHERE br.id = NEW.request_id;
  
  SELECT u.full_name INTO v_donor_name
  FROM users u
  WHERE u.id = NEW.user_id;
  
  -- Create in-app notification
  IF NEW.response_type IN ('available', 'interested') THEN
    INSERT INTO notifications (
      user_id,
      notification_type,
      title,
      message,
      metadata
    )
    VALUES (
      v_hospital_user_id,
      'match_found',
      'New Donor Response',
      format('%s has marked themselves as %s for your blood request', 
        v_donor_name, NEW.response_type),
      jsonb_build_object(
        'request_id', NEW.request_id,
        'donor_id', NEW.donor_id,
        'response_type', NEW.response_type,
        'distance_km', NEW.distance_km
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_hospital_on_response ON donor_responses;
CREATE TRIGGER trigger_notify_hospital_on_response
  AFTER INSERT ON donor_responses
  FOR EACH ROW
  WHEN (NEW.response_type IN ('available', 'interested'))
  EXECUTE FUNCTION notify_hospital_on_donor_response();

-- ============================================================================
-- 7. REAL-TIME CHANNEL CONFIGURATION
-- ============================================================================

/*
USAGE IN FRONTEND (JavaScript/TypeScript):

// Subscribe to blood request updates
const requestChannel = supabase
  .channel('blood-request-updates')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'blood_requests',
      filter: `id=eq.${requestId}`
    },
    (payload) => {
      console.log('Request updated:', payload);
      // Update UI with new data
    }
  )
  .subscribe();

// Subscribe to donor responses for a specific request
const responsesChannel = supabase
  .channel('donor-responses')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'donor_responses',
      filter: `request_id=eq.${requestId}`
    },
    (payload) => {
      console.log('New donor response:', payload);
      // Update donor list in real-time
    }
  )
  .subscribe();

// Subscribe to notifications
const notificationsChannel = supabase
  .channel('notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('New notification:', payload);
      // Show notification toast
    }
  )
  .subscribe();

// Cleanup
return () => {
  supabase.removeChannel(requestChannel);
  supabase.removeChannel(responsesChannel);
  supabase.removeChannel(notificationsChannel);
};
*/

-- ============================================================================
-- 8. PERFORMANCE MONITORING
-- ============================================================================

-- View to monitor real-time activity
CREATE OR REPLACE VIEW realtime_activity_monitor AS
SELECT 
  'blood_requests' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE updated_at > now() - interval '1 minute') as updated_last_minute,
  COUNT(*) FILTER (WHERE updated_at > now() - interval '5 minutes') as updated_last_5_minutes,
  MAX(updated_at) as last_update
FROM blood_requests
WHERE status IN ('pending', 'matching', 'notified', 'partial')

UNION ALL

SELECT 
  'donor_responses' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE updated_at > now() - interval '1 minute') as updated_last_minute,
  COUNT(*) FILTER (WHERE updated_at > now() - interval '5 minutes') as updated_last_5_minutes,
  MAX(updated_at) as last_update
FROM donor_responses
WHERE created_at > now() - interval '24 hours';

GRANT SELECT ON realtime_activity_monitor TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

/*
-- Check which tables are enabled for real-time
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Monitor real-time activity
SELECT * FROM realtime_activity_monitor;

-- Get current dashboard stats
SELECT * FROM realtime_dashboard_stats;

-- Test real-time data function
SELECT * FROM get_request_realtime_data('request-uuid-here');
*/
