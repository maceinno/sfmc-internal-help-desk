// ============================================================================
// Core domain types for the SFMC Internal Help Desk Portal
// Field names use snake_case to match Supabase column names directly.
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

// ── Interfaces (snake_case to match DB) ─────────────────────

/** A file attached to a ticket or message. */
export interface Attachment {
  id: string
  file_name: string
  file_size: number
  file_type: string
  uploaded_by: string
  created_at: string
  storage_path: string
  url?: string
  version?: number
  version_group?: string
  is_final?: boolean
  message_id?: string
  ticket_id?: string
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
  avatar_url?: string
  department?: string
  departments?: string[]
  team_ids?: string[]
  branch_id?: string
  region_id?: string
  is_out_of_office?: boolean
  ticket_types_handled?: TicketType[]
  has_regional_access?: boolean
  managed_region_id?: string
  has_branch_access?: boolean
  managed_branch_id?: string
  timezone?: string
}

/** A single message within a ticket conversation thread. */
export interface Message {
  id: string
  ticket_id?: string
  author_id: string
  content: string
  created_at: string
  is_internal: boolean
  attachments?: Attachment[]
  tagged_agents?: string[]
}

/** A field value stored on a ticket for a given custom field. */
export interface CustomFieldValue {
  field_id: string
  value: string | string[] | boolean | number | null
}

/** The core ticket entity representing a help-desk request. */
export interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory | string
  created_by: string
  assigned_to?: string
  assigned_team?: string
  cc?: string[]
  collaborators?: string[]
  created_at: string
  updated_at: string
  messages?: Message[]
  attachments?: Attachment[]
  ticket_type?: TicketType | string
  sub_category?: string
  internal_notes?: string
  visibility?: TicketVisibility
  parent_ticket_id?: string
  custom_fields?: CustomFieldValue[]
  merged_into_id?: string
  merged_ticket_ids?: string[]
  mailing_address?: {
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
  ticket_id: string
  ticket_title: string
  from_user_id: string
  to_user_id: string
  message: string
  read: boolean
  created_at: string
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
  group_name: string
  filter_config: ViewFilterConfig
  sort_order: number
  is_custom?: boolean
}

// ── SLA Types ────────────────────────────────────────────────

export interface SlaPolicyConditions {
  ticketTypes: TicketType[] | 'any'
  categories: TicketCategory[] | 'any'
  priorities: TicketPriority[] | 'any'
  subCategories?: string[] | 'any'
}

export interface SlaPolicyMetrics {
  firstReplyHours: number
  nextReplyHours: number
  warningThreshold?: number
}

export interface SlaPolicy {
  id: string
  name: string
  enabled: boolean
  conditions: SlaPolicyConditions
  metrics: SlaPolicyMetrics
  sort_order: number
  is_default?: boolean
}

// ── Schedule Types ───────────────────────────────────────────

export interface BusinessHoursEntry {
  day: DayOfWeek
  enabled: boolean
  startTime: string
  endTime: string
}

export interface Holiday {
  id: string
  name: string
  date: string
}

export interface DepartmentSchedule {
  id: string
  department_name: string
  timezone: string
  business_hours: BusinessHoursEntry[]
  holidays: Holiday[]
  enabled: boolean
}

// ── Canned Responses ─────────────────────────────────────────

export interface CannedResponseAction {
  setStatus?: TicketStatus
  setPriority?: TicketPriority
  setTeam?: string
  setCategory?: string
  addInternalNote?: string
}

export interface CannedResponse {
  id: string
  name: string
  content: string
  category?: string
  actions?: CannedResponseAction
  is_personal?: boolean
  created_by?: string
  usage_count?: number
}

// ── Routing ──────────────────────────────────────────────────

export interface RoutingRule {
  id: string
  name: string
  enabled: boolean
  ticket_type: string | 'any'
  category: string | 'any'
  assign_to_user?: string
  assign_to_team?: string
  priority_order: number
}

// ── Custom Fields ────────────────────────────────────────────

export interface CustomField {
  id: string
  name: string
  label: string
  field_type: CustomFieldType
  required: boolean
  options?: string[]
  default_value?: string | string[] | boolean | number
  help_text?: string
  placeholder?: string
  visible_to_roles: ('employee' | 'agent' | 'admin')[]
  visible_to_departments?: string[]
  sort_order: number
  enabled: boolean
  created_at?: string
  updated_at?: string
}
