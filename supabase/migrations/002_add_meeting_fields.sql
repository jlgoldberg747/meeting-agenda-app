-- Add missing columns to meetings table
-- These fields are referenced in frontend/backend code but were not in the initial migration

-- Organisation field for meeting metadata
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS organisation text DEFAULT '';

-- Alarm settings per meeting
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS alarms_enabled boolean DEFAULT true;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS alarm_minutes_before integer DEFAULT 1;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS alarm_type text DEFAULT 'chime';
