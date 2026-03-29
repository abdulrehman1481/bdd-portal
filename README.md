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
- `/download/apk` : Public APK download page
- `/api/apk/download` : Signed private R2 APK redirect
- `/internal/apk-upload` : Protected APK upload console (not linked in nav)
- `/api/apk/upload-url` : Protected signed URL API for direct browser-to-R2 upload

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create `.env.local` from `.env.local.example`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api

# Cloudflare R2 private APK download
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_S3_API_URL=https://your_account_id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=bdd-link
R2_APK_OBJECT_KEY=apk/bloodlink.apk
R2_SIGNED_URL_EXPIRES_SECONDS=300

# Basic auth for hidden APK upload route/API
APK_UPLOAD_USER=your_upload_username
APK_UPLOAD_PASS=your_upload_password
```

### 2.1) Vercel Environment Variables (Production)

Add these keys in Vercel Project Settings -> Environment Variables:

- `NEXT_PUBLIC_API_BASE_URL`
- `R2_ACCOUNT_ID`
- `R2_S3_API_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_APK_OBJECT_KEY`
- `R2_SIGNED_URL_EXPIRES_SECONDS`
- `APK_UPLOAD_USER`
- `APK_UPLOAD_PASS`

Recommended values for this project:

- `R2_ACCOUNT_ID=f24cb5cfab87962127776fb0d44ebef2`
- `R2_S3_API_URL=https://f24cb5cfab87962127776fb0d44ebef2.r2.cloudflarestorage.com`
- `R2_BUCKET_NAME=bdd-link`
- `R2_APK_OBJECT_KEY=apk/bloodlink.apk`
- `R2_SIGNED_URL_EXPIRES_SECONDS=300`

Security note:

- Do not commit real `R2_SECRET_ACCESS_KEY` / API tokens into source control.
- If credentials were exposed in chat/logs, rotate them in Cloudflare and update Vercel immediately.

R2 CORS requirement for browser upload:

- In Cloudflare R2 bucket settings, allow CORS for your portal origins.
- Allow methods: `PUT`, `GET`, `HEAD`.
- Allow headers: `Content-Type`.

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
