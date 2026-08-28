import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabase est optionnel — si pas configuré, on dégrade vers du polling (refetchInterval).
// Ça permet de tester l'app en local sans projet Supabase.
export const supabase: SupabaseClient | null =
  url && key && url.startsWith("http")
    ? createClient(url, key, {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 10 } },
      })
    : null;

export const isRealtimeEnabled = supabase !== null;
