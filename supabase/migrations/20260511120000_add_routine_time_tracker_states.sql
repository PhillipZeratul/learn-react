
CREATE TABLE IF NOT EXISTS public.routine_time_tracker_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid DEFAULT auth.uid() NOT NULL UNIQUE,
    active_time_tracker_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL
);

-- RLS
ALTER TABLE public.routine_time_tracker_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tracker state" ON public.routine_time_tracker_states
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tracker state" ON public.routine_time_tracker_states
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracker state" ON public.routine_time_tracker_states
    FOR UPDATE USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.routine_time_tracker_states;
