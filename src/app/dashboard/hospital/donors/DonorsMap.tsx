'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import InteractiveMap from '@/components/InteractiveMap';
import { Heart, MapPin, Users, Activity, TrendingUp, Phone, Mail, Navigation, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function MatchedDonorsMap() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [hospitalData, setHospitalData] = useState<any>(null);
  const [donors, setDonors] = useState<any[]>([]);
  const [selectedBloodType, setSelectedBloodType] = useState<string>('all');

  const navItems = [
    { label: 'Dashboard', href: '/dashboard/hospital', icon: Activity },
    { label: 'Blood Requests', href: '/dashboard/hospital/requests', icon: Heart },
    { label: 'Donors Map', href: '/dashboard/hospital/donors', icon: Users },
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    } else if (user) {
      fetchHospitalData();
      fetchMatchedDonors();
    }
  }, [user, loading, router, selectedBloodType]);

  const fetchHospitalData = async () => {
    const { data } = await supabase
      .from('hospitals')
      .select('*')
      .eq('user_id', user?.id)
      .single();
    
    if (data) setHospitalData(data);
  };

  const fetchMatchedDonors = async () => {
    const { data: hospital } = await supabase
      .from('hospitals')
      .select('id')
      .eq('user_id', user?.id)
      .single();

    if (!hospital) return;

    // Get active requests for this hospital
    const { data: requests } = await supabase
      .from('blood_requests')
      .select('id, required_blood_type, priority')
      .eq('hospital_id', hospital.id)
      .in('status', ['pending', 'matching', 'notified', 'urgent', 'partial'])
      .order('created_at', { ascending: false });

    if (!requests || requests.length === 0) {
      setDonors([]);
      return;
    }

    // Get matched donors for all requests using find_nearby_donors RPC
    const allDonors: any[] = [];
    const donorIds = new Set();

    for (const request of requests) {
      const { data, error } = await supabase
        .rpc('find_nearby_donors', {
          p_request_id: request.id,
          p_max_distance: request.priority === 'urgent' ? 50 : 30
        });

      if (data && !error) {
        // Add donors, avoiding duplicates
        data.forEach((donor: any) => {
          if (!donorIds.has(donor.donor_id)) {
            donorIds.add(donor.donor_id);
            allDonors.push({
              id: donor.donor_id,
              donor_id: donor.donor_id,
              donors: {
                id: donor.donor_id,
                blood_type: donor.blood_type,
                total_donations: donor.total_donations
              },
              donor_user: {
                full_name: donor.donor_name,
                phone: donor.contact_phone,
                email: null
              },
              location: {
                latitude: donor.donor_latitude,
                longitude: donor.donor_longitude,
                city: donor.donor_city
              },
              distance_meters: donor.distance_km * 1000,
              has_responded: donor.has_responded,
              response_type: donor.response_type,
              response_status: donor.response_status
            });
          }
        });
      }
    }

    // Filter by blood type if selected
    const filtered = selectedBloodType === 'all' 
      ? allDonors 
      : allDonors.filter(d => d.donors.blood_type === selectedBloodType);

    setDonors(filtered);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  const bloodTypes = ['all', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  return (
    <DashboardLayout navItems={navItems}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Matched Donors Map</h1>
            <p className="text-gray-600 mt-1">View all matched donors on the map</p>
          </div>
        </div>

        {/* Blood Type Filter */}
        <div className="flex gap-2 flex-wrap">
          {bloodTypes.map(type => (
            <button
              key={type}
              onClick={() => setSelectedBloodType(type)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedBloodType === type
                  ? 'bg-red-500 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {type === 'all' ? 'All Types' : type}
            </button>
          ))}
        </div>

        {/* Map */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {hospitalData?.latitude && hospitalData?.longitude ? (
            <InteractiveMap
              center={{ lat: hospitalData.latitude, lng: hospitalData.longitude }}
              markers={[
                // Hospital location
                {
                  id: 'hospital',
                  position: { lat: hospitalData.latitude, lng: hospitalData.longitude },
                  title: hospitalData.name,
                  type: 'hospital'
                },
                // Donor locations
                ...donors
                  .filter(d => d.location?.latitude && d.location?.longitude)
                  .map(donor => ({
                    id: donor.id,
                    position: { 
                      lat: donor.location.latitude, 
                      lng: donor.location.longitude 
                    },
                    title: `${donor.donor_user?.full_name || 'Anonymous'} - ${donor.donors.blood_type}`,
                    type: 'donor' as const,
                    onClick: () => {
                      console.log('Donor:', donor);
                    }
                  }))
              ]}
              height="600px"
              zoom={10}
            />
          ) : (
            <div className="bg-yellow-50 rounded-lg p-12 text-center border-2 border-dashed border-yellow-200">
              <MapPin className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Set Hospital Location</h3>
              <p className="text-gray-600 mb-4">
                Please update your hospital location in profile settings to see the donors map.
              </p>
              <button
                onClick={() => router.push('/dashboard/hospital/profile')}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
              >
                Update Location
              </button>
            </div>
          )}
        </div>

        {/* Donors List */}
        {donors.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Matched Donors ({donors.length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {donors.map((donor) => (
                <div
                  key={donor.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {donor.donor_user?.full_name || 'Anonymous'}
                      </p>
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                        {donor.donors.blood_type}
                      </span>
                    </div>
                  </div>
                  
                  {donor.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <MapPin className="w-4 h-4" />
                      <span>{donor.location.city}</span>
                      {donor.distance_meters && (
                        <span className="text-red-600 font-semibold">
                          • {(donor.distance_meters / 1000).toFixed(1)} km
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <button className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium flex items-center justify-center gap-1">
                      <Phone className="w-4 h-4" />
                      Call
                    </button>
                    <button className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-1">
                      <Mail className="w-4 h-4" />
                      Email
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
