'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Heart, MapPin, Users, Activity, Clock, AlertCircle, 
  Phone, Mail, CheckCircle, XCircle, ArrowLeft, User,
  Calendar, Award, TrendingUp, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function RequestDetail() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const requestId = params?.id as string;
  
  const [request, setRequest] = useState<any>(null);
  const [donorResponses, setDonorResponses] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const navItems = [
    { label: 'Dashboard', href: '/dashboard/hospital', icon: Activity },
    { label: 'Blood Requests', href: '/dashboard/hospital/requests', icon: Heart },
    { label: 'Create Request', href: '/dashboard/hospital/create-request', icon: AlertCircle },
    { label: 'Matched Donors', href: '/dashboard/hospital/donors', icon: Users },
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    } else if (user && requestId) {
      fetchRequestDetails();
      fetchDonorResponses();
      
      // Set up real-time subscription for donor responses
      const responsesChannel = supabase
        .channel(`donor-responses-${requestId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'donor_responses',
            filter: `request_id=eq.${requestId}`
          },
          (payload) => {
            console.log('Donor response updated:', payload);
            fetchDonorResponses();
          }
        )
        .subscribe();

      // Subscribe to blood request updates
      const requestChannel = supabase
        .channel(`blood-request-${requestId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'blood_requests',
            filter: `id=eq.${requestId}`
          },
          (payload) => {
            console.log('Request updated:', payload);
            fetchRequestDetails();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(responsesChannel);
        supabase.removeChannel(requestChannel);
      };
    }
  }, [user, loading, requestId]);

  const fetchRequestDetails = async () => {
    setLoadingData(true);
    
    // Fetch request details
    const { data: requestData, error: requestError } = await supabase
      .from('blood_requests')
      .select('*, hospitals(name, city, address, phone, latitude, longitude)')
      .eq('id', requestId)
      .single();

    if (requestData) setRequest(requestData);
    setLoadingData(false);
  };

  const fetchDonorResponses = async () => {
    // Fetch donor responses using the SQL function
    const { data, error } = await supabase
      .rpc('get_request_responses', { p_request_id: requestId });

    if (data) {
      setDonorResponses(data);
    } else if (error) {
      console.error('Error fetching responses:', error);
    }
  };

  const getResponseTypeColor = (responseType: string) => {
    switch (responseType) {
      case 'available': return 'bg-green-100 text-green-700 border border-green-300';
      case 'interested': return 'bg-blue-100 text-blue-700 border border-blue-300';
      case 'not_available': return 'bg-gray-100 text-gray-700 border border-gray-300';
      default: return 'bg-yellow-100 text-yellow-700 border border-yellow-300';
    }
  };

  const getResponseStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-50 text-green-700';
      case 'scheduled': return 'bg-blue-50 text-blue-700';
      case 'completed': return 'bg-purple-50 text-purple-700';
      case 'cancelled': return 'bg-red-50 text-red-700';
      default: return 'bg-yellow-50 text-yellow-700';
    }
  };

  const updateRequestStatus = async (status: string) => {
    const { error } = await supabase
      .from('blood_requests')
      .update({ status })
      .eq('id', requestId);

    if (!error) {
      fetchRequestDetails();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fulfilled': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'matching': return 'bg-blue-100 text-blue-700';
      case 'urgent': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };



  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!request) {
    return (
      <DashboardLayout navItems={navItems}>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Request not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const availableCount = donorResponses.filter(r => r.response_type === 'available').length;
  const interestedCount = donorResponses.filter(r => r.response_type === 'interested').length;

  return (
    <DashboardLayout navItems={navItems}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              Request #{request.request_number}
            </h1>
            <p className="text-gray-600 mt-1">
              Created {new Date(request.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                fetchRequestDetails();
                fetchDonorResponses();
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <select
              value={request.status}
              onChange={(e) => updateRequestStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="pending">Pending</option>
              <option value="matching">Matching</option>
              <option value="notified">Notified</option>
              <option value="partial">Partial</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Request Details Card */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Request Details</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-xl">{request.required_blood_type}</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Blood Type</p>
                    <p className="text-2xl font-bold text-gray-900">{request.required_blood_type}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Heart className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Units Required</p>
                      <p className="font-semibold text-gray-900">{request.units_required} units</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Priority</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(request.priority)}`}>
                        {request.priority.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Required By</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(request.required_by).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Hospital</p>
                      <p className="font-semibold text-gray-900">{request.hospitals.name}</p>
                      <p className="text-sm text-gray-600">{request.hospitals.city}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Contact</p>
                      <p className="font-semibold text-gray-900">{request.hospitals.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Response Statistics</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="text-2xl font-bold text-blue-900">{donorResponses.length}</span>
                </div>
                <p className="text-sm text-blue-700">Total Responses</p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-900">{availableCount}</span>
                </div>
                <p className="text-sm text-green-700">Available Now</p>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="text-2xl font-bold text-yellow-900">{interestedCount}</span>
                </div>
                <p className="text-sm text-yellow-700">Interested</p>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <span className="text-2xl font-bold text-purple-900">
                    {donorResponses.filter((r: any) => r.response_status === 'scheduled').length}
                  </span>
                </div>
                <p className="text-sm text-purple-700">Scheduled</p>
              </div>
            </div>
          </div>
        </div>

        {/* Donor Responses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Donor Responses</h2>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                {availableCount} Available
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                {interestedCount} Interested
              </span>
            </div>
          </div>
          
          {donorResponses.length > 0 ? (
            <div className="space-y-4">
              {donorResponses.map((response: any) => (
                <div
                  key={response.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      response.response_type === 'available' 
                        ? 'bg-gradient-to-br from-green-500 to-emerald-500' 
                        : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                    }`}>
                      <User className="w-6 h-6 text-white" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-semibold text-gray-900">{response.donor_name || 'Anonymous'}</p>
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                          {response.donor_blood_type}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getResponseTypeColor(response.response_type)}`}>
                          {response.response_type}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{response.donor_city || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Award className="w-4 h-4" />
                          <span>{response.total_donations || 0} donations</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          <span>{response.distance_km?.toFixed(1)} km away</span>
                        </div>
                        {response.preferred_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{response.preferred_time}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        {response.donor_phone && (
                          <>
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-700">{response.donor_phone}</span>
                          </>
                        )}
                        {response.donor_email && (
                          <>
                            <Mail className="w-4 h-4 text-gray-400 ml-2" />
                            <span className="text-sm text-gray-700">{response.donor_email}</span>
                          </>
                        )}
                      </div>
                      
                      {response.notes && (
                        <p className="text-sm text-gray-600 mt-2 italic">Note: {response.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getResponseStatusColor(response.response_status)}`}>
                      {response.response_status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(response.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No donor responses yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Donors will be notified and can mark themselves as available
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
