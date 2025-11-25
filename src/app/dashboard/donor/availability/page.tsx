'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Heart, MapPin, Calendar, Award, Clock, Activity, ToggleLeft, ToggleRight, Save } from 'lucide-react';

export default function DonorAvailability() {
  const { user } = useAuth();
  const router = useRouter();
  const [availableNow, setAvailableNow] = useState(true);
  const [saving, setSaving] = useState(false);

  const navItems = [
    { label: 'Dashboard', href: '/dashboard/donor', icon: Activity },
    { label: 'My Profile', href: '/dashboard/donor/profile', icon: Heart },
    { label: 'Donation History', href: '/dashboard/donor/history', icon: Calendar },
    { label: 'Nearby Requests', href: '/dashboard/donor/requests', icon: MapPin },
    { label: 'Availability', href: '/dashboard/donor/availability', icon: Clock },
  ];

  const handleSave = async () => {
    setSaving(true);
    // Save availability logic here
    setTimeout(() => {
      setSaving(false);
      alert('Availability settings saved!');
    }, 1000);
  };

  return (
    <DashboardLayout navItems={navItems}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Availability Settings</h1>
          <p className="text-gray-600 mt-1">Manage when you're available to donate</p>
        </div>

        {/* Current Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Status</h2>
          
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                availableNow ? 'bg-green-500' : 'bg-gray-400'
              }`}>
                <Heart className="w-6 h-6 text-white" fill="white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {availableNow ? 'Available to Donate' : 'Not Available'}
                </p>
                <p className="text-sm text-gray-600">
                  {availableNow 
                    ? 'You will receive notifications for urgent requests'
                    : 'You won\'t receive donation requests'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setAvailableNow(!availableNow)}
              className="p-2"
            >
              {availableNow ? (
                <ToggleRight className="w-12 h-12 text-green-500" />
              ) : (
                <ToggleLeft className="w-12 h-12 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Weekly Schedule */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Weekly Schedule</h2>
          <p className="text-gray-600 mb-4">Set your preferred donation times</p>

          <div className="space-y-3">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
              <div key={day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <input type="checkbox" className="w-5 h-5 text-red-500 rounded" defaultChecked />
                <span className="font-medium text-gray-900 w-24">{day}</span>
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option>9:00 AM</option>
                  <option>10:00 AM</option>
                  <option>11:00 AM</option>
                  <option>12:00 PM</option>
                  <option>2:00 PM</option>
                  <option>3:00 PM</option>
                  <option>4:00 PM</option>
                </select>
                <span className="text-gray-600">to</span>
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option>5:00 PM</option>
                  <option>6:00 PM</option>
                  <option>7:00 PM</option>
                  <option>8:00 PM</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Preferences</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-600">Receive blood request alerts via email</p>
              </div>
              <input type="checkbox" className="w-5 h-5 text-red-500 rounded" defaultChecked />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">SMS Notifications</p>
                <p className="text-sm text-gray-600">Get urgent alerts via text message</p>
              </div>
              <input type="checkbox" className="w-5 h-5 text-red-500 rounded" defaultChecked />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Push Notifications</p>
                <p className="text-sm text-gray-600">Receive in-app push notifications</p>
              </div>
              <input type="checkbox" className="w-5 h-5 text-red-500 rounded" defaultChecked />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Urgent Requests Only</p>
                <p className="text-sm text-gray-600">Only notify for urgent/emergency cases</p>
              </div>
              <input type="checkbox" className="w-5 h-5 text-red-500 rounded" />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:from-red-600 hover:to-pink-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Availability Settings'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
