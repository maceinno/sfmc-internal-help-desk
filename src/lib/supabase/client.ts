// For use in Client Components
// Creates a Supabase client that passes the Clerk JWT for RLS

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Create a Supabase client authenticated with a Clerk JWT.
 * Use this in Client Components where you have a session token
 * (e.g. from `useAuth().getToken({ template: 'supabase' })`).
 */
export function createClerkSupabaseClient(clerkToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${clerkToken}`,
      },
    },
  })
}

/**
 * Create an unauthenticated Supabase client using only the anon key.
 * Useful for public reads that don't require RLS-gated access.
 */
export function createSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey)
}
