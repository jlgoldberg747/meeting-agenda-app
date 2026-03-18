export type MeetingFormat = 'FIP' | 'FI' | 'P+D' | 'D' | 'WND' | 'W+D' | 'PR' | 'O' | 'BRK';
export type MeetingStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
export type ItemStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

export interface Profile {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateItem {
  id: string;
  template_id: string;
  position: number;
  title: string;
  duration_minutes: number;
  format: MeetingFormat;
  objective: string;
  illustration: string;
  approach: string;
  is_break: boolean;
  notes: string;
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

export interface MeetingItem {
  id: string;
  meeting_id: string;
  position: number;
  title: string;
  duration_minutes: number;
  format: MeetingFormat;
  objective: string;
  illustration: string;
  approach: string;
  is_break: boolean;
  notes: string;
  status: ItemStatus;
  actual_start_at: string | null;
  actual_end_at: string | null;
  actual_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

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
