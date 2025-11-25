'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Heart, MapPin, Users, Activity, TrendingUp, Clock, AlertCircle, Calendar, Building2, Navigation, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function HospitalRequests() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'fulfilled' | 'cancelled'>('all');

  const navItems = [
    { label: 'Dashboard', href: '/dashboard/hospital', icon: Activity },
    { label: 'Blood Requests', href: '/dashboard/hospital/requests', icon: Heart },
    { label: 'Create Request', href: '/dashboard/hospital/create-request', icon: AlertCircle },
    { label: 'Matched Donors', href: '/dashboard/hospital/donors', icon: Users },
    { label: 'Analytics', href: '/dashboard/hospital/analytics', icon: TrendingUp },
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    } else if (user && user.role !== 'hospital') {
      router.push(`/dashboard/${user.role}`);
    } else if (user) {
      fetchRequests();
    }
  }, [user, loading, router, filter]);

  const fetchRequests = async () => {
    const { data: hospital } = await supabase
      .from('hospitals')
      .select('id')
      .eq('user_id', user?.id)
      .single();

    if (!hospital) return;

    let query = supabase
      .from('blood_requests')
      .select('*')
      .eq('hospital_id', hospital.id)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data } = await query;
    if (data) setRequests(data);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fulfilled':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
      case 'matching':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Activity className="w-5 h-5 text-blue-500" />;
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
            <h1 className="text-3xl font-bold text-gray-900">Blood Requests</h1>
            <p className="text-gray-600 mt-1">Manage your blood donation requests</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/hospital/create-request')}
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 font-medium shadow-lg hover:shadow-xl transition-all"
          >
            Create New Request
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {['all', 'pending', 'fulfilled', 'cancelled'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-red-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Requests Grid */}
        {requests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No requests found</h3>
            <p className="text-gray-600 mb-6">Create your first blood request to get started</p>
            <button
              onClick={() => router.push('/dashboard/hospital/create-request')}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 font-medium"
            >
              Create Request
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {getStatusIcon(request.status)}
                      <h3 className="text-lg font-semibold text-gray-900">
                        {request.request_number}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(request.priority)}`}>
                        {request.priority}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Heart className="w-4 h-4" />
                        <span>Blood Type: <span className="font-semibold text-gray-900">{request.required_blood_type}</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Activity className="w-4 h-4" />
                        <span>Units: <span className="font-semibold text-gray-900">{request.units_required}</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Required By: <span className="font-semibold text-gray-900">
                          {request.required_by ? new Date(request.required_by).toLocaleDateString() : 'ASAP'}
                        </span></span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>Status: <span className="font-semibold text-gray-900 capitalize">{request.status}</span></span>
                      </div>
                    </div>

                    {request.reason && (
                      <div className="mt-3 text-sm text-gray-600">
                        <span className="font-medium">Reason:</span> {request.reason}
                      </div>
                    )}

                    {request.patient_name && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Patient:</span> {request.patient_name}
                        {request.patient_age && `, ${request.patient_age} years old`}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/hospital/requests/${request.id}`)}
                      className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium"
                    >
                      View Details
                    </button>
                    {request.status === 'pending' && (
                      <button
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
