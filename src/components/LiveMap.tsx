"use client";

import { divIcon, LatLng } from "leaflet";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from "react-leaflet";
import { Marker, useMap } from "react-leaflet";
import { useEffect } from "react";

type MapPoint = {
  id: string | number;
  label: string;
  lat: number;
  lng: number;
  color: string;
};

type MapBuffer = {
  id: string | number;
  lat: number;
  lng: number;
  radiusMeters: number;
  color?: string;
  fillOpacity?: number;
  label?: string;
};

type LiveMapProps = {
  center: { lat: number; lng: number };
  points: MapPoint[];
  zoom?: number;
  height?: number;
  buffers?: MapBuffer[];
  showCenterMarker?: boolean;
  onPickLocation?: (lat: number, lng: number) => void;
  draggableCenter?: boolean;
  onCenterDrag?: (lat: number, lng: number) => void;
  pickerLabel?: string;
  selectedPointId?: string | number;
  onPointClick?: (pointId: string | number) => void;
  autoPanToSelected?: boolean;
};

const dragHandleIcon = divIcon({
  className: "map-drag-handle",
  html: '<span class="map-drag-handle-dot"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function MapClickHandler({ onPickLocation }: { onPickLocation?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPickLocation?.(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function MapAutoCenter({
  center,
  selectedPointId,
  points,
  autoPan = true,
}: {
  center: { lat: number; lng: number };
  selectedPointId?: string | number;
  points: MapPoint[];
  autoPan?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (autoPan && selectedPointId) {
      const selectedPoint = points.find((p) => p.id === selectedPointId);
      if (selectedPoint && (Math.abs(selectedPoint.lat - center.lat) > 0.001 || Math.abs(selectedPoint.lng - center.lng) > 0.001)) {
        map.panTo(new LatLng(selectedPoint.lat, selectedPoint.lng), { duration: 0.8 });
        return;
      }
    }
    if (Math.abs(center.lat - map.getCenter().lat) > 0.001 || Math.abs(center.lng - map.getCenter().lng) > 0.001) {
      map.panTo(new LatLng(center.lat, center.lng), { duration: 0.5 });
    }
  }, [center, selectedPointId, points, map, autoPan]);

  return null;
}

export default function LiveMap({
  center,
  points,
  zoom = 12,
  height = 320,
  buffers = [],
  showCenterMarker = true,
  onPickLocation,
  draggableCenter = false,
  onCenterDrag,
  pickerLabel = "Selected location",
  selectedPointId,
  onPointClick,
  autoPanToSelected = true,
}: LiveMapProps) {
  return (
    <div style={{ height, width: "100%", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(56,43,28,0.14)" }}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapAutoCenter center={center} selectedPointId={selectedPointId} points={points} autoPan={autoPanToSelected} />
        <MapClickHandler onPickLocation={onPickLocation} />
        {buffers.map((buffer) => (
          <Circle
            key={buffer.id}
            center={[buffer.lat, buffer.lng]}
            radius={buffer.radiusMeters}
            pathOptions={{
              color: buffer.color || "#0f766e",
              fillColor: buffer.color || "#0f766e",
              fillOpacity: buffer.fillOpacity ?? 0.12,
            }}
          >
            {buffer.label ? <Popup>{buffer.label}</Popup> : null}
          </Circle>
        ))}
        {showCenterMarker ? (
          <CircleMarker
            center={[center.lat, center.lng]}
            radius={6}
            pathOptions={{ color: "#111827", fillColor: "#111827", fillOpacity: 0.95 }}
          >
            <Popup>{onPickLocation ? `${pickerLabel} (${center.lat.toFixed(5)}, ${center.lng.toFixed(5)})` : "Current location"}</Popup>
          </CircleMarker>
        ) : null}
        {draggableCenter ? (
          <Marker
            position={[center.lat, center.lng]}
            icon={dragHandleIcon}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target;
                const position = marker.getLatLng();
                onCenterDrag?.(position.lat, position.lng);
              },
            }}
          >
            <Popup>Drag to update coordinates</Popup>
          </Marker>
        ) : null}
        {points.map((point) => (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lng]}
            radius={selectedPointId === point.id ? 11 : 8}
            pathOptions={{ color: point.color, fillColor: point.color, fillOpacity: 0.8 }}
            eventHandlers={{
              click: () => onPointClick?.(point.id),
            }}
          >
            <Popup>{point.label}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}