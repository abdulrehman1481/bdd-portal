'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import LocationPicker from '@/components/LocationPicker';
import { Heart, MapPin, Activity, Phone, Mail, Edit, Save, Building2, Clock, Award, TrendingUp, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function HospitalProfile() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hospitalData, setHospitalData] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);

  const navItems = [
    { label: 'Dashboard', href: '/dashboard/hospital', icon: Activity },
    { label: 'Blood Requests', href: '/dashboard/hospital/requests', icon: Heart },
    { label: 'Profile Settings', href: '/dashboard/hospital/profile', icon: Building2 },
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    } else if (user) {
      fetchHospitalData();
      fetchUserData();
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

  const fetchUserData = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user?.id)
      .single();
    
    if (data) setUserData(data);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update hospital data
      if (hospitalData) {
        await supabase
          .from('hospitals')
          .update(hospitalData)
          .eq('user_id', user?.id);
      }

      // Update user data
      if (userData) {
        await supabase
          .from('users')
          .update({
            full_name: userData.full_name,
            phone: userData.phone,
          })
          .eq('id', user?.id);
      }
    } catch (error) {
      console.error('Error saving:', error);
    }
    setSaving(false);
    setIsEditing(false);
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Hospital Profile</h1>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Cover */}
          <div className="h-32 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
          
          {/* Profile Info */}
          <div className="px-6 pb-6">
            <div className="flex items-end gap-6 -mt-16 mb-6">
              <div className="w-32 h-32 bg-white rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                <Building2 className="w-16 h-16 text-blue-500" />
              </div>
              <div className="flex-1 pt-16">
                <h2 className="text-2xl font-bold text-gray-900">{hospitalData?.name || 'Hospital Name'}</h2>
                <p className="text-gray-600">{hospitalData?.city || 'City'}</p>
              </div>
              <div className="pt-16">
                <span className={`px-4 py-2 rounded-full font-semibold ${
                  hospitalData?.is_verified 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {hospitalData?.is_verified ? 'Verified' : 'Pending Verification'}
                </span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Name</label>
                    <input
                      type="text"
                      value={hospitalData?.name || ''}
                      onChange={(e) => setHospitalData({ ...hospitalData, name: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                    <input
                      type="text"
                      value={hospitalData?.license_number || ''}
                      onChange={(e) => setHospitalData({ ...hospitalData, license_number: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={hospitalData?.phone || ''}
                      onChange={(e) => setHospitalData({ ...hospitalData, phone: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={userData?.email || ''}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={hospitalData?.website || ''}
                      onChange={(e) => setHospitalData({ ...hospitalData, website: e.target.value })}
                      disabled={!isEditing}
                      placeholder="https://example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              {/* Location Information */}
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Information</h3>
                <LocationPicker
                  latitude={hospitalData?.latitude || 0}
                  longitude={hospitalData?.longitude || 0}
                  city={hospitalData?.city || ''}
                  address={hospitalData?.address || ''}
                  onChange={(location) => setHospitalData({
                    ...hospitalData,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    city: location.city,
                    address: location.address
                  })}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Heart className="w-8 h-8 text-red-500" />
              <span className="text-3xl font-bold text-gray-900">{hospitalData?.total_requests || 0}</span>
            </div>
            <p className="text-gray-600">Total Requests</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <span className="text-3xl font-bold text-gray-900">{hospitalData?.fulfilled_requests || 0}</span>
            </div>
            <p className="text-gray-600">Fulfilled</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8 text-blue-500" />
              <span className="text-3xl font-bold text-gray-900">
                {hospitalData?.total_requests > 0
                  ? Math.round((hospitalData.fulfilled_requests / hospitalData.total_requests) * 100)
                  : 0}%
              </span>
            </div>
            <p className="text-gray-600">Success Rate</p>
          </div>
        </div>

        {/* Additional Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Operating Hours</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weekday Hours</label>
              <input
                type="text"
                value={hospitalData?.operating_hours_weekday || ''}
                onChange={(e) => setHospitalData({ ...hospitalData, operating_hours_weekday: e.target.value })}
                disabled={!isEditing}
                placeholder="e.g., 9:00 AM - 5:00 PM"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weekend Hours</label>
              <input
                type="text"
                value={hospitalData?.operating_hours_weekend || ''}
                onChange={(e) => setHospitalData({ ...hospitalData, operating_hours_weekend: e.target.value })}
                disabled={!isEditing}
                placeholder="e.g., 10:00 AM - 2:00 PM"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Hospital Description</h3>
          <textarea
            value={hospitalData?.description || ''}
            onChange={(e) => setHospitalData({ ...hospitalData, description: e.target.value })}
            disabled={!isEditing}
            placeholder="Describe your hospital's services and facilities..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-50"
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
