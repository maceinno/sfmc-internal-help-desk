import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']

/**
 * POST /api/users/profile/avatar — Upload a profile photo.
 * Stores in the 'branding' bucket (public) under avatars/ path.
 * Updates the user's avatar_url in profiles.
 */
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be under 2 MB' }, { status: 413 })
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'File must be PNG, JPG, or WEBP' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `avatars/${userId}-${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('branding')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('[avatar] Upload failed:', uploadError)
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage
    .from('branding')
    .getPublicUrl(path)

  // Update profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: urlData.publicUrl })
    .eq('id', userId)

  if (updateError) {
    console.error('[avatar] Profile update failed:', updateError)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ url: urlData.publicUrl })
}
