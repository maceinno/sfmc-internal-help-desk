'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Internal app: keep data fresh but avoid unnecessary refetches
        staleTime: 30 * 1000, // 30 seconds
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  })
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Create a stable QueryClient per browser tab (avoids sharing across requests in SSR)
  const [queryClient] = useState(makeQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  )
}
