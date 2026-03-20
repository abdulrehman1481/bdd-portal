The Architecture Flow (How it works in real-time)
The Trigger: A hospital fills out a form on your Next.js app to request 2 units of O- blood "CRITICALLY."

The API: Next.js sends a POST request to your Django API.

The Quick Response: Django saves the request to PostgreSQL and immediately returns a 201 Created to Next.js so the hospital's screen doesn't freeze.

The Background Engine: Behind the scenes, Django hands the ID of that request to a Celery Worker.

The Geospatial Match: The Celery worker runs the PostGIS query to find all eligible O- donors within a 10km radius.

The Ping: Celery loops through those donors, sends an SMS (via Twilio/AWS), and creates a DonorPingLog so you don't spam them twice.

The Combined Code Blueprint
Here are the three final pieces you need to feed to Copilot to build out the API and matching engine.

1. The API Serializer (serializers.py)
This dictates how data is translated between your Next.js frontend (JSON) and your Django database.

Python
from rest_framework import serializers
from .models import BloodRequest

class BloodRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = BloodRequest
        fields = '__all__'
        # The frontend shouldn't dictate these; the backend calculates them
        read_only_fields = ['requester', 'units_fulfilled', 'status', 'created_at', 'updated_at']

    def validate(self, data):
        """Ensure the required deadline is in the future."""
        from django.utils import timezone
        if data.get('required_by_datetime') and data['required_by_datetime'] < timezone.now():
            raise serializers.ValidationError("The required time must be in the future.")
        return data
2. The API View (views.py)
This receives the request from Next.js and triggers the background task if it's an emergency.

Python
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import BloodRequest
from .serializers import BloodRequestSerializer
from .tasks import match_and_ping_donors # We will create this next

class BloodRequestCreateView(generics.CreateAPIView):
    queryset = BloodRequest.objects.all()
    serializer_class = BloodRequestSerializer
    permission_classes = [IsAuthenticated] # User or Hospital must be logged in

    def perform_create(self, serializer):
        # 1. Save the request and attach the logged-in user as the requester
        blood_request = serializer.save(requester=self.request.user)
        
        # 2. If it's Urgent or Critical, fire off the Celery background task
        if blood_request.urgency in ['URGENT', 'CRITICAL']:
            # .delay() tells Celery to run this in the background instantly
            match_and_ping_donors.delay(blood_request.id)
3. The Matching Engine & Notifier (tasks.py)
This is the heart of the application. It runs completely in the background via Celery, ensuring your server never crashes even if it has to scan 100,000 users.

Python
from celery import shared_task
from django.contrib.gis.measure import D
from django.utils import timezone
from datetime import timedelta
from .models import BloodRequest, DonorProfile, DonorPingLog

@shared_task
def match_and_ping_donors(blood_request_id):
    """
    Background task to find eligible donors nearby and send them alerts.
    """
    try:
        blood_request = BloodRequest.objects.get(id=blood_request_id)
    except BloodRequest.DoesNotExist:
        return "Request not found."

    # 1. Define routing logic based on urgency
    # Critical gets a wider net (10km), Urgent gets a tighter net (5km)
    search_radius_km = 10 if blood_request.urgency == 'CRITICAL' else 5

    # 2. Calculate the 90-day cooldown threshold
    ninety_days_ago = timezone.now().date() - timedelta(days=90)

    # 3. THE POSTGIS MAGIC QUERY
    # Finds donors who: have the right blood, are available, weigh enough, 
    # haven't donated recently, AND are within the geographic radius.
    eligible_donors = DonorProfile.objects.filter(
        blood_group=blood_request.blood_group_needed,
        is_available=True,
        weight_kg__gte=50,
        location__distance_lte=(blood_request.location, D(km=search_radius_km))
    ).exclude(
        last_donation_date__gt=ninety_days_ago # Exclude recent donors
    )

    pings_sent = 0

    # 4. Loop through and notify
    for donor in eligible_donors:
        # Check the audit log to ensure we haven't already spammed this donor for this request
        if not DonorPingLog.objects.filter(blood_request=blood_request, donor=donor).exists():
            
            # --- INTEGRATION POINT ---
            # Here is where you would call Twilio (SMS), Firebase (Push), or SendGrid (Email)
            # send_sms(donor.user.phone_number, f"URGENT: {blood_request.blood_group_needed} needed at {blood_request.hospital_name}!")
            print(f"Simulating SMS sent to {donor.user.phone_number}")
            
            # Log the ping so we don't double-text them
            DonorPingLog.objects.create(blood_request=blood_request, donor=donor)
            pings_sent += 1
            
            # Optional: Stop pinging if we've notified 20x the required units 
            # (e.g., need 2 units, ping max 40 people)
            if pings_sent >= (blood_request.units_required * 20):
                break

    return f"Successfully pinged {pings_sent} nearby donors."