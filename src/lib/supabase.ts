import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey && supabaseUrl !== 'your-project-url.supabase.co');

export const supabase = isSupabaseConfigured 
    ? createClient(supabaseUrl, supabasePublishableKey)
    : null;

if (!isSupabaseConfigured) {
    console.warn("Supabase is not configured. Cloud sync will be disabled. Please check your .env file.");
}

export type SupabaseClient = typeof supabase
