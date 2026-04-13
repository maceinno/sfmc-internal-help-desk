// Barrel export for Supabase client utilities.
//
// NOTE: server.ts and admin.ts import 'server-only' and CANNOT be re-exported
// from this barrel without poisoning the client bundle. Import them directly:
//   import { createServerSupabaseClient } from '@/lib/supabase/server'
//   import { createAdminClient } from '@/lib/supabase/admin'

export { createClerkSupabaseClient, createSupabaseClient } from './client'
