import { getProfileId } from "@/lib/clerk/resolve-id";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// POST /api/users/ooo — Toggle Out of Office
// ---------------------------------------------------------------------------
// Flips the user's is_out_of_office flag. Existing tickets are intentionally
// left assigned to the user — the routing engine (src/lib/routing/rule-engine.ts)
// skips OOO agents when picking a team member for new tickets, so no bulk
// reassignment is needed.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const userId = await getProfileId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { enabled: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return Response.json(
      { error: "'enabled' must be a boolean." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("profiles")
    .update({ is_out_of_office: body.enabled })
    .eq("id", userId);

  if (error) {
    console.error("[ooo] Failed to update OOO flag:", error);
    return Response.json(
      { error: "Failed to update profile." },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
