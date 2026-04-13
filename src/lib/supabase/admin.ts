// For webhooks and background jobs that bypass RLS
// Uses the service-role key — never expose this on the client.

import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Create a Supabase admin client that bypasses Row Level Security.
 * Only use this for trusted server-side operations such as:
 *  - Clerk webhook user sync
 *  - Cron / background jobs
 *  - Admin data migrations
 */
export function createAdminClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
