-- Add alarm/meeting settings columns to meetings table
alter table public.meetings
  add column alarms_enabled boolean default true not null,
  add column alarm_minutes_before integer default 1 not null,
  add column alarm_type text default 'chime' not null;
