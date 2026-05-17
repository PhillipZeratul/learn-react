-- Make end_at nullable for active time trackers
ALTER TABLE public.time_tracker_cards ALTER COLUMN end_at DROP NOT NULL;
ALTER TABLE public.time_tracker_cards ALTER COLUMN end_at DROP DEFAULT;
