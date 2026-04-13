'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Admin error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          Admin Error
        </h2>
        <p className="text-sm text-gray-500">
          Something went wrong loading the admin page. Please try again or go
          back.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <pre className="mt-2 w-full rounded-lg bg-gray-100 p-3 text-xs text-left text-red-700 overflow-auto max-h-32">
            {error.message}
          </pre>
        )}
        <div className="flex gap-3 mt-2">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
          >
            Try again
          </button>
          <Link
            href="/admin/categories"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back to Admin
          </Link>
        </div>
      </div>
    </div>
  )
}
