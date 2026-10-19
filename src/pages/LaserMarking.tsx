import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Zap, Play, Square, AlertTriangle, Gauge, Thermometer, Timer,
  Settings2, CheckCircle2, Activity, Server, Cpu, Wrench, ListOrdered,
  Power, RotateCcw, TrendingUp,
} from 'lucide-react';
import { PageHeader } from '../components/Topbar';
import { supabase, type LaserMarking, type TrackFitting } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const MATERIALS = ['Manganese Steel', 'Carbon Steel', 'Cast Iron', 'Concrete', 'Composite'];

export default function LaserMarkingSim() {
  const { profile } = useAuth();
  const [fittings, setFittings] = useState<TrackFitting[]>([]);
  const [selectedFit, setSelectedFit] = useState<string>('');
  const [power, setPower] = useState(80);
  const [temp, setTemp] = useState(25);
  const [speed, setSpeed] = useState(50);
  const [status, setStatus] = useState<LaserMarking['status']>('Idle');
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<LaserMarking[]>([]);
  const [material, setMaterial] = useState('Manganese Steel');
  const [error, setError] = useState('');
  const [queue, setQueue] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.from('track_fittings').select('*').limit(50).then(({ data }) => { if (data) setFittings(data as TrackFitting[]); });
    supabase.from('laser_markings').select('*').order('created_at', { ascending: false }).limit(10).then(({ data }) => { if (data) setHistory(data as LaserMarking[]); });
  }, []);

  const estTime = Math.round((100 / speed) * (power / 50) * 10) / 10;
  const currentTemp = temp + Math.round(progress / 5);
  const tempStatus = currentTemp > 60 ? 'danger' : currentTemp > 45 ? 'warning' : 'normal';
  const machineHealth = status === 'Running' ? Math.max(60, 98 - Math.round(progress / 10)) : 98;

  function start() {
    if (!selectedFit) { setError('Select a track fitting first'); return; }
    setError(''); setStatus('Running'); setProgress(0);
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { stop(true); return 100; }
        return p + 2;
      });
    }, 100);
  }

  async function stop(completed = false) {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    const finalStatus = completed ? 'Completed' : 'Emergency Stop';
    setStatus(finalStatus);
    if (!completed) setProgress(0);

    const fit = fittings.find((f) => f.id === selectedFit);
    const { data } = await supabase.from('laser_markings').insert({
      fit_id: selectedFit || null, qr_id: fit?.qr_id ?? null,
      laser_power: power, temperature: temp + Math.round(progress / 5),
      speed, material, estimated_time: estTime, status: finalStatus,
      started_by: profile?.id ?? null,
    }).select().single();
    if (data) setHistory((h) => [data as LaserMarking, ...h].slice(0, 10));

    if (queue.length > 0 && completed) {
      const next = queue[0]; setQueue((q) => q.slice(1));
      setSelectedFit(next); setTimeout(() => start(), 500);
    }
  }

  function emergencyStop() { stop(false); }
  function addToQueue() { if (selectedFit && !queue.includes(selectedFit)) setQueue((q) => [...q, selectedFit]); }
  function removeFromQueue(id: string) { setQueue((q) => q.filter((x) => x !== id)); }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const statusColor = { Idle: 'bg-slate-400', Running: 'bg-green-500 animate-pulse', Completed: 'bg-rail-600', 'Emergency Stop': 'bg-red-500' }[status];
  const statusBg = { Idle: 'bg-slate-50 text-slate-600 dark:bg-rail-900 dark:text-slate-400', Running: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400', Completed: 'bg-rail-50 text-rail-700 dark:bg-rail-800/40 dark:text-rail-300', 'Emergency Stop': 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' }[status];

  return (
    <>
      <PageHeader title="Laser Marking Simulator" subtitle="Simulate laser-based QR code engraving on track fittings">
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${statusBg}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
          {status}
        </div>
      </PageHeader>

      {error && <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"><AlertTriangle size={16} />{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Controls */}
        <div className="card p-5">
          <div className="mb-5 flex items-center gap-2"><Settings2 size={18} className="text-rail-600 dark:text-rail-400" /><h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Parameters</h2></div>
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Track Fitting</label>
              <select value={selectedFit} onChange={(e) => setSelectedFit(e.target.value)} className="input">
                <option value="">Select component...</option>
                {fittings.map((f) => <option key={f.id} value={f.id}>{f.component_id} — {f.component_type}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Material</label>
              <select value={material} onChange={(e) => setMaterial(e.target.value)} className="input">
                {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <Slider icon={Zap} label="Laser Power" value={power} min={10} max={100} unit="W" onChange={setPower} />
            <Slider icon={Gauge} label="Speed" value={speed} min={10} max={100} unit="mm/s" onChange={setSpeed} />
            <Slider icon={Thermometer} label="Temperature" value={temp} min={20} max={80} unit="°C" onChange={setTemp} />

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-rail-900/50">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"><Timer size={16} /> Est. Time</span>
              <span className="text-sm font-bold text-rail-700 dark:text-rail-400">{estTime}s</span>
            </div>

            <div className="flex gap-3">
              <button onClick={start} disabled={status === 'Running'} className="btn-primary flex-1"><Play size={16} /> Start</button>
              <button onClick={emergencyStop} disabled={status !== 'Running'} className="btn-danger flex-1"><Square size={16} /> E-Stop</button>
            </div>
            <button onClick={addToQueue} disabled={!selectedFit || queue.includes(selectedFit)} className="btn-secondary w-full"><ListOrdered size={16} /> Add to Queue</button>
          </div>
        </div>

        {/* Simulation Visual + Machine Health */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2"><Activity size={18} className="text-rail-600 dark:text-rail-400" /><h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Live Simulation</h2></div>
            <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div animate={status === 'Running' ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.3 }} transition={{ duration: 0.5, repeat: status === 'Running' ? Infinity : 0 }} className="h-1 w-3/4 bg-gradient-to-r from-transparent via-red-500 to-transparent" style={{ boxShadow: '0 0 20px rgba(239,68,68,0.8)' }} />
              </div>
              <div className="absolute inset-8 grid grid-cols-12 gap-0.5 opacity-40">
                {Array.from({ length: 144 }).map((_, i) => (
                  <div key={i} className={`rounded-sm ${Math.random() > 0.5 ? 'bg-rail-400' : 'bg-transparent'}`} style={{ opacity: (i / 144) * (progress / 100) }} />
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-4 backdrop-blur">
                <div className="mb-1 flex justify-between text-xs text-white"><span>Engraving Progress</span><span>{progress}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.1 }} className="h-full bg-gradient-to-r from-rail-400 to-rail-600" />
                </div>
                <div className="mt-2 flex justify-between text-xs text-white/70">
                  <span>ETA: {status === 'Running' ? Math.ceil((100 - progress) / 2) : 0}s</span>
                  <span>{status === 'Running' ? 'Engraving...' : status}</span>
                </div>
              </div>
              {status === 'Completed' && (
                <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-semibold text-green-300 backdrop-blur"><CheckCircle2 size={14} /> Completed</div>
              )}
            </div>

            {/* Live Metrics */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric icon={Zap} label="Power" value={`${power}W`} />
              <Metric icon={Thermometer} label="Temperature" value={`${currentTemp}°C`} tone={tempStatus} />
              <Metric icon={Gauge} label="Speed" value={`${speed}mm/s`} />
              <Metric icon={Timer} label="ETA" value={`${status === 'Running' ? Math.ceil((100 - progress) / 2) : 0}s`} />
            </div>
          </div>

          {/* Machine Health */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-2"><Server size={16} className="text-rail-600 dark:text-rail-400" /><span className="text-xs font-medium text-slate-500 dark:text-slate-400">Machine Health</span></div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{machineHealth}%</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-rail-800"><div className={`h-full rounded-full ${machineHealth > 90 ? 'bg-green-500' : 'bg-accent-500'}`} style={{ width: `${machineHealth}%` }} /></div>
            </div>
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-2"><Cpu size={16} className="text-rail-600 dark:text-rail-400" /><span className="text-xs font-medium text-slate-500 dark:text-slate-400">Laser Status</span></div>
              <p className="flex items-center gap-1.5 text-lg font-bold text-slate-900 dark:text-white"><Power size={18} className={status === 'Running' ? 'text-green-500' : 'text-slate-400'} />{status === 'Running' ? 'Active' : 'Standby'}</p>
            </div>
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-2"><Wrench size={16} className="text-rail-600 dark:text-rail-400" /><span className="text-xs font-medium text-slate-500 dark:text-slate-400">Queue</span></div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{queue.length}</p>
              <p className="text-xs text-slate-400">jobs pending</p>
            </div>
          </div>
        </div>
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="card mt-6 p-5">
          <div className="mb-3 flex items-center gap-2"><ListOrdered size={18} className="text-rail-600 dark:text-rail-400" /><h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Job Queue</h3></div>
          <div className="space-y-2">
            {queue.map((id, i) => {
              const fit = fittings.find((f) => f.id === id);
              return (
                <div key={id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-rail-800">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rail-100 text-xs font-bold text-rail-700 dark:bg-rail-800 dark:text-rail-300">{i + 1}</span>
                  <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{fit?.component_id ?? id}</span>
                  <button onClick={() => removeFromQueue(id)} className="text-slate-400 hover:text-red-500"><RotateCcw size={14} /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      <div className="card mt-6 p-5">
        <div className="mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-rail-600 dark:text-rail-400" /><h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Recent Marking Jobs</h3></div>
        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No marking jobs yet. Start a simulation above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-rail-800 dark:text-slate-400">
                <th className="pb-2 pr-4 font-medium">Component</th><th className="pb-2 pr-4 font-medium">Power</th><th className="pb-2 pr-4 font-medium">Temp</th><th className="pb-2 pr-4 font-medium">Speed</th><th className="pb-2 pr-4 font-medium">Material</th><th className="pb-2 pr-4 font-medium">Time</th><th className="pb-2 font-medium">Status</th>
              </tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="table-row">
                    <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-200">{h.qr_id ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400">{h.laser_power}W</td>
                    <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400">{h.temperature}°C</td>
                    <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400">{h.speed}mm/s</td>
                    <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400">{h.material}</td>
                    <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400">{h.estimated_time}s</td>
                    <td className="py-2.5"><span className={`badge ${h.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' : h.status === 'Emergency Stop' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-rail-800 dark:text-slate-300'}`}>{h.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Slider({ icon: Icon, label, value, min, max, unit, onChange }: { icon: typeof Zap; label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"><Icon size={14} />{label}</span>
        <span className="text-sm font-bold text-rail-700 dark:text-rail-400">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-rail-600" />
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone = 'normal' }: { icon: typeof Zap; label: string; value: string; tone?: 'normal' | 'warning' | 'danger' }) {
  const color = tone === 'danger' ? 'text-red-600 dark:text-red-400' : tone === 'warning' ? 'text-accent-600 dark:text-accent-400' : 'text-slate-800 dark:text-slate-100';
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-rail-900/50">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Icon size={12} />{label}</div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
