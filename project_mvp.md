1. The MVP Breakdown
To get this to market quickly while setting up the foundation for the future mobile app, your MVP should focus on these core workflows:

A. User & Hospital Authentication

Users (Donors/Requesters): Phone number or email login, profile setup (blood type, weight, last donation date, current location).

Hospitals: Verification workflow, facility location tracking, contact person details.

B. The Dual Dashboards

User Dashboard:

Nearby Feed/Map: A feed of open requests within a 10km radius, sorted by urgency (Critical first).

Request Creator: Form to request blood for family/friends (Patient Name, Age, Blood Type, Hospital Location, Urgency).

Donation Tracker: History of past donations and eligibility countdown.

Hospital Dashboard:

Active Requests: Management of all open requests for their patients.

Donor Radar: A map/search tool allowing the hospital to set a buffer (e.g., 5km) to find registered donors of a specific blood type and send them an SOS ping.

C. The Matching Engine (Core Algorithm)

When a critical request is created, the system queries the database for eligible donors (correct blood type, haven't donated in 90 days) within a geo-fenced radius using PostGIS.

D. Mobile-Readiness

Build the frontend as a Next.js Progressive Web App (PWA) with map integration (using Mapbox or Google Maps). Keep the backend completely decoupled as a REST or GraphQL API so your future mobile app can consume the exact same endpoints.

2. System Architecture
Frontend: Next.js (React) styled with Tailwind CSS. Use React Query for data fetching and caching. Use Mapbox GL JS or Google Maps API for rendering the nearby requests and the hospital "donor radar."

Backend: Django with Django REST Framework (DRF) to serve APIs.

Database: PostgreSQL. Crucially, you must install the PostGIS extension. Standard SQL is slow at calculating distances on a sphere (Earth). PostGIS makes radius searches instant.

Spatial Framework: GeoDjango (django.contrib.gis).

Asynchronous Tasks: Celery + Redis. When a hospital creates a "Critical" request, you don't want the user waiting on the loading screen while the server emails/SMSs 50 nearby users. Celery handles this matching and notifying in the background.

3. Advanced Database Schema (Django)
This schema uses GeoDjango's PointField to store precise geographic coordinates, enabling the "buffer" radius searches you mentioned.

Python
from django.contrib.gis.db import models
from django.contrib.auth.models import AbstractUser

# 1. Base User Model
class User(AbstractUser):
    ROLE_CHOICES = (
        ('DONOR', 'Donor'),
        ('HOSPITAL', 'Hospital'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    phone_number = models.CharField(max_length=15, unique=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

# 2. Donor Profile
class DonorProfile(models.fields):
    BLOOD_GROUPS = (
        ('A+', 'A Positive'), ('A-', 'A Negative'),
        ('B+', 'B Positive'), ('B-', 'B Negative'),
        ('O+', 'O Positive'), ('O-', 'O Negative'),
        ('AB+', 'AB Positive'), ('AB-', 'AB Negative'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='donor_profile')
    blood_group = models.CharField(max_length=3, choices=BLOOD_GROUPS)
    date_of_birth = models.DateField()
    last_donation_date = models.DateField(null=True, blank=True)
    is_available = models.BooleanField(default=True) # Can toggle off if sick/unavailable
    
    # GEOSPATIAL FIELD: Stores Longitude and Latitude
    location = models.PointField(geography=True, spatial_index=True)

# 3. Hospital Profile
class HospitalProfile(models.fields):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='hospital_profile')
    facility_name = models.CharField(max_length=255)
    registration_number = models.CharField(max_length=100, unique=True)
    contact_person = models.CharField(max_length=255)
    
    # GEOSPATIAL FIELD
    location = models.PointField(geography=True, spatial_index=True)

# 4. Blood Request Model
class BloodRequest(models.fields):
    URGENCY_LEVELS = (
        ('NORMAL', 'Normal (within 24-48 hours)'),
        ('URGENT', 'Urgent (within 12 hours)'),
        ('CRITICAL', 'Critical (Immediate)'),
    )
    STATUS = (
        ('OPEN', 'Open'),
        ('FULFILLED', 'Fulfilled'),
        ('CANCELLED', 'Cancelled'),
    )
    
    # Can be created by a Hospital or a regular User
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blood_requests')
    
    patient_name = models.CharField(max_length=255)
    patient_age = models.IntegerField()
    blood_group_required = models.CharField(max_length=3, choices=DonorProfile.BLOOD_GROUPS)
    units_required = models.IntegerField(default=1)
    urgency = models.CharField(max_length=10, choices=URGENCY_LEVELS)
    status = models.CharField(max_length=10, choices=STATUS, default='OPEN')
    
    # Where is the blood needed? (Might differ from the Hospital's main location)
    facility_name = models.CharField(max_length=255)
    location = models.PointField(geography=True, spatial_index=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

# 5. Donation Tracking Model (The Ledger)
class DonationRecord(models.fields):
    STATUS = (
        ('PENDING', 'Pending/Committed'),
        ('COMPLETED', 'Completed'),
        ('NO_SHOW', 'No Show'),
    )
    request = models.ForeignKey(BloodRequest, on_delete=models.CASCADE, related_name='donations')
    donor = models.ForeignKey(DonorProfile, on_delete=models.CASCADE, related_name='donation_history')
    status = models.CharField(max_length=10, choices=STATUS, default='PENDING')
    donation_date = models.DateTimeField(auto_now_add=True)
How the Location Logic works in Django
Because we are using PointField(geography=True), when a hospital wants to search for donors within a 5-kilometer buffer, your Django query will look incredibly simple and run blazing fast:

Python
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance

# 1. Get hospital's location
hospital_location = my_hospital.location 

# 2. Find eligible, available donors within 5 kilometers
nearby_donors = DonorProfile.objects.filter(
    location__distance_lte=(hospital_location, D(km=5)),
    blood_group='O-',
    is_available=True
).annotate(distance=Distance('location', hospital_location)).order_by('distance')
This setup ensures that your Next.js frontend only receives exactly the data it needs to plot pins on the map, and your database handles all the heavy lifting of the geographic math.