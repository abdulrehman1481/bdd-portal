# Database Setup Guide

## Quick Setup (4 Steps)

Run these SQL files **IN ORDER** in your Supabase SQL Editor:

### Step 1: Main Schema
File: `dbschema.sql`

Creates all tables, indexes, views, and basic triggers.

### Step 2: RLS Policies  
File: `rls-policies.sql`

Enables Row Level Security and creates policies for data access control.

### Step 3: Triggers
File: `triggers.sql`

Sets up automatic geometry field population from latitude/longitude.

### Step 4: Location Matching
File: `location-matching.sql`

Adds location-based matching with buffer zones, distance calculation, and auto-matching.

**Features:**
- Buffer zone matching (20km-50km based on priority)
- Distance calculation (Haversine formula)
- Auto-match donors to requests
- Search functions for donors/hospitals
- Blood type compatibility matching

---

## Verification

After running all files, verify setup:

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check PostGIS
SELECT postgis_version();
```

---

## Troubleshooting

See main `README.md` in project root for detailed troubleshooting steps.

