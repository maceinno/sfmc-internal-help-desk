import { getProfileId } from "@/lib/clerk/resolve-id";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// POST /api/upload — File Upload
// ---------------------------------------------------------------------------
// Accepts multipart/form-data with a file and metadata, uploads to Supabase
// Storage, creates an attachment record, and returns it with a signed URL.
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(request: Request) {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const userId = await getProfileId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse multipart form data ─────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Invalid form data. Expected multipart/form-data." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  const ticketId = formData.get("ticketId");
  const messageId = formData.get("messageId") as string | null;
  const versionGroup = formData.get("versionGroup") as string | null;
  const versionRaw = formData.get("version") as string | null;
  const isFinalRaw = formData.get("isFinal") as string | null;

  // ── Validate required fields ──────────────────────────────────────────────
  if (!(file instanceof File)) {
    return Response.json(
      { error: "Missing or invalid 'file' field." },
      { status: 400 },
    );
  }

  if (!ticketId || typeof ticketId !== "string") {
    return Response.json(
      { error: "Missing or invalid 'ticketId' field." },
      { status: 400 },
    );
  }

  // ── Verify caller has access to the ticket ────────────────────────────────
  const supabaseCheck = createAdminClient();
  const { data: ticketRow } = await supabaseCheck
    .from("tickets")
    .select("id, created_by, assigned_to")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketRow) {
    const { data: profile } = await supabaseCheck
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
  }

  // ── Validate file size ────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      {
        error: `File size exceeds the 20 MB limit. Received ${(file.size / (1024 * 1024)).toFixed(2)} MB.`,
      },
      { status: 413 },
    );
  }

  // ── Parse optional fields ─────────────────────────────────────────────────
  const version = versionRaw ? parseInt(versionRaw, 10) : null;
  const isFinal = isFinalRaw === "true";

  // ── Upload to Supabase Storage ────────────────────────────────────────────
  const supabase = createAdminClient();
  const uniqueId = crypto.randomUUID();
  const storagePath = `${ticketId}/${uniqueId}_${file.name}`;

  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    console.error("[upload] Storage upload failed:", uploadError);
    return Response.json(
      { error: "Failed to upload file to storage." },
      { status: 500 },
    );
  }

  // ── Create attachment record ──────────────────────────────────────────────
  const attachmentRecord = {
    ticket_id: ticketId,
    file_name: file.name,
    file_size: file.size,
    file_type: file.type || "application/octet-stream",
    storage_path: storagePath,
    uploaded_by: userId,
    ...(messageId && { message_id: messageId }),
    ...(versionGroup && { version_group: versionGroup }),
    ...(version !== null && !isNaN(version) && { version }),
    ...(isFinalRaw !== null && { is_final: isFinal }),
  };

  const { data: attachment, error: insertError } = await supabase
    .from("attachments")
    .insert(attachmentRecord)
    .select()
    .single();

  if (insertError) {
    console.error("[upload] Failed to create attachment record:", insertError);
    // Attempt to clean up the uploaded file
    await supabase.storage.from("attachments").remove([storagePath]);
    return Response.json(
      { error: "Failed to create attachment record." },
      { status: 500 },
    );
  }

  // ── Generate signed URL (1 hour expiry) ───────────────────────────────────
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("attachments")
    .createSignedUrl(storagePath, 60 * 60); // 3600 seconds = 1 hour

  if (signedUrlError) {
    console.error("[upload] Failed to create signed URL:", signedUrlError);
    // Return the attachment without a URL rather than failing entirely
    return Response.json(attachment, { status: 201 });
  }

  return Response.json(
    { ...attachment, url: signedUrlData.signedUrl },
    { status: 201 },
  );
}
