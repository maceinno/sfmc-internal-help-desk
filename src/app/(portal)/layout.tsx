import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Providers } from '@/components/providers'
import { Sidebar } from '@/components/layout/sidebar'
import { RealtimeProvider } from '@/components/layout/realtime-provider'
import { AssumeUserBanner } from '@/components/layout/assume-user-banner'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  return (
    <Providers>
      <RealtimeProvider>
        <AssumeUserBanner />
        <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900">
          <Sidebar />
          <main className="flex-1 ml-0 lg:ml-64 p-4 pt-16 lg:pt-8 lg:p-8">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </RealtimeProvider>
    </Providers>
  )
}
