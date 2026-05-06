// ---------------------------------------------------------------------------
// uploadFileDirect — Browser → Supabase Storage upload, bypassing Vercel.
// ---------------------------------------------------------------------------
// Three-step flow that avoids Vercel's ~4.5 MB serverless function body limit:
//
//   1. POST /api/upload/sign with file metadata. Server validates auth + ticket
//      access, mints a one-time signed upload URL, and creates the attachments
//      row in `pending` state.
//   2. PUT the file body directly to the signed URL. The bytes never touch
//      our Vercel function.
//   3. POST /api/upload/finalize { id } to flip the row to `ready`.
//
// Throws on any step failure — callers decide whether to abort or warn.
// ---------------------------------------------------------------------------

export interface DirectUploadOptions {
  file: File;
  ticketId: string;
  messageId?: string;
  versionGroup?: string;
  version?: number;
  isFinal?: boolean;
}

export interface DirectUploadResult {
  id: string;
}

export async function uploadFileDirect(
  opts: DirectUploadOptions,
): Promise<DirectUploadResult> {
  const { file, ticketId, messageId, versionGroup, version, isFinal } = opts;

  // ── 1. Mint signed URL + pending row ──────────────────────────────────────
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticketId,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      messageId,
      versionGroup,
      version,
      isFinal,
    }),
  });

  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({}));
    throw new Error(err.error ?? `Failed to sign upload (${signRes.status})`);
  }

  const { id, signedUrl } = (await signRes.json()) as {
    id: string;
    signedUrl: string;
  };

  // ── 2. PUT the file body directly to Supabase Storage ─────────────────────
  const putRes = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error(
      `Failed to upload to storage (${putRes.status} ${putRes.statusText})`,
    );
  }

  // ── 3. Finalize the row ───────────────────────────────────────────────────
  const finalizeRes = await fetch("/api/upload/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });

  if (!finalizeRes.ok) {
    const err = await finalizeRes.json().catch(() => ({}));
    throw new Error(
      err.error ?? `Failed to finalize upload (${finalizeRes.status})`,
    );
  }

  return { id };
}
