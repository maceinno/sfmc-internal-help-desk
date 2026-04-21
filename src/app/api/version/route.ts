import { NextResponse } from 'next/server'

// Always hit the live version on each request — we explicitly want to detect
// new deploys as they happen, not serve a cached response.
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/version
 *
 * Returns the build identifier for the running deployment. The client polls
 * this to detect when a new version has shipped so it can prompt the user
 * to refresh.
 *
 * On Vercel, `VERCEL_GIT_COMMIT_SHA` is set automatically per deploy. Locally
 * it's `dev`, which means the banner never fires during development.
 */
export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev'
  return NextResponse.json(
    { version },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  )
}
