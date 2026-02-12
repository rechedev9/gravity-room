import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function isConfigured(): boolean {
  const isSecureOrLocal =
    supabaseUrl.startsWith('https://') ||
    supabaseUrl.startsWith('http://localhost') ||
    supabaseUrl.startsWith('http://127.0.0.1');
  return isSecureOrLocal && supabaseUrl.length > 8 && supabaseAnonKey.length > 0;
}

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isConfigured()) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
      },
    });
  }
  return client;
}
