export type MeetingFormat = 'FIP' | 'FI' | 'P+D' | 'D' | 'WND' | 'W+D' | 'PR' | 'O' | 'BRK';
export type MeetingStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
export type ItemStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

export interface FormatDef {
  c: MeetingFormat;
  l: string;
  cl: string;
}

export const FORMATS: FormatDef[] = [
  { c: 'FIP', l: 'For Info — Presentation', cl: '#08B3C3' },
  { c: 'FI',  l: 'For Info — Pre-read',    cl: '#8A96A8' },
  { c: 'P+D', l: 'Presentation + Decision', cl: '#EF4444' },
  { c: 'D',   l: 'Decision (Pre-read)',     cl: '#F97316' },
  { c: 'WND', l: 'Workshop — No Decision',  cl: '#9333EA' },
  { c: 'W+D', l: 'Workshop + Decision',     cl: '#B478F0' },
  { c: 'PR',  l: 'Prayer / Devotion',       cl: '#0D1F3C' },
  { c: 'O',   l: 'Other',                   cl: '#22C55E' },
  { c: 'BRK', l: 'Break',                   cl: '#E2E8F0' },
];

export function getFormat(code: MeetingFormat): FormatDef {
  return FORMATS.find(f => f.c === code) || FORMATS[7];
}

export interface AgendaItemBase {
  id: string;
  position: number;
  title: string;
  duration_minutes: number;
  format: MeetingFormat;
  objective: string;
  illustration: string;
  approach: string;
  is_break: boolean;
  notes: string;
}

export interface TemplateItem extends AgendaItemBase {
  template_id: string;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  description: string;
  start_time: string;
  items: TemplateItem[];
  created_at: string;
  updated_at: string;
}

export interface MeetingItem extends AgendaItemBase {
  meeting_id: string;
  status: ItemStatus;
  actual_start_at: string | null;
  actual_end_at: string | null;
  actual_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export type MeetingItemUpdate = Partial<
  Pick<MeetingItem, 'status' | 'actual_start_at' | 'actual_end_at' | 'actual_duration_minutes' | 'notes'>
>;

export interface Meeting {
  id: string;
  user_id: string;
  template_id: string | null;
  title: string;
  subtitle: string;
  date: string;
  start_time: string;
  location: string;
  facilitator: string;
  participants: string[];
  status: MeetingStatus;
  actual_start_at: string | null;
  actual_end_at: string | null;
  notes: string;
  items: MeetingItem[];
  created_at: string;
  updated_at: string;
}

// Computed scheduled times for agenda items
export interface ScheduledItem extends MeetingItem {
  sched_start: string; // HH:MM
  sched_end: string;   // HH:MM
  sched_start_min: number;
  sched_end_min: number;
}

// Time utilities
export function t2m(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function m2t(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function calcSchedule(items: MeetingItem[], startTime: string): ScheduledItem[] {
  let cur = t2m(startTime);
  return items.map(item => {
    const st = cur;
    const en = cur + item.duration_minutes;
    cur = en;
    return {
      ...item,
      sched_start: m2t(st),
      sched_end: m2t(en),
      sched_start_min: st,
      sched_end_min: en,
    };
  });
}

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
