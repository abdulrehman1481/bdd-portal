-- ============================================================================
-- BLOOD DONATION PLATFORM - PRODUCTION DATABASE SCHEMA
-- Enhanced with audit trails, analytics, and advanced features
-- ============================================================================

-- Enable Required Extensions
create extension if not exists postgis;
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm; -- For text search

-- ============================================================================
-- 1. USERS & AUTHENTICATION
-- ============================================================================

create table public.users (
    id uuid primary key default uuid_generate_v4(),
    auth_id uuid unique not null,
    full_name text not null,
    email text unique not null,
    phone text,
    avatar_url text,
    role text not null check (role in ('donor', 'hospital', 'admin')),
    is_active boolean default true,
    is_verified boolean default false,
    verification_token text,
    last_login_at timestamptz,
    login_count int default 0,
    preferences jsonb default '{}',
    metadata jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index users_auth_id_idx on users(auth_id);
create index users_role_idx on users(role);
create index users_email_idx on users(email);
create index users_phone_idx on users(phone);

-- ============================================================================
-- 2. DONORS (Enhanced with analytics)
-- ============================================================================

create table public.donors (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid unique references public.users(id) on delete cascade,
    blood_type text not null check (blood_type in ('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-')),
    date_of_birth date not null,
    gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
    weight_kg float,
    height_cm float,
    last_donation_date date,
    next_eligible_date date,
    total_donations int default 0,
    health_status text default 'eligible' check (health_status in ('eligible', 'temporary_deferral', 'permanent_deferral')),
    health_notes text,
    medical_conditions jsonb default '[]',
    medications jsonb default '[]',
    emergency_contact_name text,
    emergency_contact_phone text,
    preferred_donation_time text, -- e.g., 'morning', 'afternoon', 'evening'
    travel_history jsonb default '[]',
    is_available boolean default true,
    notification_preferences jsonb default '{"email": true, "sms": true, "push": true}',
    privacy_settings jsonb default '{"show_profile": false, "show_stats": true}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index donors_user_id_idx on donors(user_id);
create index donors_blood_type_idx on donors(blood_type);
create index donors_eligible_idx on donors(next_eligible_date) where is_available = true;
create index donors_health_status_idx on donors(health_status);

-- ============================================================================
-- 3. DONOR LOCATIONS (GIS Enhanced)
-- ============================================================================

create table public.donor_locations (
    id uuid primary key default uuid_generate_v4(),
    donor_id uuid references public.donors(id) on delete cascade,
    geom geometry(Point, 4326) not null,
    latitude float not null,
    longitude float not null,
    accuracy float,
    altitude float,
    address text,
    city text,
    state text,
    country text,
    postal_code text,
    location_type text default 'current' check (location_type in ('current', 'home', 'work', 'preferred')),
    is_primary boolean default false,
    updated_at timestamptz default now()
);

create index donor_locations_geom_idx on donor_locations using gist (geom);
create index donor_locations_donor_idx on donor_locations(donor_id);
create index donor_locations_city_idx on donor_locations(city);

-- ============================================================================
-- 4. DONOR AVAILABILITY (Time-based scheduling)
-- ============================================================================

create table public.donor_availability (
    id uuid primary key default uuid_generate_v4(),
    donor_id uuid references public.donors(id) on delete cascade,
    available_now boolean default false,
    day_of_week int check (day_of_week between 0 and 6), -- 0=Sunday
    start_time time,
    end_time time,
    timezone text default 'UTC',
    is_recurring boolean default false,
    valid_from date,
    valid_until date,
    notes text,
    created_at timestamptz default now()
);

create index donor_availability_donor_idx on donor_availability(donor_id);
create index donor_availability_now_idx on donor_availability(available_now) where available_now = true;

-- ============================================================================
-- 5. HOSPITALS (Enhanced with capabilities)
-- ============================================================================

create table public.hospitals (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid unique references public.users(id) on delete cascade,
    name text not null,
    license_number text unique,
    hospital_type text check (hospital_type in ('government', 'private', 'ngo', 'blood_bank')),
    address text not null,
    city text not null,
    state text,
    country text,
    postal_code text,
    phone text not null,
    emergency_phone text,
    email text,
    website text,
    geom geometry(Point, 4326) not null,
    latitude float not null,
    longitude float not null,
    is_verified boolean default false,
    verification_date timestamptz,
    verified_by uuid references public.users(id),
    operating_hours jsonb default '{}', -- {"monday": {"open": "08:00", "close": "20:00"}}
    blood_bank_capacity jsonb default '{}', -- Current stock levels
    services jsonb default '[]', -- Available services
    facilities jsonb default '[]', -- Parking, wheelchair access, etc.
    total_requests int default 0,
    fulfilled_requests int default 0,
    rating float default 0,
    rating_count int default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index hospitals_geom_idx on hospitals using gist (geom);
create index hospitals_city_idx on hospitals(city);
create index hospitals_verified_idx on hospitals(is_verified) where is_verified = true;
create index hospitals_name_trgm_idx on hospitals using gin (name gin_trgm_ops);

-- ============================================================================
-- 6. BLOOD REQUESTS (Enhanced with tracking)
-- ============================================================================

create table public.blood_requests (
    id uuid primary key default uuid_generate_v4(),
    request_number text unique not null, -- Human-readable ID
    hospital_id uuid references public.hospitals(id) on delete cascade,
    patient_name text, -- Optional, for tracking
    patient_age int,
    patient_gender text,
    required_blood_type text not null,
    units_required int not null check (units_required > 0),
    units_fulfilled int default 0,
    priority text not null default 'normal' check (priority in ('urgent', 'high', 'normal', 'low')),
    request_type text default 'emergency' check (request_type in ('emergency', 'surgery', 'chronic', 'replacement')),
    reason text,
    notes text,
    required_by timestamptz not null,
    geom geometry(Point, 4326) not null,
    latitude float not null,
    longitude float not null,
    search_radius_km float default 10,
    status text default 'pending' check (status in ('pending', 'matching', 'notified', 'partial', 'fulfilled', 'cancelled', 'expired')),
    matched_donors_count int default 0,
    notified_donors_count int default 0,
    accepted_donors_count int default 0,
    auto_match_enabled boolean default true,
    notification_sent_at timestamptz,
    fulfilled_at timestamptz,
    cancelled_at timestamptz,
    cancellation_reason text,
    created_by uuid references public.users(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index blood_requests_geom_idx on blood_requests using gist (geom);
create index blood_requests_hospital_idx on blood_requests(hospital_id);
create index blood_requests_status_idx on blood_requests(status);
create index blood_requests_priority_idx on blood_requests(priority);
create index blood_requests_blood_type_idx on blood_requests(required_blood_type);
create index blood_requests_required_by_idx on blood_requests(required_by);

-- ============================================================================
-- 7. MATCHES (Enhanced matching algorithm results)
-- ============================================================================

create table public.matches (
    id uuid primary key default uuid_generate_v4(),
    request_id uuid references public.blood_requests(id) on delete cascade,
    donor_id uuid references public.donors(id) on delete cascade,
    match_rank int, -- 1 = best match
    distance_meters float not null,
    distance_km float generated always as (distance_meters / 1000.0) stored,
    travel_time_minutes int,
    match_score float not null, -- 0-100
    blood_compatible boolean not null,
    availability_matched boolean not null,
    eligibility_status text check (eligibility_status in ('eligible', 'not_eligible', 'needs_review')),
    factors jsonb default '{}', -- Detailed scoring factors
    notified_at timestamptz,
    notification_status text default 'pending' check (notification_status in ('pending', 'sent', 'delivered', 'failed')),
    donor_response text default 'pending' check (donor_response in ('pending', 'accepted', 'declined', 'expired')),
    response_at timestamptz,
    decline_reason text,
    appointment_scheduled_at timestamptz,
    appointment_confirmed boolean default false,
    created_at timestamptz default now(),
    unique(request_id, donor_id)
);

create index matches_request_idx on matches(request_id);
create index matches_donor_idx on matches(donor_id);
create index matches_score_idx on matches(match_score desc);
create index matches_response_idx on matches(donor_response);

-- ============================================================================
-- 8. DONATION HISTORY (Comprehensive tracking)
-- ============================================================================

create table public.donation_history (
    id uuid primary key default uuid_generate_v4(),
    donation_number text unique not null,
    donor_id uuid references public.donors(id) on delete cascade,
    hospital_id uuid references public.hospitals(id),
    request_id uuid references public.blood_requests(id),
    match_id uuid references public.matches(id),
    donation_type text check (donation_type in ('whole_blood', 'plasma', 'platelets', 'double_red')),
    blood_type text not null,
    units int not null,
    donation_date timestamptz not null,
    screening_results jsonb default '{}',
    hemoglobin_level float,
    blood_pressure text,
    weight_kg float,
    adverse_reactions jsonb default '[]',
    donation_duration_minutes int,
    staff_notes text,
    donor_feedback text,
    donor_rating int check (donor_rating between 1 and 5),
    certificate_issued boolean default false,
    certificate_url text,
    created_at timestamptz default now()
);

create index donation_history_donor_idx on donation_history(donor_id);
create index donation_history_hospital_idx on donation_history(hospital_id);
create index donation_history_date_idx on donation_history(donation_date desc);
create index donation_history_request_idx on donation_history(request_id);

-- ============================================================================
-- 9. NOTIFICATIONS (Multi-channel)
-- ============================================================================

create table public.notifications (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.users(id) on delete cascade,
    notification_type text not null check (notification_type in ('urgent_request', 'match_found', 'appointment_reminder', 'eligibility_restored', 'thank_you', 'system')),
    channel text not null check (channel in ('push', 'email', 'sms', 'in_app')),
    priority text default 'normal' check (priority in ('high', 'normal', 'low')),
    title text not null,
    message text not null,
    data jsonb default '{}',
    action_url text,
    scheduled_for timestamptz,
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz,
    status text default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed', 'read')),
    error_message text,
    expires_at timestamptz,
    created_at timestamptz default now()
);

create index notifications_user_idx on notifications(user_id);
create index notifications_status_idx on notifications(status);
create index notifications_sent_at_idx on notifications(sent_at desc);
create index notifications_read_idx on notifications(read_at) where read_at is null;

-- ============================================================================
-- 10. PUSH TOKENS (Multi-device support)
-- ============================================================================

create table public.push_tokens (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.users(id) on delete cascade,
    token text not null,
    platform text check (platform in ('ios', 'android', 'web')),
    device_id text,
    device_name text,
    is_active boolean default true,
    last_used_at timestamptz default now(),
    created_at timestamptz default now(),
    unique(user_id, token)
);

create index push_tokens_user_idx on push_tokens(user_id);
create index push_tokens_active_idx on push_tokens(is_active) where is_active = true;

-- ============================================================================
-- 11. AUDIT LOGS (Security & compliance)
-- ============================================================================

create table public.audit_logs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.users(id),
    action text not null,
    resource_type text not null,
    resource_id uuid,
    ip_address inet,
    user_agent text,
    changes jsonb,
    metadata jsonb default '{}',
    created_at timestamptz default now()
);

create index audit_logs_user_idx on audit_logs(user_id);
create index audit_logs_action_idx on audit_logs(action);
create index audit_logs_created_at_idx on audit_logs(created_at desc);

-- ============================================================================
-- 12. ANALYTICS & REPORTING
-- ============================================================================

create table public.analytics_events (
    id uuid primary key default uuid_generate_v4(),
    event_type text not null,
    user_id uuid references public.users(id),
    session_id text,
    properties jsonb default '{}',
    timestamp timestamptz default now()
);

create index analytics_events_type_idx on analytics_events(event_type);
create index analytics_events_timestamp_idx on analytics_events(timestamp desc);

-- ============================================================================
-- 13. SYSTEM SETTINGS
-- ============================================================================

create table public.system_settings (
    key text primary key,
    value jsonb not null,
    description text,
    updated_by uuid references public.users(id),
    updated_at timestamptz default now()
);

-- Insert default settings
insert into system_settings (key, value, description) values
('matching_radius_km', '50', 'Default search radius for donor matching'),
('urgent_notification_limit', '100', 'Max donors to notify for urgent requests'),
('donation_cooldown_days', '56', 'Days between whole blood donations'),
('auto_expire_requests_hours', '72', 'Hours before unfulfilled requests expire');

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

create or replace function update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on users
    for each row execute function update_updated_at();

create trigger donors_updated_at before update on donors
    for each row execute function update_updated_at();

create trigger hospitals_updated_at before update on hospitals
    for each row execute function update_updated_at();

create trigger blood_requests_updated_at before update on blood_requests
    for each row execute function update_updated_at();

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- Active eligible donors view
create view active_eligible_donors as
select 
    d.*,
    u.full_name,
    u.email,
    u.phone,
    dl.geom,
    dl.city,
    dl.state
from donors d
join users u on d.user_id = u.id
left join donor_locations dl on d.id = dl.donor_id and dl.is_primary = true
where d.is_available = true
    and d.health_status = 'eligible'
    and (d.next_eligible_date is null or d.next_eligible_date <= current_date)
    and u.is_active = true;

-- Request statistics view
create view request_statistics as
select
    hospital_id,
    count(*) as total_requests,
    sum(case when status = 'fulfilled' then 1 else 0 end) as fulfilled_count,
    sum(case when status = 'pending' then 1 else 0 end) as pending_count,
    avg(extract(epoch from (fulfilled_at - created_at))/3600) as avg_fulfillment_hours
from blood_requests
group by hospital_id;