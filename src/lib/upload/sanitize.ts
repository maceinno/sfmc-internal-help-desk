// ---------------------------------------------------------------------------
// Storage-path filename sanitization
// ---------------------------------------------------------------------------
// Pure utility — no server-only imports, no framework dependencies. Lives
// outside the API route so the unit tests can import it directly without
// loading the Next.js server runtime.
// ---------------------------------------------------------------------------

/**
 * Make a filename safe to embed in a Supabase Storage path.
 *
 * Real-world failure that motivated this: macOS Screenshot filenames look
 * like `Screenshot 2026-05-15 at 4.10.46 PM.png` -- but the space between
 * the timestamp and `PM` is actually U+202F (NARROW NO-BREAK SPACE), not
 * U+0020. The browser's `fetch()` URL-encodes it before sending the PUT,
 * but Supabase signed the upload token against the raw character; the
 * mismatch silently 403'd every PUT. Bytes never landed in the bucket,
 * finalize never fired, and we ended up with orphaned `status='pending'`
 * rows that the requester couldn't see.
 *
 * The DB's `file_name` column keeps the user's original filename (with
 * any Unicode, spaces, etc.) so the UI renders what the user expects.
 * Only `storage_path` gets the sanitized form, so the underlying bucket
 * key is unambiguous ASCII and any client encoder produces the same URL.
 */
export function sanitizeStorageName(name: string): string {
  const cleaned = name
    .normalize("NFC")
    // Drop ASCII control chars (U+0000..U+001F) and DEL (U+007F).
    .replace(/[\u0000-\u001F\u007F]/g, "")
    // Normalize non-breaking / unusual whitespace categories to a regular
    // ASCII space. Covers U+00A0 (NBSP), U+2000..U+200B (en/em/etc spaces
    // + zero-width space), U+202F (the macOS screenshot one), U+205F,
    // U+3000 (ideographic space).
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    // Anything still outside printable ASCII becomes `_`.
    .replace(/[^\x20-\x7E]/g, "_")
    // Path-unsafe ASCII (Windows-reserved + slashes) becomes `_`.
    .replace(/[/\\:*?"<>|]/g, "_")
    .trim()
    // Cap length. Supabase Storage allows up to 1024 chars per object key,
    // but very long paths break preview UIs and email subjects.
    .slice(0, 200);
  return cleaned || "untitled";
}
