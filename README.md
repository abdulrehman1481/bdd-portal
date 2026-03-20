# BloodLink Frontend (Next.js)

This frontend uses your Django API backend from `d:/appdev/bdd/backend`.

## What is implemented

- Reference-inspired landing page converted to TSX
- Auth flow for both donor and hospital
  - Sign up for both roles
  - Sign in and role-based redirect
- Separate dashboards
  - Hospital dashboard
  - Donor dashboard
- Hospital features
  - View KPI summary
  - View active requests
  - Create blood request
  - Trigger matching for a request
  - Donor radar by blood group and radius
  - Map with requests + donor points
- Donor features
  - Update donor profile
  - View eligibility countdown
  - View nearby request feed
  - Map with nearby requests

## Key routes

- `/` : Landing
- `/auth/signup` : Signup (donor/hospital)
- `/auth/signin` : Signin
- `/dashboard/hospital` : Hospital dashboard
- `/dashboard/donor` : Donor dashboard
- `/hospital` : Redirects to hospital dashboard

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create `.env.local` from `.env.local.example`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
```

### 3) Start backend first

```powershell
Set-Location D:/appdev/bdd/backend
d:/appdev/bdd/.venv/Scripts/python.exe manage.py runserver 8000
```

### 4) Start frontend

```bash
Set-Location D:/appdev/bdd/bdd-portal
npm run dev
```

Open `http://localhost:3000`.

## Backend endpoints used

- `POST /api/auth/register/`
- `POST /api/auth/token/`
- `GET /api/auth/me/`
- `GET/PATCH /api/profiles/hospital/`
- `GET/PATCH /api/profiles/donor/`
- `GET /api/requests/`
- `POST /api/requests/create/`
- `POST /api/requests/{id}/trigger-matching/`
- `GET /api/donors/radar/`
- `GET /api/dashboard/hospital/summary/`
- `GET /api/dashboard/donor/feed/`
- `GET /api/dashboard/donor/eligibility/`

## Notes

- Hospital double verification restriction is not enforced yet by backend login; this can be added next as a second-step workflow.
- Session is currently stored in localStorage for MVP speed.
- Maps are rendered with `react-leaflet` + OpenStreetMap tiles.
