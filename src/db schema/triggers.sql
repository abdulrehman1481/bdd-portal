-- ============================================================================
-- HELPER FUNCTIONS AND TRIGGERS FOR AUTOMATIC GEOM GENERATION
-- Run this AFTER the main schema and RLS policies
-- ============================================================================

-- Function to automatically set geom from lat/lng on hospitals
CREATE OR REPLACE FUNCTION public.update_hospital_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update geom automatically
DROP TRIGGER IF EXISTS hospital_geom_trigger ON public.hospitals;
CREATE TRIGGER hospital_geom_trigger
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.hospitals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hospital_geom();

-- Function to automatically set geom from lat/lng on blood_requests
CREATE OR REPLACE FUNCTION public.update_request_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update geom automatically
DROP TRIGGER IF EXISTS request_geom_trigger ON public.blood_requests;
CREATE TRIGGER request_geom_trigger
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.blood_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_request_geom();

-- Function to automatically set geom from lat/lng on donor_locations
CREATE OR REPLACE FUNCTION public.update_donor_location_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update geom automatically
DROP TRIGGER IF EXISTS donor_location_geom_trigger ON public.donor_locations;
CREATE TRIGGER donor_location_geom_trigger
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.donor_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_donor_location_geom();
