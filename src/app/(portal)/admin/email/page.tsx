'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Loader2,
  Search,
  Send,
  ExternalLink,
  AlertTriangle,
  Inbox,
  MailWarning,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ── Types ──────────────────────────────────────────────────────

interface Issue {
  recipient: string
  event_type: string
  subject: string | null
  bounce_type: string | null
  bounce_subtype: string | null
  reason: string | null
  resend_email_id: string | null
  event_at: string
}

interface TimelineEvent {
  id: string
  event_type: string
  subject: string | null
  bounce_type: string | null
  bounce_subtype: string | null
  reason: string | null
  resend_email_id: string | null
  event_at: string
}

// ── Helpers ────────────────────────────────────────────────────

function eventBadge(type: string) {
  const map: Record<string, { label: string; cls: string }> = {
    bounced: { label: 'Bounced', cls: 'bg-red-100 text-red-700 border-red-200' },
    suppressed: {
      label: 'Suppressed',
      cls: 'bg-red-100 text-red-700 border-red-200',
    },
    failed: { label: 'Failed', cls: 'bg-red-100 text-red-700 border-red-200' },
    complained: {
      label: 'Spam complaint',
      cls: 'bg-orange-100 text-orange-700 border-orange-200',
    },
    delivery_delayed: {
      label: 'Delayed',
      cls: 'bg-amber-100 text-amber-700 border-amber-200',
    },
    delivered: {
      label: 'Delivered',
      cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
    sent: { label: 'Sent', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  }
  const m = map[type] ?? {
    label: type,
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return (
    <Badge variant="outline" className={`text-[11px] ${m.cls}`}>
      {m.label}
    </Badge>
  )
}

function fmt(ts: string) {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

function resendUrl(emailId: string | null) {
  return emailId ? `https://resend.com/emails/${emailId}` : 'https://resend.com/emails'
}

// ── Page ───────────────────────────────────────────────────────

export default function EmailDeliveryPage() {
  const [searchInput, setSearchInput] = useState('')
  const [lookup, setLookup] = useState<string | null>(null)

  const issuesQuery = useQuery<{ issues: Issue[]; count: number }>({
    queryKey: ['admin', 'email-events', 'issues'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email-events')
      if (!res.ok) throw new Error('Failed to load delivery issues')
      return res.json()
    },
  })

  const timelineQuery = useQuery<{ recipient: string; events: TimelineEvent[] }>({
    queryKey: ['admin', 'email-events', 'timeline', lookup],
    enabled: !!lookup,
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/email-events?recipient=${encodeURIComponent(lookup!)}`,
      )
      if (!res.ok) throw new Error('Failed to load history')
      return res.json()
    },
  })

  const resendInvite = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch('/api/users/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Failed to resend invite')
      return body
    },
    onSuccess: (_b, email) => {
      toast.success(`Invite re-sent to ${email}`, {
        description:
          'If the address is still suppressed in Resend, clear it there first — the resend will be dropped until you do.',
      })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const issues = issuesQuery.data?.issues ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Email Delivery</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Addresses Resend has bounced or suppressed. A suppressed address
          receives nothing — not even its account invite — until the
          suppression is cleared.
        </p>
      </div>

      {/* How-to / explainer */}
      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="p-4 text-sm text-amber-900">
          <div className="flex gap-2">
            <MailWarning className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Clearing a suppressed address is a two-step fix</p>
              <p>
                Resend doesn&apos;t expose suppression removal over its API, so
                the actual un-block happens in the Resend dashboard:
              </p>
              <ol className="list-decimal ml-5 space-y-0.5">
                <li>
                  Open{' '}
                  <a
                    href="https://resend.com/emails"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Resend → Logs / Suppressions
                  </a>
                  , find the address, and remove the suppression.
                </li>
                <li>Confirm the mailbox actually exists / receives mail (otherwise it re-bounces).</li>
                <li>
                  Come back and hit <strong>Resend invite</strong> below.
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lookup any address */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const v = searchInput.trim().toLowerCase()
              setLookup(v || null)
            }}
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Look up an address's delivery history…"
                className="pl-9"
                type="email"
              />
            </div>
            <Button type="submit" variant="outline">
              Look up
            </Button>
          </form>

          {lookup && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  History for <span className="font-mono">{lookup}</span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resendInvite.isPending}
                  onClick={() => resendInvite.mutate(lookup)}
                >
                  {resendInvite.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Resend invite
                </Button>
              </div>
              {timelineQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : (timelineQuery.data?.events.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No delivery events recorded for this address. (Events accrue
                  once the Resend events webhook is configured — see the note
                  above.)
                </p>
              ) : (
                <ul className="divide-y">
                  {timelineQuery.data!.events.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                      {eventBadge(e.event_type)}
                      <span className="text-muted-foreground tabular-nums">
                        {fmt(e.event_at)}
                      </span>
                      <span className="flex-1 truncate text-gray-700">
                        {e.reason || e.subject || '—'}
                      </span>
                      {e.resend_email_id && (
                        <a
                          href={resendUrl(e.resend_email_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-gray-700"
                          title="Open in Resend"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* The bounce list */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold">
              Delivery issues{' '}
              {issuesQuery.data ? `(${issuesQuery.data.count})` : ''}
            </h3>
          </div>

          {issuesQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : issuesQuery.isError ? (
            <div className="py-12 text-center text-sm text-red-600">
              Failed to load. Try refreshing.
            </div>
          ) : issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No delivery issues</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm">
                Nothing is bouncing or suppressed. (Events populate from the
                moment the Resend events webhook is configured — see the note
                above.)
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Last event</TableHead>
                  <TableHead className="text-right">&nbsp;</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((it) => (
                  <TableRow key={it.recipient}>
                    <TableCell className="font-medium">{it.recipient}</TableCell>
                    <TableCell>
                      {eventBadge(it.event_type)}
                      {it.bounce_subtype && (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {it.bounce_subtype}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[28rem] truncate">
                      {it.reason || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                      {fmt(it.event_at)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            resendInvite.isPending &&
                            resendInvite.variables === it.recipient
                          }
                          onClick={() => resendInvite.mutate(it.recipient)}
                          title="Re-mint a sign-in link and resend the invite"
                        >
                          {resendInvite.isPending &&
                          resendInvite.variables === it.recipient ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Resend invite
                        </Button>
                        <a
                          href={resendUrl(it.resend_email_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-gray-700"
                          title="Open in Resend"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
