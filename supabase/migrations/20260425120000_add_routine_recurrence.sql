-- Add recurrence fields to routine_cards
ALTER TABLE public.routine_cards ADD COLUMN IF NOT EXISTS rrule TEXT;
ALTER TABLE public.routine_cards ADD COLUMN IF NOT EXISTS parent_routine_id UUID REFERENCES public.routine_cards(id);
ALTER TABLE public.routine_cards ADD COLUMN IF NOT EXISTS original_recurrence_date TIMESTAMPTZ;

-- Index for detached instances lookup
CREATE INDEX IF NOT EXISTS idx_routine_cards_parent_recurrence ON public.routine_cards(parent_routine_id, original_recurrence_date) WHERE parent_routine_id IS NOT NULL;
