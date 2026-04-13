// For use in Server Components and Route Handlers
// Uses Clerk's auth() to get the token server-side

import 'server-only'

import { auth } from '@clerk/nextjs/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Create a Supabase client for use in Server Components and Route Handlers.
 * Automatically retrieves the Clerk session token via `auth()` and passes it
 * as the Authorization header so that Supabase RLS policies can identify the user.
 *
 * Returns `null` for the client if no valid Clerk session exists.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const { getToken } = await auth()
  const token = await getToken({ template: 'supabase' })

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    },
  })
}
