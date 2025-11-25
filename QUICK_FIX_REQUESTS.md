# 🔧 Quick Fix - Requests Not Showing on Map/List

## Problem
Donor dashboard shows requests on homepage but NOT on:
- `/dashboard/donor/requests` page (list view)
- `/dashboard/donor/requests` page (map view)

## Root Cause
Most likely one of these issues:
1. ✅ Donor doesn't have location set
2. ✅ Blood requests don't have proper geom/latitude/longitude
3. ✅ `find_nearby_requests()` function not working
4. ✅ Donor is marked as not eligible or unavailable

## Instant Fix (5 minutes)

### Step 1: Run DEBUG_REQUESTS.sql
```
Open: src/db schema/DEBUG_REQUESTS.sql
Copy ALL → Paste in Supabase SQL Editor → Run
```

This will show you EXACTLY what's wrong with detailed output.

### Step 2: Run Updated Hospital Seed Data
```
Open: src/db schema/hospital-seed-data-UPDATED.sql
Copy ALL → Paste in Supabase SQL Editor → Run
```

This will:
- ✅ Update your existing user accounts to hospital/donor roles
- ✅ Create 4 hospitals with REAL locations
- ✅ Create 4 blood requests (different priorities)
- ✅ Create 2 donor profiles with locations
- ✅ Link everything to your actual user IDs

### Step 3: Run FINAL_SYNC.sql (if not already done)
```
Open: src/db schema/FINAL_SYNC.sql
Copy ALL → Paste in Supabase SQL Editor → Run
```

This ensures all functions and tables are properly configured.

---

## Account Mapping (From Your User IDs)

Your accounts will be mapped as follows:

| Email | User ID | Role | Usage |
|-------|---------|------|-------|
| hospital@gmail.com | cedf761a-d880-416f-932b-483abedbb33d | Hospital | Apollo Hospital Delhi |
| hospital1@gmail.com | cd663efb-29d3-42bb-b7c0-9a8790a63f69 | Hospital | AIIMS New Delhi |
| hospital2@gmail.com | 1b07a8c5-b899-4fdc-93a0-d7baa39fa178 | Hospital | Fortis Noida |
| hospital3@gmail.com | 2b5c345e-afef-4e04-9d6d-21b332557ba1 | Hospital | Max Gurgaon |
| donor@gmail.com | e01bdb4b-093f-467d-ba2b-a93086151aa2 | Donor | O+ Blood, Central Delhi |
| donor1@gmail.com | 7b609013-0d59-4701-aa0c-8439ef04a940 | Donor | A+ Blood, South Delhi |

---

## Test Flow After Running SQL

### Test 1: Login as Donor
```
1. Login: donor@gmail.com (use your password)
2. Go to: /dashboard/donor/requests
3. Expected: See 4 blood requests with distances
4. Click: "I'm Available" on any request
5. Expected: Success message + button changes to "Marked Available"
```

### Test 2: Login as Hospital
```
1. Login: hospital@gmail.com (use your password)
2. Go to: /dashboard/hospital/requests
3. Expected: See the request you created
4. Click on request to view details
5. Expected: See donor who marked themselves available
```

### Test 3: Map View
```
1. Login: donor@gmail.com
2. Go to: /dashboard/donor/requests
3. Click: "Map" button (top right)
4. Expected: 
   - Your location (blue marker)
   - 4 Hospital markers (red)
   - 20km radius circle
   - Distances shown
```

---

## If Still Not Working

### Check 1: Verify Donor Has Location
Run in SQL Editor:
```sql
SELECT 
  u.email,
  d.blood_type,
  dl.latitude,
  dl.longitude,
  dl.is_primary
FROM donors d
JOIN users u ON d.user_id = u.id
LEFT JOIN donor_locations dl ON d.id = dl.donor_id
WHERE u.email = 'donor@gmail.com';
```

Expected Result:
- latitude: 28.6139
- longitude: 77.2090
- is_primary: true

If NULL, run `hospital-seed-data-UPDATED.sql` again.

### Check 2: Verify Requests Exist
Run in SQL Editor:
```sql
SELECT 
  request_number,
  required_blood_type,
  priority,
  status,
  latitude,
  longitude,
  h.name as hospital
FROM blood_requests br
JOIN hospitals h ON br.hospital_id = h.id
WHERE status IN ('pending', 'matching', 'urgent')
ORDER BY created_at DESC;
```

Expected: 4 requests with different blood types

If empty, run `hospital-seed-data-UPDATED.sql` again.

### Check 3: Test Function Directly
Run in SQL Editor:
```sql
SELECT * FROM find_nearby_requests(
  (SELECT id FROM donors WHERE user_id = 'e01bdb4b-093f-467d-ba2b-a93086151aa2'),
  50
);
```

Expected: Returns 4 rows with request details

If error or empty, run `FINAL_SYNC.sql` again.

---

## Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| "No requests found" | No donor location | Run hospital-seed-data-UPDATED.sql |
| "Error fetching requests via RPC" | Function missing | Run FINAL_SYNC.sql |
| "Cannot record response" | donor_responses table missing | Run donor-responses.sql + FINAL_SYNC.sql |
| Empty map | No requests or donor location | Run hospital-seed-data-UPDATED.sql |

---

## Browser Console Check

Open browser console (F12) while on `/dashboard/donor/requests`:

### Good Signs ✅:
```
✓ No error messages
✓ "Results:" shows data
✓ "Donor location set" badge appears
```

### Bad Signs ⚠️:
```
✗ "Error fetching requests via RPC"
✗ "No donor found for user"
✗ "Cannot read properties of undefined"
```

If you see errors, check browser Network tab:
- Look for `rpc/find_nearby_requests` call
- Check Response tab for error details

---

## Quick Manual Fix (If SQL Doesn't Work)

### Add Donor Location Manually:
```sql
-- Replace DONOR_ID with your actual donor id
INSERT INTO donor_locations (
  donor_id, 
  latitude, 
  longitude, 
  city, 
  is_primary, 
  geom
) VALUES (
  'YOUR_DONOR_ID_HERE',
  28.6139,  -- Central Delhi
  77.2090,
  'New Delhi',
  true,
  ST_SetSRID(ST_MakePoint(77.2090, 28.6139), 4326)
);
```

### Add Test Request Manually:
```sql
-- Replace HOSPITAL_ID with your actual hospital id
INSERT INTO blood_requests (
  hospital_id,
  request_number,
  required_blood_type,
  units_required,
  priority,
  status,
  required_by,
  latitude,
  longitude,
  geom
) VALUES (
  'YOUR_HOSPITAL_ID_HERE',
  'REQ-TEST-001',
  'O+',
  2,
  'urgent',
  'pending',
  NOW() + interval '1 day',
  28.5355,
  77.2868,
  ST_SetSRID(ST_MakePoint(77.2868, 28.5355), 4326)
);
```

---

## Success Criteria

✅ Donor dashboard shows requests count  
✅ `/dashboard/donor/requests` shows requests in list view  
✅ Map view shows markers and radius  
✅ Distances are calculated correctly  
✅ "I'm Available" button works  
✅ Hospital sees donor responses  

When all ✅, you're good to go!

---

## Files Created

1. `hospital-seed-data-UPDATED.sql` - Uses your actual user IDs
2. `DEBUG_REQUESTS.sql` - Diagnostic queries
3. This guide - Quick fix instructions

**Run them in order:**
1. FINAL_SYNC.sql (if not done)
2. hospital-seed-data-UPDATED.sql
3. DEBUG_REQUESTS.sql (to verify)

🎉 **Done!**
