# Blood Donation Platform - Database Setup & Implementation Guide

## 📋 Overview

This guide will help you set up the complete blood donation platform with:
- 4 Hospital test accounts
- Donor response tracking system
- Real-time updates for blood requests and responses
- Location-based matching
- Interactive maps

## 🗄️ Database Setup Order

Execute the SQL files in this **exact order**:

### 1. Core Schema
```sql
-- File: dbschema.sql
-- Creates: users, donors, hospitals, blood_requests, matches, donation_history, notifications
```

### 2. Location Matching
```sql
-- File: location-matching.sql
-- Creates: Distance calculations, donor matching functions, spatial queries
```

### 3. Notifications System
```sql
-- File: notifications-system.sql  
-- Creates: Notification triggers, donor notification functions
```

### 4. Donor Responses ⭐ NEW
```sql
-- File: donor-responses.sql
-- Creates: donor_responses table, response tracking functions
```

### 5. Real-Time Setup ⭐ NEW
```sql
-- File: realtime-setup.sql
-- Enables: Real-time subscriptions, RLS policies, triggers
```

### 6. Hospital Seed Data ⭐ NEW
```sql
-- File: hospital-seed-data.sql
-- Creates: 4 test hospital accounts with locations
```

## 🏥 Hospital Test Accounts

After running `hospital-seed-data.sql`, you'll have these test accounts:

| Hospital | Email | Password | Location | Blood Type |
|----------|-------|----------|----------|------------|
| Apollo Hospital Delhi | apollo.delhi@hospital.com | 12345678 | Sarita Vihar, Delhi | All types |
| AIIMS New Delhi | aiims.delhi@hospital.com | 12345678 | Ansari Nagar, Delhi | All types |
| Fortis Hospital Noida | fortis.noida@hospital.com | 12345678 | Sector 62, Noida | All types |
| Max Super Specialty Gurgaon | max.gurgaon@hospital.com | 12345678 | Sector 43, Gurgaon | All types |

### Creating Hospital Accounts in Supabase Auth

1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add User"
3. For each hospital, create:
   - Email: (see table above)
   - Password: 12345678
   - Confirm password
   - **Important**: After creating, update the user's metadata or create the corresponding entry in the `users` table

Alternatively, use Supabase Admin API:

```typescript
// createHospitalAccounts.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const hospitals = [
  { email: 'apollo.delhi@hospital.com', password: '12345678', name: 'Apollo Hospital Delhi' },
  { email: 'aiims.delhi@hospital.com', password: '12345678', name: 'AIIMS New Delhi' },
  { email: 'fortis.noida@hospital.com', password: '12345678', name: 'Fortis Hospital Noida' },
  { email: 'max.gurgaon@hospital.com', password: '12345678', name: 'Max Super Specialty Gurgaon' }
];

for (const hospital of hospitals) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: hospital.email,
    password: hospital.password,
    email_confirm: true
  });
  console.log(`Created: ${hospital.name}`, data?.user?.id);
}
```

## 🔄 Real-Time Features

### Blood Requests
When a hospital creates a blood request:
1. Auto-matches nearby donors
2. Sends notifications to eligible donors
3. Updates in real-time for all watchers

### Donor Responses
When a donor marks themselves as available:
1. Response is recorded in `donor_responses` table
2. Hospital receives instant notification
3. Request statistics update in real-time
4. Other users see updated counts

## 🗺️ Map Implementation

### Hospital View (DonorsMap.tsx)
Shows:
- Hospital location (red marker)
- Matched donors (blue markers)
- Distance circles based on priority
- Donor details on click

### Donor View (Donor Requests)
Shows:
- Nearby blood requests
- Hospital locations
- Distance to each request
- Priority indicators

## 📱 Frontend Integration

### 1. Blood Request Detail Page (Hospital)

```typescript
// /dashboard/hospital/requests/[id]/RequestDetail.tsx
// Features:
// - Real-time donor response updates
// - Live statistics
// - Donor contact information
// - Response status tracking
```

### 2. Donor Requests Page (Donor)

Create: `/dashboard/donor/requests/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DonorRequests() {
  const [requests, setRequests] = useState([]);
  const [donorId, setDonorId] = useState(null);

  useEffect(() => {
    // Fetch donor ID
    fetchDonorId();
  }, []);

  useEffect(() => {
    if (donorId) {
      fetchNearbyRequests();
      
      // Real-time subscription
      const channel = supabase
        .channel('donor-requests')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'blood_requests'
        }, () => {
          fetchNearbyRequests();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [donorId]);

  const fetchDonorId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('donors')
        .select('id')
        .eq('user_id', user.id)
        .single();
      setDonorId(data?.id);
    }
  };

  const fetchNearbyRequests = async () => {
    const { data } = await supabase
      .rpc('find_nearby_requests', {
        p_donor_id: donorId,
        p_max_distance: 20
      });
    setRequests(data || []);
  };

  const respondToRequest = async (requestId: string, responseType: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.rpc('record_donor_response', {
      p_request_id: requestId,
      p_donor_id: donorId,
      p_user_id: user.id,
      p_response_type: responseType,
      p_notes: 'I am available to donate',
      p_preferred_time: 'anytime',
      p_contact_method: 'app'
    });

    // Refresh requests
    fetchNearbyRequests();
  };

  return (
    // UI implementation
  );
}
```

## 🔧 Key SQL Functions

### For Hospitals

```sql
-- Get responses for a request
SELECT * FROM get_request_responses('request-id');

-- Get only available donors
SELECT * FROM get_request_responses('request-id', 'available');

-- Get real-time data
SELECT * FROM get_request_realtime_data('request-id');
```

### For Donors

```sql
-- Find nearby requests
SELECT * FROM find_nearby_requests('donor-id', 20);

-- Record availability response
SELECT record_donor_response(
  'request-id',
  'donor-id',
  'user-id',
  'available',
  'Can come today afternoon',
  'afternoon',
  'phone'
);

-- Get my response history
SELECT * FROM get_donor_responses('donor-id');
```

## 🎯 Testing the System

### 1. Create Test Donor Accounts
- Create 2-3 donor accounts via signup
- Set different blood types
- Set locations near the test hospitals

### 2. Create Blood Request
- Login as a hospital (e.g., apollo.delhi@hospital.com)
- Go to Create Request
- Fill in:
  - Blood Type: O+
  - Units: 2
  - Priority: urgent
  - Location: Auto-filled from hospital

### 3. Check Notifications
- Login as matching donor
- Check notifications
- Should see new blood request notification

### 4. Respond as Donor
- View request details
- Click "I'm Available"
- Select preferred time
- Submit response

### 5. Verify Real-Time Updates
- Keep hospital page open
- When donor responds, see:
  - Statistics update instantly
  - New donor appears in responses list
  - Notification appears

## 📊 Monitoring Real-Time Activity

```sql
-- Check real-time tables enabled
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Monitor activity
SELECT * FROM realtime_activity_monitor;

-- Dashboard stats
SELECT * FROM realtime_dashboard_stats;
```

## 🐛 Troubleshooting

### Real-Time Not Working
1. Check if tables are in publication:
   ```sql
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```

2. Re-enable if needed:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE public.donor_responses;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.blood_requests;
   ```

### Donor Responses Not Showing
1. Check RLS policies are correct
2. Verify function exists:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'get_request_responses';
   ```

3. Test function directly:
   ```sql
   SELECT * FROM get_request_responses('your-request-id');
   ```

### Map Not Showing Locations
1. Verify latitude/longitude are set in hospital_seed_data.sql
2. Check hospitals table:
   ```sql
   SELECT name, latitude, longitude FROM hospitals;
   ```

3. Ensure donor_locations has primary location:
   ```sql
   SELECT d.id, dl.latitude, dl.longitude, dl.is_primary 
   FROM donors d
   LEFT JOIN donor_locations dl ON d.id = dl.donor_id;
   ```

## 🔐 Security Notes

⚠️ **Important**: 
- The password `12345678` is for TESTING ONLY
- Change all passwords in production
- Enable proper RLS policies
- Use environment variables for sensitive data
- Never commit real credentials to version control

## 🚀 Next Steps

1. ✅ Run all SQL files in order
2. ✅ Create hospital auth accounts
3. ✅ Test hospital login
4. ✅ Create test donor accounts
5. ✅ Create blood request
6. ✅ Test donor response
7. ✅ Verify real-time updates
8. ✅ Test map functionality

## 📝 Files Summary

| File | Purpose | Status |
|------|---------|--------|
| dbschema.sql | Core database schema | Existing |
| location-matching.sql | Distance calculations, matching | Updated ✅ |
| notifications-system.sql | Notification triggers | Existing |
| donor-responses.sql | Response tracking system | New ✅ |
| realtime-setup.sql | Real-time configuration | New ✅ |
| hospital-seed-data.sql | Test hospital data | New ✅ |
| RequestDetail.tsx | Hospital request view | Updated ✅ |
| DonorsMap.tsx | Hospital donors map | Needs Update 🔨 |
| InteractiveMap.tsx | Reusable map component | Working ✅ |

## 💡 Tips

- Use the refresh button to manually fetch latest data
- Real-time updates happen automatically
- Check browser console for real-time event logs
- Use Supabase Dashboard > Database > Tables to verify data
- Test with multiple browser windows for real-time

---

**Need Help?** Check the SQL comments or console logs for detailed debugging information.
