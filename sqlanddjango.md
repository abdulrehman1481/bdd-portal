1. PostgreSQL + PostGIS Raw SQL Schema
Save this as database_schema.sql. Copilot can read this to understand the exact database constraints, spatial indexes, and foreign key relationships.

SQL
-- Enable PostGIS extension for spatial queries (MANDATORY)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    password VARCHAR(128) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    email VARCHAR(254) UNIQUE NOT NULL,
    phone_number VARCHAR(17) UNIQUE NOT NULL,
    role VARCHAR(10) NOT NULL CHECK (role IN ('DONOR', 'HOSPITAL', 'ADMIN')),
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    date_joined TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_phone_idx ON users(phone_number);

-- 2. DONOR PROFILES
CREATE TABLE donor_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blood_group VARCHAR(3) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-')),
    date_of_birth DATE NOT NULL,
    weight_kg DECIMAL(5,2) NOT NULL CHECK (weight_kg >= 50.00),
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('M', 'F', 'O')),
    is_available BOOLEAN DEFAULT TRUE,
    last_donation_date DATE,
    location GEOGRAPHY(Point, 4326) NOT NULL, -- SRID 4326 is standard GPS coords
    location_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX donor_blood_idx ON donor_profiles(blood_group);
-- Spatial Index for instant radius searches
CREATE INDEX donor_location_gist ON donor_profiles USING GIST (location);

-- 3. HOSPITAL PROFILES
CREATE TABLE hospital_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    facility_name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    is_verified_by_admin BOOLEAN DEFAULT FALSE,
    nodal_officer_name VARCHAR(255) NOT NULL,
    emergency_phone VARCHAR(17) NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL
);
CREATE INDEX hospital_location_gist ON hospital_profiles USING GIST (location);

-- 4. BLOOD REQUESTS
CREATE TABLE blood_requests (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_name VARCHAR(255) NOT NULL,
    blood_group_needed VARCHAR(3) NOT NULL CHECK (blood_group_needed IN ('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-')),
    units_required INTEGER NOT NULL CHECK (units_required > 0),
    units_fulfilled INTEGER DEFAULT 0,
    urgency VARCHAR(15) NOT NULL CHECK (urgency IN ('STANDARD', 'URGENT', 'CRITICAL')),
    status VARCHAR(15) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PARTIAL', 'FULFILLED', 'CLOSED')),
    required_by_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    hospital_name VARCHAR(255) NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Core Policy: Fulfilled units cannot exceed required units
    CONSTRAINT check_units_fulfilled CHECK (units_fulfilled <= units_required)
);
CREATE INDEX req_blood_idx ON blood_requests(blood_group_needed);
CREATE INDEX req_status_idx ON blood_requests(status);
CREATE INDEX req_urgency_idx ON blood_requests(urgency);
CREATE INDEX req_location_gist ON blood_requests USING GIST (location);

-- 5. DONATION COMMITMENTS (The Ledger)
CREATE TABLE donation_commitments (
    id SERIAL PRIMARY KEY,
    blood_request_id INTEGER NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
    donor_id INTEGER NOT NULL REFERENCES donor_profiles(id) ON DELETE CASCADE,
    status VARCHAR(25) NOT NULL DEFAULT 'ACCEPTED' CHECK (status IN ('ACCEPTED', 'DONATED', 'REJECTED_AT_HOSPITAL', 'NO_SHOW')),
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    -- Core Policy: A donor can only commit once per request
    UNIQUE (blood_request_id, donor_id)
);

-- 6. DONOR PING LOGS (For Algorithm Tracking)
CREATE TABLE donor_ping_logs (
    id SERIAL PRIMARY KEY,
    blood_request_id INTEGER NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
    donor_id INTEGER NOT NULL REFERENCES donor_profiles(id) ON DELETE CASCADE,
    pinged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    did_respond BOOLEAN DEFAULT FALSE,
    UNIQUE (blood_request_id, donor_id)
);
2. Django Models (The Copilot Blueprint)
Save this as models.py. If you are splitting your Django project into apps, you can keep this as a monolithic core/models.py for simplicity during the MVP phase, or split them later. Copilot will understand the relationships either way.

Python
from django.contrib.gis.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError
from datetime import date, timedelta

# --- 1. CORE AUTHENTICATION ---
class User(AbstractUser):
    ROLE_CHOICES = (
        ('DONOR', 'Donor'),
        ('HOSPITAL', 'Hospital'),
        ('ADMIN', 'System Admin'),
    )
    phone_regex = RegexValidator(regex=r'^\+?1?\d{9,15}$', message="Format: '+999999999'. Up to 15 digits allowed.")
    
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    phone_number = models.CharField(validators=[phone_regex], max_length=17, unique=True)
    email = models.EmailField(unique=True)
    
    is_phone_verified = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    is_banned = models.BooleanField(default=False)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'phone_number', 'role']

    def __str__(self):
        return f"{self.email} ({self.role})"


# --- 2. PROFILES & GEOSPATIAL ---
BLOOD_GROUPS = (
    ('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'),
    ('O+', 'O+'), ('O-', 'O-'), ('AB+', 'AB+'), ('AB-', 'AB-'),
)

class DonorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='donor_profile')
    blood_group = models.CharField(max_length=3, choices=BLOOD_GROUPS, db_index=True)
    date_of_birth = models.DateField()
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2)
    gender = models.CharField(max_length=10, choices=(('M', 'Male'), ('F', 'Female'), ('O', 'Other')))
    
    is_available = models.BooleanField(default=True)
    last_donation_date = models.DateField(null=True, blank=True)
    
    # GeoDjango fields
    location = models.PointField(geography=True, spatial_index=True)
    location_updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_eligible_to_donate(self):
        """90-day cooldown and >50kg weight policy."""
        if not self.is_available or self.weight_kg < 50:
            return False
        if self.last_donation_date:
            return date.today() >= self.last_donation_date + timedelta(days=90)
        return True

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.blood_group}"

class HospitalProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='hospital_profile')
    facility_name = models.CharField(max_length=255)
    license_number = models.CharField(max_length=100, unique=True)
    is_verified_by_admin = models.BooleanField(default=False)
    
    nodal_officer_name = models.CharField(max_length=255)
    emergency_phone = models.CharField(max_length=17)
    
    location = models.PointField(geography=True, spatial_index=True)

    def __str__(self):
        return self.facility_name


# --- 3. BLOOD REQUEST ENGINE ---
class BloodRequest(models.Model):
    URGENCY = (
        ('STANDARD', 'Standard (24-48 hrs)'),
        ('URGENT', 'Urgent (Within 12 hrs)'),
        ('CRITICAL', 'Critical (Immediate)'),
    )
    STATUS = (
        ('ACTIVE', 'Active & Searching'),
        ('PARTIAL', 'Partially Fulfilled'),
        ('FULFILLED', 'Fully Fulfilled'),
        ('CLOSED', 'Closed/Expired'),
    )
    
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_requests')
    patient_name = models.CharField(max_length=255)
    blood_group_needed = models.CharField(max_length=3, choices=BLOOD_GROUPS, db_index=True)
    units_required = models.PositiveIntegerField(default=1)
    units_fulfilled = models.PositiveIntegerField(default=0)
    
    urgency = models.CharField(max_length=15, choices=URGENCY, db_index=True)
    status = models.CharField(max_length=15, choices=STATUS, default='ACTIVE', db_index=True)
    required_by_datetime = models.DateTimeField()
    
    hospital_name = models.CharField(max_length=255)
    location = models.PointField(geography=True, spatial_index=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.units_fulfilled > self.units_required:
            raise ValidationError("Fulfilled units cannot exceed required units.")

    def save(self, *args, **kwargs):
        self.clean()
        # Auto-update status based on fulfillment
        if self.units_fulfilled >= self.units_required:
            self.status = 'FULFILLED'
        elif self.units_fulfilled > 0:
            self.status = 'PARTIAL'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.blood_group_needed} at {self.hospital_name} ({self.urgency})"


# --- 4. COMMITMENT LEDGER & LOGGING ---
class DonationCommitment(models.Model):
    STATUS = (
        ('ACCEPTED', 'Donor Accepted, En Route'),
        ('DONATED', 'Successfully Donated'),
        ('REJECTED_AT_HOSPITAL', 'Rejected (Health issues)'),
        ('NO_SHOW', 'Donor did not show up'),
    )
    
    blood_request = models.ForeignKey(BloodRequest, on_delete=models.CASCADE, related_name='commitments')
    donor = models.ForeignKey(DonorProfile, on_delete=models.CASCADE, related_name='commitments')
    status = models.CharField(max_length=25, choices=STATUS, default='ACCEPTED')
    
    accepted_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ('blood_request', 'donor')

    def __str__(self):
        return f"{self.donor} -> {self.blood_request}"

class DonorPingLog(models.Model):
    blood_request = models.ForeignKey(BloodRequest, on_delete=models.CASCADE)
    donor = models.ForeignKey(DonorProfile, on_delete=models.CASCADE)
    pinged_at = models.DateTimeField(auto_now_add=True)
    did_respond = models.BooleanField(default=False)

    class Meta:
        unique_together = ('blood_request', 'donor')
Pro-tip for Copilot: Open these files in your IDE and write a comment at the top of a new file saying something like: "Using the models defined in models.py, generate a Django REST Framework ModelViewSet to allow hospitals to query donors within a 5km radius." Copilot will read the PointField context and write the exact GeoDjango query you need.