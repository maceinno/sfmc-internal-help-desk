// ============================================================================
// Core domain types for the SFMC Internal Help Desk Portal
// Ported from the prototype (magic-patterns) and aligned with the DB schema.
// ============================================================================

export type TicketStatus = 'new' | 'open' | 'pending' | 'on_hold' | 'solved'
export type TicketPriority = 'urgent' | 'high' | 'medium' | 'low'
export type TicketCategory =
  | 'Loan Origination'
  | 'Underwriting'
  | 'Closing'
  | 'Servicing'
  | 'Compliance'
  | 'IT Systems'
  | 'General'

export type TicketType =
  | 'Closing Support'
  | 'IT Support'
  | 'Lending Support'
  | 'Marketing Support'
  | 'Payoff Request'
  | 'Product Desk (Non-Agency Products)'
  | 'Secondary Support'

export type TicketVisibility = 'public' | 'internal' | 'restricted'

export type NotificationType =
  | 'tagged'
  | 'collaborator_added'
  | 'reply_on_tagged'
  | 'sla_at_risk'

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'date'
  | 'number'

// ── Interfaces ───────────────────────────────────────────────

/** A file attached to a ticket or message. */
export interface Attachment {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  uploadedBy: string
  uploadedAt: string
  url?: string
  version?: number
  versionGroup?: string
  isFinal?: boolean
  messageId?: string
}

/** A physical branch location. */
export interface Branch {
  id: string
  name: string
  location: string
}

/** Region is structurally identical to Branch. */
export type Region = Branch

/** A user of the help-desk system (employee, agent, or admin). */
export interface User {
  id: string
  name: string
  email: string
  role: 'employee' | 'agent' | 'admin'
  avatar: string
  department?: string
  departments?: string[]
  teamIds?: string[]
  branchId?: string
  regionId?: string
  isOutOfOffice?: boolean
  ticketTypesHandled?: TicketType[]
  hasRegionalAccess?: boolean
  managedRegionId?: string
  hasBranchAccess?: boolean
  managedBranchId?: string
}

/** A single message within a ticket conversation thread. */
export interface Message {
  id: string
  authorId: string
  content: string
  timestamp: string
  isInternal: boolean
  attachments?: Attachment[]
  taggedAgents?: string[]
}

/** A field value stored on a ticket for a given custom field. */
export interface CustomFieldValue {
  fieldId: string
  value: string | string[] | boolean | number | null
}

/** The core ticket entity representing a help-desk request. */
export interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  createdBy: string
  assignedTo?: string
  assignedTeam?: string
  cc?: string[]
  collaborators?: string[]
  createdAt: string
  updatedAt: string
  messages: Message[]
  attachments?: Attachment[]
  ticketType?: TicketType
  subCategory?: string
  internalNotes?: string
  visibility?: TicketVisibility
  parentTicketId?: string
  customFields?: CustomFieldValue[]
  /** If this ticket was merged into another. */
  mergedIntoId?: string
  /** IDs of tickets merged into this one. */
  mergedTicketIds?: string[]
  mailingAddress?: {
    street1: string
    street2?: string
    city: string
    state: string
    zip: string
  }
}

/** An in-app notification delivered to a user. */
export interface AppNotification {
  id: string
  type: NotificationType
  ticketId: string
  ticketTitle: string
  fromUserId: string
  toUserId: string
  message: string
  read: boolean
  timestamp: string
}

/** Aggregated statistics for a ticket view. */
export interface TicketStats {
  newCount: number
  open: number
  pending: number
  onHold: number
  solved: number
  avgResponseTime: string
  overdue: number
}

/** Filter criteria applied to a saved view. */
export interface ViewFilterConfig {
  statusFilter: TicketStatus | 'any'
  assigneeFilter: 'me' | 'unassigned' | 'assigned' | 'any'
  categoryFilter: TicketCategory | 'any'
  slaFilter: 'breached' | 'at-risk' | 'any'
}

/** A saved ticket view with ordering and filter configuration. */
export interface ViewConfig {
  id: string
  name: string
  enabled: boolean
  group: string
  filterConfig: ViewFilterConfig
  order: number
  isCustom?: boolean
}

// ── SLA Types ────────────────────────────────────────────────

/** Conditions that a ticket must match for an SLA policy to apply. */
export interface SlaPolicyConditions {
  ticketTypes: TicketType[] | 'any'
  categories: TicketCategory[] | 'any'
  priorities: TicketPriority[] | 'any'
  subCategories?: string[] | 'any'
}

/** Response-time metrics defined by an SLA policy. */
export interface SlaPolicyMetrics {
  firstReplyHours: number
  nextReplyHours: number
  /** Percentage (0-100) at which to flag "at risk". Default 75. */
  warningThreshold?: number
}

/** An SLA policy that maps ticket conditions to response-time targets. */
export interface SlaPolicy {
  id: string
  name: string
  enabled: boolean
  conditions: SlaPolicyConditions
  metrics: SlaPolicyMetrics
  order: number
  isDefault?: boolean
}

// ── Schedule Types ───────────────────────────────────────────

/** A single business-hours window for a day of the week. */
export interface BusinessHoursEntry {
  day: DayOfWeek
  enabled: boolean
  /** "HH:MM" format, e.g. "08:00" */
  startTime: string
  /** "HH:MM" format, e.g. "17:00" */
  endTime: string
}

/** A named holiday when the office is closed. */
export interface Holiday {
  id: string
  name: string
  /** "YYYY-MM-DD" format */
  date: string
}

/** A department's business-hours schedule including holidays. */
export interface DepartmentSchedule {
  id: string
  departmentName: string
  timezone: string
  businessHours: BusinessHoursEntry[]
  holidays: Holiday[]
  enabled: boolean
}

// ── Canned Responses ─────────────────────────────────────────

/** Side-effects applied when a canned response is used. */
export interface CannedResponseAction {
  setStatus?: TicketStatus
  setPriority?: TicketPriority
  setTeam?: string
  setCategory?: string
  addInternalNote?: string
}

/** A reusable pre-written reply with optional automated actions. */
export interface CannedResponse {
  id: string
  name: string
  content: string
  category?: string
  actions?: CannedResponseAction
  isPersonal?: boolean
  createdBy?: string
  usageCount?: number
}

// ── Routing ──────────────────────────────────────────────────

/** A rule that auto-assigns tickets to a user or team based on type/category. */
export interface RoutingRule {
  id: string
  name: string
  enabled: boolean
  ticketType: string | 'any'
  category: string | 'any'
  assignToUserId?: string
  assignToTeam?: string
  /** Lower value = higher priority; rules are evaluated in order. */
  priority: number
}

// ── Custom Fields ────────────────────────────────────────────

/** Definition of a custom field that can be added to tickets. */
export interface CustomField {
  id: string
  name: string
  label: string
  type: CustomFieldType
  required: boolean
  /** For select/multiselect types. */
  options?: string[]
  defaultValue?: string | string[] | boolean | number
  helpText?: string
  placeholder?: string
  visibleToRoles: ('employee' | 'agent' | 'admin')[]
  /** Department/TicketType names. Empty = visible to all departments. */
  visibleToDepartments?: string[]
  order: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}
