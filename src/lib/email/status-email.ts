/**
 * Whether a status change should send its own "Status changed to X" email.
 *
 * One email per action is the rule. An agent using "Submit as Solved" makes
 * ONE change from their point of view, but it used to produce two emails a
 * couple of seconds apart — the reply, then a separate status notification.
 * The reply email now names the new status itself (see `statusWithReplyBlock`
 * in the email templates), so when a reply carried the change there is
 * nothing left for a second email to say.
 *
 * A status change made on its own — from the sidebar, or the composer's
 * status button with nothing typed — still emails, because that email is the
 * only way the requester hears about it.
 */
export function shouldSendStatusEmail(p: {
  oldStatus?: string
  newStatus?: string
  /** True when the same action posted a reply, whose email named the status. */
  sentWithReply?: boolean
}): boolean {
  if (!p.oldStatus || !p.newStatus) return false
  // Nothing actually moved — never mail "pending → pending".
  if (p.oldStatus === p.newStatus) return false
  return p.sentWithReply !== true
}
