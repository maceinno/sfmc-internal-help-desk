import { getProfileId } from '@/lib/clerk/resolve-id'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/upload/branding — Upload a branding asset (logo, etc.)
 *
 * Uses the admin Supabase client to bypass storage RLS policies.
 * Returns the public URL of the uploaded file.
 */

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB

export async function POST(request: Request) {
  const userId = await getProfileId()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify admin role
  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing file' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: 'File must be under 2 MB' }, { status: 413 })
  }

  const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
  if (!allowed.includes(file.type)) {
    return Response.json(
      { error: 'File must be PNG, JPG, SVG, or WEBP' },
      { status: 400 },
    )
  }

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `logo-${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('branding')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('[branding-upload] Storage error:', uploadError)
    return Response.json({ error: 'Failed to upload file' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage
    .from('branding')
    .getPublicUrl(path)

  return Response.json({ url: urlData.publicUrl })
}
