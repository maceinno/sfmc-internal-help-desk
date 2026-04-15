-- ============================================================================
-- 004_test_data.sql
-- Test data for verifying all views and features
-- Run via Supabase SQL Editor (uses service role, bypasses RLS)
-- ============================================================================

BEGIN;

-- ============================================================================
-- TEST PROFILES (fake Clerk IDs — agents & employees for ticket variety)
-- ============================================================================

INSERT INTO profiles (id, email, name, role, department, team_ids) VALUES
  ('test-agent-1',    'maria.santos@sfmchl.test',   'Maria Santos',    'agent',    'IT Support',        ARRAY['team-it']),
  ('test-agent-2',    'james.chen@sfmchl.test',      'James Chen',      'agent',    'Lending Support',   ARRAY['team-lending']),
  ('test-agent-3',    'emily.brooks@sfmchl.test',    'Emily Brooks',    'agent',    'Closing Support',   ARRAY['team-closing']),
  ('test-agent-4',    'devon.wright@sfmchl.test',    'Devon Wright',    'agent',    'Secondary Support', ARRAY['team-secondary']),
  ('test-agent-5',    'priya.patel@sfmchl.test',     'Priya Patel',     'agent',    'Marketing Support', ARRAY['team-marketing']),
  ('test-employee-1', 'laura.martinez@sfmchl.test',  'Laura Martinez',  'employee', 'Loan Origination',  NULL),
  ('test-employee-2', 'kevin.thompson@sfmchl.test',  'Kevin Thompson',  'employee', 'Loan Origination',  NULL),
  ('test-employee-3', 'sarah.johnson@sfmchl.test',   'Sarah Johnson',   'employee', 'Closing',           NULL),
  ('test-employee-4', 'brian.nguyen@sfmchl.test',    'Brian Nguyen',    'employee', 'Servicing',         NULL),
  ('test-employee-5', 'ashley.rogers@sfmchl.test',   'Ashley Rogers',   'employee', 'Compliance',        NULL)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- TICKETS  (30 tickets across all types, statuses, priorities)
-- ============================================================================

-- Temporarily override the sequence so test IDs are predictable
-- (the sequence auto-generates, so we just let it run)

-- ── IT Support tickets ─────────────────────────────────────────

INSERT INTO tickets (title, description, status, priority, category, ticket_type, sub_category, created_by, assigned_to, assigned_team, created_at) VALUES
  ('Laptop won''t boot after update',
   'My laptop is stuck on a black screen after the Windows update pushed last night. Can''t get past the loading spinner. I have a closing call in 2 hours.',
   'new', 'urgent', 'Hardware Issue', 'IT Support', 'Laptop',
   'test-employee-1', NULL, 'team-it',
   NOW() - INTERVAL '15 minutes'),

  ('Need access to MeridianLink Mortgage',
   'New LO starting Monday — please provision MeridianLink Mortgage access for Kevin Thompson. Manager approved.',
   'open', 'high', 'Add Access', 'IT Support', 'MeridianLink Mortgage',
   'test-employee-2', 'test-agent-1', 'team-it',
   NOW() - INTERVAL '3 hours'),

  ('Password reset for FHA Connection',
   'Locked out of FHA Connection after too many failed attempts. Need reset ASAP — have a VA loan that needs conditions cleared today.',
   'solved', 'medium', 'Password Reset', 'IT Support', 'FHA Connection',
   'test-employee-3', 'test-agent-1', 'team-it',
   NOW() - INTERVAL '2 days'),

  ('Request new docking station for home office',
   'Working from home 3 days/week now. Need a USB-C docking station that supports dual monitors. Currently using a single monitor setup.',
   'pending', 'low', 'Hardware Request', 'IT Support', 'Docking Station',
   'test-employee-4', 'test-agent-1', 'team-it',
   NOW() - INTERVAL '5 days'),

  ('Email distribution list — add new team member',
   'Please add ashley.rogers@sfmchl.test to the Compliance-Alerts distribution list.',
   'open', 'low', 'Email Distribution List', 'IT Support', 'Add Member',
   'test-employee-5', 'test-agent-1', 'team-it',
   NOW() - INTERVAL '1 day'),

-- ── Lending Support tickets ────────────────────────────────────

  ('Condition dispute on LN-2026-04521',
   'Underwriter added a condition for employment verification but we already have the VOE on file. Loan is supposed to close next week. Please review and remove.',
   'open', 'high', 'Condition Dispute', 'Lending Support', NULL,
   'test-employee-1', 'test-agent-2', 'team-lending',
   NOW() - INTERVAL '6 hours'),

  ('Income opinion needed for self-employed borrower',
   'Borrower is self-employed with 2 years of tax returns showing declining income. Need senior UW opinion on whether we can use the higher year. Loan amount $425,000.',
   'new', 'medium', 'Income Opinion', 'Lending Support', NULL,
   'test-employee-2', NULL, 'team-lending',
   NOW() - INTERVAL '30 minutes'),

  ('Exception request — DTI above guideline',
   'Requesting DTI exception for conventional loan. DTI at 49.2% (guideline is 45%). Strong compensating factors: 780 FICO, 30% down payment, 12 months reserves.',
   'pending', 'high', 'Exception Request', 'Lending Support', NULL,
   'test-employee-1', 'test-agent-2', 'team-lending',
   NOW() - INTERVAL '2 days'),

  ('Condo review for Seaside Towers unit 4B',
   'Need condo project review for Seaside Towers HOA. Have the condo questionnaire and budget. Complex has 120 units, 85% owner-occupied.',
   'on_hold', 'medium', 'Condo Review', 'Lending Support', NULL,
   'test-employee-2', 'test-agent-2', 'team-lending',
   NOW() - INTERVAL '4 days'),

  ('Funding issue — wire not received',
   'Loan LN-2026-03998 was supposed to fund yesterday. Title company says wire hasn''t arrived. Borrower is locked out of their new home. URGENT.',
   'open', 'urgent', 'Funding Closing Issue', 'Lending Support', NULL,
   'test-employee-3', 'test-agent-2', 'team-lending',
   NOW() - INTERVAL '2 hours'),

-- ── Closing Support tickets ────────────────────────────────────

  ('Move closing date from 4/20 to 4/25',
   'Borrower requested to push closing 5 days due to travel. Lock expires 4/28 so we should be fine. Loan LN-2026-04100.',
   'new', 'medium', 'Move Closing Date', 'Closing Support', NULL,
   'test-employee-1', NULL, 'team-closing',
   NOW() - INTERVAL '45 minutes'),

  ('POA approval needed for deployed military borrower',
   'Co-borrower is active duty military deployed overseas. Have limited POA from JAG office. Need approval to proceed with signing via POA. Lock expires in 10 days.',
   'open', 'high', 'POA Approval', 'Closing Support', NULL,
   'test-employee-2', 'test-agent-3', 'team-closing',
   NOW() - INTERVAL '1 day'),

  ('ICD early release request',
   'Requesting early release of ICD for loan LN-2026-03875. All conditions cleared, just waiting on final title policy which title company says will be ready tomorrow.',
   'pending', 'medium', 'ICD Release', 'Closing Support', 'Early Release',
   'test-employee-3', 'test-agent-3', 'team-closing',
   NOW() - INTERVAL '3 days'),

  ('Escrow adjustment — property taxes changed',
   'County reassessed property taxes from $4,200 to $5,100/year. Need escrow recalculation before closing. Closing scheduled for 4/22.',
   'open', 'high', 'Escrow Adjustments', 'Closing Support', NULL,
   'test-employee-1', 'test-agent-3', 'team-closing',
   NOW() - INTERVAL '8 hours'),

  ('Post closing — missing recorded deed',
   'Closed 3 weeks ago but county recorder hasn''t returned the deed. Title company following up. Need status update for the file.',
   'solved', 'low', 'Post Closing', 'Closing Support', NULL,
   'test-employee-4', 'test-agent-3', 'team-closing',
   NOW() - INTERVAL '7 days'),

-- ── Secondary Support tickets ──────────────────────────────────

  ('Lock extension request — 7 days',
   'Need 7-day lock extension on LN-2026-04200. Appraisal came in low and we''re disputing. Current lock expires 4/18.',
   'new', 'urgent', 'Extension', 'Secondary Support', NULL,
   'test-employee-1', NULL, 'team-secondary',
   NOW() - INTERVAL '1 hour'),

  ('Pricing exception — jumbo loan',
   'Requesting 25bps pricing exception on jumbo loan $1.2M. Borrower has competing offer from Chase at 6.25%. Our rate is 6.50%.',
   'open', 'high', 'Pricing Exception', 'Secondary Support', NULL,
   'test-employee-2', 'test-agent-4', 'team-secondary',
   NOW() - INTERVAL '4 hours'),

  ('Bond lock request for first-time homebuyer',
   'Borrower qualifies for state HFA bond program. Income at 78% of AMI. Need bond lock at today''s rate. Property in qualifying census tract.',
   'pending', 'medium', 'Bond Lock Request', 'Secondary Support', NULL,
   'test-employee-3', 'test-agent-4', 'team-secondary',
   NOW() - INTERVAL '1 day'),

  ('Loan structure revision — before CTC',
   'Need to restructure from 30-yr fixed to 7/1 ARM per borrower request. Loan is in processing, no CTC yet. Will the rate improve?',
   'open', 'medium', 'Loan Structure Revision', 'Secondary Support', 'Before CTC',
   'test-employee-1', 'test-agent-4', 'team-secondary',
   NOW() - INTERVAL '2 days'),

-- ── Marketing Support tickets ──────────────────────────────────

  ('Need new business cards — title change',
   'I was promoted to Senior Loan Officer. Need updated business cards with new title. Same contact info otherwise. Order 500 please.',
   'new', 'medium', 'Graphic Design', 'Marketing Support', NULL,
   'test-employee-1', NULL, 'team-marketing',
   NOW() - INTERVAL '2 hours'),

  ('CRM campaign for spring purchase season',
   'Want to set up a drip campaign targeting pre-approved borrowers who haven''t locked yet. Have a list of ~200 contacts. Need help with copy and scheduling.',
   'open', 'medium', 'CRM', 'Marketing Support', NULL,
   'test-employee-2', 'test-agent-5', 'team-marketing',
   NOW() - INTERVAL '3 days'),

  ('Update branch page on company website',
   'Our Downtown branch moved to a new address. Need the website updated with new address, phone number, and updated Google Maps embed.',
   'solved', 'low', 'Web', 'Marketing Support', NULL,
   'test-employee-3', 'test-agent-5', 'team-marketing',
   NOW() - INTERVAL '10 days'),

-- ── Payoff Request tickets ─────────────────────────────────────

  ('Payoff statement for LN-2024-01822',
   'Borrower is refinancing with another lender. Need 30-day payoff statement. Current UPB approximately $287,000.',
   'new', 'medium', 'SFMC Payoff', 'Payoff Request', 'Traditional',
   'test-employee-4', NULL, 'team-payoff',
   NOW() - INTERVAL '3 hours'),

  ('Payment history for tax purposes',
   'Borrower needs full 2025 payment history for their tax accountant. Loan LN-2023-09441.',
   'solved', 'low', 'Payment History', 'Payoff Request', NULL,
   'test-employee-5', 'test-agent-4', 'team-payoff',
   NOW() - INTERVAL '6 days'),

-- ── Product Desk tickets ───────────────────────────────────────

  ('Bank statement program — borrower qualification',
   'Self-employed borrower, 2 years in business. 12 months bank statements show avg monthly deposits of $18,500. Need guidance on max loan amount for bank statement program.',
   'open', 'medium', 'Bank Statement', 'Product Desk (Non-Agency Products)', NULL,
   'test-employee-1', 'test-agent-4', 'team-product-desk',
   NOW() - INTERVAL '5 hours'),

  ('DSCR loan — investment property',
   'Investor purchasing 4-unit property. Projected rent $6,400/mo, PITIA estimated $5,200/mo. DSCR = 1.23. Is this eligible? Max LTV?',
   'new', 'high', 'DSCR', 'Product Desk (Non-Agency Products)', NULL,
   'test-employee-2', NULL, 'team-product-desk',
   NOW() - INTERVAL '90 minutes'),

-- ── Tickets assigned to Shawn (your admin account) ─────────────

  ('System-wide email template update',
   'Need to update all automated email templates to use the new company branding. Logo, colors, and footer text all need changes.',
   'open', 'medium', 'Communications', 'Marketing Support', NULL,
   'test-employee-1', 'user_3COscNBqp3YCoINRT5r2QWjlfy0', 'team-marketing',
   NOW() - INTERVAL '1 day'),

  ('New hire onboarding — full access setup',
   'New loan processor starting Monday 4/20. Need full system access: MeridianLink, DocMagic, Halcyon, Microsoft, Intranet, Zoom. Manager: Laura Martinez.',
   'new', 'high', 'New Hire', 'IT Support', NULL,
   'test-employee-2', 'user_3COscNBqp3YCoINRT5r2QWjlfy0', 'team-it',
   NOW() - INTERVAL '4 hours'),

  ('Compliance review — unusual loan structure',
   'Need compliance sign-off on a loan with multiple co-borrowers across two properties. Want to make sure we''re not running afoul of any regs before proceeding.',
   'on_hold', 'high', 'General Question', 'Closing Support', NULL,
   'test-employee-5', 'user_3COscNBqp3YCoINRT5r2QWjlfy0', 'team-closing',
   NOW() - INTERVAL '3 days'),

-- ── Ticket created by Shawn ────────────────────────────────────

  ('Deploy help desk portal to production',
   'Final testing complete. Need to coordinate production deployment of the new help desk portal. Verify DNS, SSL, and webhook configuration.',
   'open', 'urgent', 'Install Software', 'IT Support', NULL,
   'user_3COscNBqp3YCoINRT5r2QWjlfy0', 'test-agent-1', 'team-it',
   NOW() - INTERVAL '12 hours')

ON CONFLICT DO NOTHING;


-- ============================================================================
-- MESSAGES  (replies on various tickets to test conversation threads)
-- ============================================================================

-- Get ticket IDs dynamically — they use the T-XXXX sequence
-- We'll insert messages referencing the tickets by matching on title

-- Messages on the urgent laptop ticket
INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'test-agent-1',
  'Looking into this now. Can you tell me the laptop model and which Windows update was applied? Also, have you tried holding the power button for 30 seconds and restarting?',
  false, NOW() - INTERVAL '10 minutes'
FROM tickets t WHERE t.title = 'Laptop won''t boot after update';

INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'test-employee-1',
  'It''s a Dell Latitude 5540. I tried the hard reset — it boots to the Dell logo but then goes black again. The update was KB5034441.',
  false, NOW() - INTERVAL '5 minutes'
FROM tickets t WHERE t.title = 'Laptop won''t boot after update';

-- Messages on the condition dispute
INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'test-agent-2',
  'I checked the file — the VOE is from March 2026, so it''s within the 120-day window. Sending this back to UW to have the condition removed.',
  false, NOW() - INTERVAL '4 hours'
FROM tickets t WHERE t.title = 'Condition dispute on LN-2026-04521';

INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'test-agent-2',
  'Internal note: UW team confirmed they missed the VOE in the file. Condition will be removed by EOD.',
  true, NOW() - INTERVAL '3 hours'
FROM tickets t WHERE t.title = 'Condition dispute on LN-2026-04521';

-- Messages on the funding issue (urgent)
INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'test-agent-2',
  'Checking with the wire room now. What''s the title company name and their wire instructions?',
  false, NOW() - INTERVAL '1 hour'
FROM tickets t WHERE t.title = 'Funding issue — wire not received';

INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'test-employee-3',
  'Title company is Pacific Coast Title, Escrow Officer: Janet Kim. I''ll send the wire instructions in a follow-up message.',
  false, NOW() - INTERVAL '50 minutes'
FROM tickets t WHERE t.title = 'Funding issue — wire not received';

-- Messages on the solved password reset ticket
INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'test-agent-1',
  'Password has been reset. Your temporary password has been sent to your email. Please change it on first login. Let me know if you have any issues.',
  false, NOW() - INTERVAL '1 day'
FROM tickets t WHERE t.title = 'Password reset for FHA Connection';

INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'test-employee-3',
  'Got it — I''m logged in now. Thanks for the quick turnaround!',
  false, NOW() - INTERVAL '1 day' + INTERVAL '2 hours'
FROM tickets t WHERE t.title = 'Password reset for FHA Connection';

-- Messages on Shawn's assigned ticket
INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'test-employee-1',
  'Here are the new brand assets: logo, color palette, and updated footer copy. All attached to the shared drive link in the ticket description.',
  false, NOW() - INTERVAL '20 hours'
FROM tickets t WHERE t.title = 'System-wide email template update';

INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'user_3COscNBqp3YCoINRT5r2QWjlfy0',
  'Thanks! I''ll start updating the templates today. Should have the first batch done by EOD.',
  false, NOW() - INTERVAL '18 hours'
FROM tickets t WHERE t.title = 'System-wide email template update';

-- Messages on the deploy ticket (created by Shawn)
INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'test-agent-1',
  'DNS records have been updated. SSL cert is provisioned. Webhook endpoint is configured and responding. Ready for final go-ahead.',
  false, NOW() - INTERVAL '6 hours'
FROM tickets t WHERE t.title = 'Deploy help desk portal to production';

-- Messages on POA approval
INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'test-agent-3',
  'I''ve reviewed the limited POA from JAG. It covers real property transactions and specifically mentions the subject property address. Forwarding to legal for final sign-off.',
  false, NOW() - INTERVAL '18 hours'
FROM tickets t WHERE t.title = 'POA approval needed for deployed military borrower';

-- Messages on the pricing exception
INSERT INTO messages (ticket_id, author_id, content, is_internal, created_at)
SELECT t.id, 'test-agent-4',
  'Checking with the rate desk. With $1.2M balance and a competing offer, we may be able to get 15-20bps. Will update by 3pm.',
  false, NOW() - INTERVAL '3 hours'
FROM tickets t WHERE t.title = 'Pricing exception — jumbo loan';


-- ============================================================================
-- TICKET CC  (a few CC entries to test the CC tickets view)
-- ============================================================================

INSERT INTO ticket_cc (ticket_id, user_id)
SELECT t.id, 'user_3COscNBqp3YCoINRT5r2QWjlfy0'
FROM tickets t WHERE t.title = 'Funding issue — wire not received';

INSERT INTO ticket_cc (ticket_id, user_id)
SELECT t.id, 'user_3COscNBqp3YCoINRT5r2QWjlfy0'
FROM tickets t WHERE t.title = 'Condition dispute on LN-2026-04521';

INSERT INTO ticket_cc (ticket_id, user_id)
SELECT t.id, 'user_3COscNBqp3YCoINRT5r2QWjlfy0'
FROM tickets t WHERE t.title = 'Lock extension request — 7 days';

INSERT INTO ticket_cc (ticket_id, user_id)
SELECT t.id, 'test-agent-2'
FROM tickets t WHERE t.title = 'Funding issue — wire not received';

INSERT INTO ticket_cc (ticket_id, user_id)
SELECT t.id, 'test-agent-3'
FROM tickets t WHERE t.title = 'POA approval needed for deployed military borrower';


-- ============================================================================
-- NOTIFICATIONS  (test the notification panel)
-- ============================================================================

INSERT INTO notifications (type, ticket_id, ticket_title, from_user_id, to_user_id, message, read, created_at)
SELECT 'tagged', t.id, t.title, 'test-agent-2', 'user_3COscNBqp3YCoINRT5r2QWjlfy0',
  'James Chen tagged you in a comment on this ticket', false, NOW() - INTERVAL '2 hours'
FROM tickets t WHERE t.title = 'Funding issue — wire not received';

INSERT INTO notifications (type, ticket_id, ticket_title, from_user_id, to_user_id, message, read, created_at)
SELECT 'collaborator_added', t.id, t.title, 'test-agent-4', 'user_3COscNBqp3YCoINRT5r2QWjlfy0',
  'You were added as a collaborator', false, NOW() - INTERVAL '4 hours'
FROM tickets t WHERE t.title = 'Lock extension request — 7 days';

INSERT INTO notifications (type, ticket_id, ticket_title, from_user_id, to_user_id, message, read, created_at)
SELECT 'reply_on_tagged', t.id, t.title, 'test-employee-1', 'user_3COscNBqp3YCoINRT5r2QWjlfy0',
  'Laura Martinez replied to a ticket you''re tagged in', false, NOW() - INTERVAL '1 hour'
FROM tickets t WHERE t.title = 'Condition dispute on LN-2026-04521';

INSERT INTO notifications (type, ticket_id, ticket_title, from_user_id, to_user_id, message, read, created_at)
SELECT 'sla_at_risk', t.id, t.title, NULL, 'user_3COscNBqp3YCoINRT5r2QWjlfy0',
  'SLA is at risk — first reply deadline approaching', false, NOW() - INTERVAL '30 minutes'
FROM tickets t WHERE t.title = 'New hire onboarding — full access setup';


COMMIT;
