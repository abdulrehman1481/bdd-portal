'use client';

import React, { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

interface MapProps {
  center?: { lat: number; lng: number };
  markers?: Array<{
    id: string;
    position: { lat: number; lng: number };
    title: string;
    subtitle?: string;
    type?: 'hospital' | 'donor' | 'user';
    onClick?: () => void;
  }>;
  height?: string;
  zoom?: number;
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
  showRadius?: boolean;
  radiusKm?: number;
  radiusCenter?: { lat: number; lng: number };
}

export default function InteractiveMap(props: MapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div 
        style={{ height: props.height || '400px', width: '100%' }}
        className="relative rounded-xl overflow-hidden border-2 border-gray-300 shadow-lg bg-gray-100 flex items-center justify-center"
      >
        <div className="text-center">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2 animate-pulse" />
          <p className="text-sm text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return <MapContent {...props} />;
}

function MapContent({ 
  center = { lat: 28.7041, lng: 77.1025 }, 
  markers = [], 
  height = '400px',
  zoom = 12,
  onLocationSelect,
  showRadius = false,
  radiusKm = 20,
  radiusCenter
}: MapProps) {
  const { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } = require('react-leaflet');
  const L = require('leaflet');
  
  const actualRadiusCenter = radiusCenter || center;

  // Fix for default marker icons
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }, []);
  
  // Custom marker icons with enhanced styling
  const createIcon = (color: string, pulseColor?: string) => {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="position: relative;">
          ${pulseColor ? `
            <div style="
              position: absolute;
              width: 40px;
              height: 40px;
              background-color: ${pulseColor};
              border-radius: 50%;
              opacity: 0.4;
              animation: pulse 2s ease-in-out infinite;
              top: -7px;
              left: -7px;
            "></div>
          ` : ''}
          <div style="
            background: linear-gradient(135deg, ${color} 0%, ${adjustColor(color, -20)} 100%);
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            position: relative;
            z-index: 1;
          "></div>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(1.3); opacity: 0.1; }
          }
        </style>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  };

  // Helper to darken colors
  const adjustColor = (color: string, amount: number) => {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  };

  const markerIcons = {
    hospital: createIcon('#EF4444', '#EF4444'),
    donor: createIcon('#3B82F6', '#3B82F6'),
    user: createIcon('#10B981', '#10B981'),
  };

  // Component to handle map clicks
  function MapClickHandler({ onLocationSelect }: { onLocationSelect?: (location: { lat: number; lng: number }) => void }) {
    useMapEvents({
      click(e: any) {
        if (onLocationSelect) {
          onLocationSelect({
            lat: e.latlng.lat,
            lng: e.latlng.lng
          });
        }
      },
    });
    return null;
  }

  // Component to fit bounds when markers change
  function FitBounds({ markers }: { markers: Array<{ position: { lat: number; lng: number } }> }) {
    const map = useMap();
    
    useEffect(() => {
      if (markers.length > 1) {
        const bounds = L.latLngBounds(markers.map((m: any) => [m.position.lat, m.position.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }, [markers, map]);
    
    return null;
  }

  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-gray-300 shadow-lg">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height, width: '100%' }}
        scrollWheelZoom={true}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Radius Circle */}
        {showRadius && actualRadiusCenter && (
          <Circle
            center={[actualRadiusCenter.lat, actualRadiusCenter.lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              fillColor: '#3B82F6',
              fillOpacity: 0.1,
              color: '#3B82F6',
              weight: 2,
              opacity: 0.6,
              dashArray: '10, 10'
            }}
          />
        )}
        
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.position.lat, marker.position.lng]}
            icon={markerIcons[marker.type || 'hospital']}
            eventHandlers={{
              click: () => marker.onClick?.()
            }}
          >
            <Popup className="custom-popup">
              <div className="p-2 min-w-[200px]">
                <strong className="text-base text-gray-900 block mb-1">{marker.title}</strong>
                {marker.subtitle && (
                  <p className="text-sm text-gray-600">{marker.subtitle}</p>
                )}
                {marker.type === 'hospital' && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-semibold">
                      Blood Request
                    </span>
                  </div>
                )}
                {marker.type === 'donor' && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold">
                      Available Donor
                    </span>
                  </div>
                )}
                {marker.type === 'user' && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold">
                      Your Location
                    </span>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        
        <MapClickHandler onLocationSelect={onLocationSelect} />
        <FitBounds markers={markers} />
      </MapContainer>
      
      {/* Legend */}
      {markers.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-4 text-xs z-[1000] border-2 border-gray-200">
          <div className="font-bold mb-3 text-gray-900 text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Map Legend
          </div>
          {markers.some(m => m.type === 'hospital') && (
            <div className="flex items-center gap-3 mb-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 border-2 border-white shadow-md"></div>
              <span className="text-gray-700 font-medium">Blood Requests</span>
            </div>
          )}
          {markers.some(m => m.type === 'donor') && (
            <div className="flex items-center gap-3 mb-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white shadow-md"></div>
              <span className="text-gray-700 font-medium">Available Donors</span>
            </div>
          )}
          {markers.some(m => m.type === 'user') && (
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-500 to-green-600 border-2 border-white shadow-md"></div>
              <span className="text-gray-700 font-medium">Your Location</span>
            </div>
          )}
          {showRadius && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-blue-700">
                <div className="w-4 h-0.5 border-t-2 border-dashed border-blue-500"></div>
                <span className="font-semibold">{radiusKm}km Coverage Area</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
