'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import StatCard from '@/components/StatCard';
import { Heart, MapPin, Users, Activity, TrendingUp, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function HospitalDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [hospitalData, setHospitalData] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    fulfilled: 0,
    active: 0,
  });

  const navItems = [
    { label: 'Dashboard', href: '/dashboard/hospital', icon: Activity },
    { label: 'Blood Requests', href: '/dashboard/hospital/requests', icon: Heart },
    { label: 'Create Request', href: '/dashboard/hospital/create-request', icon: AlertCircle },
    { label: 'Donors Map', href: '/dashboard/hospital/donors', icon: Users },
    { label: 'Profile Settings', href: '/dashboard/hospital/profile', icon: Users },
    { label: 'Analytics', href: '/dashboard/hospital/analytics', icon: TrendingUp },
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    } else if (user && user.role !== 'hospital') {
      router.push(`/dashboard/${user.role}`);
    } else if (user) {
      fetchHospitalData();
      fetchRequests();
    }
  }, [user, loading, router]);

  const fetchHospitalData = async () => {
    const { data } = await supabase
      .from('hospitals')
      .select('*')
      .eq('user_id', user?.id)
      .single();
    
    if (data) setHospitalData(data);
  };

  const fetchRequests = async () => {
    const { data: hospital } = await supabase
      .from('hospitals')
      .select('id')
      .eq('user_id', user?.id)
      .single();

    if (hospital) {
      const { data } = await supabase
        .from('blood_requests')
        .select('*')
        .eq('hospital_id', hospital.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data) {
        setRequests(data);
        setStats({
          total: data.length,
          pending: data.filter(r => r.status === 'pending' || r.status === 'matching').length,
          fulfilled: data.filter(r => r.status === 'fulfilled').length,
          active: data.filter(r => ['pending', 'matching', 'notified', 'partial'].includes(r.status)).length,
        });
      }
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {hospitalData?.name || 'Hospital Dashboard'}
          </h1>
          <p className="text-gray-600 mt-1">Manage your blood requests and donors</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Requests"
            value={hospitalData?.total_requests || 0}
            icon={Heart}
            color="red"
          />
          <StatCard
            title="Active Requests"
            value={stats.active}
            icon={Clock}
            color="orange"
          />
          <StatCard
            title="Fulfilled"
            value={hospitalData?.fulfilled_requests || 0}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            title="Success Rate"
            value={
              hospitalData?.total_requests > 0
                ? `${Math.round((hospitalData.fulfilled_requests / hospitalData.total_requests) * 100)}%`
                : '0%'
            }
            icon={TrendingUp}
            color="blue"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/dashboard/hospital/create-request')}
            className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            <AlertCircle className="w-8 h-8 mb-2" />
            <h3 className="text-lg font-semibold">Create Blood Request</h3>
            <p className="text-sm text-red-100 mt-1">Request blood from donors</p>
          </button>
          <button
            onClick={() => router.push('/dashboard/hospital/donors')}
            className="bg-white border-2 border-gray-200 p-6 rounded-xl hover:border-red-500 hover:shadow-lg transition-all"
          >
            <Users className="w-8 h-8 mb-2 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">View Matched Donors</h3>
            <p className="text-sm text-gray-600 mt-1">See available donors</p>
          </button>
          <button
            onClick={() => router.push('/dashboard/hospital/analytics')}
            className="bg-white border-2 border-gray-200 p-6 rounded-xl hover:border-red-500 hover:shadow-lg transition-all"
          >
            <TrendingUp className="w-8 h-8 mb-2 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900">View Analytics</h3>
            <p className="text-sm text-gray-600 mt-1">Track performance</p>
          </button>
        </div>

        {/* Recent Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Requests</h2>
            <button
              onClick={() => router.push('/dashboard/hospital/requests')}
              className="text-red-500 hover:text-red-600 font-semibold"
            >
              View All
            </button>
          </div>

          {requests.length > 0 ? (
            <div className="space-y-4">
              {requests.slice(0, 5).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/hospital/requests/${request.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">{request.required_blood_type}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {request.request_number}
                      </p>
                      <p className="text-sm text-gray-600">
                        {request.units_required} units • {request.priority}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      request.status === 'fulfilled'
                        ? 'bg-green-100 text-green-700'
                        : request.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {request.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No requests yet</p>
              <button
                onClick={() => router.push('/dashboard/hospital/create-request')}
                className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Create First Request
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
