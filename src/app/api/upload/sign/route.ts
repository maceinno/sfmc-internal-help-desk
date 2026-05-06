import { getProfileId } from "@/lib/clerk/resolve-id";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// POST /api/upload/sign — Mint a one-time signed upload URL for direct-to-
// Supabase Storage uploads.
// ---------------------------------------------------------------------------
// The legacy /api/upload route accepts the file body itself, which means files
// >~4.5 MB get 413'd by Vercel's serverless function body limit. This route
// instead returns a short-lived URL that the browser PUTs the file to directly,
// bypassing the Vercel function for the byte path. The cap then becomes
// whatever the Supabase Storage bucket allows.
//
// Flow:
//   1. Client POSTs metadata (ticketId + file info) here.
//   2. We auth, verify ticket access, validate size, then mint a signed URL
//      and create the attachments row in `pending` state.
//   3. Client PUTs the file body straight to Supabase Storage.
//   4. Client POSTs to /api/upload/finalize to flip the row to `ready`.
// ---------------------------------------------------------------------------

// 100 MB. The Supabase `attachments` bucket file_size_limit is set above
// this so the route cap is the binding constraint. Bumping further
// requires raising the bucket-level file_size_limit first (dashboard or
// via the platform SQL function `update_bucket`).
const MAX_FILE_SIZE = 100 * 1024 * 1024;

interface SignBody {
  ticketId?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  messageId?: string | null;
  versionGroup?: string | null;
  version?: number | null;
  isFinal?: boolean | null;
}

export async function POST(request: Request) {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const userId = await getProfileId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse + validate body ─────────────────────────────────────────────────
  let body: SignBody;
  try {
    body = (await request.json()) as SignBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { ticketId, fileName, fileType, fileSize } = body;

  if (!ticketId || typeof ticketId !== "string") {
    return Response.json(
      { error: "Missing or invalid 'ticketId'." },
      { status: 400 },
    );
  }
  if (!fileName || typeof fileName !== "string") {
    return Response.json(
      { error: "Missing or invalid 'fileName'." },
      { status: 400 },
    );
  }
  if (typeof fileSize !== "number" || fileSize <= 0) {
    return Response.json(
      { error: "Missing or invalid 'fileSize'." },
      { status: 400 },
    );
  }
  if (fileSize > MAX_FILE_SIZE) {
    return Response.json(
      {
        error: `File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit. Received ${(fileSize / (1024 * 1024)).toFixed(2)} MB.`,
      },
      { status: 413 },
    );
  }

  // ── Verify caller has access to the ticket ────────────────────────────────
  const supabase = createAdminClient();
  const { data: ticketRow } = await supabase
    .from("tickets")
    .select("id, created_by, assigned_to")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticketRow) {
    return Response.json({ error: "Ticket not found." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  const isAgentOrAdmin =
    profile?.role === "agent" || profile?.role === "admin";
  const isCreator = ticketRow.created_by === userId;
  const isAssignee = ticketRow.assigned_to === userId;

  if (!isAgentOrAdmin && !isCreator && !isAssignee) {
    return Response.json(
      { error: "You do not have access to this ticket." },
      { status: 403 },
    );
  }

  // ── Mint signed upload URL ────────────────────────────────────────────────
  const uniqueId = crypto.randomUUID();
  const storagePath = `${ticketId}/${uniqueId}_${fileName}`;

  const { data: signed, error: signError } = await supabase.storage
    .from("attachments")
    .createSignedUploadUrl(storagePath);

  if (signError || !signed) {
    console.error("[upload/sign] createSignedUploadUrl failed:", signError);
    return Response.json(
      { error: "Failed to create signed upload URL." },
      { status: 500 },
    );
  }

  // ── Insert pending attachment row ─────────────────────────────────────────
  const version =
    typeof body.version === "number" && !isNaN(body.version)
      ? body.version
      : null;

  const attachmentRecord = {
    ticket_id: ticketId,
    file_name: fileName,
    file_size: fileSize,
    file_type: fileType || "application/octet-stream",
    storage_path: storagePath,
    uploaded_by: userId,
    status: "pending",
    ...(body.messageId && { message_id: body.messageId }),
    ...(body.versionGroup && { version_group: body.versionGroup }),
    ...(version !== null && { version }),
    ...(body.isFinal !== null &&
      body.isFinal !== undefined && { is_final: !!body.isFinal }),
  };

  const { data: attachment, error: insertError } = await supabase
    .from("attachments")
    .insert(attachmentRecord)
    .select()
    .single();

  if (insertError) {
    console.error(
      "[upload/sign] Failed to insert pending attachment:",
      insertError,
    );
    return Response.json(
      { error: "Failed to create attachment record." },
      { status: 500 },
    );
  }

  return Response.json(
    {
      id: attachment.id,
      signedUrl: signed.signedUrl,
      token: signed.token,
      path: signed.path,
    },
    { status: 201 },
  );
}
