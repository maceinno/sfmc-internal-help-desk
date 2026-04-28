import { CreateTicketForm } from '@/components/create-ticket/create-ticket-form'

export default function NewTicketPage() {
  // The tickets layout wraps detail-route children in `overflow-hidden`
  // so the ticket-detail page can manage its own internal scroll regions.
  // The new-ticket form is one long vertical layout though, so it needs
  // its own scrollable surface — otherwise as conditional fields appear
  // (Category, Sub-category, address blocks, etc.) the bottom of the
  // form, including the Submit button, gets clipped by the parent.
  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <CreateTicketForm />
    </div>
  )
}
