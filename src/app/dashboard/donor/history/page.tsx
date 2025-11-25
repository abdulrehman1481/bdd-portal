'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Heart, MapPin, Calendar, Award, Clock, Activity, Calendar as CalendarIcon, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function DonationHistory() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [donations, setDonations] = useState<any[]>([]);

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
      fetchDonationHistory();
    }
  }, [user, loading, router]);

  const fetchDonationHistory = async () => {
    const { data: donorData } = await supabase
      .from('donors')
      .select('id')
      .eq('user_id', user?.id)
      .single();

    if (donorData) {
      const { data } = await supabase
        .from('donation_history')
        .select('*, hospitals(name, city)')
        .eq('donor_id', donorData.id)
        .order('donation_date', { ascending: false });
      
      if (data) setDonations(data);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Donation History</h1>
            <p className="text-gray-600 mt-1">Your complete donation record</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {donations.length > 0 ? (
          <div className="grid gap-4">
            {donations.map((donation) => (
              <div
                key={donation.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Heart className="w-6 h-6 text-white" fill="white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {donation.hospitals?.name || 'Unknown Hospital'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {donation.hospitals?.city || 'Unknown Location'}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          {new Date(donation.donation_date).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span>{donation.donation_type || 'Whole Blood'}</span>
                        <span>•</span>
                        <span className="font-semibold text-red-500">
                          {donation.blood_type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {donation.units} {donation.units === 1 ? 'Unit' : 'Units'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {donation.donation_number}
                    </div>
                  </div>
                </div>

                {donation.staff_notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">{donation.staff_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Donations Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start your journey of saving lives by making your first donation!
            </p>
            <button
              onClick={() => router.push('/dashboard/donor/requests')}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              View Nearby Requests
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
