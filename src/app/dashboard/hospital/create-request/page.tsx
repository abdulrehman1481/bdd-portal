'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import LocationPicker from '@/components/LocationPicker';
import { Heart, MapPin, Users, Activity, TrendingUp, Clock, AlertCircle, Calendar, Loader2, Info } from 'lucide-react';
import { supabase, BloodType } from '@/lib/supabase';

export default function CreateRequest() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [hospitalLocation, setHospitalLocation] = useState({
    latitude: 0,
    longitude: 0,
    city: '',
    address: ''
  });
  const [formData, setFormData] = useState({
    bloodType: 'O+' as BloodType,
    units: 1,
    priority: 'normal',
    requestType: 'emergency',
    patientName: '',
    patientAge: '',
    reason: '',
    notes: '',
    requiredBy: '',
  });
  
  useEffect(() => {
    fetchHospitalLocation();
  }, [user]);
  
  const fetchHospitalLocation = async () => {
    if (!user) return;
    
    const { data: hospital } = await supabase
      .from('hospitals')
      .select('latitude, longitude, city, address')
      .eq('user_id', user.id)
      .single();
    
    if (hospital) {
      setHospitalLocation({
        latitude: hospital.latitude || 0,
        longitude: hospital.longitude || 0,
        city: hospital.city || '',
        address: hospital.address || ''
      });
    }
  };
  
  const getRadiusForPriority = (priority: string) => {
    switch (priority) {
      case 'urgent': return 50;
      case 'high': return 30;
      default: return 20;
    }
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard/hospital', icon: Activity },
    { label: 'Blood Requests', href: '/dashboard/hospital/requests', icon: Heart },
    { label: 'Create Request', href: '/dashboard/hospital/create-request', icon: AlertCircle },
    { label: 'Matched Donors', href: '/dashboard/hospital/donors', icon: Users },
    { label: 'Analytics', href: '/dashboard/hospital/analytics', icon: TrendingUp },
  ];

  const bloodTypes: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get hospital ID
      const { data: hospital } = await supabase
        .from('hospitals')
        .select('id, latitude, longitude')
        .eq('user_id', user?.id)
        .single();

      if (!hospital) {
        alert('Hospital profile not found');
        return;
      }

      // Create blood request
      const { data, error } = await supabase
        .from('blood_requests')
        .insert({
          hospital_id: hospital.id,
          request_number: `REQ-${Date.now()}`,
          required_blood_type: formData.bloodType,
          units_required: formData.units,
          priority: formData.priority,
          request_type: formData.requestType,
          patient_name: formData.patientName || null,
          patient_age: formData.patientAge ? parseInt(formData.patientAge) : null,
          reason: formData.reason,
          notes: formData.notes,
          required_by: formData.requiredBy,
          latitude: hospitalLocation.latitude,
          longitude: hospitalLocation.longitude,
          created_by: user?.id,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      alert(`Blood request created successfully! Donors within ${getRadiusForPriority(formData.priority)}km will be notified.`);
      router.push('/dashboard/hospital/requests');
    } catch (error: any) {
      alert('Error creating request: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout navItems={navItems}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Blood Request</h1>
          <p className="text-gray-600 mt-1">Request blood from verified donors in your area</p>
        </div>

        {/* Priority Info Card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Notification Radius by Priority</h3>
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="font-semibold text-gray-700 mb-1">Normal/Low</div>
                  <div className="text-2xl font-bold text-blue-600">20 km</div>
                  <div className="text-xs text-gray-500 mt-1">Standard radius</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-200">
                  <div className="font-semibold text-gray-700 mb-1">High Priority</div>
                  <div className="text-2xl font-bold text-orange-600">30 km</div>
                  <div className="text-xs text-gray-500 mt-1">Extended radius</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-red-200">
                  <div className="font-semibold text-gray-700 mb-1">Urgent</div>
                  <div className="text-2xl font-bold text-red-600">50 km</div>
                  <div className="text-xs text-gray-500 mt-1">Maximum radius</div>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                Donors within the radius matching the blood type will be automatically notified when you create this request.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          {/* Location Section */}
          <div className="pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-500" />
              Request Location
            </h2>
            <LocationPicker
              latitude={hospitalLocation.latitude}
              longitude={hospitalLocation.longitude}
              city={hospitalLocation.city}
              address={hospitalLocation.address}
              onChange={setHospitalLocation}
              showRadius={true}
              radiusKm={getRadiusForPriority(formData.priority)}
            />
          </div>
          {/* Blood Type & Units */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Blood Type Required <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.bloodType}
                onChange={(e) => setFormData({ ...formData, bloodType: e.target.value as BloodType })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              >
                {bloodTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Units Required <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.units}
                onChange={(e) => setFormData({ ...formData, units: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Priority & Type */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              >
                <option value="low">Low (20km radius)</option>
                <option value="normal">Normal (20km radius)</option>
                <option value="high">High (30km radius)</option>
                <option value="urgent">Urgent (50km radius)</option>
              </select>
              <p className="mt-2 text-xs text-gray-500">
                Current radius: <span className="font-semibold text-blue-600">{getRadiusForPriority(formData.priority)}km</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Request Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.requestType}
                onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              >
                <option value="emergency">Emergency</option>
                <option value="surgery">Surgery</option>
                <option value="chronic">Chronic Condition</option>
                <option value="replacement">Replacement</option>
              </select>
            </div>
          </div>

          {/* Patient Information (Optional) */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Patient Name (Optional)
              </label>
              <input
                type="text"
                value={formData.patientName}
                onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Patient Age (Optional)
              </label>
              <input
                type="number"
                min="0"
                value={formData.patientAge}
                onChange={(e) => setFormData({ ...formData, patientAge: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Required By Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Required By <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.requiredBy}
              onChange={(e) => setFormData({ ...formData, requiredBy: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Request <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:from-red-600 hover:to-pink-600 transition-all disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Request...
                </>
              ) : (
                'Create Blood Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
