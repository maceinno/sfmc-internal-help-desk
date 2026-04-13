import { Ticket } from 'lucide-react'

export default function MyTicketsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Ticket className="w-7 h-7 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
        Your tickets will appear here.
      </div>
    </div>
  )
}
