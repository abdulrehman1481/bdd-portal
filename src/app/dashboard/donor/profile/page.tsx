'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import LocationPicker from '@/components/LocationPicker';
import { Heart, MapPin, Calendar, Award, Bell, Clock, Activity, User, Phone, Mail, Edit, Save } from 'lucide-react';
import { supabase, BloodType } from '@/lib/supabase';

export default function DonorProfile() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [donorData, setDonorData] = useState<any>(null);
  const [location, setLocation] = useState({ latitude: 0, longitude: 0, city: '', address: '' });

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
      fetchDonorData();
    }
  }, [user, loading, router]);

  const fetchDonorData = async () => {
    const { data } = await supabase
      .from('donors')
      .select('*, donor_locations(*)')
      .eq('user_id', user?.id)
      .single();
    
    if (data) {
      setDonorData(data);
      // Get primary location
      const primaryLoc = data.donor_locations?.find((l: any) => l.is_primary) || data.donor_locations?.[0];
      if (primaryLoc) {
        setLocation({
          latitude: primaryLoc.latitude,
          longitude: primaryLoc.longitude,
          city: primaryLoc.city || '',
          address: primaryLoc.address || ''
        });
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update donor data
      if (donorData) {
        await supabase
          .from('donors')
          .update(donorData)
          .eq('user_id', user?.id);

        // Update or create location
        const { data: existingLoc } = await supabase
          .from('donor_locations')
          .select('id')
          .eq('donor_id', donorData.id)
          .eq('is_primary', true)
          .single();

        if (existingLoc) {
          await supabase
            .from('donor_locations')
            .update({
              latitude: location.latitude,
              longitude: location.longitude,
              city: location.city,
              address: location.address,
              location_type: 'current',
            })
            .eq('id', existingLoc.id);
        } else if (location.latitude && location.longitude) {
          await supabase
            .from('donor_locations')
            .insert({
              donor_id: donorData.id,
              latitude: location.latitude,
              longitude: location.longitude,
              city: location.city,
              address: location.address,
              location_type: 'current',
              is_primary: true,
            });
        }
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
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
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
          <div className="h-32 bg-gradient-to-r from-red-500 to-pink-500"></div>
          
          {/* Profile Info */}
          <div className="px-6 pb-6">
            <div className="flex items-end gap-6 -mt-16 mb-6">
              <div className="w-32 h-32 bg-white rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                <User className="w-16 h-16 text-gray-400" />
              </div>
              <div className="flex-1 pt-16">
                <h2 className="text-2xl font-bold text-gray-900">{user.full_name}</h2>
                <p className="text-gray-600">{user.email}</p>
              </div>
              <div className="pt-16">
                <span className="px-4 py-2 bg-red-100 text-red-700 rounded-full font-semibold">
                  {donorData?.blood_type || 'N/A'}
                </span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Contact Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-gray-700">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span>{user.phone || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              {/* Medical Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Blood Type:</span>
                    <span className="font-semibold text-gray-900">{donorData?.blood_type || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Weight:</span>
                    <span className="font-semibold text-gray-900">
                      {donorData?.weight_kg ? `${donorData.weight_kg} kg` : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date of Birth:</span>
                    <span className="font-semibold text-gray-900">
                      {donorData?.date_of_birth ? new Date(donorData.date_of_birth).toLocaleDateString() : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gender:</span>
                    <span className="font-semibold text-gray-900 capitalize">
                      {donorData?.gender || 'Not set'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Donation Stats */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Donation Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Donations:</span>
                    <span className="font-semibold text-gray-900">{donorData?.total_donations || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Donation:</span>
                    <span className="font-semibold text-gray-900">
                      {donorData?.last_donation_date 
                        ? new Date(donorData.last_donation_date).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Next Eligible:</span>
                    <span className="font-semibold text-gray-900">
                      {donorData?.next_eligible_date 
                        ? new Date(donorData.next_eligible_date).toLocaleDateString()
                        : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Health Status */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Health Status</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-semibold capitalize ${
                      donorData?.health_status === 'eligible' ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {donorData?.health_status || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Available:</span>
                    <span className={`font-semibold ${
                      donorData?.is_available ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {donorData?.is_available ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={donorData?.emergency_contact_name || ''}
                onChange={(e) => setDonorData({ ...donorData, emergency_contact_name: e.target.value })}
                disabled={!isEditing}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={donorData?.emergency_contact_phone || ''}
                onChange={(e) => setDonorData({ ...donorData, emergency_contact_phone: e.target.value })}
                disabled={!isEditing}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* Location Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Settings</h3>
          <LocationPicker
            latitude={location.latitude}
            longitude={location.longitude}
            city={location.city}
            address={location.address}
            onChange={setLocation}
            disabled={!isEditing}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
