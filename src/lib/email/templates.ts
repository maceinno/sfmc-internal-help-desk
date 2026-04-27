/**
 * HTML email templates for help desk notifications.
 * All templates follow a consistent branded layout.
 */

import { htmlToPlainText } from '@/lib/html/to-plain-text'

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://help.sfmc.com'

function ticketUrl(ticketId: string) {
  return `${PORTAL_URL}/tickets/${ticketId}`
}

function layout(body: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;">SFMC Help Desk</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 4px;font-size:12px;color:#6b7280;font-weight:500;">
              Reply directly to this email to respond to the ticket.
            </p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              SFMC Help Desk Portal &middot;
              <a href="${PORTAL_URL}" style="color:#2563eb;text-decoration:none;">Open Portal</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function button(url: string, text: string) {
  return `<a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;margin-top:16px;">
    ${text}
  </a>`
}

function badge(label: string, color: string, bg: string) {
  return `<span style="display:inline-block;background:${bg};color:${color};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">${label}</span>`
}

// ── Template functions ──────────────────────────────────────────

export function ticketCreatedCreator(p: {
  ticketId: string
  title: string
  category: string
  priority: string
}) {
  return {
    subject: `[${p.ticketId}] Your request has been submitted`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Request Submitted</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
        Your ticket has been created and will be reviewed by our team.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;width:100px;">Ticket</td>
            <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#111827;">${p.ticketId}</td></tr>
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Subject</td>
            <td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb;">${p.title}</td></tr>
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Category</td>
            <td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb;">${p.category}</td></tr>
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Priority</td>
            <td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb;">${badge(p.priority, '#92400e', '#fef3c7')}</td></tr>
      </table>
      ${button(ticketUrl(p.ticketId), 'View Ticket')}
    `),
  }
}

export function ticketCreatedAgent(p: {
  ticketId: string
  title: string
  category: string
  priority: string
  creatorName: string
}) {
  return {
    subject: `[${p.ticketId}] New ticket assigned to you: ${p.title}`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">New Ticket Assigned</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
        A new ticket from <strong>${p.creatorName}</strong> has been assigned to you.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;width:100px;">Ticket</td>
            <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#111827;">${p.ticketId}</td></tr>
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Subject</td>
            <td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb;">${p.title}</td></tr>
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">From</td>
            <td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb;">${p.creatorName}</td></tr>
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Priority</td>
            <td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb;">${badge(p.priority, '#92400e', '#fef3c7')}</td></tr>
      </table>
      ${button(ticketUrl(p.ticketId), 'View & Respond')}
    `),
  }
}

export interface ConversationMessage {
  authorName: string
  content: string
  isInternal: boolean
  createdAt: string
}

export function newReply(p: {
  ticketId: string
  title: string
  authorName: string
  content: string
  isInternal: boolean
  description?: string
  conversation?: ConversationMessage[]
}) {
  const preview = p.content.length > 500 ? p.content.slice(0, 500) + '...' : p.content
  const label = p.isInternal ? 'New Internal Note' : 'New Reply'

  // Build conversation thread (most recent messages, excluding the new one)
  let threadHtml = ''
  if (p.conversation && p.conversation.length > 0) {
    const messages = p.conversation.slice(-10) // Last 10 messages
    threadHtml = `
      <div style="margin-top:24px;padding-top:20px;border-top:2px solid #e5e7eb;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">
          Conversation History
        </p>
        ${messages.map((msg) => {
          const date = new Date(msg.createdAt).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          })
          const msgPreview = msg.content.length > 300 ? msg.content.slice(0, 300) + '...' : msg.content
          const borderColor = msg.isInternal ? '#fbbf24' : '#e5e7eb'
          const bgColor = msg.isInternal ? '#fffbeb' : '#ffffff'
          const badge = msg.isInternal ? '<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;margin-left:6px;">Internal</span>' : ''
          return `
            <div style="margin-bottom:8px;padding:12px;border-left:3px solid ${borderColor};background:${bgColor};border-radius:0 6px 6px 0;">
              <div style="margin-bottom:4px;">
                <strong style="font-size:13px;color:#111827;">${msg.authorName}</strong>${badge}
                <span style="font-size:11px;color:#9ca3af;margin-left:8px;">${date}</span>
              </div>
              <p style="margin:0;font-size:13px;color:#4b5563;white-space:pre-wrap;line-height:1.5;">${msgPreview}</p>
            </div>`
        }).join('')}
      </div>`
  }

  // Include original ticket description at the bottom. Tiptap-stored
  // HTML gets reduced to readable plain text so the email stays consistent.
  let descriptionHtml = ''
  if (p.description) {
    const descText = htmlToPlainText(p.description)
    const descPreview = descText.length > 300 ? descText.slice(0, 300) + '...' : descText
    descriptionHtml = `
      <div style="margin-top:16px;padding-top:16px;border-top:1px dashed #d1d5db;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">
          Original Request
        </p>
        <div style="padding:12px;background:#f9fafb;border-radius:6px;">
          <p style="margin:0;font-size:13px;color:#4b5563;white-space:pre-wrap;line-height:1.5;">${descPreview}</p>
        </div>
      </div>`
  }

  return {
    subject: `Re: [${p.ticketId}] ${p.title}`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">${label}</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
        <strong>${p.authorName}</strong> ${p.isInternal ? 'added an internal note to' : 'replied to'} ticket <strong>${p.ticketId}</strong>.
      </p>
      <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:16px;margin-bottom:16px;">
        <div style="margin-bottom:4px;">
          <strong style="font-size:13px;color:#111827;">${p.authorName}</strong>
          <span style="font-size:11px;color:#6b7280;margin-left:8px;">just now</span>
        </div>
        <p style="margin:0;font-size:14px;color:#1e1b4b;white-space:pre-wrap;line-height:1.6;">${preview}</p>
      </div>
      ${button(ticketUrl(p.ticketId), 'View & Reply')}
      ${threadHtml}
      ${descriptionHtml}
    `),
  }
}

export function statusChanged(p: {
  ticketId: string
  title: string
  oldStatus: string
  newStatus: string
  changedByName: string
}) {
  const statusColors: Record<string, { color: string; bg: string }> = {
    new: { color: '#1e40af', bg: '#dbeafe' },
    open: { color: '#15803d', bg: '#dcfce7' },
    pending: { color: '#92400e', bg: '#fef3c7' },
    on_hold: { color: '#6b7280', bg: '#f3f4f6' },
    solved: { color: '#166534', bg: '#bbf7d0' },
  }
  const sc = statusColors[p.newStatus] ?? { color: '#374151', bg: '#f3f4f6' }

  return {
    subject: `[${p.ticketId}] Status changed to ${p.newStatus.replace('_', ' ')}: ${p.title}`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Ticket Status Updated</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
        <strong>${p.changedByName}</strong> updated the status of your ticket.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;width:100px;">Ticket</td>
            <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#111827;">${p.ticketId} — ${p.title}</td></tr>
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Status</td>
            <td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb;">
              ${badge(p.oldStatus.replace('_', ' '), '#6b7280', '#f3f4f6')}
              <span style="margin:0 8px;color:#9ca3af;">&rarr;</span>
              ${badge(p.newStatus.replace('_', ' '), sc.color, sc.bg)}
            </td></tr>
      </table>
      ${button(ticketUrl(p.ticketId), 'View Ticket')}
    `),
  }
}

export function assignmentChanged(p: {
  ticketId: string
  title: string
  assigneeName: string
  assignedByName: string
}) {
  return {
    subject: `[${p.ticketId}] Ticket assigned to you: ${p.title}`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Ticket Assigned to You</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
        <strong>${p.assignedByName}</strong> assigned ticket <strong>${p.ticketId}</strong> to you.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${p.title}</p>
      </div>
      ${button(ticketUrl(p.ticketId), 'View & Respond')}
    `),
  }
}

export function userTagged(p: {
  ticketId: string
  title: string
  taggedByName: string
}) {
  return {
    subject: `[${p.ticketId}] You were mentioned: ${p.title}`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">You Were Mentioned</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
        <strong>${p.taggedByName}</strong> mentioned you in ticket <strong>${p.ticketId}</strong>.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${p.title}</p>
      </div>
      ${button(ticketUrl(p.ticketId), 'View Conversation')}
    `),
  }
}

export function ccNotification(p: {
  ticketId: string
  title: string
  authorName: string
  content: string
  description?: string
  conversation?: ConversationMessage[]
}) {
  const preview = p.content.length > 500 ? p.content.slice(0, 500) + '...' : p.content

  // Reuse the reply template's thread rendering
  const replyTemplate = newReply({
    ...p,
    isInternal: false,
  })

  return {
    subject: `Re: [${p.ticketId}] ${p.title}`,
    html: replyTemplate.html.replace(
      'New Reply',
      "CC'd Ticket Update"
    ).replace(
      'replied to',
      'posted on'
    ),
  }
}

export function welcomeUser(p: {
  name: string
  role: string
  signInUrl: string
}) {
  const firstName = p.name.split(/\s+/)[0] || p.name
  return {
    subject: 'Welcome to the SFMC Help Desk — set up your account',
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Welcome, ${firstName}</h2>
      <p style="margin:0 0 16px;color:#374151;font-size:14px;">
        An admin has created an account for you on the SFMC Help Desk portal.
        Click the button below to sign in and set your password.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;width:100px;">Role</td>
            <td style="padding:12px 16px;font-size:14px;color:#111827;text-transform:capitalize;">${p.role}</td></tr>
      </table>
      ${button(p.signInUrl, 'Sign In & Set Password')}
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px;">
        This sign-in link expires in 7 days. If it expires, use "Forgot password?" on the sign-in page to recover your account.
      </p>
    `),
  }
}

export function slaAlert(p: {
  ticketId: string
  title: string
  status: 'at_risk' | 'breached'
  timeInfo: string
}) {
  const isBreached = p.status === 'breached'
  const headerColor = isBreached ? '#dc2626' : '#d97706'
  return {
    subject: `[${p.ticketId}] SLA ${isBreached ? 'BREACHED' : 'AT RISK'}: ${p.title}`,
    html: layout(`
      <div style="background:${isBreached ? '#fef2f2' : '#fffbeb'};border:1px solid ${isBreached ? '#fecaca' : '#fde68a'};border-radius:8px;padding:16px;margin-bottom:16px;">
        <h2 style="margin:0 0 4px;font-size:18px;color:${headerColor};">
          ${isBreached ? 'SLA Breached' : 'SLA At Risk'}
        </h2>
        <p style="margin:0;font-size:14px;color:#374151;">${p.timeInfo}</p>
      </div>
      <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;width:100px;">Ticket</td>
            <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#111827;">${p.ticketId}</td></tr>
        <tr><td style="padding:12px 16px;background:#f9fafb;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Subject</td>
            <td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb;">${p.title}</td></tr>
      </table>
      ${button(ticketUrl(p.ticketId), 'View Ticket')}
    `),
  }
}
