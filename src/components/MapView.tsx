// @ts-nocheck
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';
import { useEffect } from 'react';

// Use CDN for icons to avoid path issues with Vite/Parcel
const markerIcon = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png';
const markerShadow = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png';

const DefaultIcon = new Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Helper component to fix map not showing up correctly on initial load
function MapFix() {
  const map = useMap();
  useEffect(() => {
    // Call multiple times to ensure it catches the container at its final size
    const timers = [
      setTimeout(() => map.invalidateSize(), 100),
      setTimeout(() => map.invalidateSize(), 500),
      setTimeout(() => map.invalidateSize(), 1000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, [map]);
  return null;
}

interface MapViewProps {
  donors?: Array<{ id: string; lat: number; lng: number; name: string }>;
  center?: [number, number];
  onDispatch?: (id: string) => void;
}

export default function MapView({ donors = [], center = [28.6139, 77.2090], onDispatch }: MapViewProps) {
  return (
    <div className="absolute inset-0 z-0">
      {/* @ts-ignore */}
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
      >
        <MapFix />
        {/* @ts-ignore */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {donors.map(donor => (
          // @ts-ignore
          <Marker key={donor.id} position={[donor.lat, donor.lng]} icon={DefaultIcon}>
            <Popup>
              <div className="p-2">
                <div className="font-bold text-slate-900">{donor.name}</div>
                <div className="text-[10px] font-black text-[#ee2b2b] uppercase tracking-widest mt-1">Active Donor</div>
                <button
                  onClick={() => onDispatch?.(donor.id)}
                  className="mt-3 w-full bg-slate-900 text-white text-[10px] font-black py-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  DISPATCH REQUEST
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
