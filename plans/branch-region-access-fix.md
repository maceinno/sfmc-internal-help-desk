# Branch + Region Access Fix & Multi-Branch Support

**Author:** Liene  
**Date:** 2026-04-30  
**Status:** Proposal — awaiting Shawn's review

---

## Problem

1. **Bug:** When an employee is given BOTH branch access AND region access, the "My Region" page shows "Unauthorized — You do not have regional manager access." The sidebar shows both links (My Branch + My Region), but clicking My Region errors out.

2. **Feature request:** Employees in Region Aldridge need to also view a specific branch from another region. Currently `managed_branch_id` is a single value — users can only manage one branch.

---

## Root Cause Analysis

### Bug: Branch + Region access conflict

The guard in `src/app/(portal)/region/page.tsx:39` checks:
```ts
if (!profile?.has_regional_access || !profile?.managed_region_id)
```

The middleware in `src/middleware.ts:114-119` checks:
```ts
if (!metadata?.hasRegionalAccess) { redirect }
```

**Hypothesis:** When an admin enables both branch AND region access and saves, the `managed_region_id` field may not be getting saved correctly, OR the Clerk metadata sync (`/api/users/sync-clerk`) only syncs `hasBranchAccess` and `hasRegionalAccess` booleans but the page-level check also requires `managed_region_id` to be non-null. The middleware lets the user through (boolean is true), but the page component rejects them (managed_region_id is empty).

**To verify:** Check the Supabase `profiles` row for the affected user — does `managed_region_id` have a value?

### Feature: Single branch limitation

The `User` type has:
- `branch_id?: string` — the user's own branch
- `managed_branch_id?: string` — the single branch they can manage

Both are single values. No array support exists.

---

## Proposed Changes

### Phase 1: Bug Fix (ship immediately)

**No DB migration needed.** Just fix the admin save logic and page guards.

| File | Change |
|------|--------|
| `admin/users/page.tsx` | Ensure enabling branch access doesn't clear region fields and vice versa (verify the save payload) |
| `region/page.tsx` | Improve error message — show which field is missing (has_regional_access vs managed_region_id) for easier debugging |
| `branch/page.tsx` | Same improvement |

### Phase 2: Multi-Branch Support (requires DB migration)

| File | Change |
|------|--------|
| **DB migration** | Add `managed_branch_ids text[]` column to `profiles` table. Backfill from existing `managed_branch_id`. |
| `src/types/ticket.ts` | Add `managed_branch_ids?: string[]` to `User` interface |
| `src/lib/permissions/policies.ts` | Update `ticketMatchesBranch()` to check if creator/assignee branch is in `managed_branch_ids` array (fall back to `managed_branch_id` for backward compat) |
| `src/lib/permissions/policies.ts` | Update `canViewBranchTickets()` and `filterBranchTickets()` similarly |
| `src/app/(portal)/branch/page.tsx` | Show tickets from ALL managed branches, update title to show branch names |
| `src/app/(portal)/admin/users/page.tsx` | Replace single branch manager select with multi-select chip toggle (like teams) |
| `src/components/layout/sidebar.tsx` | Show "My Branch" if `managed_branch_ids` has entries OR `managed_branch_id` is set |
| `src/app/api/users/sync-clerk/route.ts` | No change needed (only syncs boolean flags) |

### Data Model Change

```
Current:
  managed_branch_id: string | null    (single branch)

Proposed:
  managed_branch_ids: string[] | null  (array of branches)
  managed_branch_id: string | null     (keep for backward compat, deprecated)
```

The migration SQL:
```sql
ALTER TABLE profiles ADD COLUMN managed_branch_ids text[];

-- Backfill from existing single value
UPDATE profiles
SET managed_branch_ids = ARRAY[managed_branch_id]
WHERE managed_branch_id IS NOT NULL;
```

---

## Questions for Shawn

1. **Phase 1 bug:** Can you check the Supabase `profiles` row for the affected user? Does `managed_region_id` have a value when both branch and region access are enabled?

2. **Phase 2 multi-branch:** Are you OK with adding a `managed_branch_ids text[]` column? Or would you prefer a junction table (`user_managed_branches`)?

3. **Backward compat:** Should we keep `managed_branch_id` as a deprecated field that auto-populates from `managed_branch_ids[0]`, or drop it entirely?

4. **Scope:** Should we also support multiple managed regions (`managed_region_ids`), or is that not needed?

---

## Files Touched (Full List)

### Phase 1 (bug fix only)
- `src/app/(portal)/admin/users/page.tsx`
- `src/app/(portal)/region/page.tsx`
- `src/app/(portal)/branch/page.tsx`

### Phase 2 (multi-branch)
- `supabase/migrations/012_managed_branch_ids.sql`
- `src/types/ticket.ts`
- `src/lib/permissions/policies.ts`
- `src/app/(portal)/branch/page.tsx`
- `src/app/(portal)/admin/users/page.tsx`
- `src/components/layout/sidebar.tsx`
