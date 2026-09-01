// ---------------------------------------------------------------------------
// Download filename for attachment links
// ---------------------------------------------------------------------------
// Pure utility — no server-only imports, no framework dependencies, so the
// unit tests can import it without loading the Next.js server runtime.
// ---------------------------------------------------------------------------

/**
 * Storage keys are `TICKET/UUID_original name.ext` — the UUID guarantees two
 * people uploading `2025 Tax Return.pdf` to the same ticket don't collide.
 *
 * The cost of that is what the browser saves the file as. `<a download="...">`
 * is IGNORED for cross-origin hrefs, and a Supabase signed URL is always
 * cross-origin, so the browser falls back to the last path segment and the
 * user gets `5fd8cf4b-d001-4819-b825-1460c16edd44_2025 Tax Return.pdf`.
 *
 * Supabase Storage honours a `download` query parameter on a signed URL by
 * responding with `Content-Disposition: attachment; filename="<value>"`,
 * which the browser DOES respect cross-origin. The parameter is not covered
 * by the URL's signature (it only affects a response header), so appending it
 * to an already-signed URL is safe — it is exactly what supabase-js does
 * internally when you pass `{ download }` to `createSignedUrl`. We append it
 * ourselves so the preview URL and the download URL can be derived from a
 * single signing call rather than two.
 */
export function withDownloadName(signedUrl: string, fileName: string): string {
  const name = fileName.trim()
  if (!name) return signedUrl
  const separator = signedUrl.includes("?") ? "&" : "?"
  return `${signedUrl}${separator}download=${encodeURIComponent(name)}`
}

/**
 * Fallback name for the rare attachment whose row we can't match back to its
 * storage key. Recovers the original filename from the key itself by dropping
 * the ticket folder and the `UUID_` prefix, so the download is still sensible
 * rather than a raw storage key.
 *
 * Keys written before the UUID scheme (and inbound-email ones) may have no
 * prefix at all, in which case the last segment is already the name.
 */
const UUID_PREFIX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i

export function downloadNameFromStoragePath(storagePath: string): string {
  const lastSegment = storagePath.split("/").pop() ?? ""
  return lastSegment.replace(UUID_PREFIX, "") || lastSegment
}
