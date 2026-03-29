# BloodLink Portal (Next.js)

Production web portal for the BloodLink platform. It provides donor and hospital dashboards, live request workflows, and a secure APK distribution pipeline backed by Cloudflare R2.

## Highlights

- Role-based authentication for donor and hospital users
- Dashboard flows for request creation, tracking, and matching
- OpenStreetMap-powered UI for geospatial blood request context
- Public APK download page with signed private-file access
- Hidden APK upload console protected with Basic Auth
- Direct browser-to-R2 signed upload flow for large APK files

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- React + Tailwind/CSS modules
- Django REST backend integration
- Cloudflare R2 (private object storage)
- Vercel (hosting and deployment)

## Routes

- `/` Landing page
- `/auth/signup` Signup page
- `/auth/signin` Signin page
- `/dashboard/donor` Donor dashboard
- `/dashboard/hospital` Hospital dashboard
- `/download/apk` Public APK download page
- `/internal/apk-upload` Hidden APK upload page (Basic Auth)
- `/api/apk/download` Signed URL redirect for private APK download
- `/api/apk/upload-url` Signed URL API for direct R2 uploads

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Create env file

```bash
cp .env.local.example .env.local
```

3. Start backend (Django)

```powershell
Set-Location D:/appdev/bdd/backend
d:/appdev/bdd/.venv/Scripts/python.exe manage.py runserver 8000
```

4. Start portal

```powershell
Set-Location D:/appdev/bdd/bdd-portal
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Use `.env.local.example` as the source of truth.

Required keys:

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

Important:

- Never commit real secrets.
- If a token/key was exposed, rotate it in Cloudflare and update Vercel.
- Values must not include trailing spaces/newlines.

## R2 CORS Policy (Required For APK Upload)

Apply this in Cloudflare R2 bucket settings:

```json
[
  {
    "AllowedOrigins": [
      "https://bdd-linkvercel.app",
      "https://bdd-portal-git-master-abdul-rehmans-projects-9e0c32a7.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD", "OPTIONS"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "x-amz-request-id", "x-amz-id-2"],
    "MaxAgeSeconds": 3600
  }
]
```

## Deployment (Vercel)

1. Add all environment variables in Vercel Project Settings for `Development`, `Preview`, and `Production`.
2. Deploy:

```bash
npx vercel --prod --yes --cwd d:\appdev\bdd\bdd-portal
```

3. Verify:

- APK download page loads: `/download/apk`
- Hidden upload page challenges for credentials: `/internal/apk-upload`
- Upload completes and updated APK is downloadable

## API Dependencies (Backend)

Portal relies on Django API endpoints for auth, profile, dashboard, request, and inbox workflows.

Core endpoint families:

- `/api/auth/*`
- `/api/profiles/*`
- `/api/requests/*`
- `/api/dashboard/*`
- `/api/donors/*`

## Known Notes

- Browser upload to R2 requires correct bucket CORS and clean env values.
- Hidden upload route is intentionally not linked in navbar.
- Session storage is optimized for MVP speed and deployment simplicity.
