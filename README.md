# BloodLink Portal

Real-time blood coordination portal I built with a product mindset.

This web application is the operational front-end of BloodLink. I designed it to be fast, role-aware, and production-ready for donors and hospitals handling urgent blood requests.

## Why This Project Matters

Blood shortage is a time-critical problem. I built this portal to reduce the gap between emergency demand and donor response by making request creation, matching, and response tracking intuitive and reliable.

## What I Built

- Role-based authentication and guarded user journeys
- Donor and hospital dashboards with action-focused workflows
- Blood request creation, tracking, and status management
- Geospatial context using map integrations for better local matching
- Secure APK distribution pipeline for mobile delivery
- Internal operational tooling for controlled artifact uploads

## Product Highlights

- Clear dashboard hierarchy for high-signal decisions
- Low-friction signup and login experience
- Request lifecycle visibility from creation to fulfillment
- API-first architecture for web and mobile parity
- Security-aware design for storage and internal operations

## Tech Stack

- Next.js 16 (App Router)
- React + TypeScript
- Tailwind + custom UI styling
- Django REST backend integration
- Cloud object storage with signed URL flows
- Vercel deployment

## Public Routes

- /
- /auth/signup
- /auth/signin
- /dashboard/donor
- /dashboard/hospital
- /download/apk

Note: private/internal routes are intentionally omitted from this public README.

## Local Development

1. Install dependencies
   npm install

2. Create local environment file
   copy .env.local.example .env.local

3. Start backend API in the backend workspace

4. Start portal
   npm run dev

5. Open http://localhost:3000

## Configuration Notes

- Use .env.local.example as the only source of truth
- Keep all secrets in environment stores only
- Do not commit credentials, tokens, private URLs, or internal access details
- Rotate keys immediately if exposure is suspected

## Deployment Approach

- Deploy through Vercel environments (Development, Preview, Production)
- Keep server-only secrets restricted to non-public scopes
- Validate critical journeys after each deployment:
  - authentication
  - dashboard data loading
  - request creation and updates
  - mobile artifact download flow

## API Contract Used

The portal consumes the platform API families:

- /api/auth/*
- /api/profiles/*
- /api/requests/*
- /api/dashboard/*
- /api/donors/*

## Security and Privacy

- Sensitive operational details are intentionally excluded from this document
- Internal tooling is access-controlled and not publicly linked
- Storage access is mediated with signed requests and short-lived permissions

## Ownership

I built and maintained this project end-to-end, including frontend architecture, integration strategy, deployment workflows, and production hardening.
