-- ============================================================================
-- 001_initial_schema.sql
-- Initial database schema for SFMC Internal Help Desk Portal
-- A Zendesk-replacement help desk for a mortgage lending company
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TRIGGER FUNCTION: auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE: branches
-- Physical office branches of the mortgage lending company
-- ============================================================================

CREATE TABLE branches (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    location   text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: regions
-- Geographic regions that group branches together
-- ============================================================================

CREATE TABLE regions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    location   text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: teams
-- Functional teams that tickets can be assigned to
-- ============================================================================

CREATE TABLE teams (
    id         text PRIMARY KEY,
    name       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: profiles
-- Extends Clerk auth users with app-specific fields.
-- PK is the Clerk user ID (text), not a uuid.
-- ============================================================================

CREATE TABLE profiles (
    id                   text PRIMARY KEY,            -- Clerk user ID
    email                text UNIQUE NOT NULL,
    name                 text NOT NULL,
    role                 text NOT NULL CHECK (role IN ('employee', 'agent', 'admin')),
    avatar_url           text,
    department           text,
    departments          text[],
    team_ids             text[],
    branch_id            uuid REFERENCES branches (id) ON DELETE SET NULL,
    region_id            uuid REFERENCES regions (id) ON DELETE SET NULL,
    is_out_of_office     boolean NOT NULL DEFAULT false,
    ticket_types_handled text[],
    has_regional_access  boolean NOT NULL DEFAULT false,
    managed_region_id    uuid REFERENCES regions (id) ON DELETE SET NULL,
    has_branch_access    boolean NOT NULL DEFAULT false,
    managed_branch_id    uuid REFERENCES branches (id) ON DELETE SET NULL,
    created_at           timestamptz NOT NULL DEFAULT NOW(),
    updated_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEQUENCE: ticket IDs in T-XXXX format, starting at T-1001
-- ============================================================================

CREATE SEQUENCE ticket_id_seq START 1001;

-- ============================================================================
-- TABLE: tickets
-- Core help desk tickets with T-XXXX formatted IDs
-- ============================================================================

CREATE TABLE tickets (
    id               text PRIMARY KEY DEFAULT 'T-' || nextval('ticket_id_seq'),
    title            text NOT NULL,
    description      text NOT NULL,
    status           text NOT NULL DEFAULT 'new'
                         CHECK (status IN ('new', 'open', 'pending', 'on_hold', 'solved')),
    priority         text NOT NULL DEFAULT 'medium'
                         CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    category         text NOT NULL,
    ticket_type      text,
    sub_category     text,
    created_by       text NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
    assigned_to      text REFERENCES profiles (id) ON DELETE SET NULL,
    assigned_team    text REFERENCES teams (id) ON DELETE SET NULL,
    visibility       text NOT NULL DEFAULT 'public'
                         CHECK (visibility IN ('public', 'internal', 'restricted')),
    internal_notes   text,
    parent_ticket_id text REFERENCES tickets (id) ON DELETE SET NULL,
    merged_into_id   text REFERENCES tickets (id) ON DELETE SET NULL,
    mailing_address  jsonb,
    created_at       timestamptz NOT NULL DEFAULT NOW(),
    updated_at       timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: ticket_cc
-- Users CC'd on a ticket (receive notifications on all public replies)
-- ============================================================================

CREATE TABLE ticket_cc (
    ticket_id text NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    user_id   text NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, user_id)
);

-- ============================================================================
-- TABLE: ticket_collaborators
-- Internal collaborators on a ticket (agents working together)
-- ============================================================================

CREATE TABLE ticket_collaborators (
    ticket_id text NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    user_id   text NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, user_id)
);

-- ============================================================================
-- TABLE: ticket_merged
-- Tracks which tickets have been merged into a parent ticket
-- ============================================================================

CREATE TABLE ticket_merged (
    parent_ticket_id text NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    merged_ticket_id text NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    merged_at        timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (parent_ticket_id, merged_ticket_id)
);

-- ============================================================================
-- TABLE: messages
-- Threaded replies and internal notes on tickets
-- ============================================================================

CREATE TABLE messages (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id     text NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    author_id     text NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
    content       text NOT NULL,
    is_internal   boolean NOT NULL DEFAULT false,
    tagged_agents text[],
    created_at    timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: attachments
-- Files attached to tickets or individual messages, with versioning support
-- ============================================================================

CREATE TABLE attachments (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id     text NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    message_id    uuid REFERENCES messages (id) ON DELETE SET NULL,
    file_name     text NOT NULL,
    file_size     bigint NOT NULL,
    file_type     text NOT NULL,
    uploaded_by   text NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
    storage_path  text NOT NULL,
    version       integer NOT NULL DEFAULT 1,
    version_group text,
    is_final      boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: custom_fields
-- Admin-defined custom fields that can appear on tickets
-- ============================================================================

CREATE TABLE custom_fields (
    id                       text PRIMARY KEY,
    name                     text UNIQUE NOT NULL,
    label                    text NOT NULL,
    field_type               text NOT NULL
                                 CHECK (field_type IN (
                                     'text', 'textarea', 'select',
                                     'multiselect', 'checkbox', 'date', 'number'
                                 )),
    required                 boolean NOT NULL DEFAULT false,
    options                  text[],
    default_value            jsonb,
    help_text                text,
    placeholder              text,
    visible_to_roles         text[],
    visible_to_departments   text[],
    sort_order               integer NOT NULL DEFAULT 0,
    enabled                  boolean NOT NULL DEFAULT true,
    created_at               timestamptz NOT NULL DEFAULT NOW(),
    updated_at               timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_custom_fields_updated_at
    BEFORE UPDATE ON custom_fields
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: custom_field_values
-- Per-ticket values for custom fields
-- ============================================================================

CREATE TABLE custom_field_values (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id text NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    field_id  text NOT NULL REFERENCES custom_fields (id) ON DELETE CASCADE,
    value     jsonb,
    UNIQUE (ticket_id, field_id)
);

-- ============================================================================
-- TABLE: sla_policies
-- Service Level Agreement policies with condition matching and time metrics
-- ============================================================================

CREATE TABLE sla_policies (
    id         text PRIMARY KEY,
    name       text NOT NULL,
    enabled    boolean NOT NULL DEFAULT true,
    conditions jsonb NOT NULL DEFAULT '{}',
    metrics    jsonb NOT NULL DEFAULT '{}',
    sort_order integer NOT NULL DEFAULT 0,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_sla_policies_updated_at
    BEFORE UPDATE ON sla_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: department_schedules
-- Business hours and holiday calendars per department
-- ============================================================================

CREATE TABLE department_schedules (
    id              text PRIMARY KEY,
    department_name text NOT NULL,
    timezone        text NOT NULL DEFAULT 'America/Chicago',
    business_hours  jsonb NOT NULL DEFAULT '[]',
    holidays        jsonb NOT NULL DEFAULT '[]',
    enabled         boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT NOW(),
    updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_department_schedules_updated_at
    BEFORE UPDATE ON department_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: view_configs
-- Saved ticket list views (system defaults and user-created custom views)
-- ============================================================================

CREATE TABLE view_configs (
    id            text PRIMARY KEY,
    name          text NOT NULL,
    enabled       boolean NOT NULL DEFAULT true,
    group_name    text,
    filter_config jsonb NOT NULL DEFAULT '{}',
    sort_order    integer NOT NULL DEFAULT 0,
    is_custom     boolean NOT NULL DEFAULT false,
    created_by    text REFERENCES profiles (id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT NOW(),
    updated_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_view_configs_updated_at
    BEFORE UPDATE ON view_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: canned_responses
-- Pre-written reply templates with optional auto-actions
-- ============================================================================

CREATE TABLE canned_responses (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    content     text NOT NULL,
    category    text,
    actions     jsonb,
    is_personal boolean NOT NULL DEFAULT false,
    created_by  text REFERENCES profiles (id) ON DELETE SET NULL,
    usage_count integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT NOW(),
    updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_canned_responses_updated_at
    BEFORE UPDATE ON canned_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: routing_rules
-- Automatic ticket assignment rules evaluated by priority order
-- ============================================================================

CREATE TABLE routing_rules (
    id              text PRIMARY KEY,
    name            text NOT NULL,
    enabled         boolean NOT NULL DEFAULT true,
    ticket_type     text,
    category        text,
    assign_to_user  text REFERENCES profiles (id) ON DELETE SET NULL,
    assign_to_team  text REFERENCES teams (id) ON DELETE SET NULL,
    priority_order  integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT NOW(),
    updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_routing_rules_updated_at
    BEFORE UPDATE ON routing_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: department_categories
-- Allowed category/sub-category combinations per ticket type
-- ============================================================================

CREATE TABLE department_categories (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_type    text NOT NULL,
    category_name  text NOT NULL,
    sub_categories text[],
    sort_order     integer NOT NULL DEFAULT 0,
    UNIQUE (ticket_type, category_name)
);

-- ============================================================================
-- TABLE: notifications
-- In-app notifications for tagging, collaboration, SLA alerts, etc.
-- ============================================================================

CREATE TABLE notifications (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type         text NOT NULL
                     CHECK (type IN ('tagged', 'collaborator_added', 'reply_on_tagged', 'sla_at_risk')),
    ticket_id    text REFERENCES tickets (id) ON DELETE CASCADE,
    ticket_title text,
    from_user_id text,
    to_user_id   text NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    message      text,
    read         boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: branding_config
-- Singleton row (id must equal 1) for portal branding / white-labeling
-- ============================================================================

CREATE TABLE branding_config (
    id                   integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    logo_url             text,
    logo_alt             text,
    company_name         text,
    portal_subtitle      text,
    primary_color        text,
    accent_color         text,
    logo_background      text,
    logo_background_color text,
    created_at           timestamptz NOT NULL DEFAULT NOW(),
    updated_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_branding_config_updated_at
    BEFORE UPDATE ON branding_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INDEXES
-- Performance indexes for the most common query patterns
-- ============================================================================

-- Tickets: filter/sort by status, lookup by assignee, creator, and team
CREATE INDEX idx_tickets_status        ON tickets (status);
CREATE INDEX idx_tickets_assigned_to   ON tickets (assigned_to)   WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_tickets_created_by    ON tickets (created_by);
CREATE INDEX idx_tickets_assigned_team ON tickets (assigned_team) WHERE assigned_team IS NOT NULL;

-- Messages: fetch conversation thread for a ticket
CREATE INDEX idx_messages_ticket_id ON messages (ticket_id);

-- Notifications: fetch unread notifications for a user
CREATE INDEX idx_notifications_to_user_id ON notifications (to_user_id);

-- Attachments: lookup by ticket and by message
CREATE INDEX idx_attachments_ticket_id  ON attachments (ticket_id);
CREATE INDEX idx_attachments_message_id ON attachments (message_id) WHERE message_id IS NOT NULL;

-- Custom field values: lookup by ticket
CREATE INDEX idx_custom_field_values_ticket_id ON custom_field_values (ticket_id);

-- Routing rules: evaluate in priority order
CREATE INDEX idx_routing_rules_priority_order ON routing_rules (priority_order) WHERE enabled = true;

-- ============================================================================
-- ROW LEVEL SECURITY
-- Enable RLS on all tables. Policies will be defined in a separate migration.
-- ============================================================================

ALTER TABLE branches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_cc             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_collaborators  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_merged         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields         ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_configs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE canned_responses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_rules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_config       ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
