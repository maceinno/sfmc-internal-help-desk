-- ============================================================================
-- 003_seed_data.sql
-- Seed data migration — ported from prototype config.ts
-- ============================================================================

BEGIN;

-- ============================================================================
-- TEAMS
-- ============================================================================

INSERT INTO teams (id, name) VALUES
  ('team-closing',      'Closing Support'),
  ('team-it',           'IT Support'),
  ('team-lending',      'Lending Support'),
  ('team-marketing',    'Marketing Support'),
  ('team-payoff',       'Payoff Request'),
  ('team-product-desk', 'Product Desk (Non-Agency Products)'),
  ('team-secondary',    'Secondary Support')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- BRANCHES
-- ============================================================================

INSERT INTO branches (name, location) VALUES
  ('Downtown Branch', 'San Francisco, CA'),
  ('Midtown Office',  'San Francisco, CA'),
  ('East Bay Branch',  'Oakland, CA'),
  ('Corporate HQ',    'San Francisco, CA')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- REGIONS
-- ============================================================================

INSERT INTO regions (name, location) VALUES
  ('Aldridge',  'Aldridge Region'),
  ('Donnelly',  'Donnelly Region'),
  ('Corporate', 'Corporate Region'),
  ('GW',        'GW Region')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- DEPARTMENT CATEGORIES  (hierarchical categories per ticket type)
-- ============================================================================

-- Closing Support
INSERT INTO department_categories (ticket_type, category_name, sub_categories) VALUES
  ('Closing Support', 'Closing Exceptions', NULL),
  ('Closing Support', 'Escrow Adjustments', NULL),
  ('Closing Support', 'General Question',   NULL),
  ('Closing Support', 'ICD Release',        ARRAY['Early Release', 'Early Balance']),
  ('Closing Support', 'Move Closing Date',  NULL),
  ('Closing Support', 'POA Approval',       NULL),
  ('Closing Support', 'Post Closing',       NULL);

-- IT Support
INSERT INTO department_categories (ticket_type, category_name, sub_categories) VALUES
  ('IT Support', 'DynaSend Signature',     NULL),
  ('IT Support', 'Email Distribution List', ARRAY['Create', 'Delete', 'Add Member', 'Remove Member', 'Issue']),
  ('IT Support', 'Forward Email',          NULL),
  ('IT Support', 'Hardware Issue',         ARRAY['Laptop', 'Keyboard/Mouse', 'Webcam', 'Docking Station', 'Monitor']),
  ('IT Support', 'Hardware Request',       ARRAY['Laptop', 'Keyboard/Mouse', 'Webcam', 'Docking Station', 'Monitor']),
  ('IT Support', 'Install Software',       NULL),
  ('IT Support', 'Add Access',            ARRAY['Bank VOD', 'CANDID', 'Certified Credit', 'CreditXpert', 'DataVerify (DRIVE)', 'Desktop Underwriter (FNMA)', 'DocMagic', 'eFAX', 'FHA Connection', 'Halcyon', 'Intranet', 'MeridianLink Mortgage', 'Microsoft', 'Nitro', 'USDA', 'VA', 'ValuTrac', 'Zoom']),
  ('IT Support', 'New Hire',              NULL),
  ('IT Support', 'Password Reset',        ARRAY['Bank VOD', 'CANDID', 'Certified Credit', 'CreditXpert', 'DataVerify (DRIVE)', 'Desktop Underwriter (FNMA)', 'DocMagic', 'eFAX', 'FHA Connection', 'Halcyon', 'Intranet', 'MeridianLink Mortgage', 'Microsoft', 'Nitro', 'USDA', 'VA', 'ValuTrac', 'Zoom']),
  ('IT Support', 'Remove Access',         ARRAY['Bank VOD', 'CANDID', 'Certified Credit', 'CreditXpert', 'DataVerify (DRIVE)', 'Desktop Underwriter (FNMA)', 'DocMagic', 'eFAX', 'FHA Connection', 'Halcyon', 'Intranet', 'MeridianLink Mortgage', 'Microsoft', 'Nitro', 'USDA', 'VA', 'ValuTrac', 'Zoom']),
  ('IT Support', 'Modify Access',         ARRAY['Bank VOD', 'CANDID', 'Certified Credit', 'CreditXpert', 'DataVerify (DRIVE)', 'Desktop Underwriter (FNMA)', 'DocMagic', 'eFAX', 'FHA Connection', 'Halcyon', 'Intranet', 'MeridianLink Mortgage', 'Microsoft', 'Nitro', 'USDA', 'VA', 'ValuTrac', 'Zoom']),
  ('IT Support', 'Shared Mailbox',        NULL),
  ('IT Support', 'Termination',           NULL),
  ('IT Support', 'Transfer / Title Change', NULL),
  ('IT Support', 'Unblock Website',       NULL);

-- Lending Support
INSERT INTO department_categories (ticket_type, category_name, sub_categories) VALUES
  ('Lending Support', 'Condition Dispute',            NULL),
  ('Lending Support', 'Condo Review',                 NULL),
  ('Lending Support', 'Exception Request',            NULL),
  ('Lending Support', 'Funding Closing Issue',        NULL),
  ('Lending Support', 'Income Opinion',               NULL),
  ('Lending Support', 'Loan Status Change',           NULL),
  ('Lending Support', 'Opinion General',              NULL),
  ('Lending Support', 'Post Closing Audit',           ARRAY['Prior to Purchase', 'Post Purchase']),
  ('Lending Support', 'Pre-Approval Certified Buyer', NULL),
  ('Lending Support', 'PTS Condition Review',         NULL),
  ('Lending Support', 'Trained Validation',           NULL);

-- Marketing Support
INSERT INTO department_categories (ticket_type, category_name, sub_categories) VALUES
  ('Marketing Support', 'Communications',   NULL),
  ('Marketing Support', 'CRM',              NULL),
  ('Marketing Support', 'Graphic Design',   NULL),
  ('Marketing Support', 'Swag/Promo Items', NULL),
  ('Marketing Support', 'Web',              NULL),
  ('Marketing Support', 'Other',            NULL);

-- Payoff Request
INSERT INTO department_categories (ticket_type, category_name, sub_categories) VALUES
  ('Payoff Request', 'Mortgage Billing Statement', NULL),
  ('Payoff Request', 'Payment History',            NULL),
  ('Payoff Request', 'SFMC Payoff',                ARRAY['Net Escrow', 'Traditional']);

-- Product Desk (Non-Agency Products)
INSERT INTO department_categories (ticket_type, category_name, sub_categories) VALUES
  ('Product Desk (Non-Agency Products)', 'Bank Statement', NULL),
  ('Product Desk (Non-Agency Products)', 'DSCR',           NULL),
  ('Product Desk (Non-Agency Products)', 'Not Certain',    NULL),
  ('Product Desk (Non-Agency Products)', 'Other Product',  NULL);

-- Secondary Support
INSERT INTO department_categories (ticket_type, category_name, sub_categories) VALUES
  ('Secondary Support', 'Bond Lock Request',            NULL),
  ('Secondary Support', 'Extension',                    NULL),
  ('Secondary Support', 'Lender Credit',                NULL),
  ('Secondary Support', 'Loan Structure Revision',      ARRAY['Before CTC', 'After CTC']),
  ('Secondary Support', 'PML/Quick Pricer',             NULL),
  ('Secondary Support', 'Post Closing Issue',           NULL),
  ('Secondary Support', 'Pricing Exception',            NULL),
  ('Secondary Support', 'Specialty Program Lock Request',ARRAY['Buydown', 'Reverse', 'Wholesale']),
  ('Secondary Support', 'Specialty Term Adjustment',    NULL);


-- ============================================================================
-- SLA POLICIES  (25 policies)
-- ============================================================================

INSERT INTO sla_policies (id, name, enabled, conditions, metrics, sort_order, is_default) VALUES
  -- IT Support
  ('sla-it-urgent',
   'IT Support — Critical',
   true,
   '{"ticketTypes": ["IT Support"], "categories": ["IT Systems"], "priorities": ["urgent", "high"]}'::jsonb,
   '{"firstReplyHours": 1, "nextReplyHours": 2}'::jsonb,
   0, true),

  ('sla-it-standard',
   'IT Support — Standard',
   true,
   '{"ticketTypes": ["IT Support"], "categories": ["IT Systems"], "priorities": ["medium", "low"]}'::jsonb,
   '{"firstReplyHours": 4, "nextReplyHours": 8}'::jsonb,
   1, true),

  -- Closing Support
  ('sla-closing',
   'Closing Support',
   true,
   '{"ticketTypes": ["Closing Support"], "categories": ["Closing"], "priorities": "any"}'::jsonb,
   '{"firstReplyHours": 4, "nextReplyHours": 8}'::jsonb,
   2, true),

  -- Lending Support — Per-Category SLAs
  ('sla-lending-funding-closing',
   'Lending — Funding Closing Issue',
   true,
   '{"ticketTypes": ["Lending Support"], "categories": "any", "priorities": "any", "subCategories": ["Funding Closing Issue"]}'::jsonb,
   '{"firstReplyHours": 1, "nextReplyHours": 2}'::jsonb,
   3, true),

  ('sla-lending-loan-status',
   'Lending — Loan Status Change',
   true,
   '{"ticketTypes": ["Lending Support"], "categories": "any", "priorities": "any", "subCategories": ["Loan Status Change"]}'::jsonb,
   '{"firstReplyHours": 1, "nextReplyHours": 2}'::jsonb,
   4, true),

  ('sla-lending-condition-dispute',
   'Lending — Condition Dispute',
   true,
   '{"ticketTypes": ["Lending Support"], "categories": "any", "priorities": "any", "subCategories": ["Condition Dispute"]}'::jsonb,
   '{"firstReplyHours": 4, "nextReplyHours": 8}'::jsonb,
   5, true),

  ('sla-lending-pre-approval',
   'Lending — Pre-Approval Certified Buyer',
   true,
   '{"ticketTypes": ["Lending Support"], "categories": "any", "priorities": "any", "subCategories": ["Pre-Approval Certified Buyer"]}'::jsonb,
   '{"firstReplyHours": 4, "nextReplyHours": 8}'::jsonb,
   6, true),

  ('sla-lending-trained-validation',
   'Lending — Trained Validation',
   true,
   '{"ticketTypes": ["Lending Support"], "categories": "any", "priorities": "any", "subCategories": ["Trained Validation"]}'::jsonb,
   '{"firstReplyHours": 4, "nextReplyHours": 8}'::jsonb,
   7, true),

  ('sla-lending-income-opinion',
   'Lending — Income Opinion',
   true,
   '{"ticketTypes": ["Lending Support"], "categories": "any", "priorities": "any", "subCategories": ["Income Opinion"]}'::jsonb,
   '{"firstReplyHours": 8, "nextReplyHours": 16}'::jsonb,
   8, true),

  ('sla-lending-opinion-general',
   'Lending — Opinion General',
   true,
   '{"ticketTypes": ["Lending Support"], "categories": "any", "priorities": "any", "subCategories": ["Opinion General"]}'::jsonb,
   '{"firstReplyHours": 8, "nextReplyHours": 16}'::jsonb,
   9, true),

  ('sla-lending-post-closing-audit',
   'Lending — Post Closing Audit',
   true,
   '{"ticketTypes": ["Lending Support"], "categories": "any", "priorities": "any", "subCategories": ["Post Closing Audit"]}'::jsonb,
   '{"firstReplyHours": 8, "nextReplyHours": 16}'::jsonb,
   10, true),

  ('sla-lending-pts-condition',
   'Lending — PTS Condition Review',
   true,
   '{"ticketTypes": ["Lending Support"], "categories": "any", "priorities": "any", "subCategories": ["PTS Condition Review"]}'::jsonb,
   '{"firstReplyHours": 8, "nextReplyHours": 16}'::jsonb,
   11, true),

  ('sla-lending-exception',
   'Lending — Exception Request',
   true,
   '{"ticketTypes": ["Lending Support"], "categories": "any", "priorities": "any", "subCategories": ["Exception Request"]}'::jsonb,
   '{"firstReplyHours": 8, "nextReplyHours": 16}'::jsonb,
   12, true),

  ('sla-lending-condo-review',
   'Lending — Condo Review',
   true,
   '{"ticketTypes": ["Lending Support"], "categories": "any", "priorities": "any", "subCategories": ["Condo Review"]}'::jsonb,
   '{"firstReplyHours": 32, "nextReplyHours": 32}'::jsonb,
   13, true),

  ('sla-lending-fallback',
   'Lending Support — Default',
   true,
   '{"ticketTypes": ["Lending Support"], "categories": ["Loan Origination", "Underwriting"], "priorities": "any"}'::jsonb,
   '{"firstReplyHours": 8, "nextReplyHours": 16}'::jsonb,
   14, true),

  -- Secondary Support
  ('sla-secondary',
   'Secondary Support',
   true,
   '{"ticketTypes": ["Secondary Support"], "categories": "any", "priorities": "any"}'::jsonb,
   '{"firstReplyHours": 2, "nextReplyHours": 4}'::jsonb,
   20, true),

  -- Payoff Request
  ('sla-payoff',
   'Payoff Request',
   true,
   '{"ticketTypes": ["Payoff Request"], "categories": ["Servicing"], "priorities": "any"}'::jsonb,
   '{"firstReplyHours": 4, "nextReplyHours": 8}'::jsonb,
   21, true),

  -- Product Desk
  ('sla-product-desk',
   'Product Desk',
   true,
   '{"ticketTypes": ["Product Desk (Non-Agency Products)"], "categories": "any", "priorities": "any"}'::jsonb,
   '{"firstReplyHours": 4, "nextReplyHours": 8}'::jsonb,
   22, true),

  -- Marketing Support
  ('sla-marketing',
   'Marketing Support',
   true,
   '{"ticketTypes": ["Marketing Support"], "categories": "any", "priorities": "any"}'::jsonb,
   '{"firstReplyHours": 8, "nextReplyHours": 24}'::jsonb,
   23, true),

  -- Compliance
  ('sla-compliance',
   'Compliance',
   true,
   '{"ticketTypes": "any", "categories": ["Compliance"], "priorities": "any"}'::jsonb,
   '{"firstReplyHours": 4, "nextReplyHours": 8}'::jsonb,
   24, true),

  -- Default (catch-all)
  ('sla-default',
   'Default Policy',
   true,
   '{"ticketTypes": "any", "categories": "any", "priorities": "any"}'::jsonb,
   '{"firstReplyHours": 8, "nextReplyHours": 24}'::jsonb,
   99, true)

ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- DEPARTMENT SCHEDULES  (business hours per ticket-type department)
-- ============================================================================

-- Shared holiday list (stored as JSONB inside each schedule row)
-- Shared default business hours for most departments

INSERT INTO department_schedules (id, department_name, timezone, business_hours, holidays, enabled) VALUES
  ('sched-closing',
   'Closing Support',
   'America/New_York',
   '[
     {"day": "monday",    "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "tuesday",   "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "wednesday", "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "thursday",  "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "friday",    "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "saturday",  "enabled": false, "startTime": "09:00", "endTime": "13:00"},
     {"day": "sunday",    "enabled": false, "startTime": "09:00", "endTime": "13:00"}
   ]'::jsonb,
   '[
     {"id": "h1",  "name": "New Year''s Day",              "date": "2026-01-01"},
     {"id": "h2",  "name": "Martin Luther King Jr. Day",   "date": "2026-01-19"},
     {"id": "h3",  "name": "Presidents'' Day",             "date": "2026-02-16"},
     {"id": "h4",  "name": "Memorial Day",                 "date": "2026-05-25"},
     {"id": "h5",  "name": "Independence Day",             "date": "2026-07-04"},
     {"id": "h6",  "name": "Labor Day",                    "date": "2026-09-07"},
     {"id": "h7",  "name": "Thanksgiving Day",             "date": "2026-11-26"},
     {"id": "h8",  "name": "Day After Thanksgiving",       "date": "2026-11-27"},
     {"id": "h9",  "name": "Christmas Eve",                "date": "2026-12-24"},
     {"id": "h10", "name": "Christmas Day",                "date": "2026-12-25"}
   ]'::jsonb,
   true),

  ('sched-it',
   'IT Support',
   'America/New_York',
   '[
     {"day": "monday",    "enabled": true,  "startTime": "07:00", "endTime": "19:00"},
     {"day": "tuesday",   "enabled": true,  "startTime": "07:00", "endTime": "19:00"},
     {"day": "wednesday", "enabled": true,  "startTime": "07:00", "endTime": "19:00"},
     {"day": "thursday",  "enabled": true,  "startTime": "07:00", "endTime": "19:00"},
     {"day": "friday",    "enabled": true,  "startTime": "07:00", "endTime": "19:00"},
     {"day": "saturday",  "enabled": true,  "startTime": "09:00", "endTime": "14:00"},
     {"day": "sunday",    "enabled": false, "startTime": "09:00", "endTime": "13:00"}
   ]'::jsonb,
   '[
     {"id": "h1",  "name": "New Year''s Day",              "date": "2026-01-01"},
     {"id": "h2",  "name": "Martin Luther King Jr. Day",   "date": "2026-01-19"},
     {"id": "h3",  "name": "Presidents'' Day",             "date": "2026-02-16"},
     {"id": "h4",  "name": "Memorial Day",                 "date": "2026-05-25"},
     {"id": "h5",  "name": "Independence Day",             "date": "2026-07-04"},
     {"id": "h6",  "name": "Labor Day",                    "date": "2026-09-07"},
     {"id": "h7",  "name": "Thanksgiving Day",             "date": "2026-11-26"},
     {"id": "h8",  "name": "Day After Thanksgiving",       "date": "2026-11-27"},
     {"id": "h9",  "name": "Christmas Eve",                "date": "2026-12-24"},
     {"id": "h10", "name": "Christmas Day",                "date": "2026-12-25"}
   ]'::jsonb,
   true),

  ('sched-lending',
   'Lending Support',
   'America/New_York',
   '[
     {"day": "monday",    "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "tuesday",   "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "wednesday", "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "thursday",  "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "friday",    "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "saturday",  "enabled": false, "startTime": "09:00", "endTime": "13:00"},
     {"day": "sunday",    "enabled": false, "startTime": "09:00", "endTime": "13:00"}
   ]'::jsonb,
   '[
     {"id": "h1",  "name": "New Year''s Day",              "date": "2026-01-01"},
     {"id": "h2",  "name": "Martin Luther King Jr. Day",   "date": "2026-01-19"},
     {"id": "h3",  "name": "Presidents'' Day",             "date": "2026-02-16"},
     {"id": "h4",  "name": "Memorial Day",                 "date": "2026-05-25"},
     {"id": "h5",  "name": "Independence Day",             "date": "2026-07-04"},
     {"id": "h6",  "name": "Labor Day",                    "date": "2026-09-07"},
     {"id": "h7",  "name": "Thanksgiving Day",             "date": "2026-11-26"},
     {"id": "h8",  "name": "Day After Thanksgiving",       "date": "2026-11-27"},
     {"id": "h9",  "name": "Christmas Eve",                "date": "2026-12-24"},
     {"id": "h10", "name": "Christmas Day",                "date": "2026-12-25"}
   ]'::jsonb,
   true),

  ('sched-marketing',
   'Marketing Support',
   'America/New_York',
   '[
     {"day": "monday",    "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "tuesday",   "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "wednesday", "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "thursday",  "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "friday",    "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "saturday",  "enabled": false, "startTime": "09:00", "endTime": "13:00"},
     {"day": "sunday",    "enabled": false, "startTime": "09:00", "endTime": "13:00"}
   ]'::jsonb,
   '[
     {"id": "h1",  "name": "New Year''s Day",              "date": "2026-01-01"},
     {"id": "h2",  "name": "Martin Luther King Jr. Day",   "date": "2026-01-19"},
     {"id": "h3",  "name": "Presidents'' Day",             "date": "2026-02-16"},
     {"id": "h4",  "name": "Memorial Day",                 "date": "2026-05-25"},
     {"id": "h5",  "name": "Independence Day",             "date": "2026-07-04"},
     {"id": "h6",  "name": "Labor Day",                    "date": "2026-09-07"},
     {"id": "h7",  "name": "Thanksgiving Day",             "date": "2026-11-26"},
     {"id": "h8",  "name": "Day After Thanksgiving",       "date": "2026-11-27"},
     {"id": "h9",  "name": "Christmas Eve",                "date": "2026-12-24"},
     {"id": "h10", "name": "Christmas Day",                "date": "2026-12-25"}
   ]'::jsonb,
   true),

  ('sched-payoff',
   'Payoff Request',
   'America/New_York',
   '[
     {"day": "monday",    "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "tuesday",   "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "wednesday", "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "thursday",  "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "friday",    "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "saturday",  "enabled": false, "startTime": "09:00", "endTime": "13:00"},
     {"day": "sunday",    "enabled": false, "startTime": "09:00", "endTime": "13:00"}
   ]'::jsonb,
   '[
     {"id": "h1",  "name": "New Year''s Day",              "date": "2026-01-01"},
     {"id": "h2",  "name": "Martin Luther King Jr. Day",   "date": "2026-01-19"},
     {"id": "h3",  "name": "Presidents'' Day",             "date": "2026-02-16"},
     {"id": "h4",  "name": "Memorial Day",                 "date": "2026-05-25"},
     {"id": "h5",  "name": "Independence Day",             "date": "2026-07-04"},
     {"id": "h6",  "name": "Labor Day",                    "date": "2026-09-07"},
     {"id": "h7",  "name": "Thanksgiving Day",             "date": "2026-11-26"},
     {"id": "h8",  "name": "Day After Thanksgiving",       "date": "2026-11-27"},
     {"id": "h9",  "name": "Christmas Eve",                "date": "2026-12-24"},
     {"id": "h10", "name": "Christmas Day",                "date": "2026-12-25"}
   ]'::jsonb,
   true),

  ('sched-product-desk',
   'Product Desk (Non-Agency Products)',
   'America/New_York',
   '[
     {"day": "monday",    "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "tuesday",   "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "wednesday", "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "thursday",  "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "friday",    "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "saturday",  "enabled": false, "startTime": "09:00", "endTime": "13:00"},
     {"day": "sunday",    "enabled": false, "startTime": "09:00", "endTime": "13:00"}
   ]'::jsonb,
   '[
     {"id": "h1",  "name": "New Year''s Day",              "date": "2026-01-01"},
     {"id": "h2",  "name": "Martin Luther King Jr. Day",   "date": "2026-01-19"},
     {"id": "h3",  "name": "Presidents'' Day",             "date": "2026-02-16"},
     {"id": "h4",  "name": "Memorial Day",                 "date": "2026-05-25"},
     {"id": "h5",  "name": "Independence Day",             "date": "2026-07-04"},
     {"id": "h6",  "name": "Labor Day",                    "date": "2026-09-07"},
     {"id": "h7",  "name": "Thanksgiving Day",             "date": "2026-11-26"},
     {"id": "h8",  "name": "Day After Thanksgiving",       "date": "2026-11-27"},
     {"id": "h9",  "name": "Christmas Eve",                "date": "2026-12-24"},
     {"id": "h10", "name": "Christmas Day",                "date": "2026-12-25"}
   ]'::jsonb,
   true),

  ('sched-secondary',
   'Secondary Support',
   'America/New_York',
   '[
     {"day": "monday",    "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "tuesday",   "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "wednesday", "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "thursday",  "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "friday",    "enabled": true,  "startTime": "08:00", "endTime": "17:00"},
     {"day": "saturday",  "enabled": false, "startTime": "09:00", "endTime": "13:00"},
     {"day": "sunday",    "enabled": false, "startTime": "09:00", "endTime": "13:00"}
   ]'::jsonb,
   '[
     {"id": "h1",  "name": "New Year''s Day",              "date": "2026-01-01"},
     {"id": "h2",  "name": "Martin Luther King Jr. Day",   "date": "2026-01-19"},
     {"id": "h3",  "name": "Presidents'' Day",             "date": "2026-02-16"},
     {"id": "h4",  "name": "Memorial Day",                 "date": "2026-05-25"},
     {"id": "h5",  "name": "Independence Day",             "date": "2026-07-04"},
     {"id": "h6",  "name": "Labor Day",                    "date": "2026-09-07"},
     {"id": "h7",  "name": "Thanksgiving Day",             "date": "2026-11-26"},
     {"id": "h8",  "name": "Day After Thanksgiving",       "date": "2026-11-27"},
     {"id": "h9",  "name": "Christmas Eve",                "date": "2026-12-24"},
     {"id": "h10", "name": "Christmas Day",                "date": "2026-12-25"}
   ]'::jsonb,
   true)

ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- CANNED RESPONSES  (10 default responses)
-- ============================================================================

INSERT INTO canned_responses (id, name, content, category, actions, usage_count) VALUES
  ('cr1',
   'Acknowledge Receipt',
   E'Hi {{requester_name}},\n\nThank you for submitting this request. We have received your ticket (#{{ticket_id}}) and an agent will review it shortly. You can expect an initial response within our SLA timeframe.\n\nBest regards,\n{{agent_name}}',
   'General',
   '{"setStatus": "open"}'::jsonb,
   24),

  ('cr2',
   'Request More Info',
   E'Hi {{requester_name}},\n\nThank you for reaching out. To help resolve this issue, could you please provide the following additional information:\n\n1. Loan file number\n2. Borrower name(s)\n3. Specific error message or screenshot\n\nThis will help us investigate more efficiently.\n\nBest regards,\n{{agent_name}}',
   'General',
   '{"setStatus": "pending"}'::jsonb,
   31),

  ('cr3',
   'Escalating to IT',
   E'Hi {{requester_name}},\n\nThis issue requires investigation by our IT team. I am escalating this ticket now and will update you once we have more information. Expected turnaround is 2-4 hours.\n\nBest regards,\n{{agent_name}}',
   'Escalation',
   '{"setStatus": "open", "setTeam": "team-it", "addInternalNote": "Escalated to IT team for investigation."}'::jsonb,
   12),

  ('cr4',
   'Issue Resolved',
   E'Hi {{requester_name}},\n\nThe issue described in ticket #{{ticket_id}} has been resolved. Please verify on your end and let us know if you experience any further problems. We will close this ticket in 24 hours if no further response is received.\n\nBest regards,\n{{agent_name}}',
   'Resolution',
   '{"setStatus": "solved"}'::jsonb,
   45),

  ('cr5',
   'Pending Borrower Docs',
   E'Hi {{requester_name}},\n\nWe are currently waiting on documentation from the borrower to proceed. Once the required documents are uploaded to the portal, please update this ticket and we will continue processing.\n\nBest regards,\n{{agent_name}}',
   'General',
   '{"setStatus": "on_hold"}'::jsonb,
   18),

  ('cr6',
   'Compliance Review Required',
   E'Hi {{requester_name}},\n\nThis request requires a compliance review before we can proceed. Our compliance team has been notified and will review within 1 business day. No action is needed from you at this time.\n\nBest regards,\n{{agent_name}}',
   'Escalation',
   '{"setStatus": "pending"}'::jsonb,
   9),

  ('cr7',
   'Escalate to Closing Team',
   E'Hi {{requester_name}},\n\nI am routing this to our Closing Support team who can better assist with this request. They will follow up with you directly.\n\nBest regards,\n{{agent_name}}',
   'Escalation',
   '{"setStatus": "open", "setTeam": "team-closing", "addInternalNote": "Escalated to Closing Support team."}'::jsonb,
   7),

  ('cr8',
   'Mark as Urgent',
   E'Hi {{requester_name}},\n\nWe have flagged your request as urgent and it is being prioritized. A senior agent will be reviewing this shortly.\n\nBest regards,\n{{agent_name}}',
   'Resolution',
   '{"setPriority": "urgent", "setStatus": "open"}'::jsonb,
   5),

  ('cr9',
   'Follow Up - No Response',
   E'Hi {{requester_name}},\n\nWe are following up on ticket #{{ticket_id}}. We haven''t received a response to our last message. If the issue has been resolved, please let us know so we can close this ticket. Otherwise, please provide the requested information so we can continue assisting you.\n\nBest regards,\n{{agent_name}}',
   'General',
   NULL,
   22),

  ('cr10',
   'Password Reset Instructions',
   E'Hi {{requester_name}},\n\nTo reset your password:\n\n1. Go to the login page\n2. Click "Forgot Password"\n3. Enter your email address\n4. Check your inbox for the reset link (check spam if needed)\n5. Create a new password\n\nIf you continue to have issues, please let us know.\n\nBest regards,\n{{agent_name}}',
   'IT Support',
   '{"setStatus": "solved"}'::jsonb,
   33)

ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- VIEW CONFIGS  (static views + generated per-department views)
-- ============================================================================

INSERT INTO view_configs (id, name, enabled, group_name, filter_config, sort_order) VALUES

  -- ── My Queue ──────────────────────────────────────────────────
  ('my-new',
   'My New Tickets', true, 'My Queue',
   '{"statusFilter": "new", "assigneeFilter": "me", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   0),
  ('my-open',
   'My Open Tickets', true, 'My Queue',
   '{"statusFilter": "open", "assigneeFilter": "me", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   1),
  ('my-on-hold',
   'My On Hold Tickets', true, 'My Queue',
   '{"statusFilter": "on_hold", "assigneeFilter": "me", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   2),
  ('my-pending',
   'My Pending Tickets', true, 'My Queue',
   '{"statusFilter": "pending", "assigneeFilter": "me", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   3),
  ('my-unsolved',
   'My Unsolved', true, 'My Queue',
   '{"statusFilter": "any", "assigneeFilter": "me", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   4),

  -- ── By Status ─────────────────────────────────────────────────
  ('new-unassigned',
   'New (Unassigned)', true, 'By Status',
   '{"statusFilter": "new", "assigneeFilter": "unassigned", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   0),
  ('all-new',
   'All New Tickets', true, 'By Status',
   '{"statusFilter": "new", "assigneeFilter": "any", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   1),
  ('all-open',
   'All Open Tickets', true, 'By Status',
   '{"statusFilter": "open", "assigneeFilter": "any", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   2),
  ('pending',
   'Pending', true, 'By Status',
   '{"statusFilter": "pending", "assigneeFilter": "any", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   3),
  ('on-hold',
   'On Hold', true, 'By Status',
   '{"statusFilter": "on_hold", "assigneeFilter": "any", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   4),
  ('sla-at-risk',
   'SLA At Risk', true, 'By Status',
   '{"statusFilter": "any", "assigneeFilter": "any", "categoryFilter": "any", "slaFilter": "at-risk"}'::jsonb,
   5),
  ('sla-breached',
   'SLA Breached', true, 'By Status',
   '{"statusFilter": "any", "assigneeFilter": "any", "categoryFilter": "any", "slaFilter": "breached"}'::jsonb,
   6),
  ('solved',
   'Solved Tickets', true, 'By Status',
   '{"statusFilter": "solved", "assigneeFilter": "any", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   7),

  -- ── Loan Origination (generated department views) ─────────────
  ('loan-origination-new',
   'New Tickets', true, 'Loan Origination',
   '{"statusFilter": "new", "assigneeFilter": "any", "categoryFilter": "Loan Origination", "slaFilter": "any"}'::jsonb,
   0),
  ('loan-origination-open',
   'Open Tickets', true, 'Loan Origination',
   '{"statusFilter": "open", "assigneeFilter": "any", "categoryFilter": "Loan Origination", "slaFilter": "any"}'::jsonb,
   1),
  ('loan-origination-on-hold',
   'On Hold Tickets', true, 'Loan Origination',
   '{"statusFilter": "on_hold", "assigneeFilter": "any", "categoryFilter": "Loan Origination", "slaFilter": "any"}'::jsonb,
   2),
  ('loan-origination-pending',
   'Pending Tickets', true, 'Loan Origination',
   '{"statusFilter": "pending", "assigneeFilter": "any", "categoryFilter": "Loan Origination", "slaFilter": "any"}'::jsonb,
   3),
  ('loan-origination-unsolved',
   'Unsolved Tickets', true, 'Loan Origination',
   '{"statusFilter": "any", "assigneeFilter": "any", "categoryFilter": "Loan Origination", "slaFilter": "any"}'::jsonb,
   4),

  -- ── Underwriting (generated department views) ─────────────────
  ('underwriting-new',
   'New Tickets', true, 'Underwriting',
   '{"statusFilter": "new", "assigneeFilter": "any", "categoryFilter": "Underwriting", "slaFilter": "any"}'::jsonb,
   0),
  ('underwriting-open',
   'Open Tickets', true, 'Underwriting',
   '{"statusFilter": "open", "assigneeFilter": "any", "categoryFilter": "Underwriting", "slaFilter": "any"}'::jsonb,
   1),
  ('underwriting-on-hold',
   'On Hold Tickets', true, 'Underwriting',
   '{"statusFilter": "on_hold", "assigneeFilter": "any", "categoryFilter": "Underwriting", "slaFilter": "any"}'::jsonb,
   2),
  ('underwriting-pending',
   'Pending Tickets', true, 'Underwriting',
   '{"statusFilter": "pending", "assigneeFilter": "any", "categoryFilter": "Underwriting", "slaFilter": "any"}'::jsonb,
   3),
  ('underwriting-unsolved',
   'Unsolved Tickets', true, 'Underwriting',
   '{"statusFilter": "any", "assigneeFilter": "any", "categoryFilter": "Underwriting", "slaFilter": "any"}'::jsonb,
   4),

  -- ── Closing (generated department views) ──────────────────────
  ('closing-new',
   'New Tickets', true, 'Closing',
   '{"statusFilter": "new", "assigneeFilter": "any", "categoryFilter": "Closing", "slaFilter": "any"}'::jsonb,
   0),
  ('closing-open',
   'Open Tickets', true, 'Closing',
   '{"statusFilter": "open", "assigneeFilter": "any", "categoryFilter": "Closing", "slaFilter": "any"}'::jsonb,
   1),
  ('closing-on-hold',
   'On Hold Tickets', true, 'Closing',
   '{"statusFilter": "on_hold", "assigneeFilter": "any", "categoryFilter": "Closing", "slaFilter": "any"}'::jsonb,
   2),
  ('closing-pending',
   'Pending Tickets', true, 'Closing',
   '{"statusFilter": "pending", "assigneeFilter": "any", "categoryFilter": "Closing", "slaFilter": "any"}'::jsonb,
   3),
  ('closing-unsolved',
   'Unsolved Tickets', true, 'Closing',
   '{"statusFilter": "any", "assigneeFilter": "any", "categoryFilter": "Closing", "slaFilter": "any"}'::jsonb,
   4),

  -- ── Servicing (generated department views) ────────────────────
  ('servicing-new',
   'New Tickets', true, 'Servicing',
   '{"statusFilter": "new", "assigneeFilter": "any", "categoryFilter": "Servicing", "slaFilter": "any"}'::jsonb,
   0),
  ('servicing-open',
   'Open Tickets', true, 'Servicing',
   '{"statusFilter": "open", "assigneeFilter": "any", "categoryFilter": "Servicing", "slaFilter": "any"}'::jsonb,
   1),
  ('servicing-on-hold',
   'On Hold Tickets', true, 'Servicing',
   '{"statusFilter": "on_hold", "assigneeFilter": "any", "categoryFilter": "Servicing", "slaFilter": "any"}'::jsonb,
   2),
  ('servicing-pending',
   'Pending Tickets', true, 'Servicing',
   '{"statusFilter": "pending", "assigneeFilter": "any", "categoryFilter": "Servicing", "slaFilter": "any"}'::jsonb,
   3),
  ('servicing-unsolved',
   'Unsolved Tickets', true, 'Servicing',
   '{"statusFilter": "any", "assigneeFilter": "any", "categoryFilter": "Servicing", "slaFilter": "any"}'::jsonb,
   4),

  -- ── Compliance (generated department views) ───────────────────
  ('compliance-new',
   'New Tickets', true, 'Compliance',
   '{"statusFilter": "new", "assigneeFilter": "any", "categoryFilter": "Compliance", "slaFilter": "any"}'::jsonb,
   0),
  ('compliance-open',
   'Open Tickets', true, 'Compliance',
   '{"statusFilter": "open", "assigneeFilter": "any", "categoryFilter": "Compliance", "slaFilter": "any"}'::jsonb,
   1),
  ('compliance-on-hold',
   'On Hold Tickets', true, 'Compliance',
   '{"statusFilter": "on_hold", "assigneeFilter": "any", "categoryFilter": "Compliance", "slaFilter": "any"}'::jsonb,
   2),
  ('compliance-pending',
   'Pending Tickets', true, 'Compliance',
   '{"statusFilter": "pending", "assigneeFilter": "any", "categoryFilter": "Compliance", "slaFilter": "any"}'::jsonb,
   3),
  ('compliance-unsolved',
   'Unsolved Tickets', true, 'Compliance',
   '{"statusFilter": "any", "assigneeFilter": "any", "categoryFilter": "Compliance", "slaFilter": "any"}'::jsonb,
   4),

  -- ── IT Systems (generated department views) ───────────────────
  ('it-systems-new',
   'New Tickets', true, 'IT Systems',
   '{"statusFilter": "new", "assigneeFilter": "any", "categoryFilter": "IT Systems", "slaFilter": "any"}'::jsonb,
   0),
  ('it-systems-open',
   'Open Tickets', true, 'IT Systems',
   '{"statusFilter": "open", "assigneeFilter": "any", "categoryFilter": "IT Systems", "slaFilter": "any"}'::jsonb,
   1),
  ('it-systems-on-hold',
   'On Hold Tickets', true, 'IT Systems',
   '{"statusFilter": "on_hold", "assigneeFilter": "any", "categoryFilter": "IT Systems", "slaFilter": "any"}'::jsonb,
   2),
  ('it-systems-pending',
   'Pending Tickets', true, 'IT Systems',
   '{"statusFilter": "pending", "assigneeFilter": "any", "categoryFilter": "IT Systems", "slaFilter": "any"}'::jsonb,
   3),
  ('it-systems-unsolved',
   'Unsolved Tickets', true, 'IT Systems',
   '{"statusFilter": "any", "assigneeFilter": "any", "categoryFilter": "IT Systems", "slaFilter": "any"}'::jsonb,
   4),

  -- ── General (generated department views) ──────────────────────
  ('general-new',
   'New Tickets', true, 'General',
   '{"statusFilter": "new", "assigneeFilter": "any", "categoryFilter": "General", "slaFilter": "any"}'::jsonb,
   0),
  ('general-open',
   'Open Tickets', true, 'General',
   '{"statusFilter": "open", "assigneeFilter": "any", "categoryFilter": "General", "slaFilter": "any"}'::jsonb,
   1),
  ('general-on-hold',
   'On Hold Tickets', true, 'General',
   '{"statusFilter": "on_hold", "assigneeFilter": "any", "categoryFilter": "General", "slaFilter": "any"}'::jsonb,
   2),
  ('general-pending',
   'Pending Tickets', true, 'General',
   '{"statusFilter": "pending", "assigneeFilter": "any", "categoryFilter": "General", "slaFilter": "any"}'::jsonb,
   3),
  ('general-unsolved',
   'Unsolved Tickets', true, 'General',
   '{"statusFilter": "any", "assigneeFilter": "any", "categoryFilter": "General", "slaFilter": "any"}'::jsonb,
   4),

  -- ── Other ─────────────────────────────────────────────────────
  ('recently-updated',
   'Recently Updated', true, 'Other',
   '{"statusFilter": "any", "assigneeFilter": "any", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   0),
  ('all-unsolved',
   'All Unsolved', true, 'Other',
   '{"statusFilter": "any", "assigneeFilter": "any", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   1),
  ('by-agent',
   'By Agent View', true, 'Other',
   '{"statusFilter": "any", "assigneeFilter": "assigned", "categoryFilter": "any", "slaFilter": "any"}'::jsonb,
   2)

ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- ROUTING RULES  (8 rules)
-- ============================================================================

INSERT INTO routing_rules (id, name, enabled, ticket_type, category, assign_to_team, priority_order) VALUES
  ('rr-it',
   'IT Support to IT Support Team',
   true, 'IT Support', 'any', 'team-it', 1),

  ('rr-closing',
   'Closing Support to Closing Support Team',
   true, 'Closing Support', 'any', 'team-closing', 2),

  ('rr-lending',
   'Lending Support to Lending Support Team',
   true, 'Lending Support', 'any', 'team-lending', 3),

  ('rr-compliance',
   'Compliance to Secondary Support',
   true, 'any', 'Compliance', 'team-secondary', 4),

  ('rr-marketing',
   'Marketing Support to Marketing Support Team',
   true, 'Marketing Support', 'any', 'team-marketing', 5),

  ('rr-payoff',
   'Payoff Request to Payoff Request Team',
   true, 'Payoff Request', 'any', 'team-payoff', 6),

  ('rr-product-desk',
   'Product Desk to Product Desk Team',
   true, 'Product Desk (Non-Agency Products)', 'any', 'team-product-desk', 7),

  ('rr-secondary',
   'Secondary Support to Secondary Support Team',
   true, 'Secondary Support', 'any', 'team-secondary', 8)

ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- CUSTOM FIELDS  (8 fields)
-- ============================================================================

INSERT INTO custom_fields (id, name, label, field_type, required, options, placeholder, help_text, visible_to_roles, visible_to_departments, sort_order, enabled) VALUES
  ('custom-loan-number',
   'loan_number', 'Loan Number', 'text', true,
   NULL,
   'e.g., LN-2024-12345',
   'Enter the loan file number from your system',
   ARRAY['agent', 'admin'],
   NULL,
   0, true),

  ('custom-loan-type',
   'loan_type', 'Loan Type', 'select', true,
   ARRAY['Conventional', 'FHA', 'VA', 'USDA', 'Jumbo', 'Non-QM', 'Reverse Mortgage'],
   NULL,
   'Select the type of loan being processed',
   ARRAY['agent', 'admin'],
   ARRAY['Lending Support', 'Closing Support'],
   1, true),

  ('custom-loan-amount',
   'loan_amount', 'Loan Amount', 'number', false,
   NULL,
   '350000',
   'Enter the loan amount in dollars (without commas or symbols)',
   ARRAY['agent', 'admin'],
   NULL,
   2, true),

  ('custom-close-date',
   'expected_close_date', 'Expected Close Date', 'date', false,
   NULL,
   NULL,
   'When is this loan scheduled to close?',
   ARRAY['agent', 'admin'],
   ARRAY['Closing Support'],
   3, true),

  ('custom-rush',
   'rush_processing', 'Rush Processing Required', 'checkbox', false,
   NULL,
   NULL,
   'Check if this ticket requires expedited handling',
   ARRAY['agent', 'admin'],
   NULL,
   4, true),

  ('custom-borrower-name',
   'borrower_name', 'Borrower Name', 'text', false,
   NULL,
   'John Smith',
   'Primary borrower name on the loan',
   ARRAY['agent', 'admin'],
   NULL,
   5, true),

  ('custom-property-address',
   'property_address', 'Property Address', 'textarea', false,
   NULL,
   '123 Main St, City, State ZIP',
   'Full property address for the loan',
   ARRAY['agent', 'admin'],
   NULL,
   6, true),

  ('custom-branch',
   'branch_location', 'Branch Location', 'select', false,
   ARRAY['Corporate HQ', 'North Branch', 'South Branch', 'East Branch', 'West Branch', 'Remote'],
   NULL,
   'Which branch is handling this loan?',
   ARRAY['agent', 'admin'],
   ARRAY['Lending Support', 'Marketing Support'],
   7, true)

ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- BRANDING CONFIG
-- ============================================================================

INSERT INTO branding_config (id, company_name, portal_subtitle, primary_color, accent_color, logo_background, logo_background_color)
VALUES (1, 'SFMC Home Lending', 'Internal Support Portal', '#2563eb', '#7c3aed', 'white', '#1e293b')
ON CONFLICT (id) DO NOTHING;


COMMIT;
