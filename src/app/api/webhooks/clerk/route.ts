import { Webhook } from "svix";
import { headers } from "next/headers";
import type { UserJSON, WebhookEvent } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Clerk Webhook Handler
// ---------------------------------------------------------------------------
// Receives user lifecycle events from Clerk and syncs them to the Supabase
// `profiles` table so the rest of the app can query user data via Supabase.
//
// Required env var: CLERK_WEBHOOK_SECRET
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[clerk-webhook] Missing CLERK_WEBHOOK_SECRET env var");
    return new Response("Server misconfigured", { status: 500 });
  }

  // ── Verify the webhook signature ──────────────────────────────────────────
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("[clerk-webhook] Missing svix headers");
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await request.text();

  const wh = new Webhook(webhookSecret);
  let event: WebhookEvent;

  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("[clerk-webhook] Signature verification failed:", err);
    return new Response("Webhook verification failed", { status: 400 });
  }

  // ── Route by event type ───────────────────────────────────────────────────
  const eventType = event.type;
  console.log(`[clerk-webhook] Received event: ${eventType}`);

  try {
    switch (eventType) {
      case "user.created":
      case "user.updated":
        await handleUserUpsert(eventType, event.data);
        break;
      case "user.deleted":
        await handleUserDeleted(event.data);
        break;
      default:
        console.log(`[clerk-webhook] Unhandled event type: ${eventType}`);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error(`[clerk-webhook] Error handling ${eventType}:`, err);
    return new Response("Internal error", { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the primary email from Clerk's user data.
 */
function getPrimaryEmail(data: UserJSON): string | null {
  if (!data.email_addresses || data.email_addresses.length === 0) return null;

  if (data.primary_email_address_id) {
    const primary = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    );
    if (primary) return primary.email_address;
  }

  // Fallback to the first email.
  return data.email_addresses[0].email_address;
}

/**
 * Build the full name from first + last, falling back to email.
 */
function getFullName(data: UserJSON): string {
  const parts = [data.first_name, data.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return getPrimaryEmail(data) ?? "Unknown";
}

/**
 * Build the profile row payload from Clerk user data.
 */
function buildProfilePayload(data: UserJSON) {
  const meta = (data.public_metadata ?? {}) as Record<string, unknown>;

  return {
    id: data.id,
    email: getPrimaryEmail(data),
    name: getFullName(data),
    avatar_url: data.image_url ?? null,
    role: (meta.role as string) ?? "employee",
    department: (meta.department as string) ?? null,
    departments: (meta.departments as string[]) ?? null,
    team_ids: (meta.teamIds as string[]) ?? null,
    branch_id: (meta.branchId as string) ?? null,
    region_id: (meta.regionId as string) ?? null,
    has_branch_access: (meta.hasBranchAccess as boolean) ?? false,
    managed_branch_id: (meta.managedBranchId as string) ?? null,
    has_regional_access: (meta.hasRegionalAccess as boolean) ?? false,
    managed_region_id: (meta.managedRegionId as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleUserUpsert(
  eventType: "user.created" | "user.updated",
  data: UserJSON,
) {
  const supabase = createAdminClient();
  const payload = buildProfilePayload(data);

  if (eventType === "user.created") {
    const { error } = await supabase.from("profiles").insert(payload);

    if (error) {
      console.error("[clerk-webhook] Failed to insert profile:", error);
      throw error;
    }

    console.log(`[clerk-webhook] Profile created for user ${data.id}`);
  } else {
    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", data.id);

    if (error) {
      console.error("[clerk-webhook] Failed to update profile:", error);
      throw error;
    }

    console.log(`[clerk-webhook] Profile updated for user ${data.id}`);
  }
}

async function handleUserDeleted(
  data: { id?: string; deleted?: boolean },
) {
  if (!data.id) {
    console.warn("[clerk-webhook] user.deleted event missing user id");
    return;
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", data.id);

  if (error) {
    console.error("[clerk-webhook] Failed to delete profile:", error);
    throw error;
  }

  console.log(`[clerk-webhook] Profile deleted for user ${data.id}`);
}
