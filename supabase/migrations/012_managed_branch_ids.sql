-- Migration: Add managed_branch_ids array column for multi-branch access
-- This allows users to manage multiple branches simultaneously.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS managed_branch_ids text[];

-- Backfill: copy existing single managed_branch_id into the new array column
UPDATE profiles
SET managed_branch_ids = ARRAY[managed_branch_id]
WHERE managed_branch_id IS NOT NULL
  AND managed_branch_ids IS NULL;
