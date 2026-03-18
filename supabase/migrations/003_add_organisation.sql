-- Add organisation field to meetings
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS organisation text DEFAULT '';
