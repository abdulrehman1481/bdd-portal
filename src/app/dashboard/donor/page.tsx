'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import StatCard from '@/components/StatCard';
import { Heart, MapPin, Calendar, Award, Activity, Clock, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function DonorDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [donorData, setDonorData] = useState<any>(null);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    } else if (user && user.role !== 'donor') {
      router.push(`/dashboard/${user.role}`);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchDonorData();
      fetchNearbyRequests();
    }
  }, [user]);

  const fetchDonorData = async () => {
    const { data } = await supabase
      .from('donors')
      .select('*')
      .eq('user_id', user?.id)
      .single();
    
    if (data) setDonorData(data);
  };

  const fetchNearbyRequests = async () => {
    // Fetch recent blood requests (simplified for MVP)
    const { data } = await supabase
      .from('blood_requests')
      .select('*, hospitals(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (data) setRecentRequests(data);
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard/donor', icon: Activity },
    { label: 'My Profile', href: '/dashboard/donor/profile', icon: Heart },
    { label: 'Donation History', href: '/dashboard/donor/history', icon: Calendar },
    { label: 'Nearby Requests', href: '/dashboard/donor/requests', icon: MapPin },
    { label: 'Availability', href: '/dashboard/donor/availability', icon: Clock },
  ];

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  const nextEligibleDate = donorData?.next_eligible_date 
    ? new Date(donorData.next_eligible_date).toLocaleDateString() 
    : 'Not set';

  return (
    <DashboardLayout navItems={navItems}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.full_name}!
          </h1>
          <p className="text-gray-600 mt-1">Here's your blood donation overview</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Donations"
            value={donorData?.total_donations || 0}
            icon={Heart}
            color="red"
            trend={{ value: '+2 this year', isPositive: true }}
          />
          <StatCard
            title="Blood Type"
            value={donorData?.blood_type || 'N/A'}
            icon={Activity}
            color="blue"
          />
          <StatCard
            title="Lives Impacted"
            value={(donorData?.total_donations || 0) * 3}
            icon={Award}
            color="green"
            trend={{ value: 'Estimated', isPositive: true }}
          />
          <StatCard
            title="Next Eligible"
            value={donorData?.health_status === 'eligible' ? 'Now' : nextEligibleDate}
            icon={Clock}
            color="purple"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Donation Status */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Your Donation Status</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <Heart className="w-6 h-6 text-white" fill="white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {donorData?.health_status === 'eligible' ? 'Eligible to Donate' : 'Not Eligible Yet'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {donorData?.health_status === 'eligible' 
                        ? 'You can donate blood now!'
                        : `Next eligible: ${nextEligibleDate}`}
                    </p>
                  </div>
                </div>
                {donorData?.is_available && (
                  <span className="px-3 py-1 bg-green-500 text-white text-sm font-medium rounded-full">
                    Available
                  </span>
                )}
              </div>

              {/* Last Donation */}
              {donorData?.last_donation_date && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Last Donation</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(donorData.last_donation_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-4 pt-4">
                <button
                  onClick={() => router.push('/dashboard/donor/availability')}
                  className="px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
                >
                  Update Availability
                </button>
                <button
                  onClick={() => router.push('/dashboard/donor/profile')}
                  className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>

          {/* Upcoming Requests */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Nearby Requests</h2>
              <Bell className="w-5 h-5 text-gray-400" />
            </div>

            <div className="space-y-3">
              {recentRequests.length > 0 ? (
                recentRequests.slice(0, 3).map((request) => (
                  <div
                    key={request.id}
                    className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-red-500">
                        {request.required_blood_type}
                      </span>
                      <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                        {request.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">
                      {request.hospitals?.name || 'Hospital'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {request.units_required} units needed
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No nearby requests at the moment
                </p>
              )}
            </div>

            <button
              onClick={() => router.push('/dashboard/donor/requests')}
              className="w-full mt-4 px-4 py-2 text-red-500 border border-red-500 rounded-lg font-semibold hover:bg-red-50 transition-colors"
            >
              View All Requests
            </button>
          </div>
        </div>

        {/* Achievement Section */}
        <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2">Your Impact</h3>
              <p className="text-red-100">
                You've made {donorData?.total_donations || 0} donations and potentially saved{' '}
                {(donorData?.total_donations || 0) * 3} lives!
              </p>
            </div>
            <Award className="w-16 h-16 opacity-80" />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
