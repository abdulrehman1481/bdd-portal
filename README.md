# Blood Donation Platform MVP

A comprehensive web dashboard for connecting blood donors with hospitals and blood banks. Built with Next.js, React, Supabase, and Tailwind CSS.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=https://kthpwxwajcofavjndvvx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Get your keys from:** Supabase Dashboard → Settings → API

### 3. Setup Database
Run these SQL files **IN ORDER** in your Supabase SQL Editor:

1. **`src/db schema/dbschema.sql`** - Creates all tables, indexes, and triggers
2. **`src/db schema/rls-policies.sql`** - Enables Row Level Security policies  
3. **`src/db schema/triggers.sql`** - Sets up automatic geometry field population
4. **`src/db schema/location-matching.sql`** - Adds location-based matching with buffer zones

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📋 Features

### For Donors
- 🩸 Complete donor profile management
- 📍 Location-based donor registration with geolocation
- 📊 Donation history tracking
- 🔔 Blood request notifications within buffer zones
- ✅ Availability management
- 🗺️ See nearby requests with distance in km

### For Hospitals
- 🏥 Hospital profile and verification
- 📝 Create blood requests with priority levels
- 🔍 Intelligent donor matching with buffer zones (20-50km)
- 📈 Request tracking and management
- 📊 Analytics and statistics
- 🎯 Auto-matching donors based on distance and blood type

### Technical Features
- 🔐 Secure authentication with Supabase Auth
- 🗺️ PostGIS integration for geolocation and buffer zones
- 📏 Haversine formula for accurate distance calculation
- 🛡️ Row Level Security (RLS) for data protection
- 📱 Responsive design with Tailwind CSS
- ⚡ Server-side rendering with Next.js
- 🎨 Modern UI with shadcn/ui components
- 🎯 Smart matching algorithm with blood type compatibility

---

## 🏗️ Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS v3
- **Backend:** Supabase (PostgreSQL + Auth)
- **Database:** PostgreSQL with PostGIS extension
- **Icons:** Lucide React
- **Charts:** Recharts
- **Date Handling:** date-fns

---

## 📁 Project Structure

```
bdd-portal/
├── src/
│   ├── app/
│   │   ├── auth/
│   │   │   ├── login/page.tsx          # Login page
│   │   │   └── signup/page.tsx         # Signup with role selection
│   │   ├── dashboard/
│   │   │   ├── donor/                  # Donor dashboard pages
│   │   │   │   ├── page.tsx           # Main dashboard
│   │   │   │   ├── profile/page.tsx   # Profile management
│   │   │   │   ├── history/page.tsx   # Donation history
│   │   │   │   ├── requests/page.tsx  # Blood requests
│   │   │   │   └── availability/page.tsx
│   │   │   └── hospital/               # Hospital dashboard pages
│   │   │       ├── page.tsx           # Main dashboard
│   │   │       ├── requests/page.tsx  # View all requests
│   │   │       └── create-request/page.tsx
│   │   ├── api/
│   │   │   └── profile/create/route.ts # Profile creation API
│   │   └── page.tsx                    # Landing page
│   ├── components/
│   │   ├── Navbar.tsx                  # Navigation bar
│   │   ├── Sidebar.tsx                 # Sidebar navigation
│   │   ├── StatCard.tsx                # Statistics display
│   │   └── DashboardLayout.tsx         # Layout wrapper
│   ├── contexts/
│   │   └── AuthContext.tsx             # Auth state management
│   ├── lib/
│   │   ├── supabase.ts                 # Supabase client
│   │   └── auth.ts                     # Auth utilities
│   └── db schema/
│       ├── dbschema.sql                # Main database schema
│       ├── rls-policies.sql            # Row Level Security
│       ├── triggers.sql                # Auto geometry triggers
│       └── location-matching.sql       # Location-based matching
├── .env.local                          # Environment variables
├── tailwind.config.js                  # Tailwind configuration
└── package.json                        # Dependencies

```

---

## 🔧 Database Setup Details

### Tables Created
- `users` - User accounts (linked to Supabase Auth)
- `donors` - Donor profiles and health information
- `hospitals` - Hospital/blood bank profiles
- `blood_requests` - Blood donation requests
- `donor_locations` - Donor location history
- `donor_availability` - Donor availability schedules
- `matches` - Donor-request matching records
- `donation_history` - Complete donation records
- `notifications` - User notifications
- `audit_logs` - System audit trail
- `analytics_events` - Analytics tracking

### Security Features
- **Row Level Security (RLS):** Enabled on all tables
- **Policy-based Access:** Users can only access their own data
- **Role-based Permissions:** Different access for donors/hospitals/admins
- **Service Role API:** Secure profile creation with bypass

---

## 🗺️ Location-Based Matching

### Buffer Zones
The system uses intelligent buffer zones based on request priority:

- **Normal Priority:** 20km radius around hospital
- **High Priority:** 30km radius around hospital  
- **Urgent Priority:** 50km radius around hospital

### Blood Type Compatibility
Auto-matching considers compatible blood types:

- **O-**: Universal donor (matches all blood types)
- **O+**: Matches O+, A+, B+, AB+
- **A-**: Matches A-, A+, AB-, AB+
- **A+**: Matches A+, AB+
- **B-**: Matches B-, B+, AB-, AB+
- **B+**: Matches B+, AB+
- **AB-**: Matches AB-, AB+
- **AB+**: Matches AB+ only

### How It Works
1. Hospital creates blood request with priority level
2. System automatically finds compatible donors within buffer zone
3. Donors see nearby requests sorted by distance
4. Match score calculated based on:
   - Exact blood type match (+20 points)
   - Universal donor (+15 points)
   - Distance (closer = higher score)

### Database Functions
```sql
-- Find donors within radius of a request
SELECT * FROM find_nearby_donors('request-id', 30);

-- Find requests within radius of a donor
SELECT * FROM find_nearby_requests('donor-id', 20);

-- Search hospitals with specific blood type
SELECT * FROM search_hospitals_by_blood_type('O+', lat, lng, 50);
```

---

## 🔒 How Authentication Works

1. **Signup:**
   - User creates account via Supabase Auth
   - User record created in `users` table
   - Role-specific profile created (donor/hospital)
   - User redirected to role-specific dashboard

2. **Login:**
   - Authenticate with Supabase
   - Fetch user profile from `users` table
   - Redirect to appropriate dashboard based on role

3. **Data Access:**
   - All queries filtered by RLS policies
   - Users can only see their own data
   - Hospitals can view available donors
   - Donors can view active blood requests

---

## 🐛 Troubleshooting

### 406 Errors (Not Acceptable)
**Cause:** RLS policies not applied or blocking queries

**Fix:**
1. Verify you ran `rls-policies.sql` in Supabase SQL Editor
2. Check policies exist:
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```
3. Ensure user is authenticated (check browser console)

### Profile Not Created During Signup
**Cause:** Missing service role key

**Fix:**
1. Get service role key from Supabase Dashboard → Settings → API
2. Add to `.env.local`: `SUPABASE_SERVICE_ROLE_KEY=your_key`
3. **Restart dev server:** Stop (Ctrl+C) and run `npm run dev` again

### Geometry/Location Errors
**Cause:** PostGIS not enabled or triggers not applied

**Fix:**
1. Enable PostGIS: `CREATE EXTENSION IF NOT EXISTS postgis;`
2. Run `triggers.sql` in Supabase SQL Editor
3. Verify: `SELECT postgis_version();`

### Build Errors
**Cause:** Missing dependencies or TypeScript errors

**Fix:**
```bash
# Clean install
Remove-Item node_modules, package-lock.json -Recurse -Force
npm install

# Clean build
Remove-Item .next -Recurse -Force
npm run build
```

---

## 📊 Verify Database Setup

Run these queries in Supabase SQL Editor:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check if policies exist
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check PostGIS
SELECT postgis_version();
```

---

## 🧪 Testing the Application

### Test Donor Signup
1. Go to http://localhost:3000
2. Click "Get Started"
3. Select "I'm a Donor"
4. Fill in:
   - Email: test-donor@example.com
   - Password: test123456
   - Name, blood type, date of birth, etc.
5. Should redirect to `/dashboard/donor`
6. Check database for records in `users` and `donors` tables

### Test Hospital Signup
1. Go to http://localhost:3000
2. Click "Get Started"
3. Select "I'm a Hospital"
4. Fill in:
   - Email: test-hospital@example.com
   - Password: test123456
   - Hospital name, license, address, etc.
5. Should redirect to `/dashboard/hospital`
6. Check database for records in `users` and `hospitals` tables

### Test Blood Request Creation
1. Login as hospital
2. Go to "Create Request"
3. Fill in blood type, units, priority, etc.
4. Submit request
5. Check `blood_requests` table for new record

---

## 🚀 Deployment

### Build for Production
```bash
npm run build
npm start
```

### Deploy to Vercel
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy

---

## 📝 Next Steps (Future Enhancements)

- [ ] Implement matching algorithm
- [ ] Add real-time notifications
- [ ] Build admin dashboard
- [ ] Add email notifications
- [ ] Implement blood inventory management
- [ ] Add mobile responsiveness improvements
- [ ] Add unit and integration tests
- [ ] Implement analytics dashboard
- [ ] Add multi-language support
- [ ] Build mobile app (React Native)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🆘 Support

Having issues? Check:
1. This README's troubleshooting section
2. `src/db schema/README.md` for database setup details
3. Browser console for error messages
4. Supabase logs in Dashboard

---

**Built with ❤️ for saving lives**
