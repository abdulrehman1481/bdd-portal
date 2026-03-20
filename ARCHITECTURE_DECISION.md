# Backend Architecture Decision

## Current State
- App uses Next.js + Supabase directly for auth, data, and SQL RPC.
- This is fast to ship but can spread business logic between SQL functions and client code.

## Recommendation
Adopt a hybrid model in two phases:

1. Keep Supabase as managed data/auth platform.
2. Introduce a dedicated backend service for complex business logic and orchestration.

## Why Hybrid Is Better Here
- Better control for matching algorithms and fraud/abuse checks.
- Cleaner separation of concerns: UI in Next.js, business rules in API service, persistence in Supabase.
- Easier versioning and testing for critical workflows (request lifecycle, donor/hospital matching).
- Reduced risk of exposing too much logic in client-side queries.

## Suggested Target Architecture
- Next.js frontend + server routes for presentation concerns.
- Dedicated API service (NestJS/Fastify/Express) for:
  - request orchestration
  - scoring and prioritization
  - external integrations (Pakistan facility sync, geocoding)
  - admin moderation flows
- Supabase PostgreSQL for storage, RLS, and auth identity.
- Background worker/queue for notifications and asynchronous matching refresh.

## Migration Plan
1. Keep existing Supabase RPCs as baseline.
2. Introduce backend endpoints for new workflows only (start with blood request creation + scoring feed).
3. Move matching and response orchestration out of client into backend service.
4. Keep RLS as defense-in-depth, but enforce core policy in backend as primary gate.

## Final Guidance
If team size and traffic are small, current Supabase-centric model is acceptable short-term.
If platform will scale nationally (multi-city Pakistan coverage, high write volume), introduce dedicated backend service now to avoid hard migration later.
