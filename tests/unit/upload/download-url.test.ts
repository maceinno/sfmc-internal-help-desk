import { describe, it, expect } from "vitest"
import {
  withDownloadName,
  downloadNameFromStoragePath,
} from "@/lib/upload/download-url"

// Attachments were downloading as `<uuid>_<original name>` because the
// storage key is what the browser falls back to on a cross-origin href.
// These cover the two halves of the fix: naming the download explicitly,
// and recovering a sensible name when the DB row can't be matched.

const SIGNED =
  "https://proj.supabase.co/storage/v1/object/sign/attachments/T-5057/5fd8cf4b-d001-4819-b825-1460c16edd44_2025%20Tax%20Return.pdf?token=abc.def"

describe("withDownloadName", () => {
  it("appends the original filename to an already-signed URL", () => {
    expect(withDownloadName(SIGNED, "2025 Tax Return.pdf")).toBe(
      `${SIGNED}&download=2025%20Tax%20Return.pdf`,
    )
  })

  it("leaves the existing token query intact", () => {
    const out = withDownloadName(SIGNED, "drive.pdf")
    expect(out).toContain("token=abc.def")
    expect(out.indexOf("token=")).toBeLessThan(out.indexOf("download="))
  })

  it("uses ? when the URL has no query string yet", () => {
    expect(withDownloadName("https://x.test/file", "a.pdf")).toBe(
      "https://x.test/file?download=a.pdf",
    )
  })

  it("escapes characters that would otherwise break the query string", () => {
    // Real filenames in this help desk include spaces, parentheses and
    // ampersands — e.g. "Escrow hold back Amendment (TXR 1903  TREC 39-11) 01.pdf".
    const out = withDownloadName(SIGNED, "Profit & Loss (Q3).pdf")
    expect(out.endsWith("&download=Profit%20%26%20Loss%20(Q3).pdf")).toBe(true)
    // Only one real parameter separator was added.
    expect(out.split("&download=")).toHaveLength(2)
  })

  it("returns the URL untouched for an empty name", () => {
    expect(withDownloadName(SIGNED, "")).toBe(SIGNED)
    expect(withDownloadName(SIGNED, "   ")).toBe(SIGNED)
  })
})

describe("downloadNameFromStoragePath", () => {
  it("strips the ticket folder and the UUID prefix", () => {
    expect(
      downloadNameFromStoragePath(
        "T-5057/5fd8cf4b-d001-4819-b825-1460c16edd44_2025 Tax Return.pdf",
      ),
    ).toBe("2025 Tax Return.pdf")
  })

  it("keeps a leading underscore that belongs to the filename", () => {
    // Genuine row: `_assets_documents_products_va-product-profile.pdf`
    expect(
      downloadNameFromStoragePath(
        "T-5003/e48487f8-93f2-4b72-b2be-ba86b52effbd__assets_documents_products_va-product-profile.pdf",
      ),
    ).toBe("_assets_documents_products_va-product-profile.pdf")
  })

  it("leaves an unprefixed key alone", () => {
    expect(downloadNameFromStoragePath("T-1001/report.pdf")).toBe("report.pdf")
  })

  it("does not mistake a UUID-looking filename for a prefix", () => {
    // No trailing underscore, so this IS the filename.
    expect(
      downloadNameFromStoragePath(
        "T-1001/5fd8cf4b-d001-4819-b825-1460c16edd44.pdf",
      ),
    ).toBe("5fd8cf4b-d001-4819-b825-1460c16edd44.pdf")
  })
})
