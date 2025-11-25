'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import InteractiveMap from '@/components/InteractiveMap';
import { Heart, MapPin, Calendar, Award, Clock, Activity, Building2, Navigation, Map, List, AlertCircle, Phone, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function NearbyRequests() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'matching' | 'nearby'>('nearby');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [donorLocation, setDonorLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [donorBloodType, setDonorBloodType] = useState<string>('');
  const [donorId, setDonorId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showAllOnMap, setShowAllOnMap] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const navItems = [
    { label: 'Dashboard', href: '/dashboard/donor', icon: Activity },
    { label: 'My Profile', href: '/dashboard/donor/profile', icon: Heart },
    { label: 'Donation History', href: '/dashboard/donor/history', icon: Calendar },
    { label: 'Nearby Requests', href: '/dashboard/donor/requests', icon: MapPin },
    { label: 'Availability', href: '/dashboard/donor/availability', icon: Clock },
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    } else if (user) {
      fetchDonorLocation();
      fetchRequests();
    }
  }, [user, loading, router, filter]);

  const fetchDonorLocation = async () => {
    const { data: donor } = await supabase
      .from('donors')
      .select('id, blood_type, user_id, donor_locations(*)')
      .eq('user_id', user?.id)
      .single();

    if (donor) {
      setDonorId(donor.id);
      setUserId(donor.user_id);
      setDonorBloodType(donor.blood_type);
      if (donor.donor_locations?.[0]) {
        const primaryLoc = donor.donor_locations.find((l: any) => l.is_primary) || donor.donor_locations[0];
        setDonorLocation({
          lat: primaryLoc.latitude,
          lng: primaryLoc.longitude
        });
      }
    }
  };

  const fetchRequests = async () => {
    // Get donor ID first
    const { data: donor } = await supabase
      .from('donors')
      .select('id, blood_type')
      .eq('user_id', user?.id)
      .single();

    if (!donor) {
      console.error('No donor found for user');
      return;
    }

    // Determine max distance based on filter
    let maxDistance = 20;
    if (filter === 'urgent') maxDistance = 50;
    else if (filter === 'nearby') maxDistance = 20;
    else if (filter === 'all') maxDistance = 100;

    // Use the find_nearby_requests function to get location-based requests
    const { data, error } = await supabase
      .rpc('find_nearby_requests', {
        p_donor_id: donor.id,
        p_max_distance: maxDistance
      });

    if (error) {
      console.error('Error fetching requests via RPC:', error);
      // Fallback to regular query
      let query = supabase
        .from('blood_requests')
        .select('*, hospitals(name, city, address, phone, latitude, longitude)')
        .in('status', ['pending', 'matching', 'notified', 'urgent', 'partial'])
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });

      if (filter === 'urgent') {
        query = query.eq('priority', 'urgent');
      } else if (filter === 'matching') {
        query = query.eq('required_blood_type', donor.blood_type);
      }

      const { data: fallbackData, error: fallbackError } = await query.limit(50);
      if (fallbackError) {
        console.error('Fallback query error:', fallbackError);
      }
      if (fallbackData) setRequests(fallbackData);
    } else if (data) {
      // Transform RPC data to match component expectations
      let transformedData = data.map((item: any) => ({
        id: item.request_id,
        request_number: item.request_number,
        required_blood_type: item.required_blood_type,
        units_required: item.units_required,
        priority: item.priority,
        status: item.request_status,
        required_by: item.required_by,
        distance_km: item.distance_km,
        has_responded: item.has_responded,
        response_type: item.response_type,
        accepted_donors_count: item.accepted_donors_count,
        hospitals: {
          name: item.hospital_name,
          city: item.hospital_city,
          address: item.hospital_address,
          latitude: item.hospital_latitude,
          longitude: item.hospital_longitude
        }
      }));

      // Apply additional filters
      if (filter === 'urgent') {
        transformedData = transformedData.filter((r: any) => r.priority === 'urgent');
      } else if (filter === 'matching') {
        transformedData = transformedData.filter((r: any) => r.required_blood_type === donor.blood_type);
      } else if (filter === 'nearby') {
        transformedData = transformedData.filter((r: any) => r.distance_km <= 20);
      }

      setRequests(transformedData);
    }
  };

  const respondToRequest = async (requestId: string, responseType: 'available' | 'interested') => {
    if (!donorId || !userId) {
      alert('Unable to respond. Please refresh and try again.');
      return;
    }

    setRespondingTo(requestId);
    
    try {
      const { data, error } = await supabase.rpc('record_donor_response', {
        p_request_id: requestId,
        p_donor_id: donorId,
        p_user_id: userId,
        p_response_type: responseType,
        p_notes: null,
        p_preferred_time: 'anytime',
        p_contact_method: 'app'
      });

      if (error) {
        console.error('Error recording response:', error);
        alert('Failed to record your response. Please try again.');
      } else {
        alert(`Thank you! You've marked yourself as ${responseType}. The hospital will contact you soon.`);
        // Refresh requests to update UI
        await fetchRequests();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setRespondingTo(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'normal':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <DashboardLayout navItems={navItems}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nearby Blood Requests</h1>
            <p className="text-gray-600 mt-1">Help save lives in your community</p>
          </div>
          
          {/* View Toggle */}
          <div className="flex gap-2 bg-white rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                viewMode === 'list'
                  ? 'bg-red-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                viewMode === 'map'
                  ? 'bg-red-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Map className="w-4 h-4" />
              Map
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Filter Requests</h3>
            {donorLocation && (
              <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
                Your location set
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('nearby')}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                filter === 'nearby'
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-md'
                  : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-red-300'
              }`}
            >
              <Navigation className="w-4 h-4" />
              Within 20km {donorLocation && `(${requests.filter(r => r.distance_km && r.distance_km <= 20).length})`}
            </button>
            <button
              onClick={() => setFilter('matching')}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                filter === 'matching'
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-md'
                  : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-red-300'
              }`}
            >
              <Heart className="w-4 h-4" />
              My Blood Type ({donorBloodType})
            </button>
            <button
              onClick={() => setFilter('urgent')}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                filter === 'urgent'
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-md'
                  : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-red-300'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Urgent Only
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'all'
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-md'
                  : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-red-300'
              }`}
            >
              All Requests
            </button>
          </div>
          {viewMode === 'map' && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllOnMap}
                  onChange={(e) => setShowAllOnMap(e.target.checked)}
                  className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="text-sm text-gray-700">Show all requests on map (not just filtered)</span>
              </label>
            </div>
          )}
        </div>

        {/* Requests Grid or Map */}
        {viewMode === 'list' ? (
          requests.length > 0 ? (
            <div className="grid gap-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white">
                            {request.required_blood_type}
                          </div>
                          <div className="text-xs text-white/80">Blood Type</div>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="w-5 h-5 text-gray-400" />
                          <h3 className="text-xl font-semibold text-gray-900">
                            {request.hospitals?.name}
                          </h3>
                          <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getPriorityColor(request.priority)}`}>
                            {request.priority.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {request.hospitals?.city}
                          </div>
                          {request.distance_km && (
                            <div className="flex items-center gap-1">
                              <Navigation className="w-4 h-4 text-red-500" />
                              <span className="font-semibold text-red-600">{request.distance_km.toFixed(1)} km away</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">Units Needed</div>
                            <div className="text-lg font-bold text-gray-900">{request.units_required}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">Status</div>
                            <div className="text-sm font-semibold text-gray-900 capitalize">{request.status}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">Needed By</div>
                            <div className="text-sm font-semibold text-gray-900">
                              {request.required_by ? new Date(request.required_by).toLocaleDateString() : 'ASAP'}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">Priority</div>
                            <div className={`text-sm font-bold ${
                              request.priority === 'urgent' ? 'text-red-600' : 
                              request.priority === 'high' ? 'text-orange-600' : 'text-blue-600'
                            }`}>
                              {request.priority.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {request.reason && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-semibold text-blue-900 mb-1">Reason for Request</div>
                          <p className="text-sm text-blue-800">{request.reason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {request.has_responded ? (
                      <div className="flex-1 px-6 py-3 bg-green-100 border-2 border-green-300 text-green-700 rounded-lg font-semibold flex items-center justify-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        {request.response_type === 'available' ? 'Marked Available' : 'Marked Interested'}
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => respondToRequest(request.id, 'available')}
                          disabled={respondingTo === request.id}
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg font-semibold hover:from-red-600 hover:to-pink-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Heart className="w-5 h-5" />
                          {respondingTo === request.id ? 'Responding...' : 'I\'m Available'}
                        </button>
                        <button 
                          onClick={() => respondToRequest(request.id, 'interested')}
                          disabled={respondingTo === request.id}
                          className="px-6 py-3 border-2 border-blue-300 text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Heart className="w-5 h-5" />
                          Interested
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => {
                        if (donorLocation && request.distance_km) {
                          window.open(`https://www.google.com/maps/dir/${donorLocation.lat},${donorLocation.lng}/${request.hospitals?.name}`, '_blank');
                        }
                      }}
                      className="px-6 py-3 border-2 border-blue-300 text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
                    >
                      <Navigation className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Requests Found
              </h3>
              <p className="text-gray-600 mb-4">
                There are no blood requests matching your filters at the moment.
              </p>
              {!donorLocation && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    <strong>Tip:</strong> Set your location in your profile to see nearby requests!
                  </p>
                  <button
                    onClick={() => router.push('/dashboard/donor/profile')}
                    className="mt-3 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium"
                  >
                    Update Location
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          /* Map View */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {donorLocation ? (
              <>
                <div className="mb-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-md">
                      <Map className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Blood Requests Near You</h3>
                      <p className="text-sm text-gray-600">
                        {showAllOnMap ? 'Showing all requests' : `Showing ${filter === 'nearby' ? 'within 20km' : filter} requests`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600">
                      {(showAllOnMap ? requests : requests.filter(r => !r.distance_km || r.distance_km <= 20)).length}
                    </div>
                    <div className="text-xs text-gray-500">Requests visible</div>
                  </div>
                </div>
                <InteractiveMap
                  center={{ lat: donorLocation.lat, lng: donorLocation.lng }}
                  markers={[
                    // User location
                    {
                      id: 'user',
                      position: { lat: donorLocation.lat, lng: donorLocation.lng },
                      title: 'Your Location',
                      subtitle: `Blood Type: ${donorBloodType}`,
                      type: 'user'
                    },
                    // Hospital requests
                    ...(showAllOnMap ? requests : requests.filter(r => !r.distance_km || r.distance_km <= 20))
                      .filter(req => req.hospitals?.latitude && req.hospitals?.longitude)
                      .map(req => ({
                        id: req.id,
                        position: { 
                          lat: req.hospitals.latitude, 
                          lng: req.hospitals.longitude 
                        },
                        title: `${req.hospitals.name}`,
                        subtitle: `${req.required_blood_type} - ${req.units_required} units needed${req.distance_km ? ` (${req.distance_km.toFixed(1)}km away)` : ''}`,
                        type: 'hospital' as const,
                        onClick: () => {
                          // Optional: Navigate to request details
                          console.log('Request:', req);
                        }
                      }))
                  ]}
                  height="600px"
                  zoom={11}
                  showRadius={true}
                  radiusKm={20}
                  radiusCenter={donorLocation}
                />
              </>
            ) : (
              <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-lg p-12 text-center border-2 border-dashed border-red-200">
                <Map className="w-16 h-16 text-red-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Set Your Location First</h3>
                <p className="text-gray-600 mb-4">
                  Please update your location in your profile to see requests on the map.
                </p>
                <button
                  onClick={() => router.push('/dashboard/donor/profile')}
                  className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
                >
                  Update Location
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
