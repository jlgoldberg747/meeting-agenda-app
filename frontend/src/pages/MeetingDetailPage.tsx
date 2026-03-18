import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { calcSchedule, getFormat, FORMATS, m2t, t2m } from '../types';
import type { MeetingItem, ScheduledItem } from '../types';

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

type ViewTab = 'summary' | 'detail';

// ─── Summary View ──────────────────────────────────────────────────────────
function SummaryView({ scheduled, fmtExpanded }: { scheduled: ScheduledItem[]; fmtExpanded: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      {scheduled.map(item => {
        const fmt = getFormat(item.format);
        const exp = expandedId === item.id;
        return (
          <div key={item.id} className="flex overflow-hidden rounded-sm">
            {/* Format strip */}
            <div
              className={`flex-shrink-0 flex items-center justify-center transition-all ${fmtExpanded ? 'w-9' : 'w-2'}`}
              style={{ background: fmt.cl, borderRadius: '10px 0 0 10px' }}
              title={`${fmt.c} — ${fmt.l}`}
            >
              {fmtExpanded && (
                <span className="text-white font-extrabold text-[7px] uppercase tracking-wider" style={{ writingMode: 'vertical-rl' }}>
                  {fmt.c}
                </span>
              )}
            </div>

            <div className={`flex-1 min-w-0 bg-srf border-[1.5px] border-l-0 border-bdr rounded-r-sm shadow-card transition-all hover:border-[rgba(43,188,200,0.3)] hover:shadow-card-lg ${item.is_break ? 'opacity-50' : ''}`}>
              <div
                className="grid items-center px-3 py-2 gap-2 cursor-pointer"
                style={{ gridTemplateColumns: '80px minmax(80px,0.6fr) minmax(100px,1.6fr) minmax(80px,0.5fr)' }}
                onClick={() => setExpandedId(exp ? null : item.id)}
              >
                <div className="font-mono text-[10px] text-muted leading-tight">
                  <div>{item.sched_start} – {item.sched_end}</div>
                  <div className="text-[9px]">{item.duration_minutes}m</div>
                </div>
                <div className="font-extrabold text-navy text-[13px] truncate">
                  {item.is_break ? '☕ ' : ''}{item.title}
                </div>
                <div className="text-[12px] text-slate line-clamp-2">
                  {(item.objective || '').replace(/\n/g, ' · ')}
                </div>
                <div className="font-mono text-[8px] font-medium uppercase tracking-wider text-teal-dk text-right">
                  {item.illustration && !item.is_break ? `⛰ ${item.illustration}` : ''}
                </div>
              </div>
              {item.approach && exp && (
                <div className="border-t border-bdr px-3 py-2 text-[11px] text-slate" style={{ paddingLeft: '104px' }}>
                  <strong>Approach:</strong> {item.approach.split('\n').map((line, i) => (
                    <span key={i}>{i > 0 && <br />}{line}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Detail Table View ─────────────────────────────────────────────────────
function DetailView({ scheduled }: { scheduled: ScheduledItem[] }) {
  return (
    <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]" style={{ minWidth: '700px' }}>
          <thead>
            <tr className="bg-srf-alt">
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr w-1"></th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Start</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">End</th>
              <th className="text-center text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Dur</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Session</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Objective</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Theme</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Approach</th>
            </tr>
          </thead>
          <tbody>
            {scheduled.map(item => {
              const fmt = getFormat(item.format);
              return (
                <tr key={item.id} className={`border-b border-srf-alt hover:bg-[var(--teal-glow)] ${item.is_break ? 'opacity-40 italic' : ''}`}
                  style={{ borderLeft: `8px solid ${fmt.cl}` }}>
                  <td></td>
                  <td className="px-2 py-1.5 font-mono text-[9px] text-muted whitespace-nowrap">{item.sched_start}</td>
                  <td className="px-2 py-1.5 font-mono text-[9px] text-muted whitespace-nowrap">{item.sched_end}</td>
                  <td className="px-2 py-1.5 font-mono text-[9px] text-muted text-center">{item.duration_minutes}m</td>
                  <td className="px-2 py-1.5 font-extrabold text-navy text-[11px]">{item.is_break ? '☕ ' : ''}{item.title}</td>
                  <td className="px-2 py-1.5 text-slate text-[10px] leading-snug">
                    {(item.objective || '').split('\n').map((line, i) => (
                      <span key={i}>{i > 0 && <br />}{line}</span>
                    ))}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[8px] font-medium uppercase tracking-wider text-teal-dk">
                    {item.illustration || ''}
                  </td>
                  <td className="px-2 py-1.5 text-muted text-[9px] leading-snug">
                    {(item.approach || '').split('\n').map((line, i) => (
                      <span key={i}>{i > 0 && <br />}{line}</span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Comparison View (for completed meetings) ──────────────────────────────
function ComparisonView({ scheduled }: { scheduled: ScheduledItem[] }) {
  return (
    <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]" style={{ minWidth: '600px' }}>
          <thead>
            <tr className="bg-srf-alt">
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr w-14">Fmt</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Session</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Planned</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Actual</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Drift</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Status</th>
            </tr>
          </thead>
          <tbody>
            {scheduled.map(item => {
              const fmt = getFormat(item.format);
              let actualData: { start: string; end: string; duration: number } | null = null;
              if (item.actual_start_at && item.actual_end_at) {
                const aStart = new Date(item.actual_start_at);
                const aEnd = new Date(item.actual_end_at);
                const aDur = Math.round((aEnd.getTime() - aStart.getTime()) / 60000);
                actualData = {
                  start: aStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                  end: aEnd.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                  duration: aDur,
                };
              }
              const diff = actualData ? actualData.duration - item.duration_minutes : null;

              return (
                <tr key={item.id} className={`border-b border-srf-alt hover:bg-[var(--teal-glow)] ${item.is_break ? 'opacity-50' : ''}`}
                  style={{ borderLeft: `4px solid ${fmt.cl}` }}>
                  <td className="px-2 py-2">
                    <span className="text-[8px] font-extrabold uppercase tracking-wider" style={{ color: fmt.cl }}>{fmt.c}</span>
                  </td>
                  <td className="px-2 py-2 font-bold text-[12px] text-navy">{item.is_break ? '☕ ' : ''}{item.title}</td>
                  <td className="px-2 py-2 font-mono text-[9px] text-muted whitespace-nowrap">
                    {item.sched_start} – {item.sched_end}
                    <div className="text-[8px]">{item.duration_minutes}m planned</div>
                  </td>
                  <td className="px-2 py-2 font-mono text-[9px]">
                    {actualData ? (
                      <div>
                        <div className="text-navy">{actualData.start} – {actualData.end}</div>
                        <div className="text-[8px] text-muted">{actualData.duration}m actual</div>
                      </div>
                    ) : <span className="text-muted">—</span>}
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [viewTab, setViewTab] = useState<ViewTab>('summary');
  const [fmtExpanded, setFmtExpanded] = useState(false);

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

  const exportXlsx = () => {
    if (!meeting) return;
    const wb = XLSX.utils.book_new();

    // Meeting metadata sheet
    const metaData = [
      ['Organisation', meeting.organisation || ''],
      ['Meeting Title', meeting.title],
      ['Subtitle', meeting.subtitle || ''],
      ['Date', meeting.date],
      ['Location', meeting.location || ''],
      ['Facilitator', meeting.facilitator || ''],
      ['Start Time', meeting.start_time],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaData), 'Meeting metadata');

    // Detailed agenda sheet
    const scheduled = calcSchedule(meeting.items, meeting.start_time);
    const agendaData = [['Start', 'Finish', 'Format', 'Topic', 'Objective', 'Illustration', 'Approach']];
    scheduled.forEach(c => {
      agendaData.push([c.sched_start, c.sched_end, c.format || '', c.title, c.objective || '', c.illustration || '', c.approach || '']);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(agendaData);
    ws2['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 22 }, { wch: 35 }, { wch: 18 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Detailed agenda');

    // Format types sheet
    const fmtData: string[][] = [['Format types']];
    FORMATS.forEach(f => fmtData.push([`${f.c} — ${f.l}`]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fmtData), 'List');

    const filename = `${meeting.title.replace(/[^a-zA-Z0-9 ]/g, '')}_Agenda.xlsx`;
    XLSX.writeFile(wb, filename);
  };

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
            <h1 className="text-2xl font-black text-navy tracking-tight">
              {meeting.title.replace(/(\d{4})/, '<em>$1</em>').includes('<em>')
                ? <>{meeting.title.split(/(\d{4})/).map((part, i) => /^\d{4}$/.test(part) ? <em key={i} className="not-italic text-teal-dk">{part}</em> : part)}</>
                : meeting.title
              }
            </h1>
            {meeting.subtitle && <p className="text-slate text-sm mt-0.5">{meeting.subtitle}</p>}
          </div>
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border-[1.5px] ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[10px] text-muted mb-4">
          {meeting.organisation && <span className="font-bold text-navy">{meeting.organisation}</span>}
          <span className="font-bold text-slate">{dateStr}</span>
          <span>🕐 {meeting.start_time}{lastSched ? ` – ${lastSched.sched_end}` : ''}</span>
          {meeting.location && <span>{meeting.location}</span>}
          {meeting.facilitator && <span>Facilitator: <strong className="text-slate">{meeting.facilitator}</strong></span>}
          {meeting.participants.length > 0 && (
            <span>{meeting.participants.join(', ')}</span>
          )}
          <span><strong>{formatDuration(totalPlanned)}</strong></span>
          {meeting.items.length > 0 && (
            <span>{meeting.items.filter(i => !i.is_break).length} sessions</span>
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
            onClick={exportXlsx}
            className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-navy border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all"
          >
            ↓ Export .xlsx
          </button>
          <button
            onClick={() => confirm('Delete this meeting?') && deleteMutation.mutate()}
            className="px-4 py-2 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-coral border-[1.5px] border-coral hover:bg-[rgba(239,68,68,0.06)] transition-all"
          >
            Delete
          </button>
        </div>
      </div>

      {/* View tabs */}
      {meeting.items.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1">
              {meeting.status === 'COMPLETED' ? (
                <button className="px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border-[1.5px] text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]">
                  Actual vs Planned
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setViewTab('summary')}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border-[1.5px] transition-all ${
                      viewTab === 'summary'
                        ? 'text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]'
                        : 'text-muted border-transparent hover:text-slate hover:bg-srf-alt'
                    }`}
                  >
                    Summary
                  </button>
                  <button
                    onClick={() => setViewTab('detail')}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border-[1.5px] transition-all ${
                      viewTab === 'detail'
                        ? 'text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]'
                        : 'text-muted border-transparent hover:text-slate hover:bg-srf-alt'
                    }`}
                  >
                    Detail
                  </button>
                </>
              )}
            </div>
            {viewTab === 'summary' && meeting.status !== 'COMPLETED' && (
              <button
                onClick={() => setFmtExpanded(f => !f)}
                className="text-[9px] font-extrabold px-3 py-1.5 rounded-full border-[1.5px] border-bdr text-muted hover:border-teal hover:text-teal-dk transition-all"
              >
                {fmtExpanded ? '◂ Collapse formats' : '▸ Expand formats'}
              </button>
            )}
          </div>

          {meeting.status === 'COMPLETED' ? (
            <ComparisonView scheduled={scheduled} />
          ) : viewTab === 'summary' ? (
            <SummaryView scheduled={scheduled} fmtExpanded={fmtExpanded} />
          ) : (
            <DetailView scheduled={scheduled} />
          )}
        </>
      )}

      {meeting.items.length === 0 && (
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
          {FORMATS.map(f => (
            <div key={f.c} className="flex items-center gap-1.5 text-[10px] font-bold text-slate px-3 py-2.5 border-r border-bdr last:border-r-0 flex-1 min-w-[140px]">
              <div className="w-[18px] h-1 rounded-full flex-shrink-0" style={{ background: f.cl }} />
              <strong>{f.c}</strong> {f.l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
