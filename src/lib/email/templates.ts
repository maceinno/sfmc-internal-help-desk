/**
 * HTML email templates for help desk notifications.
 * All templates follow a consistent branded layout.
 */

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://help.sfmchl.com'

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
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              This is an automated notification from the SFMC Help Desk Portal.
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

export function newReply(p: {
  ticketId: string
  title: string
  authorName: string
  content: string
  isInternal: boolean
}) {
  const preview = p.content.length > 300 ? p.content.slice(0, 300) + '...' : p.content
  const label = p.isInternal ? 'New Internal Note' : 'New Reply'
  return {
    subject: `[${p.ticketId}] ${label} on: ${p.title}`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">${label}</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
        <strong>${p.authorName}</strong> ${p.isInternal ? 'added an internal note to' : 'replied to'} ticket <strong>${p.ticketId}</strong>.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;line-height:1.6;">${preview}</p>
      </div>
      ${button(ticketUrl(p.ticketId), 'View Conversation')}
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
}) {
  const preview = p.content.length > 300 ? p.content.slice(0, 300) + '...' : p.content
  return {
    subject: `[${p.ticketId}] New activity on CC'd ticket: ${p.title}`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">CC'd Ticket Update</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
        <strong>${p.authorName}</strong> posted on ticket <strong>${p.ticketId}</strong> that you are CC'd on.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;line-height:1.6;">${preview}</p>
      </div>
      ${button(ticketUrl(p.ticketId), 'View Ticket')}
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
