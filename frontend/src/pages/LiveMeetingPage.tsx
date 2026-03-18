import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import {
  calcSchedule, getFormat, FORMATS, m2t, t2m, nowMinutes,
  type MeetingItem, type ScheduledItem, type MeetingFormat,
} from '../types';
import { playChimeByType, getSelectedChime } from './SettingsPage';

// ─── Types ───────────────────────────────────────────────────────────────────
type ViewMode = 'summary' | 'detail' | 'track' | 'edit';

interface TrackState {
  sM: number;        // start in minutes-from-midnight
  eM: number | null;  // end in minutes-from-midnight (null = still running)
}

// ─── Audio ───────────────────────────────────────────────────────────────────
function playChime(loud = false) {
  playChimeByType(getSelectedChime(), loud);
}

// ─── Projection helpers (matching reference V5.1) ────────────────────────────
function getProjectedTimes(
  scheduled: ScheduledItem[],
  tracking: Record<string, TrackState>,
): Record<string, { pS: string; pE: string; dM: number }> {
  const proj: Record<string, { pS: string; pE: string; dM: number }> = {};
  let lastIdx = -1;
  let lastEnd: number | null = null;
  for (let i = scheduled.length - 1; i >= 0; i--) {
    const tr = tracking[scheduled[i].id];
    if (tr && tr.eM != null) { lastIdx = i; lastEnd = tr.eM; break; }
  }
  if (lastIdx === -1 || lastEnd === null) return proj;
  let cursor = lastEnd;
  for (let i = lastIdx + 1; i < scheduled.length; i++) {
    const s = scheduled[i];
    proj[s.id] = { pS: m2t(cursor), pE: m2t(cursor + s.duration_minutes), dM: cursor - s.sched_start_min };
    cursor += s.duration_minutes;
  }
  return proj;
}

function getForecastEnd(
  item: ScheduledItem,
  tracking: Record<string, TrackState>,
  proj: Record<string, { pS: string; pE: string; dM: number }>,
): string {
  const tr = tracking[item.id];
  if (tr && tr.sM != null) return m2t(tr.sM + item.duration_minutes);
  if (proj[item.id]) return m2t(t2m(proj[item.id].pS) + item.duration_minutes);
  return item.sched_end;
}

function calcDrift(scheduled: ScheduledItem[], tracking: Record<string, TrackState>): number {
  let drift = 0;
  scheduled.forEach(s => {
    const tr = tracking[s.id];
    if (tr && tr.eM != null) { drift += (tr.sM + s.duration_minutes) - tr.eM; }
  });
  return drift;
}

function projectedFinish(
  scheduled: ScheduledItem[],
  tracking: Record<string, TrackState>,
  proj: Record<string, { pS: string; pE: string; dM: number }>,
): string {
  const last = scheduled[scheduled.length - 1];
  if (!last) return '';
  if (proj[last.id]) return proj[last.id].pE;
  const tr = tracking[last.id];
  if (tr && tr.eM != null) return m2t(tr.eM);
  return last.sched_end;
}

// ─── Timer Display ───────────────────────────────────────────────────────────
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

// ─── Format Strip ────────────────────────────────────────────────────────────
function FmtStrip({ format, expanded }: { format: MeetingFormat; expanded: boolean }) {
  const fmt = getFormat(format);
  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center transition-all relative group ${expanded ? 'w-9' : 'w-2'}`}
      style={{ background: fmt.cl, borderRadius: '10px 0 0 10px' }}
    >
      {expanded && (
        <span className="text-white font-extrabold text-[7px] uppercase tracking-wider" style={{ writingMode: 'vertical-rl' }}>
          {fmt.c}
        </span>
      )}
      <div className="hidden group-hover:block absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 bg-navy text-white text-[10px] font-bold py-1 px-2.5 rounded-md whitespace-nowrap z-50 shadow-card-lg">
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-navy" />
        {fmt.c} — {fmt.l}
      </div>
    </div>
  );
}

// ─── FC Tag ──────────────────────────────────────────────────────────────────
function FcTag({ fc, schedEnd }: { fc: string; schedEnd: string }) {
  const ok = t2m(fc) <= t2m(schedEnd);
  return (
    <span className={`inline-block font-mono text-[9px] font-bold px-1 py-0 rounded border ${ok ? 'bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.2)] text-teal-dk' : 'bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.18)] text-coral'}`}>
      {fc}
    </span>
  );
}

// ─── Brand Import Modal ──────────────────────────────────────────────────────
function BrandModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  if (!open) return null;
  const apply = () => {
    const vars: Record<string, string> = {};
    ([[/teal[:\s]+([#][0-9a-fA-F]{3,8})/i, '--teal'],
      [/navy[:\s]+([#][0-9a-fA-F]{3,8})/i, '--navy'],
      [/accent[:\s]+([#][0-9a-fA-F]{3,8})/i, '--teal'],
      [/background[:\s]+([#][0-9a-fA-F]{3,8})/i, '--bg'],
      [/coral[:\s]+([#][0-9a-fA-F]{3,8})/i, '--coral'],
    ] as [RegExp, string][]).forEach(([re, vn]) => { const m = text.match(re); if (m) vars[vn] = m[1]; });
    ([[/(?:display|heading)[\s-]*font[:\s]+['"]?([^'",\n]+)/i, '--fn'],
      [/mono[\s-]*font[:\s]+['"]?([^'",\n]+)/i, '--fm'],
    ] as [RegExp, string][]).forEach(([re, vn]) => { const m = text.match(re); if (m) vars[vn] = `'${m[1].trim()}',sans-serif`; });
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-[rgba(13,31,60,0.4)] backdrop-blur-sm z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="bg-srf border-[1.5px] border-bdr rounded-[20px] p-6 max-w-[560px] w-[92%] shadow-card-lg relative" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-dk to-teal-br rounded-t-[20px]" />
        <h2 className="text-lg font-black text-navy mb-2">Import Brand Style</h2>
        <p className="text-slate text-[12px] leading-relaxed mb-2">Paste brand colours (hex), font names.</p>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Primary: #08B3C3, Navy: #0D1F3C..." className="w-full min-h-[150px] font-mono text-[11px] border-[1.5px] border-bdr rounded-sm p-2.5 bg-bg text-navy resize-y focus:border-teal transition-colors" />
        <div className="flex gap-2 mt-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-muted border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all">Cancel</button>
          <button onClick={apply} className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all">Apply</button>
        </div>
      </div>
    </div>
  );
}

// ─── Export helpers ───────────────────────────────────────────────────────────
function exportAgenda(meeting: any, scheduled: ScheduledItem[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Organisation', meeting.organisation || ''], ['Meeting Title', meeting.title],
    ['Subtitle', meeting.subtitle || ''], ['Date', meeting.date],
    ['Location', meeting.location || ''], ['Facilitator', meeting.facilitator || ''],
    ['Start Time', meeting.start_time],
  ]), 'Meeting metadata');
  const ad: any[][] = [['Start', 'Finish', 'Format', 'Topic', 'Objective', 'Illustration', 'Approach']];
  scheduled.forEach(c => ad.push([c.sched_start, c.sched_end, c.format, c.title, c.objective || '', c.illustration || '', c.approach || '']));
  const ws2 = XLSX.utils.aoa_to_sheet(ad);
  ws2['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 22 }, { wch: 35 }, { wch: 18 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Detailed agenda');
  const fd: string[][] = [['Format types']];
  FORMATS.forEach(f => fd.push([`${f.c} — ${f.l}`]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fd), 'List');
  XLSX.writeFile(wb, `${(meeting.title || 'Agenda').replace(/[^a-zA-Z0-9 ]/g, '')}_Agenda.xlsx`);
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Organisation', ''], ['Meeting Title', ''], ['Subtitle', ''], ['Date', ''],
    ['Location', ''], ['Facilitator', ''], ['Start Time', '09:00'],
  ]), 'Meeting metadata');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Start', 'Finish', 'Format', 'Topic', 'Objective', 'Illustration', 'Approach'],
    ['09:00', '09:30', 'FIP', 'Opening', '', '', ''],
    ['', '10:00', 'WND', 'Session 1', '', '', ''],
    ['', '10:15', 'BRK', 'Tea Break', '', '', ''],
  ]), 'Detailed agenda');
  const fd: string[][] = [['Format types']];
  FORMATS.forEach(f => fd.push([`${f.c} — ${f.l}`]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fd), 'List');
  XLSX.writeFile(wb, 'Agenda_Template.xlsx');
}

// ─── File import helpers ─────────────────────────────────────────────────────
function pxT(v: any): string | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    const m = v.match(/(\d{1,2}):(\d{2})/);
    if (m) return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
    const n = parseFloat(v);
    if (!isNaN(n) && n > 0 && n < 1) return m2t(Math.round(n * 1440));
    return null;
  }
  if (typeof v === 'number' && v >= 0 && v < 1) return m2t(Math.round(v * 1440));
  return null;
}

let _nextId = 1000;
function nextTempId() { return `imp-${_nextId++}`; }

function parseImportFile(file: File, startTime: string): Promise<{ items: MeetingItem[]; meta: Record<string, string> | null; newStartTime: string | null }> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv' || ext === 'tsv') {
      const r = new FileReader();
      r.onload = e => {
        const wb = XLSX.read(e.target!.result, { type: 'string' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
        resolve(processRows(rows as any[], null, startTime));
      };
      r.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const r = new FileReader();
      r.onload = e => {
        const wb = XLSX.read(e.target!.result, { type: 'array', raw: true });
        let ms: any = null, as: any = null;
        for (const n of wb.SheetNames) {
          const nl = n.toLowerCase();
          if (nl.includes('meta')) ms = wb.Sheets[n];
          if (nl.includes('agenda') || nl.includes('detail')) as = wb.Sheets[n];
        }
        if (!as && wb.SheetNames.length >= 2) { ms = wb.Sheets[wb.SheetNames[0]]; as = wb.Sheets[wb.SheetNames[1]]; }
        else if (!as) as = wb.Sheets[wb.SheetNames[0]];
        let meta: Record<string, string> | null = null;
        if (ms) {
          meta = {};
          (XLSX.utils.sheet_to_json(ms, { header: 1, defval: '', raw: true }) as any[]).forEach((row: any) => {
            if (!row[0]) return;
            const k = String(row[0]).toLowerCase().trim(), v = row[1];
            if (k.includes('organisation')) meta!.org = String(v || '');
            if (k.includes('title')) meta!.title = String(v || '');
            if (k.includes('subtitle')) meta!.subtitle = String(v || '');
            if (k.includes('date')) meta!.date = String(v || '');
            if (k.includes('location')) meta!.location = String(v || '');
            if (k.includes('facilitator')) meta!.facilitator = String(v || '');
            if (k.includes('start time')) meta!.startTime = pxT(v) || '';
          });
        }
        const rows = XLSX.utils.sheet_to_json(as, { defval: '', raw: true });
        resolve(processRows(rows as any[], meta, startTime));
      };
      r.readAsArrayBuffer(file);
    } else {
      reject(new Error('Unsupported file type'));
    }
  });
}

function processRows(rows: Record<string, any>[], meta: Record<string, string> | null, startTime: string): { items: MeetingItem[]; meta: Record<string, string> | null; newStartTime: string | null } {
  if (!rows.length) return { items: [], meta, newStartTime: null };
  const keys = Object.keys(rows[0]);
  const fc = (h: string[]) => keys.find(k => h.some(x => k.toLowerCase().includes(x))) || null;
  const cT = fc(['topic', 'title', 'session']), cO = fc(['obj', 'objective', 'description']);
  const cI = fc(['illus', 'illustration', 'visual']), cA = fc(['approach', 'method', 'notes']);
  const cS = fc(['start']), cE = fc(['end', 'finish']), cF = fc(['format', 'fmt', 'type']);
  const ns: MeetingItem[] = [];
  let pe: string | null = null;
  let newStart: string | null = null;
  rows.forEach(r => {
    const tr = cT ? r[cT] : null;
    if (!tr) return;
    const title = String(tr).trim();
    if (!title) return;
    let st = cS ? pxT(r[cS]) : null;
    const et = cE ? pxT(r[cE]) : null;
    if (!st && pe) st = pe;
    if (!st && meta?.startTime) st = meta.startTime;
    let dur = 30;
    if (st && et) { dur = t2m(et) - t2m(st); if (dur <= 0) dur = 30; }
    pe = et || m2t(t2m(st || startTime) + dur);
    if (!ns.length && st) newStart = st;
    const isB = /break|lunch|tea|coffee|pause/i.test(title);
    const fmtRaw = cF ? String(r[cF] || '').trim().toUpperCase() : '';
    const fmtValid = FORMATS.find(f => f.c === fmtRaw);
    const fmt = fmtValid ? fmtRaw : (isB ? 'BRK' : 'O');
    ns.push({
      id: nextTempId(), meeting_id: '', position: ns.length, title, duration_minutes: dur,
      format: fmt as MeetingFormat, objective: String(cO ? r[cO] || '' : '').trim().replace(/\\n/g, '\n'),
      illustration: String(cI ? r[cI] || '' : '').trim(), approach: String(cA ? r[cA] || '' : '').trim().replace(/\\n/g, '\n'),
      is_break: isB || fmt === 'BRK', notes: '', status: 'pending',
      actual_start_at: null, actual_end_at: null, actual_duration_minutes: null, created_at: '', updated_at: '',
    });
  });
  return { items: ns, meta, newStartTime: newStart };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ MAIN PAGE ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
export default function LiveMeetingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => api.meetings.get(id!),
    refetchOnWindowFocus: false,
  });

  // ── State ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<ViewMode>('summary');
  const [locked, setLocked] = useState(false);
  const [tracking, setTracking] = useState<Record<string, TrackState>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chimesOn, setChimesOn] = useState(true);
  const [chimeAlerts, setChimeAlerts] = useState([10, 5, 1, 0]);
  const [firedChimes, setFiredChimes] = useState<Record<string, Set<number>>>({});
  const [fmtExpanded, setFmtExpanded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [trkExpandedId, setTrkExpandedId] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState<string | null>(null);
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [localItemNotes, setLocalItemNotes] = useState<Record<string, string>>({});
  const [meetingStartedAt, setMeetingStartedAt] = useState<Date | null>(null);
  const [completedModal, setCompletedModal] = useState(false);
  const [brandModal, setBrandModal] = useState(false);
  // Edit state
  const [editItems, setEditItems] = useState<MeetingItem[]>([]);
  const [editMeta, setEditMeta] = useState({ organisation: '', title: '', subtitle: '', date: '', location: '', facilitator: '', start_time: '09:00' });
  // Tick for live updates
  const [, setTick] = useState(0);

  const updateMeetingMutation = useMutation({
    mutationFn: (data: any) => api.meetings.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting', id] });
      qc.invalidateQueries({ queryKey: ['meetings-upcoming'] });
      qc.invalidateQueries({ queryKey: ['meetings-archive'] });
    },
  });
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) => api.meetings.updateItem(id!, itemId, data),
  });

  // ── Init from DB ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!meeting) return;
    const t: Record<string, TrackState> = {};
    let activeFound: string | null = null;
    for (const item of meeting.items) {
      if (item.actual_start_at) {
        const sd = new Date(item.actual_start_at);
        const sM = sd.getHours() * 60 + sd.getMinutes();
        let eM: number | null = null;
        if (item.actual_end_at) { const ed = new Date(item.actual_end_at); eM = ed.getHours() * 60 + ed.getMinutes(); }
        t[item.id] = { sM, eM };
        if (item.status === 'in_progress') activeFound = item.id;
      }
    }
    setTracking(t);
    if (activeFound) setActiveId(activeFound);
    if (meeting.actual_start_at) setMeetingStartedAt(new Date(meeting.actual_start_at));
    const ln: Record<string, string> = {};
    for (const item of meeting.items) ln[item.id] = item.notes || '';
    setLocalItemNotes(ln);
    setNotes(meeting.notes || '');
    setEditItems(meeting.items.map(i => ({ ...i })));
    setEditMeta({
      organisation: meeting.organisation || '', title: meeting.title,
      subtitle: meeting.subtitle || '', date: meeting.date,
      location: meeting.location || '', facilitator: meeting.facilitator || '',
      start_time: meeting.start_time,
    });
  }, [meeting?.id]);

  // ── Chime check ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeId || !chimesOn) return;
    const check = () => {
      const tr = tracking[activeId];
      if (!tr) return;
      const dur = meeting?.items.find(i => i.id === activeId)?.duration_minutes || 0;
      const fcEnd = tr.sM + dur;
      const rem = fcEnd - nowMinutes();
      setFiredChimes(prev => {
        const cur = new Set(prev[activeId] || []);
        let shouldPlay = false, loud = false;
        for (const a of chimeAlerts) {
          if (rem <= a && !cur.has(a)) { cur.add(a); shouldPlay = true; if (a === 0) loud = true; }
        }
        if (shouldPlay) playChime(loud);
        return { ...prev, [activeId]: cur };
      });
    };
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [activeId, chimesOn, tracking, meeting?.items, chimeAlerts]);

  // ── Tick for live UI updates ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeId) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeId]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStart = (itemId: string) => {
    const now = new Date();
    const sM = nowMinutes();
    if (!meetingStartedAt) {
      setMeetingStartedAt(now);
      updateMeetingMutation.mutate({ status: 'IN_PROGRESS', actual_start_at: now.toISOString() });
    }
    setTracking(prev => ({ ...prev, [itemId]: { sM, eM: null } }));
    setActiveId(itemId);
    updateItemMutation.mutate({ itemId, data: { status: 'in_progress', actual_start_at: now.toISOString() } });
  };

  const handleEnd = (itemId: string) => {
    const now = new Date();
    const eM = nowMinutes();
    const tr = tracking[itemId];
    const dur = tr ? eM - tr.sM : 0;
    setTracking(prev => ({ ...prev, [itemId]: { ...prev[itemId], eM } }));
    setActiveId(null);
    updateItemMutation.mutate({ itemId, data: { status: 'done', actual_end_at: now.toISOString(), actual_duration_minutes: dur } });
  };

  const handleManualSave = (itemId: string) => {
    if (manualStart) {
      const sM = t2m(manualStart);
      const eM = manualEnd ? t2m(manualEnd) : null;
      setTracking(prev => ({ ...prev, [itemId]: { sM, eM } }));
      if (eM != null && activeId === itemId) setActiveId(null);
      if (eM == null) setActiveId(itemId);
      const startDate = new Date(); startDate.setHours(Math.floor(sM / 60), sM % 60, 0, 0);
      const data: any = { status: eM != null ? 'done' : 'in_progress', actual_start_at: startDate.toISOString() };
      if (eM != null) {
        const endDate = new Date(); endDate.setHours(Math.floor(eM / 60), eM % 60, 0, 0);
        data.actual_end_at = endDate.toISOString();
        data.actual_duration_minutes = eM - sM;
      }
      updateItemMutation.mutate({ itemId, data });
    }
    setManualEntry(null); setManualStart(''); setManualEnd('');
  };

  const handleResetTracking = () => {
    setTracking({}); setActiveId(null); setManualEntry(null); setFiredChimes({});
  };

  const handleCompleteMeeting = async () => {
    const now = new Date();
    await updateMeetingMutation.mutateAsync({
      status: 'COMPLETED', actual_end_at: now.toISOString(), notes,
      items: meeting?.items.map(item => ({ ...item, notes: localItemNotes[item.id] ?? item.notes })),
    });
    navigate(`/meetings/${id}`);
  };

  const handleNotesChange = (itemId: string, newNotes: string) => {
    setLocalItemNotes(prev => ({ ...prev, [itemId]: newNotes }));
    updateItemMutation.mutate({ itemId, data: { notes: newNotes } });
  };

  // Edit handlers
  const handleEditSave = async () => {
    await updateMeetingMutation.mutateAsync({
      organisation: editMeta.organisation, title: editMeta.title, subtitle: editMeta.subtitle,
      date: editMeta.date, location: editMeta.location, facilitator: editMeta.facilitator,
      start_time: editMeta.start_time,
      items: editItems.map((item, idx) => ({
        title: item.title, duration_minutes: item.duration_minutes, format: item.format,
        objective: item.objective, illustration: item.illustration, approach: item.approach,
        is_break: item.is_break, notes: item.notes, position: idx,
        status: item.status || 'pending', actual_start_at: item.actual_start_at,
        actual_end_at: item.actual_end_at, actual_duration_minutes: item.actual_duration_minutes,
      })),
    });
    setMode('summary');
  };

  const handleEditFieldChange = (itemId: string, field: string, value: any) => {
    setEditItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const u = { ...i, [field]: value };
      if (field === 'format') u.is_break = value === 'BRK';
      return u;
    }));
  };

  const handleAddSession = (afterId?: string) => {
    const n: MeetingItem = {
      id: nextTempId(), meeting_id: '', position: 0, title: 'New Session',
      duration_minutes: 20, format: 'O', objective: '', illustration: '', approach: '',
      is_break: false, notes: '', status: 'pending',
      actual_start_at: null, actual_end_at: null, actual_duration_minutes: null,
      created_at: '', updated_at: '',
    };
    if (!afterId) setEditItems(prev => [...prev, n]);
    else {
      const idx = editItems.findIndex(i => i.id === afterId);
      const next = [...editItems]; next.splice(idx + 1, 0, n); setEditItems(next);
    }
  };

  const handleDeleteSession = (itemId: string) => setEditItems(prev => prev.filter(i => i.id !== itemId));

  const handleToggleBreak = (itemId: string) => {
    setEditItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const isB = !i.is_break;
      return { ...i, is_break: isB, format: (isB ? 'BRK' : (i.format === 'BRK' ? 'O' : i.format)) as MeetingFormat };
    }));
  };

  const handleEditDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const next = [...editItems];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setEditItems(next);
  };

  const handleFileImport = async (file: File) => {
    try {
      const result = await parseImportFile(file, editMeta.start_time);
      if (result.items.length > 0) setEditItems(result.items);
      if (result.meta) {
        setEditMeta(prev => ({
          ...prev,
          ...(result.meta!.org ? { organisation: result.meta!.org } : {}),
          ...(result.meta!.title ? { title: result.meta!.title } : {}),
          ...(result.meta!.subtitle ? { subtitle: result.meta!.subtitle } : {}),
          ...(result.meta!.date ? { date: result.meta!.date } : {}),
          ...(result.meta!.location ? { location: result.meta!.location } : {}),
          ...(result.meta!.facilitator ? { facilitator: result.meta!.facilitator } : {}),
          ...(result.meta!.startTime ? { start_time: result.meta!.startTime } : {}),
        }));
      }
      if (result.newStartTime) setEditMeta(prev => ({ ...prev, start_time: result.newStartTime! }));
    } catch { /* ignore */ }
  };

  // ── Loading / Not Found ────────────────────────────────────────────────────
  if (isLoading) return <div className="py-20 text-center text-muted text-sm animate-pulse">Loading meeting...</div>;
  if (!meeting) return <div className="py-20 text-center text-muted text-sm">Meeting not found.</div>;

  // ── Computed ───────────────────────────────────────────────────────────────
  const scheduled = calcSchedule(meeting.items, meeting.start_time);
  const hasTracking = Object.keys(tracking).length > 0;
  const proj = getProjectedTimes(scheduled, tracking);
  const drift = calcDrift(scheduled, tracking);
  const pFinish = projectedFinish(scheduled, tracking, proj);
  const firstItem = scheduled[0];
  const lastItem = scheduled[scheduled.length - 1];
  const totalMinutes = lastItem && firstItem ? t2m(lastItem.sched_end) - t2m(firstItem.sched_start) : 0;
  const sessionCount = scheduled.filter(s => !s.is_break).length;

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fade-in">
      {/* ═══ NAV BAR ═══ */}
      <div className="sticky top-[52px] z-40 bg-srf border-[1.5px] border-bdr shadow-card px-4 py-2 mb-3 rounded-b-card flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-black text-navy text-sm truncate max-w-[200px]">{meeting.title}</span>
          <div className="w-px h-5 bg-bdr" />
        </div>
        <div className="flex gap-0.5">
          {!locked && (
            <button onClick={() => setMode('edit')} className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border-[1.5px] transition-all ${mode === 'edit' ? 'text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]' : 'text-muted border-transparent hover:text-slate hover:bg-srf-alt'}`}>Create / Edit</button>
          )}
          {(['summary', 'detail', 'track'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setMode(v)} className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border-[1.5px] transition-all ${mode === v ? 'text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]' : 'text-muted border-transparent hover:text-slate hover:bg-srf-alt'}`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {mode === 'track' && hasTracking && (
            <span className={`flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full border-[1.5px] ${drift >= 0 ? 'text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]' : 'text-coral bg-[rgba(239,68,68,0.08)] border-coral'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current inline-block animate-pulse" />
              {drift === 0 ? 'ON TIME' : drift > 0 ? `+${drift}m ahead` : `${Math.abs(drift)}m behind`}
            </span>
          )}
          <button onClick={() => playChime(true)} className="w-7 h-7 rounded-full bg-gradient-to-r from-teal-dk to-teal-br text-white flex items-center justify-center shadow-teal hover:scale-110 transition-all text-sm" title="Manual chime">🔔</button>
          <button onClick={() => setChimesOn(c => !c)} className={`text-[9px] font-extrabold px-2 py-1 rounded-full border-[1.5px] transition-all ${chimesOn ? 'text-amber border-amber' : 'text-muted border-bdr'}`}>{chimesOn ? '🔔 On' : '🔕 Off'}</button>
          <button onClick={() => { setLocked(l => { const next = !l; if (next && mode === 'edit') setMode('summary'); return next; }); }} className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full border-[1.5px] transition-all ${locked ? 'text-coral border-coral' : 'text-muted border-bdr hover:border-teal hover:text-teal-dk'}`}>{locked ? '🔒 Locked' : '🔓 Lock'}</button>
          <Link to={`/meetings/${id}`} className="text-[9px] font-extrabold px-2.5 py-1 rounded-full border-[1.5px] border-bdr text-muted hover:border-teal hover:text-teal-dk transition-all">← Exit</Link>
        </div>
      </div>

      {/* ═══ HEADER ═══ */}
      <div className={`bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5 mb-3 relative overflow-hidden card-accent ${mode === 'track' ? 'sticky top-[100px] z-30' : ''}`}>
        <h1 className="text-xl font-black text-navy tracking-tight">{meeting.title}</h1>
        {meeting.subtitle && <div className="text-slate text-[12px] font-semibold mt-0.5">{meeting.subtitle}</div>}
        <div className="flex gap-3 mt-2 flex-wrap text-[10px] text-muted font-bold">
          <span className="text-slate font-bold">{meeting.date}</span>
          {meeting.location && <span>{meeting.location}</span>}
          {firstItem && <span>{firstItem.sched_start} – {lastItem?.sched_end}</span>}
          {hasTracking && (
            <span className={`font-mono font-bold px-1.5 py-0 rounded border text-[10px] ${drift >= 0 ? 'bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.2)] text-teal-dk' : 'bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.2)] text-coral'}`}>
              {drift >= 0 ? '✓' : '⚠'} FC {pFinish}
            </span>
          )}
          <span className="font-bold text-slate">{Math.floor(totalMinutes / 60)}h{totalMinutes % 60 ? ` ${totalMinutes % 60}m` : ''}</span>
          <span>{sessionCount} sessions</span>
          {meeting.facilitator && <span>Facilitator: <strong className="text-slate">{meeting.facilitator}</strong></span>}
        </div>
      </div>

      {/* ═══ VIEW BODY ═══ */}
      {mode === 'summary' && <SummaryView scheduled={scheduled} tracking={tracking} proj={proj} hasTracking={hasTracking} expandedId={expandedId} setExpandedId={setExpandedId} fmtExpanded={fmtExpanded} />}
      {mode === 'detail' && <DetailView scheduled={scheduled} tracking={tracking} proj={proj} hasTracking={hasTracking} />}
      {mode === 'track' && renderTrack()}
      {mode === 'edit' && renderEdit()}

      {/* ═══ FORMAT LEGEND ═══ */}
      <div className="flex flex-wrap gap-0 bg-srf border-[1.5px] border-bdr rounded-sm shadow-card overflow-hidden mt-4 mb-4">
        {FORMATS.map(f => (
          <div key={f.c} className="flex items-center gap-1.5 text-[10px] font-bold text-slate px-3 py-2.5 border-r border-bdr last:border-r-0 flex-1 min-w-[140px]">
            <div className="w-[18px] h-1 rounded-full flex-shrink-0" style={{ background: f.cl }} />
            <strong>{f.c}</strong> {f.l}
          </div>
        ))}
      </div>

      {/* Format toggle */}
      <button onClick={() => setFmtExpanded(f => !f)} className="fixed bottom-4 left-4 z-[90] bg-srf border-[1.5px] border-bdr rounded-full px-3 py-1 text-[9px] font-extrabold text-muted shadow-card hover:border-teal hover:text-teal-dk transition-all uppercase tracking-wider">
        {fmtExpanded ? '◂ Collapse formats' : '▸ Expand formats'}
      </button>

      <BrandModal open={brandModal} onClose={() => setBrandModal(false)} />

      {/* Complete modal */}
      {completedModal && (
        <div className="fixed inset-0 bg-[rgba(13,31,60,0.4)] backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="bg-srf border-[1.5px] border-bdr rounded-[20px] p-6 max-w-md w-[92%] shadow-card-lg relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-dk to-teal-br rounded-t-[20px]" />
            <h2 className="text-lg font-black text-navy mb-2">Complete Meeting?</h2>
            <p className="text-slate text-[12px] mb-4">This will mark the meeting as completed and save all tracking data.</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Final notes..." className="w-full text-[11px] border-[1.5px] border-bdr rounded-sm px-3 py-2 bg-bg text-navy resize-none focus:border-teal transition-colors mb-3" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCompletedModal(false)} className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-muted border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all">Cancel</button>
              <button onClick={handleCompleteMeeting} className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all">Complete & Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ TRACK VIEW ═══════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  function renderTrack() {
    const doneCnt = scheduled.filter(c => tracking[c.id]?.eM != null).length;
    return (
      <>
        {hasTracking && (
          <div className="bg-srf rounded-sm px-5 py-3 mb-3 border-[1.5px] border-bdr shadow-card flex items-center justify-between flex-wrap gap-2 sticky top-[140px] z-[29]">
            {[
              { label: 'Planned', value: lastItem?.sched_end ?? '—', cls: 'text-navy' },
              { label: 'Forecast', value: pFinish, cls: drift >= 0 ? 'text-teal-dk' : 'text-coral' },
              { label: 'Drift', value: drift === 0 ? '—' : `${drift > 0 ? '+' : ''}${drift}m`, cls: drift > 0 ? 'text-teal-dk' : drift < 0 ? 'text-coral' : 'text-amber' },
              { label: 'Progress', value: `${doneCnt}/${scheduled.length}`, cls: 'text-navy' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="text-center">
                <div className="text-[8px] font-extrabold uppercase tracking-widest text-muted">{label}</div>
                <div className={`font-mono font-bold text-[17px] mt-0.5 ${cls}`}>{value}</div>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-1">
          {scheduled.map(c => {
            const tr = tracking[c.id];
            const done = tr && tr.eM != null;
            const act = activeId === c.id;
            const pr = proj[c.id];
            const fc = getForecastEnd(c, tracking, proj);
            const exp = trkExpandedId === c.id;
            const isManual = manualEntry === c.id;

            let cls = '';
            if (c.is_break) cls = 'opacity-45';
            else if (act) cls = 'border-teal shadow-[0_0_0_2px_rgba(43,188,200,0.15)]';
            else if (done) cls = 'opacity-40';

            let driftEl: React.ReactNode = null;
            if (done && tr) {
              const di = (tr.sM + c.duration_minutes) - tr.eM!;
              driftEl = di > 0 ? <span className="text-teal-dk font-mono text-[10px] font-bold">+{di}m</span>
                : di < 0 ? <span className="text-coral font-mono text-[10px] font-bold">{di}m</span>
                : <span className="text-amber font-mono text-[10px] font-bold">—</span>;
            } else if (pr) {
              driftEl = <span className="font-mono text-[9px] text-muted">≈ {pr.pS}</span>;
            }

            let controls: React.ReactNode = null;
            if (isManual) {
              controls = (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <input className="font-mono text-[10px] w-[44px] text-center border-[1.5px] border-bdr rounded-md px-0.5 py-0.5 bg-srf-alt text-navy focus:border-teal" placeholder="HH:MM" value={manualStart} onChange={e => setManualStart(e.target.value)} />
                  <input className="font-mono text-[10px] w-[44px] text-center border-[1.5px] border-bdr rounded-md px-0.5 py-0.5 bg-srf-alt text-navy focus:border-teal" placeholder="HH:MM" value={manualEnd} onChange={e => setManualEnd(e.target.value)} />
                  <button onClick={() => handleManualSave(c.id)} className="px-2 py-0.5 rounded-full font-extrabold text-[8px] bg-[rgba(43,188,200,0.1)] text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)]">✓</button>
                </div>
              );
            } else if (done && tr) {
              const actual = tr.eM! - tr.sM;
              controls = (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[rgba(43,188,200,0.08)] text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)]">{m2t(tr.sM)}–{m2t(tr.eM!)} ({actual}m)</span>
                  <button onClick={() => { setManualEntry(c.id); setManualStart(m2t(tr.sM)); setManualEnd(m2t(tr.eM!)); }} className="text-muted text-[11px] px-0.5 opacity-35 hover:opacity-100 hover:text-teal-dk transition-all">✎</button>
                </div>
              );
            } else if (act && tr) {
              const el = nowMinutes() - tr.sM;
              const remainSecs = (c.duration_minutes - el) * 60;
              controls = (
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <TimerDisplay seconds={remainSecs} overtime={remainSecs < 0} />
                  <button onClick={() => handleEnd(c.id)} className="px-3 py-1 rounded-full font-extrabold text-[9px] uppercase tracking-wider bg-coral text-white border border-coral animate-pulse">End · {el}m</button>
                  <button onClick={() => { setManualEntry(c.id); setManualStart(m2t(tr.sM)); setManualEnd(''); }} className="text-muted text-[11px] px-0.5 opacity-35 hover:opacity-100 hover:text-teal-dk transition-all">✎</button>
                </div>
              );
            } else if (!activeId) {
              controls = (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleStart(c.id)} className="px-3 py-1 rounded-full font-extrabold text-[9px] uppercase tracking-wider bg-[rgba(43,188,200,0.1)] text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)] hover:bg-teal hover:text-white transition-all">Start</button>
                  <button onClick={() => { setManualEntry(c.id); setManualStart(''); setManualEnd(''); }} className="text-muted text-[11px] px-0.5 opacity-35 hover:opacity-100 hover:text-teal-dk transition-all">✎ manual</button>
                </div>
              );
            } else {
              controls = (
                <div onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setManualEntry(c.id); setManualStart(''); setManualEnd(''); }} className="text-muted text-[11px] px-0.5 opacity-35 hover:opacity-100 hover:text-teal-dk transition-all">✎ manual</button>
                </div>
              );
            }

            return (
              <div key={c.id} className="flex overflow-hidden" style={{ marginBottom: '4px' }}>
                <FmtStrip format={c.format} expanded={fmtExpanded} />
                <div className={`flex-1 min-w-0 bg-srf border-[1.5px] border-bdr border-l-0 rounded-r-sm shadow-card transition-all ${cls}`}>
                  <div className="grid items-center px-3 py-2 gap-2.5 cursor-pointer" style={{ gridTemplateColumns: '80px minmax(60px,0.35fr) 1fr auto' }} onClick={() => setTrkExpandedId(exp ? null : c.id)}>
                    <div className="font-mono text-[10px] text-muted leading-tight flex items-baseline gap-1.5 flex-wrap">
                      <span>{c.sched_start} – {c.sched_end}</span>
                      <span className="text-[9px]">{c.duration_minutes}m</span>
                      <FcTag fc={fc} schedEnd={c.sched_end} />
                    </div>
                    <div className="text-[13px] font-extrabold text-navy truncate">{c.is_break ? '☕ ' : ''}{c.title}</div>
                    <div className="text-[12px] text-slate truncate">{(c.objective || '').split('\n')[0]}</div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">{driftEl}{controls}</div>
                  </div>
                  {c.approach && exp && (
                    <div className="px-3 pb-2 border-t border-bdr">
                      <div className="pt-2 text-[11px] text-slate leading-relaxed pl-[90px]">
                        <strong>Approach:</strong> {c.approach.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-4 mt-3">
          <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-2">Meeting Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Overall meeting notes, decisions, action items..." rows={3} className="w-full text-[12px] border-[1.5px] border-bdr rounded-sm px-3 py-2 bg-bg text-navy resize-none focus:border-teal transition-colors" />
        </div>
        <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
          <button onClick={handleResetTracking} className="px-4 py-2 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-coral border-[1.5px] border-coral hover:bg-[rgba(239,68,68,0.06)] transition-all">Reset Tracking</button>
          <button onClick={() => setCompletedModal(true)} className="px-5 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all">Complete Meeting</button>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ EDIT VIEW ════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  function renderEdit() {
    if (locked) { setMode('summary'); return null; }
    const editSched = calcSchedule(editItems, editMeta.start_time);
    return (
      <div className="space-y-4">
        <div className="flex gap-2.5 items-stretch">
          <div className="flex-1 border-[1.5px] border-dashed border-bdr rounded-card p-5 text-center transition-all hover:border-teal hover:bg-[var(--teal-glow)] cursor-pointer relative" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileImport(f); }}>
            <div className="text-[22px] opacity-30 mb-1">📋</div>
            <div className="text-[12px] font-extrabold text-slate">Import Agenda</div>
            <div className="text-[10px] text-muted mt-0.5">Drag & drop Excel/CSV</div>
            <input type="file" accept=".csv,.xlsx,.xls,.tsv" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileImport(f); e.target.value = ''; }} />
          </div>
          <div className="flex flex-col justify-center items-center gap-1.5 px-4 py-3 bg-srf border-[1.5px] border-bdr rounded-card min-w-[120px]">
            <div className="text-[18px] opacity-30">📥</div>
            <button onClick={downloadTemplate} className="px-2.5 py-1 rounded-full font-extrabold text-[9px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal">Template</button>
          </div>
        </div>

        <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-4">
          <div className="text-[13px] font-black text-navy mb-2.5">Meeting Details</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {([['organisation', 'Organisation'], ['title', 'Meeting Title'], ['subtitle', 'Subtitle'], ['date', 'Date'], ['location', 'Location'], ['facilitator', 'Facilitator']] as const).map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold uppercase tracking-widest text-muted">{label}</label>
                <input value={editMeta[key]} onChange={e => setEditMeta(prev => ({ ...prev, [key]: e.target.value }))} className="border-[1.5px] border-bdr rounded-sm px-2.5 py-1.5 text-[13px] bg-srf text-navy focus:border-teal transition-colors" />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-extrabold uppercase tracking-widest text-muted">Start Time</label>
              <input value={editMeta.start_time} onChange={e => setEditMeta(prev => ({ ...prev, start_time: e.target.value }))} className="border-[1.5px] border-bdr rounded-sm px-2.5 py-1.5 text-[13px] font-mono bg-srf text-navy focus:border-teal transition-colors w-[70px]" />
            </div>
          </div>
        </div>

        <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-4">
          <h3 className="text-[13px] font-black text-navy mb-2.5">⚙ Settings</h3>
          <div className="flex items-center gap-2.5 mb-2 text-[12px]">
            <label className="font-bold text-slate min-w-[90px]">Chimes</label>
            <button onClick={() => setChimesOn(c => !c)} className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full border-[1.5px] transition-all cursor-pointer ${chimesOn ? 'text-amber border-amber' : 'text-muted border-bdr'}`}>{chimesOn ? '🔔 On' : '🔕 Off'}</button>
          </div>
          <div className="flex items-center gap-2.5 mb-2 text-[12px]">
            <label className="font-bold text-slate min-w-[90px]">Alert timers</label>
            {chimeAlerts.map((a, i) => (
              <input key={i} className="w-10 font-mono text-[12px] text-center border-[1.5px] border-bdr rounded-md px-1 py-0.5 focus:border-teal" value={a} onChange={e => { const n = [...chimeAlerts]; n[i] = Math.max(0, parseInt(e.target.value) || 0); n.sort((a, b) => b - a); setChimeAlerts(n); }} />
            ))}
            <span className="text-[10px] text-muted">min before FC End</span>
          </div>
          <div className="text-[11px] text-muted leading-relaxed mt-2 px-3 py-2 bg-srf-alt rounded-sm border-l-[3px] border-teal">
            <strong>Chime rules:</strong> When a session is active and chimes are ON, a zen meditation chime plays at each configured number of minutes before the Forecast End time (= actual start + planned duration). Soft chimes play at warning intervals; a louder chime plays at 0 min (session end).
          </div>
          <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-bdr text-[12px]">
            <label className="font-bold text-slate min-w-[90px]">Brand</label>
            <button onClick={() => setBrandModal(true)} className="px-3.5 py-1 rounded-full font-extrabold text-[9px] uppercase tracking-wider text-muted border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all">Import Brand Style</button>
          </div>
          <div className="flex items-center gap-2.5 mt-2 text-[12px]">
            <label className="font-bold text-slate min-w-[90px]">Export</label>
            <button onClick={() => exportAgenda(meeting, scheduled)} className="px-3.5 py-1 rounded-full font-extrabold text-[9px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal">↓ Export Agenda (.xlsx)</button>
          </div>
        </div>

        <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card overflow-hidden">
          <DragDropContext onDragEnd={handleEditDragEnd}>
            <Droppable droppableId="edit-sessions">
              {(provided) => (
                <table className="w-full border-collapse text-[12px]" ref={provided.innerRef} {...provided.droppableProps}>
                  <thead>
                    <tr className="bg-srf-alt">
                      {['', 'Start', 'Dur', 'End', 'Format', 'Title', 'Objective', 'Theme', 'Approach', ''].map((h, i) => (
                        <th key={i} className={`text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-1 py-2 border-b-[1.5px] border-bdr ${i === 0 ? 'w-[20px]' : i === 1 || i === 3 ? 'w-[38px]' : i === 2 ? 'w-[30px]' : i === 4 ? 'w-[56px]' : i === 9 ? 'w-[60px]' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {editSched.map((c, idx) => (
                      <Draggable key={c.id} draggableId={c.id} index={idx}>
                        {(drag, snapshot) => (
                          <tr ref={drag.innerRef} {...drag.draggableProps} className={`border-b border-srf-alt ${snapshot.isDragging ? 'opacity-30' : ''}`}>
                            <td className="px-1 py-0.5"><span {...drag.dragHandleProps} className="cursor-grab text-muted text-[12px] select-none">⠿</span></td>
                            <td className="font-mono text-[9px] text-muted px-1 py-0.5">{c.sched_start}</td>
                            <td className="px-1 py-0.5"><input className="w-[34px] text-center font-mono font-bold text-[11px] text-teal-dk border-[1.5px] border-bdr rounded-md px-1 py-1 bg-bg focus:border-teal" value={c.duration_minutes} onChange={e => handleEditFieldChange(c.id, 'duration_minutes', Math.max(1, parseInt(e.target.value) || 5))} /></td>
                            <td className="font-mono text-[9px] text-muted px-1 py-0.5">{c.sched_end}</td>
                            <td className="px-1 py-0.5"><select className="w-[62px] text-[9px] font-extrabold border-[1.5px] border-bdr rounded-md px-1 py-0.5 bg-bg focus:border-teal" value={c.format} onChange={e => handleEditFieldChange(c.id, 'format', e.target.value)}>{FORMATS.map(f => <option key={f.c} value={f.c}>{f.c}</option>)}</select></td>
                            <td className="px-1 py-0.5"><input className="w-full text-[11px] font-bold border-[1.5px] border-bdr rounded-md px-1.5 py-1 bg-bg text-navy focus:border-teal" value={c.title} onChange={e => handleEditFieldChange(c.id, 'title', e.target.value)} /></td>
                            <td className="px-1 py-0.5"><input className="w-full text-[11px] border-[1.5px] border-bdr rounded-md px-1.5 py-1 bg-bg text-navy focus:border-teal" value={(c.objective || '').replace(/\n/g, ' | ')} onChange={e => handleEditFieldChange(c.id, 'objective', e.target.value.replace(/ \| /g, '\n'))} /></td>
                            <td className="px-1 py-0.5"><input className="w-full text-[11px] border-[1.5px] border-bdr rounded-md px-1.5 py-1 bg-bg text-navy focus:border-teal" value={c.illustration || ''} onChange={e => handleEditFieldChange(c.id, 'illustration', e.target.value)} /></td>
                            <td className="px-1 py-0.5"><input className="w-full text-[10px] border-[1.5px] border-bdr rounded-md px-1.5 py-1 bg-bg text-navy focus:border-teal" value={(c.approach || '').replace(/\n/g, ' | ')} onChange={e => handleEditFieldChange(c.id, 'approach', e.target.value.replace(/ \| /g, '\n'))} /></td>
                            <td className="px-1 py-0.5">
                              <div className="flex gap-0.5">
                                <button onClick={() => handleToggleBreak(c.id)} className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] text-muted hover:bg-[rgba(239,68,68,0.08)] hover:text-coral transition-all" title="Toggle break">☕</button>
                                <button onClick={() => handleAddSession(c.id)} className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] text-teal-dk hover:bg-[var(--teal-glow)] transition-all" title="Insert after">+</button>
                                <button onClick={() => handleDeleteSession(c.id)} className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] text-muted hover:bg-[rgba(239,68,68,0.08)] hover:text-coral transition-all" title="Delete">✕</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </tbody>
                </table>
              )}
            </Droppable>
          </DragDropContext>
          <div className="p-1.5">
            <button onClick={() => handleAddSession()} className="w-full py-2 border-[1.5px] border-dashed border-bdr rounded-sm text-teal-dk font-extrabold text-[11px] hover:border-teal hover:bg-[var(--teal-glow)] transition-all">+ Add Session</button>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleEditSave} disabled={updateMeetingMutation.isPending} className="px-5 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all disabled:opacity-60">
            {updateMeetingMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ SUMMARY VIEW (extracted component) ═════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
function SummaryView({
  scheduled, tracking, proj, hasTracking, expandedId, setExpandedId, fmtExpanded,
}: {
  scheduled: ScheduledItem[];
  tracking: Record<string, TrackState>;
  proj: Record<string, { pS: string; pE: string; dM: number }>;
  hasTracking: boolean;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  fmtExpanded: boolean;
}) {
  return (
    <div className="space-y-1">
      {scheduled.map(c => {
        const fc = getForecastEnd(c, tracking, proj);
        const exp = expandedId === c.id;
        return (
          <div key={c.id} className="flex overflow-hidden">
            <FmtStrip format={c.format} expanded={fmtExpanded} />
            <div className={`flex-1 min-w-0 bg-srf border-[1.5px] border-bdr border-l-0 rounded-r-sm shadow-card transition-all hover:border-[rgba(43,188,200,0.3)] hover:shadow-card-lg hover:-translate-y-px ${c.is_break ? 'opacity-50' : ''}`}>
              <div className="grid items-center px-3 py-2 gap-2.5 cursor-pointer" style={{ gridTemplateColumns: '80px minmax(80px,0.6fr) minmax(100px,1.6fr) minmax(80px,0.5fr)' }} onClick={() => setExpandedId(exp ? null : c.id)}>
                <div className="font-mono text-[10px] text-muted leading-tight">
                  <div>{c.sched_start} – {c.sched_end}</div>
                  <div className="text-[9px]">{c.duration_minutes}m</div>
                  {hasTracking && <div className="mt-0.5"><FcTag fc={fc} schedEnd={c.sched_end} /></div>}
                </div>
                <div className="text-[13px] font-extrabold text-navy truncate">{c.is_break ? '☕ ' : ''}{c.title}</div>
                <div className="text-[12px] text-slate line-clamp-2">{(c.objective || '').replace(/\n/g, ' · ')}</div>
                <div className="font-mono text-[8px] font-medium uppercase tracking-wider text-teal-dk text-right break-words">
                  {c.illustration && !c.is_break ? `⛰ ${c.illustration}` : ''}
                </div>
              </div>
              {c.approach && exp && (
                <div className="px-3 pb-2 border-t border-bdr">
                  <div className="pt-2 text-[11px] text-slate leading-relaxed pl-[90px]">
                    <strong>Approach:</strong> {c.approach.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ DETAIL VIEW (extracted component) ══════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
function DetailView({
  scheduled, tracking, proj, hasTracking,
}: {
  scheduled: ScheduledItem[];
  tracking: Record<string, TrackState>;
  proj: Record<string, { pS: string; pE: string; dM: number }>;
  hasTracking: boolean;
}) {
  return (
    <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-srf-alt sticky top-[52px] z-10">
              <th className="w-2 border-b-[1.5px] border-bdr"></th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-1.5 py-2 border-b-[1.5px] border-bdr w-[34px]">Start</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-1.5 py-2 border-b-[1.5px] border-bdr w-[34px]">End</th>
              <th className="text-center text-[8px] font-extrabold uppercase tracking-widest text-muted px-1 py-2 border-b-[1.5px] border-bdr w-[24px]">Dur</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-1.5 py-2 border-b-[1.5px] border-bdr" style={{ width: '14%' }}>Session</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-1.5 py-2 border-b-[1.5px] border-bdr" style={{ width: '28%' }}>Objective</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-1.5 py-2 border-b-[1.5px] border-bdr" style={{ width: '7%' }}>Theme</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-1.5 py-2 border-b-[1.5px] border-bdr" style={{ width: '28%' }}>Approach</th>
              <th className="text-center text-[8px] font-extrabold uppercase tracking-widest text-muted px-1 py-2 border-b-[1.5px] border-bdr w-[36px]">FC</th>
            </tr>
          </thead>
          <tbody>
            {scheduled.map(c => {
              const fc = getForecastEnd(c, tracking, proj);
              const fmt = getFormat(c.format);
              return (
                <tr key={c.id} className={`${c.is_break ? 'opacity-40 italic' : ''} hover:bg-[var(--teal-glow)] border-b border-srf-alt`} style={{ borderLeft: `8px solid ${fmt.cl}` }}>
                  <td></td>
                  <td className="font-mono text-[9px] text-muted px-1.5 py-1.5 whitespace-nowrap">{c.sched_start}</td>
                  <td className="font-mono text-[9px] text-muted px-1.5 py-1.5 whitespace-nowrap">{c.sched_end}</td>
                  <td className="font-mono text-[9px] text-muted text-center px-1 py-1.5">{c.duration_minutes}m</td>
                  <td className="font-extrabold text-navy text-[11px] px-1.5 py-1.5">{c.is_break ? '☕ ' : ''}{c.title}</td>
                  <td className="text-slate text-[10px] px-1.5 py-1.5 leading-relaxed break-words">{c.objective?.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</td>
                  <td className="font-mono text-[8px] font-medium uppercase tracking-wider text-teal-dk px-1.5 py-1.5 break-words">{c.illustration}</td>
                  <td className="text-muted text-[9px] px-1.5 py-1.5 leading-relaxed break-words">{c.approach?.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</td>
                  <td className="text-center px-1 py-1.5">
                    {hasTracking ? <FcTag fc={fc} schedEnd={c.sched_end} /> : <span className="text-muted font-mono text-[9px]">{c.sched_end}</span>}
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
