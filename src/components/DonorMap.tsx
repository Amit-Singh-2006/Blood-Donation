import React, { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Point } from '../lib/geo';

export interface MapDonor extends Point {
  id: number;
  label: string;
}

/** Keeps every marker in view as donors move. */
function FitToMarkers({ points }: { points: Point[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join('|');
  useEffect(() => {
    if (points.length === 1) map.setView([points[0]!.latitude, points[0]!.longitude], 14);
    else if (points.length > 1) map.fitBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]), { padding: [36, 36], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/**
 * The hospital and the donors on their way to it (only donors who chose to
 * share their location). OpenStreetMap tiles: no API key, attribution shown.
 */
export default function DonorMap({ hospital, donors, height = 260 }: { hospital: (Point & { name: string }) | null; donors: MapDonor[]; height?: number }) {
  const points: Point[] = [...(hospital ? [hospital] : []), ...donors];
  if (!points.length) return null;
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 relative z-0" style={{ height }}>
      <MapContainer center={[points[0]!.latitude, points[0]!.longitude]} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hospital && (
          <CircleMarker center={[hospital.latitude, hospital.longitude]} radius={10} pathOptions={{ color: '#0f172a', fillColor: '#0f172a', fillOpacity: 0.9, weight: 3 }}>
            <Tooltip permanent direction="top" offset={[0, -8]}>{hospital.name}</Tooltip>
          </CircleMarker>
        )}
        {donors.map((d) => (
          <React.Fragment key={d.id}>
            {hospital && (
              <Polyline positions={[[d.latitude, d.longitude], [hospital.latitude, hospital.longitude]]} pathOptions={{ color: '#ee2b2b', weight: 2, dashArray: '6 6', opacity: 0.7 }} />
            )}
            <CircleMarker center={[d.latitude, d.longitude]} radius={9} pathOptions={{ color: '#ffffff', fillColor: '#ee2b2b', fillOpacity: 1, weight: 3 }}>
              <Tooltip permanent direction="top" offset={[0, -8]}>{d.label}</Tooltip>
            </CircleMarker>
          </React.Fragment>
        ))}
        <FitToMarkers points={points} />
      </MapContainer>
    </div>
  );
}
