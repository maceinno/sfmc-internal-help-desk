import { getProfileId } from "@/lib/clerk/resolve-id";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// POST /api/upload/finalize — Mark a pending attachment as ready.
// ---------------------------------------------------------------------------
// Companion to /api/upload/sign. After the client PUTs the file body to the
// signed URL returned by /sign, it calls this endpoint with the attachment
// id. We flip status from 'pending' to 'ready', which makes the row visible
// to anyone who can see the ticket (per the attachments_select RLS policy
// added in migration 013).
//
// Authorization: only the uploader can finalize their own row. This prevents
// a peer from prematurely marking another user's in-flight upload as ready.
// ---------------------------------------------------------------------------

interface FinalizeBody {
  id?: string;
}

export async function POST(request: Request) {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const userId = await getProfileId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: FinalizeBody;
  try {
    body = (await request.json()) as FinalizeBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return Response.json(
      { error: "Missing or invalid 'id'." },
      { status: 400 },
    );
  }

  // ── Flip status to 'ready' (uploader-only) ────────────────────────────────
  // The uploaded_by filter ensures only the user who minted the pending row
  // can finalize it. The status='pending' filter makes finalize idempotent —
  // a no-op if it's already ready.
  const supabase = createAdminClient();
  const { data: attachment, error: updateError } = await supabase
    .from("attachments")
    .update({ status: "ready" })
    .eq("id", body.id)
    .eq("uploaded_by", userId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (updateError) {
    console.error("[upload/finalize] Update failed:", updateError);
    return Response.json(
      { error: "Failed to finalize attachment." },
      { status: 500 },
    );
  }

  if (!attachment) {
    // Either the id doesn't exist, isn't owned by this user, or was already
    // finalized. Treat the already-finalized case as success so client retries
    // don't error spuriously.
    const { data: existing } = await supabase
      .from("attachments")
      .select("id, uploaded_by, status")
      .eq("id", body.id)
      .maybeSingle();

    if (
      existing &&
      existing.uploaded_by === userId &&
      existing.status === "ready"
    ) {
      return Response.json(existing, { status: 200 });
    }

    return Response.json(
      { error: "Attachment not found or not owned by caller." },
      { status: 404 },
    );
  }

  return Response.json(attachment, { status: 200 });
}
