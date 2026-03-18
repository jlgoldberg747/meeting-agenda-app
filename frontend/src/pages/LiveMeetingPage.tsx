import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { calcSchedule, getFormat, FORMATS, m2t, t2m, nowMinutes, type ScheduledItem } from '../types';
import { playChimeByType, getSelectedChime } from './SettingsPage';

function playChime(loud = false) {
  playChimeByType(getSelectedChime(), loud);
}

interface TrackState {
  startedAt: Date | null;
  endedAt: Date | null;
}

// ─── Timer display ──────────────────────────────────────────────────────────
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

// ─── Manual time entry inputs ───────────────────────────────────────────────
function ManualEntry({ tracking, onSave, onCancel }: {
  tracking: TrackState | null;
  onSave: (start: string, end: string) => void;
  onCancel: () => void;
}) {
  const [startVal, setStartVal] = useState(tracking?.startedAt ? m2t(tracking.startedAt.getHours() * 60 + tracking.startedAt.getMinutes()) : '');
  const [endVal, setEndVal] = useState(tracking?.endedAt ? m2t(tracking.endedAt.getHours() * 60 + tracking.endedAt.getMinutes()) : '');

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input
        className="font-mono text-[10px] w-[52px] text-center border-[1.5px] border-bdr rounded-md px-1 py-1 bg-srf-alt text-navy focus:border-teal focus:outline-none"
        placeholder="HH:MM"
        value={startVal}
        onChange={e => setStartVal(e.target.value)}
      />
      <input
        className="font-mono text-[10px] w-[52px] text-center border-[1.5px] border-bdr rounded-md px-1 py-1 bg-srf-alt text-navy focus:border-teal focus:outline-none"
        placeholder="HH:MM"
        value={endVal}
        onChange={e => setEndVal(e.target.value)}
      />
      <button
        onClick={() => onSave(startVal, endVal)}
        className="px-2 py-1 rounded-full font-extrabold text-[8px] bg-[rgba(43,188,200,0.1)] text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)] hover:bg-teal hover:text-white transition-all"
      >✓</button>
      <button
        onClick={onCancel}
        className="px-2 py-1 rounded-full font-extrabold text-[8px] text-muted border border-bdr hover:text-coral transition-all"
      >✕</button>
    </div>
  );
}

// ─── Single agenda row ──────────────────────────────────────────────────────
function ItemRow({
  sitem,
  isActive,
  isDone,
  tracking,
  expanded,
  projectedStart,
  driftDisplay,
  manualEntry,
  onStart,
  onEnd,
  onSkip,
  onExtend,
  onToggleExpand,
  onNotesChange,
  onManualEdit,
  onManualSave,
  onManualCancel,
  fmtExpanded,
}: {
  sitem: ScheduledItem;
  isActive: boolean;
  isDone: boolean;
  tracking: TrackState | null;
  expanded: boolean;
  projectedStart: string | null;
  driftDisplay: React.ReactNode;
  manualEntry: boolean;
  onStart: () => void;
  onEnd: () => void;
  onSkip: () => void;
  onExtend: (mins: number) => void;
  onToggleExpand: () => void;
  onNotesChange: (notes: string) => void;
  onManualEdit: () => void;
  onManualSave: (start: string, end: string) => void;
  onManualCancel: () => void;
  fmtExpanded: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [localNotes, setLocalNotes] = useState(sitem.notes || '');
  const fmt = getFormat(sitem.format);

  useEffect(() => { setLocalNotes(sitem.notes || ''); }, [sitem.notes]);

  useEffect(() => {
    if (!isActive || !tracking?.startedAt) return;
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - tracking.startedAt!.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [isActive, tracking?.startedAt]);

  const remainSecs = isActive
    ? sitem.duration_minutes * 60 - elapsed
    : isDone && tracking?.startedAt && tracking?.endedAt ? 0
    : sitem.duration_minutes * 60;

  const overtime = isActive && remainSecs < 0;

  // Forecast end: actual start + planned duration
  const fcEnd = (() => {
    if (tracking?.startedAt) {
      const startMin = tracking.startedAt.getHours() * 60 + tracking.startedAt.getMinutes();
      return m2t(startMin + sitem.duration_minutes);
    }
    if (projectedStart) {
      return m2t(t2m(projectedStart) + sitem.duration_minutes);
    }
    return sitem.sched_end;
  })();

  const fcDiff = t2m(fcEnd) - sitem.sched_end_min;

  let cls = '';
  if (isActive) cls = 'border-teal shadow-[0_0_0_2px_rgba(43,188,200,0.15)]';
  else if (isDone) cls = 'opacity-40';
  else if (sitem.is_break) cls = 'opacity-50';

  return (
    <div className={`flex overflow-hidden rounded-r-sm border-[1.5px] border-l-0 border-bdr ${cls} transition-all bg-srf shadow-card mb-1`}>
      {/* Format strip */}
      <div
        className={`flex-shrink-0 flex items-center justify-center transition-all ${fmtExpanded ? 'w-9' : 'w-2'}`}
        style={{ background: fmt.cl }}
        title={`${fmt.c} — ${fmt.l}`}
      >
        {fmtExpanded && (
          <span className="text-white font-extrabold text-[7px] uppercase tracking-wider" style={{ writingMode: 'vertical-rl' }}>
            {fmt.c}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="grid items-center px-3 py-2 gap-2 cursor-pointer"
          style={{ gridTemplateColumns: '80px minmax(60px,0.35fr) 1fr auto' }}
          onClick={onToggleExpand}
        >
          {/* Time info */}
          <div className="font-mono text-[9px] text-muted leading-tight flex flex-wrap items-baseline gap-1.5">
            <span>{sitem.sched_start} – {sitem.sched_end}</span>
            <span className="text-[8px]">{sitem.duration_minutes}m</span>
            <span className={`text-[9px] font-mono font-bold px-1 py-0 rounded border text-[8px] ${fcDiff <= 0 ? 'bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.2)] text-teal-dk' : 'bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.18)] text-coral'}`}>
              {fcEnd}
            </span>
          </div>

          {/* Title */}
          <div className="font-extrabold text-navy text-[13px] truncate">
            {sitem.is_break ? '☕ ' : ''}{sitem.title}
          </div>

          {/* Objective */}
          <div className="text-[10px] text-muted truncate">
            {(sitem.objective || '').split('\n')[0]}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            {driftDisplay}

            {manualEntry ? (
              <ManualEntry
                tracking={tracking}
                onSave={onManualSave}
                onCancel={onManualCancel}
              />
            ) : (
              <>
                {isActive && (
                  <>
                    <TimerDisplay seconds={remainSecs} overtime={overtime} />
                    <button
                      onClick={onEnd}
                      className="px-3 py-1 rounded-full font-extrabold text-[9px] uppercase tracking-wider bg-coral text-white border border-coral animate-pulse"
                    >
                      End · {Math.floor(elapsed / 60)}m
                    </button>
                    <button onClick={() => onExtend(5)} className="px-2 py-1 rounded-full font-extrabold text-[8px] text-muted border border-bdr hover:border-teal hover:text-teal-dk transition-all">
                      +5m
                    </button>
                    <button onClick={onManualEdit} className="text-muted text-[11px] px-1 opacity-35 hover:opacity-100 hover:text-teal-dk transition-all">✎</button>
                  </>
                )}
                {!isActive && !isDone && (
                  <>
                    <button
                      onClick={onStart}
                      className="px-3 py-1 rounded-full font-extrabold text-[9px] uppercase tracking-wider bg-[rgba(43,188,200,0.1)] text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)] hover:bg-teal hover:text-white transition-all"
                    >
                      Start
                    </button>
                    <button onClick={onManualEdit} className="text-muted text-[11px] px-1 opacity-35 hover:opacity-100 hover:text-teal-dk transition-all">✎ manual</button>
                  </>
                )}
                {isDone && tracking?.startedAt && tracking?.endedAt && (
                  <>
                    <span className="text-[8px] font-extrabold px-2 py-0.5 rounded-full bg-[rgba(43,188,200,0.1)] text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)] cursor-default">
                      {m2t(tracking.startedAt.getHours() * 60 + tracking.startedAt.getMinutes())}–{m2t(tracking.endedAt.getHours() * 60 + tracking.endedAt.getMinutes())} ({Math.round((tracking.endedAt.getTime() - tracking.startedAt.getTime()) / 60000)}m)
                    </span>
                    <button onClick={onManualEdit} className="text-muted text-[11px] px-1 opacity-35 hover:opacity-100 hover:text-teal-dk transition-all">✎</button>
                  </>
                )}
                {isDone && !(tracking?.startedAt && tracking?.endedAt) && (
                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-srf-alt text-muted">
                    Skipped
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {expanded && (
          <div className="px-3 pb-3 border-t border-srf-alt">
            {sitem.approach && (
              <div className="text-[11px] text-slate mb-2 mt-2" style={{ paddingLeft: '80px' }}>
                <strong>Approach:</strong> {sitem.approach.split('\n').map((line, i) => (
                  <span key={i}>{i > 0 && <br />}{line}</span>
                ))}
              </div>
            )}
            <div className="mt-2" style={{ paddingLeft: '80px' }}>
              <label className="block text-[8px] font-extrabold uppercase tracking-widest text-muted mb-1">
                Session Notes
              </label>
              <textarea
                value={localNotes}
                onChange={e => setLocalNotes(e.target.value)}
                onBlur={() => onNotesChange(localNotes)}
                rows={2}
                placeholder="Add notes during this session…"
                className="w-full text-[11px] border-[1.5px] border-bdr rounded-sm px-2 py-1.5 bg-bg text-navy resize-none focus:border-teal transition-colors"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export default function LiveMeetingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => api.meetings.get(id!),
    refetchOnWindowFocus: false,
  });

  const [tracking, setTracking] = useState<Record<string, TrackState>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chimes, setChimes] = useState(true);
  const [locked, setLocked] = useState(false);
  const [fmtExpanded, setFmtExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const [firedChimes, setFiredChimes] = useState<Record<string, Set<number>>>({});
  const [localItemNotes, setLocalItemNotes] = useState<Record<string, string>>({});
  const [meetingStartedAt, setMeetingStartedAt] = useState<Date | null>(null);
  const [completedModal, setCompletedModal] = useState(false);
  const [manualEntryId, setManualEntryId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!meeting) return;
    if (meeting.status === 'COMPLETED') {
      navigate(`/meetings/${id}`);
      return;
    }
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
    if (meeting.actual_start_at) setMeetingStartedAt(new Date(meeting.actual_start_at));

    const ln: Record<string, string> = {};
    for (const item of meeting.items) {
      ln[item.id] = item.notes || '';
    }
    setLocalItemNotes(ln);
    setNotes(meeting.notes || '');
  }, [meeting?.id]);

  // Chime check
  useEffect(() => {
    if (!activeId || !chimes) return;
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
  }, [activeId, chimes, tracking, meeting?.items]);

  const handleStart = (itemId: string) => {
    if (locked) return;
    const now = new Date();
    if (!meetingStartedAt) {
      setMeetingStartedAt(now);
      updateMeetingMutation.mutate({ status: 'IN_PROGRESS', actual_start_at: now.toISOString() });
    }
    setTracking(prev => ({ ...prev, [itemId]: { startedAt: now, endedAt: null } }));
    setActiveId(itemId);
    updateItemMutation.mutate({ itemId, data: { status: 'in_progress', actual_start_at: now.toISOString() } });
  };

  const handleEnd = (itemId: string) => {
    const now = new Date();
    const tr = tracking[itemId];
    const dur = tr?.startedAt ? Math.round((now.getTime() - tr.startedAt.getTime()) / 60000) : 0;
    setTracking(prev => ({ ...prev, [itemId]: { ...prev[itemId], endedAt: now } }));
    setActiveId(null);
    updateItemMutation.mutate({ itemId, data: { status: 'done', actual_end_at: now.toISOString(), actual_duration_minutes: dur } });
  };

  const handleSkip = (itemId: string) => {
    if (locked) return;
    updateItemMutation.mutate({ itemId, data: { status: 'skipped' } });
    setTracking(prev => ({ ...prev, [itemId]: { startedAt: null, endedAt: null } }));
  };

  const handleExtend = () => { /* visual only */ };

  const handleNotesChange = (itemId: string, newNotes: string) => {
    setLocalItemNotes(prev => ({ ...prev, [itemId]: newNotes }));
    updateItemMutation.mutate({ itemId, data: { notes: newNotes } });
  };

  const handleManualSave = (itemId: string, startStr: string, endStr: string) => {
    if (!startStr) { setManualEntryId(null); return; }
    const sm = t2m(startStr);
    const today = new Date();
    today.setHours(Math.floor(sm / 60), sm % 60, 0, 0);
    const startDate = new Date(today);
    let endDate: Date | null = null;
    let dur: number | null = null;
    if (endStr) {
      const em = t2m(endStr);
      const endD = new Date(today);
      endD.setHours(Math.floor(em / 60), em % 60, 0, 0);
      endDate = endD;
      dur = Math.round((endD.getTime() - startDate.getTime()) / 60000);
    }
    setTracking(prev => ({ ...prev, [itemId]: { startedAt: startDate, endedAt: endDate } }));
    if (endDate) {
      if (activeId === itemId) setActiveId(null);
      updateItemMutation.mutate({ itemId, data: { status: 'done', actual_start_at: startDate.toISOString(), actual_end_at: endDate.toISOString(), actual_duration_minutes: dur } });
    } else {
      setActiveId(itemId);
      updateItemMutation.mutate({ itemId, data: { status: 'in_progress', actual_start_at: startDate.toISOString() } });
    }
    if (!meetingStartedAt) {
      setMeetingStartedAt(startDate);
      updateMeetingMutation.mutate({ status: 'IN_PROGRESS', actual_start_at: startDate.toISOString() });
    }
    setManualEntryId(null);
  };

  const handleResetTracking = () => {
    setTracking({});
    setActiveId(null);
    setManualEntryId(null);
    setFiredChimes({});
    setMeetingStartedAt(null);
    meeting?.items.forEach(item => {
      updateItemMutation.mutate({ itemId: item.id, data: { status: 'pending', actual_start_at: null, actual_end_at: null, actual_duration_minutes: null } });
    });
    updateMeetingMutation.mutate({ status: 'PLANNED', actual_start_at: null });
  };

  const handleCompleteMeeting = async () => {
    const now = new Date();
    await updateMeetingMutation.mutateAsync({
      status: 'COMPLETED',
      actual_end_at: now.toISOString(),
      notes: notes,
      items: meeting?.items.map(item => ({ ...item, notes: localItemNotes[item.id] ?? item.notes })),
    });
    navigate(`/meetings/${id}`);
  };

  if (isLoading) return <div className="py-20 text-center text-muted text-sm animate-pulse">Loading meeting…</div>;
  if (!meeting) return <div className="py-20 text-center text-muted text-sm">Meeting not found.</div>;

  const scheduled = calcSchedule(meeting.items, meeting.start_time);
  const doneCnt = meeting.items.filter(i => tracking[i.id]?.endedAt || i.status === 'skipped').length;
  const total = meeting.items.length;

  // Drift
  let drift = 0;
  scheduled.forEach(s => {
    const tr = tracking[s.id];
    if (tr?.startedAt && tr?.endedAt) {
      const actualDur = Math.round((tr.endedAt.getTime() - tr.startedAt.getTime()) / 60000);
      drift += s.duration_minutes - actualDur;
    }
  });

  // Projected starts
  const projectedStarts: Record<string, string> = {};
  let lastEndMin: number | null = null;
  let lastEndIdx = -1;
  for (let i = scheduled.length - 1; i >= 0; i--) {
    const tr = tracking[scheduled[i].id];
    if (tr?.endedAt) {
      lastEndIdx = i;
      lastEndMin = tr.endedAt.getHours() * 60 + tr.endedAt.getMinutes();
      break;
    }
  }
  if (lastEndMin !== null && lastEndIdx >= 0) {
    let cursor = lastEndMin;
    for (let i = lastEndIdx + 1; i < scheduled.length; i++) {
      projectedStarts[scheduled[i].id] = m2t(cursor);
      cursor += scheduled[i].duration_minutes;
    }
  }

  const lastItem = scheduled[scheduled.length - 1];
  let projFinish = lastItem?.sched_end ?? '';
  if (projectedStarts[lastItem?.id]) {
    projFinish = m2t(t2m(projectedStarts[lastItem.id]) + lastItem.duration_minutes);
  } else if (drift !== 0) {
    projFinish = m2t(t2m(lastItem.sched_end) - drift);
  }

  const hasStarted = meetingStartedAt !== null || meeting.status === 'IN_PROGRESS';
  const hasTracking = Object.keys(tracking).length > 0;

  return (
    <div className="animate-fade-in">
      {/* Sticky header */}
      <div className="sticky top-[52px] z-40 bg-srf border-[1.5px] border-bdr shadow-card-lg px-4 py-3 mb-3 rounded-b-card">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-black text-navy text-base leading-tight">
              {meeting.title.split(/(\d{4})/).map((part, i) => /^\d{4}$/.test(part) ? <em key={i} className="not-italic text-teal-dk">{part}</em> : part)}
            </h1>
            {meeting.subtitle && <div className="text-muted text-[10px]">{meeting.subtitle}</div>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasStarted && (
              <span className={`flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full border-[1.5px] ${drift >= 0 ? 'text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]' : 'text-coral bg-[rgba(239,68,68,0.08)] border-coral'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current inline-block animate-pulse" />
                {drift === 0 ? 'ON TIME' : drift > 0 ? `+${drift}m AHEAD` : `${Math.abs(drift)}m BEHIND`}
              </span>
            )}
            <button onClick={() => playChime(true)} className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-dk to-teal-br text-white flex items-center justify-center shadow-teal hover:scale-110 transition-all text-sm" title="Manual chime">🔔</button>
            <button onClick={() => setChimes(c => !c)} className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full border-[1.5px] transition-all ${chimes ? 'text-amber border-amber bg-[rgba(224,156,20,0.1)]' : 'text-muted border-bdr'}`}>
              {chimes ? '🔔 On' : '🔕 Off'}
            </button>
            <button onClick={() => setLocked(l => !l)} className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full border-[1.5px] transition-all ${locked ? 'text-coral border-coral' : 'text-muted border-bdr hover:border-teal hover:text-teal-dk'}`}>
              {locked ? '🔒 Locked' : '🔓 Lock'}
            </button>
            <Link to={`/meetings/${id}`} className="text-[9px] font-extrabold px-3 py-1 rounded-full border-[1.5px] border-bdr text-muted hover:border-teal hover:text-teal-dk transition-all">← Exit</Link>
          </div>
        </div>

        {hasStarted && (
          <div className="flex gap-6 mt-3 flex-wrap bg-srf border-[1.5px] border-bdr rounded-sm px-5 py-2.5 shadow-card">
            {[
              { label: 'Planned', value: lastItem?.sched_end ?? '—', cls: 'text-navy' },
              { label: 'Forecast', value: projFinish, cls: drift >= 0 ? 'text-teal-dk' : 'text-coral' },
              { label: 'Drift', value: drift === 0 ? '—' : `${drift > 0 ? '+' : ''}${drift}m`, cls: drift > 0 ? 'text-teal-dk' : drift < 0 ? 'text-coral' : 'text-amber' },
              { label: 'Progress', value: `${doneCnt}/${total}`, cls: 'text-navy' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="text-center">
                <div className="text-[8px] font-extrabold uppercase tracking-widest text-muted">{label}</div>
                <div className={`font-mono font-bold text-[17px] ${cls}`}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agenda items */}
      <div className="space-y-0.5 mb-4">
        {scheduled.map(sitem => {
          const tr = tracking[sitem.id] ?? null;
          const isActive = activeId === sitem.id;
          const isDone = Boolean(tr?.endedAt) || sitem.status === 'skipped';
          const projStart = projectedStarts[sitem.id] || null;

          let driftDisplay: React.ReactNode = null;
          if (isDone && tr?.startedAt && tr?.endedAt) {
            const fcEnd = (tr.startedAt.getHours() * 60 + tr.startedAt.getMinutes()) + sitem.duration_minutes;
            const actualEnd = tr.endedAt.getHours() * 60 + tr.endedAt.getMinutes();
            const di = fcEnd - actualEnd;
            driftDisplay = di > 0
              ? <span className="font-mono text-[10px] font-bold text-teal-dk">+{di}m</span>
              : di < 0 ? <span className="font-mono text-[10px] font-bold text-coral">{di}m</span>
              : <span className="font-mono text-[10px] font-bold text-amber">—</span>;
          } else if (projStart) {
            driftDisplay = <span className="font-mono text-[9px] text-muted">≈ {projStart}</span>;
          }

          return (
            <ItemRow
              key={sitem.id}
              sitem={{ ...sitem, notes: localItemNotes[sitem.id] ?? sitem.notes }}
              isActive={isActive}
              isDone={isDone}
              tracking={tr}
              expanded={expandedId === sitem.id}
              projectedStart={projStart}
              driftDisplay={driftDisplay}
              manualEntry={manualEntryId === sitem.id}
              fmtExpanded={fmtExpanded}
              onStart={() => handleStart(sitem.id)}
              onEnd={() => handleEnd(sitem.id)}
              onSkip={() => handleSkip(sitem.id)}
              onExtend={() => handleExtend()}
              onToggleExpand={() => setExpandedId(expandedId === sitem.id ? null : sitem.id)}
              onNotesChange={(n) => handleNotesChange(sitem.id, n)}
              onManualEdit={() => setManualEntryId(sitem.id)}
              onManualSave={(s, e) => handleManualSave(sitem.id, s, e)}
              onManualCancel={() => setManualEntryId(null)}
            />
          );
        })}
      </div>

      {/* Meeting notes */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-4 mb-4">
        <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-2">Meeting Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Overall meeting notes, decisions, action items…" rows={3}
          className="w-full text-[12px] border-[1.5px] border-bdr rounded-sm px-3 py-2 bg-bg text-navy resize-none focus:border-teal transition-colors" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <button onClick={() => setFmtExpanded(f => !f)} className="text-[9px] font-extrabold px-3 py-1.5 rounded-full border-[1.5px] border-bdr text-muted hover:border-teal hover:text-teal-dk transition-all">
          {fmtExpanded ? '◂ Collapse formats' : '▸ Expand formats'}
        </button>
        <div className="flex gap-2">
          {hasTracking && (
            <button onClick={() => confirm('Reset all tracking data?') && handleResetTracking()}
              className="px-4 py-2 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-coral border-[1.5px] border-coral hover:bg-[rgba(239,68,68,0.06)] transition-all">
              Reset Tracking
            </button>
          )}
          <button onClick={() => setCompletedModal(true)}
            className="px-5 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all">
            Complete Meeting
          </button>
        </div>
      </div>

      {/* Format legend */}
      <div className="flex flex-wrap gap-0 bg-srf border-[1.5px] border-bdr rounded-sm shadow-card overflow-hidden">
        {FORMATS.map(f => (
          <div key={f.c} className="flex items-center gap-1.5 text-[9px] font-bold text-slate px-2.5 py-2 border-r border-bdr last:border-r-0 flex-1 min-w-[120px]">
            <div className="w-[18px] h-1 rounded-full flex-shrink-0" style={{ background: f.cl }} />
            <strong>{f.c}</strong>
            <span className="text-muted hidden sm:inline">{f.l}</span>
          </div>
        ))}
      </div>

      {/* Complete modal */}
      {completedModal && (
        <div className="fixed inset-0 bg-[rgba(13,31,60,0.4)] backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="bg-srf border-[1.5px] border-bdr rounded-[20px] p-6 max-w-md w-[92%] shadow-card-lg relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-dk to-teal-br rounded-t-[20px]" />
            <h2 className="text-lg font-black text-navy mb-2">Complete Meeting?</h2>
            <p className="text-slate text-[12px] mb-4">This will mark the meeting as completed and save all tracking data.</p>
            <div className="mb-4">
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">Final Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add any final notes or decisions…"
                className="w-full text-[11px] border-[1.5px] border-bdr rounded-sm px-3 py-2 bg-bg text-navy resize-none focus:border-teal transition-colors" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCompletedModal(false)}
                className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-muted border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all">Cancel</button>
              <button onClick={handleCompleteMeeting}
                className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all">Complete & Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
