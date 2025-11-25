'use client';

import React, { useState } from 'react';
import { MapPin, Navigation, Loader2, Map, Edit3, Check } from 'lucide-react';
import InteractiveMap from './InteractiveMap';

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  city: string;
  address: string;
  onChange: (location: { latitude: number; longitude: number; city: string; address: string }) => void;
  disabled?: boolean;
  showRadius?: boolean;
  radiusKm?: number;
}

export default function LocationPicker({ 
  latitude, 
  longitude, 
  city, 
  address, 
  onChange, 
  disabled,
  showRadius = false,
  radiusKm = 20
}: LocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const getCurrentLocation = () => {
    setLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          // Reverse geocode to get address
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            const data = await response.json();
            
            onChange({
              latitude: lat,
              longitude: lng,
              city: data.address?.city || data.address?.town || data.address?.village || '',
              address: data.display_name || ''
            });
            setShowMap(true);
          } catch (error) {
            // If geocoding fails, just use coordinates
            onChange({
              latitude: lat,
              longitude: lng,
              city: city,
              address: address
            });
            setShowMap(true);
          }
          setLoading(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get your location. Please enter manually or click on the map.');
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert('Geolocation is not supported by your browser');
      setLoading(false);
    }
  };

  const handleMapClick = async (location: { lat: number; lng: number }) => {
    if (disabled) return;
    
    // Reverse geocode the selected location
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}`
      );
      const data = await response.json();
      
      onChange({
        latitude: location.lat,
        longitude: location.lng,
        city: data.address?.city || data.address?.town || data.address?.village || '',
        address: data.display_name || ''
      });
    } catch (error) {
      onChange({
        latitude: location.lat,
        longitude: location.lng,
        city: city,
        address: address
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Action Buttons */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-red-500" />
          Location Details
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={disabled || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Locating...
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                Auto-Detect
              </>
            )}
          </button>
          {latitude && longitude && (
            <button
              type="button"
              onClick={() => setShowMap(!showMap)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all shadow-md ${
                showMap 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600' 
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400'
              }`}
            >
              <Map className="w-4 h-4" />
              {showMap ? 'Hide Map' : 'Show Map'}
            </button>
          )}
        </div>
      </div>

      {/* Location Input Fields */}
      <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-5 border-2 border-gray-200 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              City
              {!disabled && (
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="ml-auto text-blue-600 hover:text-blue-800"
                >
                  {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-3 h-3" />}
                </button>
              )}
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => onChange({ latitude, longitude, city: e.target.value, address })}
              disabled={disabled}
              placeholder="e.g., New Delhi"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => onChange({ latitude, longitude, city, address: e.target.value })}
              disabled={disabled}
              placeholder="e.g., Connaught Place"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
            <input
              type="number"
              step="any"
              value={latitude || ''}
              onChange={(e) => onChange({ latitude: parseFloat(e.target.value) || 0, longitude, city, address })}
              disabled={disabled}
              placeholder="e.g., 28.7041"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 transition-all font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
            <input
              type="number"
              step="any"
              value={longitude || ''}
              onChange={(e) => onChange({ latitude, longitude: parseFloat(e.target.value) || 0, city, address })}
              disabled={disabled}
              placeholder="e.g., 77.1025"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 transition-all font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Location Preview Card */}
      {latitude && longitude && (
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm flex-shrink-0">
              <MapPin className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-100 mb-1">Current Location</p>
              <p className="text-lg font-bold mb-2">
                {city || 'Unknown City'}{address && `, ${address.split(',')[0]}`}
              </p>
              <div className="flex items-center gap-4 text-sm">
                <div className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                  <span className="font-mono">{latitude.toFixed(4)}°N</span>
                </div>
                <div className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                  <span className="font-mono">{longitude.toFixed(4)}°E</span>
                </div>
              </div>
              {showRadius && (
                <div className="mt-3 pt-3 border-t border-white/20">
                  <p className="text-sm text-blue-100">
                    <span className="font-semibold">Coverage Area:</span> {radiusKm} km radius
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Map */}
      {showMap && latitude && longitude && (
        <div className="space-y-3 bg-white rounded-xl p-5 border-2 border-gray-200 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Map className="w-4 h-4 text-blue-600" />
              Click on the map to update your location
            </p>
            {showRadius && (
              <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                {radiusKm}km Coverage
              </span>
            )}
          </div>
          <InteractiveMap
            center={{ lat: latitude, lng: longitude }}
            markers={[
              {
                id: 'current',
                position: { lat: latitude, lng: longitude },
                title: `${city || 'Your Location'}${showRadius ? ` (${radiusKm}km radius)` : ''}`,
                type: 'user'
              }
            ]}
            height="450px"
            zoom={showRadius ? 11 : 13}
            onLocationSelect={handleMapClick}
            showRadius={showRadius}
            radiusKm={radiusKm}
            radiusCenter={latitude && longitude ? { lat: latitude, lng: longitude } : undefined}
          />
        </div>
      )}
    </div>
  );
}
