import { createClient } from '@supabase/supabase-js'

// Fallback to production credentials so production hosting builds without injected env vars don't disable auth
const DEFAULT_SUPABASE_URL = "https://ksjphkqxudtkduuhnyvn.supabase.co"
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzanBoa3F4dWR0a2R1dWhueXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzM2ODYsImV4cCI6MjA5MTkwOTY4Nn0.iKSSYA2t4nE4HJdIvFNraAsykwweWx29K57L1yNTSvU"

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY

export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Isolated client instance that does not alter local storage or current user session
export function createIsolatedSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

