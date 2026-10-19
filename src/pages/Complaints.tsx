import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquareWarning, Search, Download, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { PageHeader } from '../components/Topbar';
import { StatusBadge, Pagination, EmptyState, LoadingSpinner } from '../components/ui';
import { supabase, type TrackFitting, type Complaint } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { logAudit } from '../lib/audit';
import { exportCsv } from '../lib/qr';

const PAGE_SIZE = 8;

const PRIORITY_STYLES: Record<string, { border: string; dot: string; label: string }> = {
  Critical: { border: 'border-l-red-500', dot: 'bg-red-500', label: 'Critical' },
  High: { border: 'border-l-accent-500', dot: 'bg-accent-500', label: 'High' },
  Medium: { border: 'border-l-rail-500', dot: 'bg-rail-500', label: 'Medium' },
  Low: { border: 'border-l-slate-400', dot: 'bg-slate-400', label: 'Low' },
};

export default function Complaints() {
  const { session } = useAuth();
  const toast = useToast();
  const [complaints, setComplaints] = useState<(Complaint & { fitting?: TrackFitting })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let query = supabase.from('complaints').select('*', { count: 'exact' });
    if (statusFilter) query = query.eq('status', statusFilter);
    if (priorityFilter) query = query.eq('priority', priorityFilter);
    query = query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const { data, count, error } = await query;
    if (error) { toast('error', error.message); setLoading(false); return; }
    const compData = (data ?? []) as Complaint[];
    const fitIds = [...new Set(compData.map((c) => c.fit_id).filter((v): v is string => v !== null))];
    let fitMap: Record<string, TrackFitting> = {};
    if (fitIds.length > 0) {
      const { data: fits } = await supabase.from('track_fittings').select('*').in('id', fitIds);
      fitMap = Object.fromEntries((fits ?? []).map((f: any) => [f.id, f]));
    }
    let result = compData.map((c) => ({ ...c, fitting: c.fit_id ? fitMap[c.fit_id] : undefined }));
    if (search) {
      result = result.filter((c) =>
        c.qr_id?.toLowerCase().includes(search.toLowerCase()) ||
        c.fitting?.component_id.toLowerCase().includes(search.toLowerCase()) ||
        c.complaint_type.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase()),
      );
    }
    setComplaints(result);
    setTotalPages(Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)));
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, statusFilter, priorityFilter]);
  useEffect(() => { const t = setTimeout(() => { setPage(1); load(); }, 300); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [search]);

  async function updateStatus(c: Complaint, status: Complaint['status']) {
    const payload: any = { status, updated_at: new Date().toISOString() };
    if (status === 'Resolved' || status === 'Rejected') payload.resolved_at = new Date().toISOString();
    const { error } = await supabase.from('complaints').update(payload).eq('id', c.id);
    if (error) { toast('error', error.message); return; }
    await logAudit(session?.user.id ?? null, `update_complaint_${status.toLowerCase()}`, 'complaint', c.id, `${c.complaint_type} for ${c.qr_id} → ${status}`);
    toast('success', `Complaint marked as ${status}`);
    load();
  }

  function handleExport() {
    exportCsv('complaints', ['QR ID', 'Component', 'Type', 'Priority', 'Status', 'Description', 'Registered', 'Resolved'],
      complaints.map((c) => [c.qr_id ?? '', c.fitting?.component_id ?? '', c.complaint_type, c.priority, c.status, c.description, new Date(c.created_at).toLocaleDateString(), c.resolved_at ? new Date(c.resolved_at).toLocaleDateString() : '—']));
  }

  return (
    <>
      <PageHeader title="Complaints" subtitle="View and manage complaints registered for track fittings">
        <button onClick={handleExport} className="btn-secondary"><Download size={16} /> Export CSV</button>
      </PageHeader>

      <div className="card mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by QR ID, component, type, or description..." className="input pl-9" /></div>
          <div className="flex gap-2">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input w-auto"><option value="">All Status</option><option value="Open">Open</option><option value="In Progress">In Progress</option><option value="Resolved">Resolved</option><option value="Rejected">Rejected</option></select>
            <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }} className="input w-auto"><option value="">All Priority</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option></select>
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner label="Loading complaints..." /> : complaints.length === 0 ? <div className="card"><EmptyState icon={MessageSquareWarning} title="No complaints found" message="Complaints registered via the QR Scanner will appear here." /></div> : (
        <div className="space-y-3">
          {complaints.map((c, i) => {
            const pStyle = PRIORITY_STYLES[c.priority] ?? PRIORITY_STYLES.Medium;
            const isExpanded = expandedId === c.id;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={`card border-l-4 ${pStyle.border} p-4`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-rail-700 dark:text-rail-300">{c.fitting?.component_id ?? 'Unknown'}</span>
                      <StatusBadge status={c.status} />
                      <span className={`badge ${c.priority === 'Critical' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' : c.priority === 'High' ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400' : c.priority === 'Medium' ? 'bg-rail-100 text-rail-700 dark:bg-rail-500/15 dark:text-rail-300' : 'bg-slate-100 text-slate-600 dark:bg-rail-800 dark:text-slate-300'}`}>
                        <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${pStyle.dot}`} />{c.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{c.complaint_type}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Clock size={12} /> {new Date(c.created_at).toLocaleString()}</span>
                      {c.qr_id && <span className="font-mono">{c.qr_id}</span>}
                      {c.resolved_at && <span>Resolved: {new Date(c.resolved_at).toLocaleDateString()}</span>}
                    </div>
                    <button onClick={() => setExpandedId(isExpanded ? null : c.id)} className="mt-2 text-xs font-medium text-rail-600 hover:underline dark:text-rail-400">
                      {isExpanded ? 'Hide timeline' : 'View timeline'}
                    </button>
                    {isExpanded && (
                      <div className="mt-3 border-l-2 border-slate-200 pl-4 dark:border-rail-700">
                        <div className="space-y-3">
                          <div className="relative">
                            <div className="absolute -left-[21px] h-3 w-3 rounded-full border-2 border-white bg-rail-500 dark:border-rail-900" />
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Complaint Registered</p>
                            <p className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString()}</p>
                          </div>
                          {c.status !== 'Open' && (
                            <div className="relative">
                              <div className="absolute -left-[21px] h-3 w-3 rounded-full border-2 border-white bg-accent-500 dark:border-rail-900" />
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Investigation Started</p>
                              <p className="text-xs text-slate-400">{new Date(c.updated_at).toLocaleString()}</p>
                            </div>
                          )}
                          {(c.status === 'Resolved' || c.status === 'Rejected') && (
                            <div className="relative">
                              <div className={`absolute -left-[21px] h-3 w-3 rounded-full border-2 border-white ${c.status === 'Resolved' ? 'bg-green-500' : 'bg-red-500'} dark:border-rail-900`} />
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{c.status === 'Resolved' ? 'Complaint Resolved' : 'Complaint Rejected'}</p>
                              <p className="text-xs text-slate-400">{c.resolved_at ? new Date(c.resolved_at).toLocaleString() : new Date(c.updated_at).toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.status === 'Open' && <button onClick={() => updateStatus(c, 'In Progress')} className="btn-secondary py-1.5 text-xs">Start</button>}
                    {c.status === 'In Progress' && <button onClick={() => updateStatus(c, 'Resolved')} className="btn-secondary py-1.5 text-xs"><CheckCircle2 size={14} /> Resolve</button>}
                    {c.status !== 'Resolved' && c.status !== 'Rejected' && <button onClick={() => updateStatus(c, 'Rejected')} className="btn-secondary py-1.5 text-xs"><XCircle size={14} /> Reject</button>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </>
  );
}
