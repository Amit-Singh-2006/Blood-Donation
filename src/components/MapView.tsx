// @ts-nocheck
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';

// Fix for default marker icon in Leaflet with React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = new Icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

interface MapViewProps {
  donors?: Array<{ id: string; lat: number; lng: number; name: string }>;
  center?: [number, number];
}

export default function MapView({ donors = [], center = [28.6139, 77.2090] }: MapViewProps) {
  return (
    <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative z-0">
      {/* @ts-ignore */}
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={false} 
        style={{ height: '100%', width: '100%' }}
      >
        {/* @ts-ignore */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {donors.map(donor => (
          // @ts-ignore
          <Marker key={donor.id} position={[donor.lat, donor.lng]} icon={DefaultIcon}>
            <Popup>
              <div className="font-semibold">{donor.name}</div>
              <div className="text-xs text-slate-500">Active Donor</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
