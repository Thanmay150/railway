import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Filter, Train } from 'lucide-react';
import { supabase, type TrackFitting } from '../lib/supabase';
import { PageHeader } from '../components/Topbar';
import { LoadingSpinner } from '../components/ui';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const STATUS_COLORS: Record<string, string> = {
  'Active': '#10b981', 'Under Maintenance': '#f59e0b', 'Decommissioned': '#6b7280', 'Flagged': '#ef4444',
};

export default function AssetMap() {
  const [fittings, setFittings] = useState<TrackFitting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    supabase.from('track_fittings').select('*').then(({ data, error }) => {
      if (!error && data) setFittings((data as TrackFitting[]).filter((f) => f.gps_lat && f.gps_lng));
      setLoading(false);
    });
  }, []);

  const filtered = filter === 'all' ? fittings : fittings.filter((f) => f.status === filter);
  const center: [number, number] = filtered.length > 0 ? [filtered[0].gps_lat!, filtered[0].gps_lng!] : [28.6139, 77.209];

  return (
    <div className="space-y-6">
      <PageHeader title="Asset Map" subtitle="Geographic view of all track fittings with GPS coordinates">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input w-auto">
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Under Maintenance">Under Maintenance</option>
            <option value="Flagged">Flagged</option>
            <option value="Decommissioned">Decommissioned</option>
          </select>
        </div>
      </PageHeader>

      {loading ? (
        <LoadingSpinner label="Loading map data..." />
      ) : filtered.length === 0 ? (
        <div className="card flex h-96 flex-col items-center justify-center text-slate-400">
          <Train size={48} className="mb-3 opacity-40" />
          <p>No track fittings with GPS coordinates found.</p>
          <p className="text-sm">Add GPS coordinates in the Track Fittings page to see them on the map.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg dark:border-rail-800">
            <MapContainer center={center} zoom={6} scrollWheelZoom className="h-[500px] w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
              {filtered.map((f) => (
                <Marker key={f.id} position={[f.gps_lat!, f.gps_lng!]}>
                  <Popup>
                    <div className="space-y-1">
                      <strong>{f.component_id}</strong><br />
                      Type: {f.component_type}<br />
                      Station: {f.station_name}<br />
                      Zone: {f.railway_zone}<br />
                      Status: <span style={{ color: STATUS_COLORS[f.status] }}>{f.status}</span><br />
                      {f.track_number && `Track: ${f.track_number}`}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Status legend */}
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Status Legend</h3>
            <div className="flex flex-wrap gap-4">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm text-slate-600 dark:text-slate-400">{status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(STATUS_COLORS).map(([status, color]) => {
              const count = fittings.filter((f) => f.status === status).length;
              return (
                <div key={status} className="card flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl" style={{ backgroundColor: `${color}20` }}>
                    <div className="flex h-full w-full items-center justify-center"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} /></div>
                  </div>
                  <div><p className="text-2xl font-bold text-slate-900 dark:text-white">{count}</p><p className="text-xs text-slate-500 dark:text-slate-400">{status}</p></div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
