-- ============================================================================
-- Custom field display conditions
-- ----------------------------------------------------------------------------
-- Lets admins show a custom field only when other ticket fields match certain
-- criteria (Zendesk-style conditional formatting).
--
-- Shape of the `conditions` JSONB column when set:
--
--   {
--     "mode": "all" | "any",            -- AND vs OR across rules
--     "rules": [
--       {
--         "field":    "ticketType" | "category" | "subCategory" | "priority",
--         "operator": "equals" | "notEquals" | "in" | "notIn"
--                     | "isEmpty" | "isNotEmpty",
--         "value":    string | string[] | null
--       }
--     ]
--   }
--
-- NULL or missing `conditions` means the field is always shown (subject to
-- the existing role / department visibility filters).
-- ============================================================================

ALTER TABLE custom_fields
    ADD COLUMN IF NOT EXISTS conditions jsonb;

COMMENT ON COLUMN custom_fields.conditions IS
    'Optional display conditions evaluated against the ticket form state. '
    'See migration 005 for shape. NULL means always show.';
