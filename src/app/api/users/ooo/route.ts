import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// POST /api/users/ooo — Toggle Out of Office
// ---------------------------------------------------------------------------
// When enabling OOO: marks the user as out-of-office, unassigns all their
// non-solved tickets, and posts an internal message on each one.
// When disabling OOO: clears the out-of-office flag.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse request body ────────────────────────────────────────────────────
  let body: { enabled: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (typeof body.enabled !== "boolean") {
    return Response.json(
      { error: "'enabled' must be a boolean." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // ── Disabling OOO ────────────────────────────────────────────────────────
  if (!body.enabled) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_out_of_office: false })
      .eq("id", userId);

    if (error) {
      console.error("[ooo] Failed to disable OOO:", error);
      return Response.json(
        { error: "Failed to update profile." },
        { status: 500 },
      );
    }

    return Response.json({ success: true, unassignedCount: 0 });
  }

  // ── Enabling OOO ─────────────────────────────────────────────────────────

  // 1. Update user's profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ is_out_of_office: true })
    .eq("id", userId);

  if (profileError) {
    console.error("[ooo] Failed to enable OOO:", profileError);
    return Response.json(
      { error: "Failed to update profile." },
      { status: 500 },
    );
  }

  // 2. Get user's name for the internal message
  const { data: profile, error: profileFetchError } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .single();

  if (profileFetchError) {
    console.error("[ooo] Failed to fetch profile:", profileFetchError);
    return Response.json(
      { error: "Failed to fetch user profile." },
      { status: 500 },
    );
  }

  const userName = profile.name ?? "An agent";

  // 3. Find all non-solved tickets assigned to this user
  const { data: tickets, error: ticketsError } = await supabase
    .from("tickets")
    .select("id")
    .eq("assigned_to", userId)
    .neq("status", "solved");

  if (ticketsError) {
    console.error("[ooo] Failed to fetch assigned tickets:", ticketsError);
    return Response.json(
      { error: "Failed to fetch assigned tickets." },
      { status: 500 },
    );
  }

  const ticketIds = tickets?.map((t) => t.id) ?? [];
  let unassignedCount = 0;

  // 4. Unassign each ticket and add internal message
  for (const ticketId of ticketIds) {
    const now = new Date().toISOString();

    // Unassign the ticket and update timestamp
    const { error: updateError } = await supabase
      .from("tickets")
      .update({ assigned_to: null, updated_at: now })
      .eq("id", ticketId);

    if (updateError) {
      console.error(
        `[ooo] Failed to unassign ticket ${ticketId}:`,
        updateError,
      );
      continue;
    }

    // Add internal message
    const { error: messageError } = await supabase.from("messages").insert({
      ticket_id: ticketId,
      author_id: userId,
      content: `${userName} is now out of office. This ticket has been unassigned and returned to the group queue for reassignment.`,
      is_internal: true,
    });

    if (messageError) {
      console.error(
        `[ooo] Failed to add internal message to ticket ${ticketId}:`,
        messageError,
      );
      continue;
    }

    unassignedCount++;
  }

  return Response.json({ success: true, unassignedCount });
}
