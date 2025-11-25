# Quick Start Guide - Blood Donation Platform

## 🚀 Quick Setup (15 minutes)

### 1. Run SQL Files (Supabase SQL Editor)
```sql
-- Copy and execute each file in order:
1. donor-responses.sql      ⭐ NEW
2. realtime-setup.sql        ⭐ NEW  
3. hospital-seed-data.sql    ⭐ NEW
4. location-matching.sql     ⭐ UPDATED (re-run)
```

### 2. Create Hospital Accounts (Supabase Dashboard)
Go to: **Authentication > Users > Add User**

Create 4 accounts:
```
apollo.delhi@hospital.com    / 12345678
aiims.delhi@hospital.com     / 12345678
fortis.noida@hospital.com    / 12345678
max.gurgaon@hospital.com     / 12345678
```

### 3. Test Login
✅ Login with: `apollo.delhi@hospital.com` / `12345678`

---

## 📍 What's Fixed

### ✅ Hospital Data
- 4 hospitals with **proper locations** (lat/lng)
- Located in Delhi NCR area
- Real contact details
- Operating 24/7

### ✅ Donor Responses
- Track who's available vs interested
- Real-time updates
- Distance tracking
- Contact information

### ✅ Real-Time
- Blood requests update live
- Donor responses appear instantly
- No page refresh needed
- Works across multiple tabs

### ✅ Maps
- Hospitals show at correct locations
- Donors plotted accurately
- Distance circles working
- Interactive markers

### ✅ Queries
- Find nearby donors (with responses)
- Find nearby requests (with availability)
- Blood type compatibility (all types)
- Distance-based matching

---

## 🎯 Quick Test

### As Hospital:
1. Login: `apollo.delhi@hospital.com`
2. Create Request: O+, 2 units, urgent
3. View on map (should see marker at Delhi)

### As Donor:
1. Create donor account
2. Set blood type: O+
3. Set location: Delhi
4. View "Nearby Requests"
5. Click "I'm Available"

### Verify Real-Time:
1. Keep hospital page open
2. Have donor respond (different browser/tab)
3. Hospital page updates automatically ✨

---

## 📊 New SQL Functions

### For Hospitals:
```sql
-- Get all responses for a request
SELECT * FROM get_request_responses('request-id');

-- Get only available donors
SELECT * FROM get_request_responses('request-id', 'available');
```

### For Donors:
```sql
-- Find requests within 20km
SELECT * FROM find_nearby_requests('donor-id', 20);

-- Mark yourself available
SELECT record_donor_response(
  'request-id',
  'donor-id',
  'user-id',
  'available',
  'I can come today',
  'afternoon',
  'phone'
);
```

---

## 🗺️ Hospital Locations

| Hospital | City | Coordinates |
|----------|------|-------------|
| Apollo Hospital | Delhi | 28.5355°N, 77.2868°E |
| AIIMS | Delhi | 28.5672°N, 77.2100°E |
| Fortis | Noida | 28.6139°N, 77.3910°E |
| Max | Gurgaon | 28.4420°N, 77.0654°E |

All properly spaced for testing distance calculations!

---

## ⚡ Real-Time Events

Monitor in browser console:
```javascript
// Blood request updated: { event: 'UPDATE', table: 'blood_requests', ... }
// Donor response updated: { event: 'INSERT', table: 'donor_responses', ... }
```

---

## 🔍 Verify Database

```sql
-- Check hospitals created
SELECT name, latitude, longitude FROM hospitals;
-- Should return 4 rows

-- Check real-time enabled
SELECT tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
-- Should include: blood_requests, donor_responses

-- Check functions exist
SELECT proname FROM pg_proc 
WHERE proname LIKE '%donor_response%';
-- Should include: record_donor_response, get_request_responses
```

---

## 🛠️ Frontend Integration

### Update Hospital Request Detail:
File: `src/app/dashboard/hospital/requests/[id]/RequestDetail.tsx`

Change:
```tsx
// OLD
const [matches, setMatches] = useState([]);

// NEW
const [donorResponses, setDonorResponses] = useState([]);

const fetchDonorResponses = async () => {
  const { data } = await supabase
    .rpc('get_request_responses', { p_request_id: requestId });
  setDonorResponses(data);
};
```

### Update Donor Requests:
File: `src/app/dashboard/donor/requests/page.tsx`

Add:
```tsx
const respondToRequest = async (requestId, type) => {
  await supabase.rpc('record_donor_response', {
    p_request_id: requestId,
    p_donor_id: donorId,
    p_user_id: user.id,
    p_response_type: type
  });
};
```

---

## ✅ Success Checklist

- [ ] 4 hospitals can login
- [ ] Create blood request works
- [ ] Hospital shows on map
- [ ] Donors see nearby requests
- [ ] Respond button works
- [ ] Hospital sees response (real-time)
- [ ] Statistics update automatically
- [ ] Distance shows correctly

---

## 🆘 Quick Fixes

### Maps not showing locations?
```sql
-- Re-run
hospital-seed-data.sql
```

### Real-time not working?
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE donor_responses;
```

### Function not found?
```sql
-- Re-run
donor-responses.sql
```

---

## 📚 Full Documentation

See: `IMPLEMENTATION_SUMMARY.md` for complete details
See: `SETUP_GUIDE.md` for step-by-step instructions

---

**Ready to go! Start with Step 1: Run the SQL files** 🚀
