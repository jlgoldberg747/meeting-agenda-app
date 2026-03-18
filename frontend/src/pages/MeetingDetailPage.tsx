import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { calcSchedule, getFormat, FORMATS, m2t, t2m } from '../types';
import type { MeetingItem } from '../types';

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

function ComparisonRow({ item, planned, actual }: {
  item: MeetingItem;
  planned: { start: string; end: string; duration: number };
  actual?: { start: string; end: string; duration: number } | null;
}) {
  const fmt = getFormat(item.format);
  const diff = actual ? actual.duration - planned.duration : null;

  return (
    <tr className={`border-b border-srf-alt hover:bg-[var(--teal-glow)] ${item.is_break ? 'opacity-50' : ''}`}
      style={{ borderLeft: `4px solid ${fmt.cl}` }}>
      <td className="px-2 py-2">
        <span className="text-[8px] font-extrabold uppercase tracking-wider" style={{ color: fmt.cl }}>{fmt.c}</span>
      </td>
      <td className="px-2 py-2 font-bold text-[12px] text-navy">{item.is_break ? '☕ ' : ''}{item.title}</td>
      <td className="px-2 py-2 font-mono text-[9px] text-muted whitespace-nowrap">
        {planned.start} – {planned.end}
        <div className="text-[8px]">{planned.duration}m planned</div>
      </td>
      <td className="px-2 py-2 font-mono text-[9px]">
        {actual ? (
          <div>
            <div className="text-navy">{actual.start} – {actual.end}</div>
            <div className="text-[8px] text-muted">{actual.duration}m actual</div>
          </div>
        ) : (
          <span className="text-muted text-[9px]">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-[10px] font-mono font-bold">
        {diff !== null ? (
          <span className={diff > 0 ? 'text-coral' : diff < 0 ? 'text-success' : 'text-amber'}>
            {diff > 0 ? `+${diff}m` : diff < 0 ? `${diff}m` : '—'}
          </span>
        ) : <span className="text-muted">—</span>}
      </td>
      <td className="px-2 py-2">
        {item.status === 'done' && <span className="text-[8px] font-extrabold px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.1)] text-success">Done</span>}
        {item.status === 'skipped' && <span className="text-[8px] font-extrabold px-2 py-0.5 rounded-full bg-srf-alt text-muted">Skipped</span>}
        {item.status === 'in_progress' && <span className="text-[8px] font-extrabold px-2 py-0.5 rounded-full bg-[rgba(43,188,200,0.1)] text-teal-dk">In Progress</span>}
        {item.status === 'pending' && <span className="text-[8px] font-extrabold px-2 py-0.5 rounded-full bg-srf-alt text-muted">Pending</span>}
      </td>
    </tr>
  );
}

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => api.meetings.get(id!),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.meetings.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings-upcoming'] });
      qc.invalidateQueries({ queryKey: ['meetings-archive'] });
      navigate('/meetings');
    },
  });

  if (isLoading) {
    return <div className="py-20 text-center text-muted text-sm animate-pulse">Loading meeting…</div>;
  }

  if (!meeting) {
    return <div className="py-20 text-center text-muted text-sm">Meeting not found.</div>;
  }

  const scheduled = calcSchedule(meeting.items, meeting.start_time);
  const totalPlanned = meeting.items.reduce((s, i) => s + i.duration_minutes, 0);
  const totalActual = meeting.items
    .filter(i => i.actual_duration_minutes != null)
    .reduce((s, i) => s + (i.actual_duration_minutes || 0), 0);
  const lastSched = scheduled[scheduled.length - 1];

  const dateStr = new Date(meeting.date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const statusMap = {
    PLANNED: { label: 'Agenda Planned', cls: 'text-teal-dk bg-[rgba(43,188,200,0.1)] border-[rgba(43,188,200,0.3)]' },
    IN_PROGRESS: { label: 'In Progress', cls: 'text-success bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.3)]' },
    COMPLETED: { label: 'Completed', cls: 'text-muted bg-srf-alt border-bdr' },
  };
  const statusInfo = statusMap[meeting.status];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header card */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5 relative overflow-hidden card-accent">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
          <div>
            <h1 className="text-2xl font-black text-navy tracking-tight">{meeting.title}</h1>
            {meeting.subtitle && <p className="text-slate text-sm mt-0.5">{meeting.subtitle}</p>}
          </div>
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border-[1.5px] ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[10px] text-muted mb-4">
          <span className="font-bold text-slate">{dateStr}</span>
          <span>🕐 {meeting.start_time}{lastSched ? ` – ${lastSched.sched_end}` : ''}</span>
          {meeting.location && <span>📍 {meeting.location}</span>}
          {meeting.facilitator && <span>👤 Facilitator: <strong className="text-slate">{meeting.facilitator}</strong></span>}
          {meeting.participants.length > 0 && (
            <span>👥 {meeting.participants.join(', ')}</span>
          )}
          <span>⏱ {formatDuration(totalPlanned)} planned</span>
          {meeting.items.length > 0 && (
            <span>📋 {meeting.items.filter(i => !i.is_break).length} sessions</span>
          )}
        </div>

        {/* Actual timing if completed */}
        {meeting.status === 'COMPLETED' && meeting.actual_start_at && meeting.actual_end_at && (
          <div className="bg-srf-alt border border-bdr rounded-sm px-4 py-3 mb-3 text-[11px]">
            <span className="font-extrabold text-navy uppercase tracking-wider text-[9px]">Actual Times: </span>
            <span className="font-mono text-slate">
              {new Date(meeting.actual_start_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – {new Date(meeting.actual_end_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {totalActual > 0 && <span className="text-muted ml-3">({formatDuration(totalActual)} actual)</span>}
          </div>
        )}

        {meeting.notes && (
          <div className="bg-srf-alt border border-bdr rounded-sm px-4 py-3 text-[12px] text-slate">
            <span className="font-bold text-navy">Notes: </span>{meeting.notes}
          </div>
        )}

        <div className="flex gap-2 mt-4 flex-wrap">
          {(meeting.status === 'PLANNED' || meeting.status === 'IN_PROGRESS') && (
            <>
              <Link
                to={`/meetings/${meeting.id}/live`}
                className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all"
              >
                {meeting.status === 'IN_PROGRESS' ? '▶ Continue Meeting' : '▶ Start Meeting'}
              </Link>
              <Link
                to={`/meetings/${meeting.id}/edit`}
                className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)] bg-[rgba(43,188,200,0.08)] hover:bg-teal hover:text-white transition-all"
              >
                Edit
              </Link>
            </>
          )}
          <button
            onClick={() => confirm('Delete this meeting?') && deleteMutation.mutate()}
            className="px-4 py-2 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-coral border-[1.5px] border-coral hover:bg-[rgba(239,68,68,0.06)] transition-all"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Agenda table */}
      {meeting.items.length > 0 ? (
        <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-bdr">
            <h2 className="font-extrabold text-navy text-sm">
              {meeting.status === 'COMPLETED' ? 'Agenda — Actual vs Planned' : 'Planned Agenda'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]" style={{ minWidth: '600px' }}>
              <thead>
                <tr className="bg-srf-alt">
                  <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr w-14">Fmt</th>
                  <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Session</th>
                  <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Planned</th>
                  {meeting.status === 'COMPLETED' && (
                    <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Actual</th>
                  )}
                  {meeting.status === 'COMPLETED' && (
                    <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Drift</th>
                  )}
                  <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Status</th>
                </tr>
              </thead>
              <tbody>
                {scheduled.map(item => {
                  let actualData = null;
                  if (item.actual_start_at && item.actual_end_at) {
                    const aStart = new Date(item.actual_start_at);
                    const aEnd = new Date(item.actual_end_at);
                    const aDur = Math.round((aEnd.getTime() - aStart.getTime()) / 60000);
                    actualData = {
                      start: aStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                      end: aEnd.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                      duration: aDur,
                    };
                  } else if (item.actual_duration_minutes != null) {
                    actualData = {
                      start: '—',
                      end: '—',
                      duration: item.actual_duration_minutes,
                    };
                  }
                  return (
                    <ComparisonRow
                      key={item.id}
                      item={item}
                      planned={{ start: item.sched_start, end: item.sched_end, duration: item.duration_minutes }}
                      actual={actualData}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-srf border-[1.5px] border-dashed border-bdr rounded-card p-8 text-center">
          <div className="text-3xl opacity-20 mb-2">📋</div>
          <p className="text-muted text-sm">No agenda items yet.</p>
          <Link
            to={`/meetings/${meeting.id}/edit`}
            className="inline-block mt-3 text-teal-dk text-[11px] font-bold hover:underline"
          >
            Add agenda items →
          </Link>
        </div>
      )}

      {/* Format legend */}
      {meeting.items.length > 0 && (
        <div className="flex flex-wrap gap-0 bg-srf border-[1.5px] border-bdr rounded-sm shadow-card overflow-hidden">
          {FORMATS.filter(f => meeting.items.some(i => i.format === f.c)).map(f => (
            <div key={f.c} className="flex items-center gap-1.5 text-[10px] font-bold text-slate px-3 py-2 border-r border-bdr last:border-r-0">
              <div className="w-4 h-1 rounded-full" style={{ background: f.cl }} />
              <strong>{f.c}</strong> {f.l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
