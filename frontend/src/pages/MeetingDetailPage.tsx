import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { calcSchedule, getFormat, FORMATS, m2t, t2m, nowMinutes, type MeetingFormat } from '../types';
import type { MeetingItem, ScheduledItem, AgendaItemBase } from '../types';
import AgendaEditor from '../components/AgendaEditor';
import { playChimeByType, getSelectedChime } from './SettingsPage';

function playChime(loud = false) {
  playChimeByType(getSelectedChime(), loud);
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

type ViewTab = 'summary' | 'detail' | 'track' | 'edit';

// ─── Track state per item ─────────────────────────────────────────────────────
interface TrackState {
  startedAt: Date | null;
  endedAt: Date | null;
}

// ─── Timer display ────────────────────────────────────────────────────────────
function TimerDisplay({ seconds, overtime }: { seconds: number; overtime: boolean }) {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return (
    <span className={`font-mono font-bold text-lg tabular-nums ${overtime ? 'text-coral' : seconds < 60 ? 'text-amber' : 'text-teal-dk'}`}>
      {overtime ? '-' : ''}{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

// ─── Summary View ─────────────────────────────────────────────────────────────
function SummaryView({
  scheduled,
  fmtExpanded,
  tracking,
  activeId,
  onStartSession,
}: {
  scheduled: ScheduledItem[];
  fmtExpanded: boolean;
  tracking: Record<string, TrackState>;
  activeId: string | null;
  onStartSession: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const hasTracking = Object.keys(tracking).length > 0;

  return (
    <div className="space-y-1">
      {scheduled.map(item => {
        const fmt = getFormat(item.format);
        const exp = expandedId === item.id;
        const tr = tracking[item.id];
        const isDone = Boolean(tr?.endedAt) || item.status === 'done' || item.status === 'skipped';
        const isActive = activeId === item.id;

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

            <div className={`flex-1 min-w-0 bg-srf border-[1.5px] border-l-0 border-bdr rounded-r-sm shadow-card transition-all hover:border-[rgba(43,188,200,0.3)] hover:shadow-card-lg ${item.is_break ? 'opacity-50' : ''} ${isDone ? 'opacity-40' : ''} ${isActive ? 'border-teal shadow-[0_0_0_2px_rgba(43,188,200,0.15)]' : ''}`}>
              <div
                className="grid items-center px-3 py-2 gap-2 cursor-pointer"
                style={{ gridTemplateColumns: '80px minmax(80px,0.6fr) minmax(100px,1.2fr) auto' }}
                onClick={() => setExpandedId(exp ? null : item.id)}
              >
                <div className="font-mono text-xs text-muted leading-tight">
                  <div>{item.sched_start} – {item.sched_end}</div>
                  <div className="text-[11px]">{item.duration_minutes}m</div>
                </div>
                <div className="font-extrabold text-navy text-sm truncate">
                  {item.is_break ? '☕ ' : ''}{item.title}
                </div>
                <div className="text-xs text-slate line-clamp-2">
                  {(item.objective || '').replace(/\n/g, ' · ')}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {!isDone && !isActive && !activeId && (
                    <button
                      onClick={() => onStartSession(item.id)}
                      className="px-3 py-1 rounded-full font-extrabold text-[11px] uppercase tracking-wider bg-[rgba(43,188,200,0.1)] text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)] hover:bg-teal hover:text-white transition-all"
                    >
                      Start
                    </button>
                  )}
                  {isActive && (
                    <span className="text-[10px] font-extrabold text-teal-dk animate-pulse">▶ ACTIVE</span>
                  )}
                  {isDone && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.1)] text-success">✓</span>
                  )}
                </div>
              </div>
              {item.approach && exp && (
                <div className="border-t border-bdr px-3 py-2 text-xs text-slate" style={{ paddingLeft: '104px' }}>
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

// ─── Detail Table View ────────────────────────────────────────────────────────
function DetailView({ scheduled }: { scheduled: ScheduledItem[] }) {
  return (
    <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs" style={{ minWidth: '700px' }}>
          <thead>
            <tr className="bg-srf-alt">
              <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr w-1"></th>
              <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Start</th>
              <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">End</th>
              <th className="text-center text-[10px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Dur</th>
              <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Session</th>
              <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Objective</th>
              <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Theme</th>
              <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-muted px-2 py-2 border-b-[1.5px] border-bdr">Approach</th>
            </tr>
          </thead>
          <tbody>
            {scheduled.map(item => {
              const fmt = getFormat(item.format);
              return (
                <tr key={item.id} className={`border-b border-srf-alt hover:bg-[var(--teal-glow)] ${item.is_break ? 'opacity-40 italic' : ''}`}
                  style={{ borderLeft: `8px solid ${fmt.cl}` }}>
                  <td></td>
                  <td className="px-2 py-1.5 font-mono text-[11px] text-muted whitespace-nowrap">{item.sched_start}</td>
                  <td className="px-2 py-1.5 font-mono text-[11px] text-muted whitespace-nowrap">{item.sched_end}</td>
                  <td className="px-2 py-1.5 font-mono text-[11px] text-muted text-center">{item.duration_minutes}m</td>
                  <td className="px-2 py-1.5 font-extrabold text-navy text-xs">{item.is_break ? '☕ ' : ''}{item.title}</td>
                  <td className="px-2 py-1.5 text-slate text-[11px] leading-snug">
                    {(item.objective || '').split('\n').map((line, i) => (
                      <span key={i}>{i > 0 && <br />}{line}</span>
                    ))}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-teal-dk">
                    {item.illustration || ''}
                  </td>
                  <td className="px-2 py-1.5 text-muted text-[11px] leading-snug">
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

// ─── Track View ───────────────────────────────────────────────────────────────
function TrackItemRow({
  sitem,
  isActive,
  isDone,
  tracking: tr,
  fmtExpanded,
  manualEntry,
  projected,
  onStart,
  onEnd,
  onManual,
  onManualSave,
}: {
  sitem: ScheduledItem;
  isActive: boolean;
  isDone: boolean;
  tracking: TrackState | null;
  fmtExpanded: boolean;
  manualEntry: boolean;
  projected: { pS: string; pE: string; dM: number } | null;
  onStart: () => void;
  onEnd: () => void;
  onManual: () => void;
  onManualSave: (sM: string, eM: string) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [manualStart, setManualStart] = useState(tr?.startedAt ? m2t(tr.startedAt.getHours() * 60 + tr.startedAt.getMinutes()) : '');
  const [manualEnd, setManualEnd] = useState(tr?.endedAt ? m2t(tr.endedAt.getHours() * 60 + tr.endedAt.getMinutes()) : '');
  const fmt = getFormat(sitem.format);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isActive || !tr?.startedAt) return;
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - tr.startedAt!.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [isActive, tr?.startedAt]);

  const remainSecs = isActive ? sitem.duration_minutes * 60 - elapsed : 0;
  const overtime = isActive && remainSecs < 0;

  let cls = sitem.is_break ? 'opacity-45' : isActive ? 'border-teal shadow-[0_0_0_2px_rgba(43,188,200,0.15)]' : isDone ? 'opacity-40' : '';

  // Drift display for done items
  let driftEl: React.ReactNode = null;
  if (isDone && tr?.startedAt && tr?.endedAt) {
    const actualDur = Math.round((tr.endedAt.getTime() - tr.startedAt.getTime()) / 60000);
    const di = sitem.duration_minutes - actualDur;
    driftEl = di > 0
      ? <span className="font-mono text-xs font-bold text-teal-dk">+{di}m</span>
      : di < 0
        ? <span className="font-mono text-xs font-bold text-coral">{di}m</span>
        : <span className="font-mono text-xs font-bold text-amber">—</span>;
  } else if (projected) {
    driftEl = <span className="font-mono text-[11px] text-muted">≈ {projected.pS}</span>;
  }

  // Controls
  let controls: React.ReactNode = null;
  if (manualEntry) {
    controls = (
      <div className="flex items-center gap-1">
        <input
          className="font-mono text-xs w-11 text-center border-[1.5px] border-bdr rounded-md px-1 py-0.5 bg-srf-alt text-navy focus:border-teal"
          placeholder="HH:MM"
          value={manualStart}
          onChange={e => setManualStart(e.target.value)}
        />
        <input
          className="font-mono text-xs w-11 text-center border-[1.5px] border-bdr rounded-md px-1 py-0.5 bg-srf-alt text-navy focus:border-teal"
          placeholder="HH:MM"
          value={manualEnd}
          onChange={e => setManualEnd(e.target.value)}
        />
        <button
          onClick={() => onManualSave(manualStart, manualEnd)}
          className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[rgba(43,188,200,0.1)] text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)]"
        >✓</button>
      </div>
    );
  } else if (isDone && tr?.startedAt && tr?.endedAt) {
    const actualDur = Math.round((tr.endedAt.getTime() - tr.startedAt.getTime()) / 60000);
    const sT = m2t(tr.startedAt.getHours() * 60 + tr.startedAt.getMinutes());
    const eT = m2t(tr.endedAt.getHours() * 60 + tr.endedAt.getMinutes());
    controls = (
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[rgba(43,188,200,0.08)] text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)]">
          {sT}–{eT} ({actualDur}m)
        </span>
        <button onClick={onManual} className="text-muted text-xs opacity-35 hover:opacity-100 hover:text-teal-dk transition-all">✎</button>
      </div>
    );
  } else if (isActive) {
    controls = (
      <div className="flex items-center gap-1.5">
        <TimerDisplay seconds={remainSecs} overtime={overtime} />
        <button
          onClick={onEnd}
          className="px-3 py-1 rounded-full font-extrabold text-[11px] uppercase tracking-wider bg-coral text-white pulse-btn border border-coral"
        >
          End
        </button>
        <button onClick={onManual} className="text-muted text-xs opacity-35 hover:opacity-100 hover:text-teal-dk transition-all">✎</button>
      </div>
    );
  } else {
    controls = (
      <div className="flex items-center gap-1">
        <button
          onClick={onStart}
          className="px-3 py-1 rounded-full font-extrabold text-[11px] uppercase tracking-wider bg-[rgba(43,188,200,0.1)] text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)] hover:bg-teal hover:text-white transition-all"
        >
          Start
        </button>
        <button onClick={onManual} className="text-muted text-[11px] opacity-35 hover:opacity-100 hover:text-teal-dk transition-all">✎ manual</button>
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden rounded-sm mb-1">
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

      <div className={`flex-1 min-w-0 bg-srf border-[1.5px] border-l-0 border-bdr rounded-r-sm shadow-card transition-all ${cls}`}>
        <div
          className="grid items-center px-3 py-2 gap-2 cursor-pointer"
          style={{ gridTemplateColumns: '80px minmax(60px,0.35fr) 1fr auto' }}
          onClick={() => setExpanded(e => !e)}
        >
          <div className="font-mono text-[11px] text-muted leading-tight flex items-baseline gap-1.5 flex-wrap">
            {sitem.sched_start} – {sitem.sched_end} <span className="text-[10px]">{sitem.duration_minutes}m</span>
          </div>
          <div className="font-extrabold text-navy text-sm truncate">
            {sitem.is_break ? '☕ ' : ''}{sitem.title}
          </div>
          <div className="text-xs text-muted truncate">
            {(sitem.objective || '').split('\n')[0]}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
            {driftEl}
            {controls}
          </div>
        </div>
        {expanded && sitem.approach && (
          <div className="border-t border-bdr px-3 py-2 text-xs text-slate" style={{ paddingLeft: '104px' }}>
            <strong>Approach:</strong> {sitem.approach.split('\n').map((line, i) => (
              <span key={i}>{i > 0 && <br />}{line}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TrackView({
  scheduled,
  fmtExpanded,
  tracking,
  activeId,
  onStart,
  onEnd,
  onManualSave,
  onResetTracking,
}: {
  scheduled: ScheduledItem[];
  fmtExpanded: boolean;
  tracking: Record<string, TrackState>;
  activeId: string | null;
  onStart: (id: string) => void;
  onEnd: (id: string) => void;
  onManualSave: (id: string, sM: string, eM: string) => void;
  onResetTracking: () => void;
}) {
  const [manualId, setManualId] = useState<string | null>(null);

  // Calculate drift and projections
  const hasTracking = Object.keys(tracking).length > 0;
  let drift = 0;
  scheduled.forEach(s => {
    const tr = tracking[s.id];
    if (tr?.startedAt && tr?.endedAt) {
      const actualDur = Math.round((tr.endedAt.getTime() - tr.startedAt.getTime()) / 60000);
      drift += s.duration_minutes - actualDur;
    }
  });

  // Projection: find last completed, project remaining
  const projections: Record<string, { pS: string; pE: string; dM: number }> = {};
  let lastDoneIdx = -1;
  let lastEndMin: number | null = null;
  for (let i = scheduled.length - 1; i >= 0; i--) {
    const tr = tracking[scheduled[i].id];
    if (tr?.endedAt) {
      lastDoneIdx = i;
      lastEndMin = tr.endedAt.getHours() * 60 + tr.endedAt.getMinutes();
      break;
    }
  }
  if (lastDoneIdx >= 0 && lastEndMin !== null) {
    let cursor = lastEndMin;
    for (let i = lastDoneIdx + 1; i < scheduled.length; i++) {
      const s = scheduled[i];
      projections[s.id] = {
        pS: m2t(cursor),
        pE: m2t(cursor + s.duration_minutes),
        dM: cursor - s.sched_start_min,
      };
      cursor += s.duration_minutes;
    }
  }

  const lastItem = scheduled[scheduled.length - 1];
  let projFinish = lastItem?.sched_end ?? '—';
  if (drift !== 0 && lastItem) {
    projFinish = m2t(t2m(lastItem.sched_end) - drift);
  }
  if (lastItem && projections[lastItem.id]) {
    projFinish = projections[lastItem.id].pE;
  }

  return (
    <div>
      {/* Stats bar */}
      {hasTracking && (
        <div className="bg-srf border-[1.5px] border-bdr rounded-sm shadow-card px-5 py-3 mb-3 flex items-center justify-around flex-wrap gap-4 sticky top-[140px] z-40">
          {[
            { label: 'Planned', value: lastItem?.sched_end ?? '—', cls: 'text-navy' },
            { label: 'Forecast', value: projFinish, cls: drift >= 0 ? 'text-teal-dk' : 'text-coral' },
            { label: 'Drift', value: drift === 0 ? '—' : `${drift > 0 ? '+' : ''}${drift}m`, cls: drift > 0 ? 'text-teal-dk' : drift < 0 ? 'text-coral' : 'text-amber' },
            { label: 'Progress', value: `${scheduled.filter(s => tracking[s.id]?.endedAt || s.status === 'done').length}/${scheduled.length}`, cls: 'text-navy' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="text-center">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted">{label}</div>
              <div className={`font-mono font-bold text-[17px] ${cls}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Track items */}
      {scheduled.map(sitem => {
        const tr = tracking[sitem.id] ?? null;
        const isDone = Boolean(tr?.endedAt) || sitem.status === 'done';
        const isActive = activeId === sitem.id;

        return (
          <TrackItemRow
            key={sitem.id}
            sitem={sitem}
            isActive={isActive}
            isDone={isDone}
            tracking={tr}
            fmtExpanded={fmtExpanded}
            manualEntry={manualId === sitem.id}
            projected={projections[sitem.id] ?? null}
            onStart={() => onStart(sitem.id)}
            onEnd={() => onEnd(sitem.id)}
            onManual={() => setManualId(manualId === sitem.id ? null : sitem.id)}
            onManualSave={(sM, eM) => {
              onManualSave(sitem.id, sM, eM);
              setManualId(null);
            }}
          />
        );
      })}

      {/* Reset button */}
      <div className="mt-5 text-center">
        <button
          onClick={onResetTracking}
          className="px-4 py-2 rounded-full font-extrabold text-xs uppercase tracking-wider text-coral border-[1.5px] border-coral hover:bg-[rgba(239,68,68,0.06)] transition-all"
        >
          Reset Tracking
        </button>
      </div>
    </div>
  );
}

// ─── Edit View ────────────────────────────────────────────────────────────────
type EditItem = Omit<AgendaItemBase, 'id'> & { id: string };

function EditView({
  meeting,
  onSave,
}: {
  meeting: any;
  onSave: (data: any) => void;
}) {
  const [organisation, setOrganisation] = useState(meeting.organisation || '');
  const [title, setTitle] = useState(meeting.title);
  const [subtitle, setSubtitle] = useState(meeting.subtitle || '');
  const [date, setDate] = useState(meeting.date);
  const [startTime, setStartTime] = useState(meeting.start_time);
  const [location, setLocation] = useState(meeting.location || '');
  const [facilitator, setFacilitator] = useState(meeting.facilitator || '');
  const [items, setItems] = useState<EditItem[]>(
    meeting.items.map((i: MeetingItem) => ({ ...i }))
  );

  const handleSave = () => {
    onSave({
      organisation: organisation.trim(),
      title: title.trim(),
      subtitle: subtitle.trim(),
      date,
      start_time: startTime,
      location: location.trim(),
      facilitator: facilitator.trim(),
      items: items.map((item, idx) => ({
        title: item.title,
        duration_minutes: item.duration_minutes,
        format: item.format as MeetingFormat,
        objective: item.objective,
        illustration: item.illustration,
        approach: item.approach,
        is_break: item.is_break,
        notes: item.notes,
        position: idx,
      })),
    });
  };

  return (
    <div className="space-y-4">
      {/* Meeting details form */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5">
        <div className="text-sm font-black mb-3">Meeting Details</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Organisation</label>
            <input value={organisation} onChange={e => setOrganisation(e.target.value)}
              className="border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Subtitle</label>
            <input value={subtitle} onChange={e => setSubtitle(e.target.value)}
              className="border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Start Time</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm font-mono text-navy bg-srf focus:border-teal transition-colors" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              className="border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Facilitator</label>
            <input value={facilitator} onChange={e => setFacilitator(e.target.value)}
              className="border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors" />
          </div>
        </div>
      </div>

      {/* Agenda editor */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5">
        <div className="text-sm font-black mb-3">Agenda Sessions</div>
        <AgendaEditor items={items} startTime={startTime} onChange={setItems} />
      </div>

      {/* Save button */}
      <div className="text-right">
        <button
          onClick={handleSave}
          className="px-5 py-2 rounded-full font-extrabold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [viewTab, setViewTab] = useState<ViewTab>('summary');
  const [fmtExpanded, setFmtExpanded] = useState(false);
  const [locked, setLocked] = useState(false);
  const [chimesOn, setChimesOn] = useState(true);

  // Tracking state
  const [tracking, setTracking] = useState<Record<string, TrackState>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [firedChimes, setFiredChimes] = useState<Record<string, Set<number>>>({});

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => api.meetings.get(id!),
    refetchOnWindowFocus: false,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.meetings.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings-upcoming'] });
      qc.invalidateQueries({ queryKey: ['meetings-archive'] });
      navigate('/meetings');
    },
  });

  const updateMeetingMutation = useMutation({
    mutationFn: (data: any) => api.meetings.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting', id] });
      qc.invalidateQueries({ queryKey: ['meetings-upcoming'] });
      qc.invalidateQueries({ queryKey: ['meetings-archive'] });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) =>
      api.meetings.updateItem(id!, itemId, data),
  });

  // Restore tracking from DB
  useEffect(() => {
    if (!meeting) return;
    const t: Record<string, TrackState> = {};
    let activeFound: string | null = null;
    for (const item of meeting.items) {
      if (item.actual_start_at) {
        const started = new Date(item.actual_start_at);
        const ended = item.actual_end_at ? new Date(item.actual_end_at) : null;
        t[item.id] = { startedAt: started, endedAt: ended };
        if (item.status === 'in_progress') activeFound = item.id;
      }
    }
    setTracking(t);
    if (activeFound) setActiveId(activeFound);
  }, [meeting?.id]);

  // Chime check interval
  useEffect(() => {
    if (!activeId || !chimesOn) return;
    const checkChimes = () => {
      const tr = tracking[activeId];
      if (!tr?.startedAt) return;
      const item = meeting?.items.find(i => i.id === activeId);
      if (!item) return;
      const elapsedMins = (Date.now() - tr.startedAt.getTime()) / 60000;
      const remainMins = item.duration_minutes - elapsedMins;
      const thresholds = [10, 5, 1, 0];
      setFiredChimes(prev => {
        const cur = new Set(prev[activeId] || []);
        let shouldPlay = false;
        let loud = false;
        for (const t of thresholds) {
          if (remainMins <= t && !cur.has(t)) {
            cur.add(t);
            shouldPlay = true;
            if (t === 0) loud = true;
          }
        }
        if (shouldPlay) playChime(loud);
        return { ...prev, [activeId]: cur };
      });
    };
    const interval = setInterval(checkChimes, 5000);
    return () => clearInterval(interval);
  }, [activeId, chimesOn, tracking, meeting?.items]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStartSession = useCallback((itemId: string) => {
    const now = new Date();
    // If meeting not started yet, mark it IN_PROGRESS
    if (meeting?.status === 'PLANNED') {
      updateMeetingMutation.mutate({ status: 'IN_PROGRESS', actual_start_at: now.toISOString() });
    }
    setTracking(prev => ({ ...prev, [itemId]: { startedAt: now, endedAt: null } }));
    setActiveId(itemId);
    updateItemMutation.mutate({
      itemId,
      data: { status: 'in_progress', actual_start_at: now.toISOString() },
    });
    // Switch to track view
    if (viewTab !== 'track') setViewTab('track');
  }, [meeting, viewTab]);

  const handleEndSession = useCallback((itemId: string) => {
    const now = new Date();
    const tr = tracking[itemId];
    const dur = tr?.startedAt ? Math.round((now.getTime() - tr.startedAt.getTime()) / 60000) : 0;
    setTracking(prev => ({ ...prev, [itemId]: { ...prev[itemId], endedAt: now } }));
    setActiveId(null);
    updateItemMutation.mutate({
      itemId,
      data: { status: 'done', actual_end_at: now.toISOString(), actual_duration_minutes: dur },
    });
  }, [tracking]);

  const handleManualSave = useCallback((itemId: string, sM: string, eM: string) => {
    if (!sM) return;
    const sMin = t2m(sM);
    const eMin = eM ? t2m(eM) : null;
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), Math.floor(sMin / 60), sMin % 60);
    const endDate = eMin !== null ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), Math.floor(eMin / 60), eMin % 60) : null;
    const dur = endDate ? Math.round((endDate.getTime() - startDate.getTime()) / 60000) : null;

    setTracking(prev => ({ ...prev, [itemId]: { startedAt: startDate, endedAt: endDate } }));
    if (endDate) {
      if (activeId === itemId) setActiveId(null);
      updateItemMutation.mutate({
        itemId,
        data: { status: 'done', actual_start_at: startDate.toISOString(), actual_end_at: endDate.toISOString(), actual_duration_minutes: dur },
      });
    } else {
      setActiveId(itemId);
      updateItemMutation.mutate({
        itemId,
        data: { status: 'in_progress', actual_start_at: startDate.toISOString() },
      });
    }
  }, [activeId]);

  const handleResetTracking = useCallback(() => {
    setTracking({});
    setActiveId(null);
    setFiredChimes({});
    // Reset all items in DB
    meeting?.items.forEach(item => {
      updateItemMutation.mutate({
        itemId: item.id,
        data: { status: 'pending', actual_start_at: null, actual_end_at: null, actual_duration_minutes: null },
      });
    });
    updateMeetingMutation.mutate({ status: 'PLANNED', actual_start_at: null, actual_end_at: null });
  }, [meeting]);

  const handleEditSave = useCallback((data: any) => {
    updateMeetingMutation.mutate(data, {
      onSuccess: () => {
        setViewTab('summary');
      },
    });
  }, []);

  const exportXlsx = () => {
    if (!meeting) return;
    const wb = XLSX.utils.book_new();
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

    const scheduled = calcSchedule(meeting.items, meeting.start_time);
    const agendaData = [['Start', 'Finish', 'Duration', 'Format', 'Topic', 'Objective', 'Illustration', 'Approach']];
    scheduled.forEach(c => {
      agendaData.push([c.sched_start, c.sched_end, `${c.duration_minutes}m`, c.format || '', c.title, c.objective || '', c.illustration || '', c.approach || '']);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(agendaData);
    ws2['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 22 }, { wch: 35 }, { wch: 18 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Detailed agenda');

    const fmtData: string[][] = [['Format types']];
    FORMATS.forEach(f => fmtData.push([`${f.c} — ${f.l}`]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fmtData), 'List');

    const filename = `${meeting.title.replace(/[^a-zA-Z0-9 ]/g, '')}_Agenda.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <div className="py-20 text-center text-muted text-sm animate-pulse">Loading meeting…</div>;
  }
  if (!meeting) {
    return <div className="py-20 text-center text-muted text-sm">Meeting not found.</div>;
  }

  const scheduled = calcSchedule(meeting.items, meeting.start_time);
  const totalPlanned = meeting.items.reduce((s, i) => s + i.duration_minutes, 0);
  const lastSched = scheduled[scheduled.length - 1];
  const hasTracking = Object.keys(tracking).length > 0;

  // Drift for nav pill
  let drift = 0;
  scheduled.forEach(s => {
    const tr = tracking[s.id];
    if (tr?.startedAt && tr?.endedAt) {
      const actualDur = Math.round((tr.endedAt.getTime() - tr.startedAt.getTime()) / 60000);
      drift += s.duration_minutes - actualDur;
    }
  });

  const dateStr = (() => {
    try {
      return new Date(meeting.date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch {
      return meeting.date;
    }
  })();

  return (
    <div className="animate-fade-in">
      {/* ─── Navigation Bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-[52px] z-50 bg-srf border-[1.5px] border-bdr shadow-card rounded-b-card px-4 py-2 mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* Tabs */}
          {!locked && (
            <button
              onClick={() => setViewTab('edit')}
              className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border-[1.5px] transition-all ${
                viewTab === 'edit'
                  ? 'text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]'
                  : 'text-muted border-transparent hover:text-slate hover:bg-srf-alt'
              }`}
            >
              Create / Edit
            </button>
          )}
          <button
            onClick={() => setViewTab('summary')}
            className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border-[1.5px] transition-all ${
              viewTab === 'summary'
                ? 'text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]'
                : 'text-muted border-transparent hover:text-slate hover:bg-srf-alt'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setViewTab('detail')}
            className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border-[1.5px] transition-all ${
              viewTab === 'detail'
                ? 'text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]'
                : 'text-muted border-transparent hover:text-slate hover:bg-srf-alt'
            }`}
          >
            Detail
          </button>
          <button
            onClick={() => setViewTab('track')}
            className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border-[1.5px] transition-all ${
              viewTab === 'track'
                ? 'text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]'
                : 'text-muted border-transparent hover:text-slate hover:bg-srf-alt'
            }`}
          >
            Track
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Drift pill */}
          {viewTab === 'track' && hasTracking && (
            <span className={`flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full border-[1.5px] ${
              drift >= 0
                ? 'text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]'
                : 'text-coral bg-[rgba(239,68,68,0.08)] border-coral'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse inline-block" />
              {drift === 0 ? 'ON TIME' : drift > 0 ? `+${drift}m ahead` : `${Math.abs(drift)}m behind`}
            </span>
          )}

          {/* Manual chime */}
          <button
            onClick={() => playChime(true)}
            className="w-7 h-7 rounded-full bg-gradient-to-r from-teal-dk to-teal-br text-white flex items-center justify-center shadow-teal hover:scale-110 transition-all text-sm"
            title="Manual chime"
          >🔔</button>

          {/* Chime toggle */}
          <button
            onClick={() => setChimesOn(c => !c)}
            className={`text-[11px] font-extrabold px-2 py-1 rounded-full border-[1.5px] transition-all ${
              chimesOn ? 'text-amber border-amber bg-[rgba(224,156,20,0.1)]' : 'text-muted border-bdr'
            }`}
          >
            {chimesOn ? '🔔 On' : '🔕 Off'}
          </button>

          {/* Lock/Unlock */}
          <button
            onClick={() => {
              const next = !locked;
              setLocked(next);
              if (next && viewTab === 'edit') setViewTab('summary');
            }}
            className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border-[1.5px] transition-all ${
              locked
                ? 'text-coral border-coral'
                : 'text-muted border-bdr hover:border-teal hover:text-teal-dk'
            }`}
          >
            {locked ? '🔒 Locked' : '🔓 Lock'}
          </button>
        </div>
      </div>

      {/* ─── Header Card ────────────────────────────────────────────────────── */}
      <div className={`bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5 mb-4 relative overflow-hidden card-accent ${viewTab === 'track' ? 'sticky top-[95px] z-40 rounded-t-none shadow-card-lg' : ''}`}>
        <h1 className="text-xl font-black text-navy tracking-tight">
          {meeting.title.split(/(\d{4})/).map((part, i) =>
            /^\d{4}$/.test(part)
              ? <em key={i} className="not-italic text-teal-dk">{part}</em>
              : <span key={i}>{part}</span>
          )}
        </h1>
        {meeting.subtitle && <p className="text-slate text-sm font-semibold mt-0.5">{meeting.subtitle}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted mt-2">
          {meeting.organisation && <span className="font-bold text-navy">{meeting.organisation}</span>}
          <span className="font-bold text-slate">{dateStr}</span>
          <span>{meeting.start_time}{lastSched ? ` – ${lastSched.sched_end}` : ''}</span>
          {meeting.location && <span>{meeting.location}</span>}
          <span><strong>{formatDuration(totalPlanned)}</strong></span>
          <span>{meeting.items.filter(i => !i.is_break).length} sessions</span>
          {meeting.facilitator && <span>Facilitator: <strong className="text-slate">{meeting.facilitator}</strong></span>}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={exportXlsx}
            className="px-3 py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-navy border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all"
          >
            ↓ Export Agenda (.xlsx)
          </button>
          <button
            onClick={() => confirm('Delete this meeting?') && deleteMutation.mutate()}
            className="px-3 py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-coral border-[1.5px] border-coral hover:bg-[rgba(239,68,68,0.06)] transition-all"
          >
            Delete
          </button>
        </div>
      </div>

      {/* ─── View Content ───────────────────────────────────────────────────── */}
      {meeting.items.length > 0 ? (
        <>
          {viewTab === 'summary' && (
            <SummaryView
              scheduled={scheduled}
              fmtExpanded={fmtExpanded}
              tracking={tracking}
              activeId={activeId}
              onStartSession={handleStartSession}
            />
          )}
          {viewTab === 'detail' && (
            <DetailView scheduled={scheduled} />
          )}
          {viewTab === 'track' && (
            <TrackView
              scheduled={scheduled}
              fmtExpanded={fmtExpanded}
              tracking={tracking}
              activeId={activeId}
              onStart={handleStartSession}
              onEnd={handleEndSession}
              onManualSave={handleManualSave}
              onResetTracking={handleResetTracking}
            />
          )}
          {viewTab === 'edit' && !locked && (
            <EditView
              meeting={meeting}
              onSave={handleEditSave}
            />
          )}
        </>
      ) : (
        <div className="bg-srf border-[1.5px] border-dashed border-bdr rounded-card p-8 text-center">
          <div className="text-3xl opacity-20 mb-2">📋</div>
          <p className="text-muted text-sm">No agenda items yet.</p>
          {!locked && (
            <button
              onClick={() => setViewTab('edit')}
              className="inline-block mt-3 text-teal-dk text-[11px] font-bold hover:underline"
            >
              Add agenda items →
            </button>
          )}
        </div>
      )}

      {/* ─── Format Toggle + Legend ─────────────────────────────────────────── */}
      {meeting.items.length > 0 && (viewTab === 'summary' || viewTab === 'track') && (
        <div className="mt-3">
          <button
            onClick={() => setFmtExpanded(f => !f)}
            className="text-[11px] font-extrabold px-3 py-1.5 rounded-full border-[1.5px] border-bdr text-muted hover:border-teal hover:text-teal-dk transition-all mb-3"
          >
            {fmtExpanded ? '◂ Collapse formats' : '▸ Expand formats'}
          </button>
        </div>
      )}

      {meeting.items.length > 0 && (
        <div className="flex flex-wrap gap-0 bg-srf border-[1.5px] border-bdr rounded-sm shadow-card overflow-hidden mt-3">
          {FORMATS.map(f => (
            <div key={f.c} className="flex items-center gap-1.5 text-xs font-bold text-slate px-3 py-2.5 border-r border-bdr last:border-r-0 flex-1 min-w-[140px]">
              <div className="w-[18px] h-1 rounded-full flex-shrink-0" style={{ background: f.cl }} />
              <strong>{f.c}</strong> {f.l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
