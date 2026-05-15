import { describe, it, expect } from "vitest";
import { sanitizeStorageName } from "@/lib/upload/sanitize";

// Helper builders so the test source stays pure ASCII; runtime values
// include the actual Unicode codepoints we want to exercise.
const NBSP = String.fromCharCode(0x00a0);
const NARROW_NBSP = String.fromCharCode(0x202f); // the macOS Screenshot one
const ZERO_WIDTH = String.fromCharCode(0x200b);
const IDEOGRAPHIC = String.fromCharCode(0x3000);
const NULL_CHAR = String.fromCharCode(0x00);
const DEL_CHAR = String.fromCharCode(0x7f);
const BEL_CHAR = String.fromCharCode(0x07);

describe("sanitizeStorageName", () => {
  it("returns ASCII filenames unchanged", () => {
    expect(sanitizeStorageName("report.pdf")).toBe("report.pdf");
    expect(sanitizeStorageName("invoice 2026.pdf")).toBe("invoice 2026.pdf");
    expect(sanitizeStorageName("a-b_c.d.png")).toBe("a-b_c.d.png");
  });

  it("normalizes macOS Screenshot filenames with U+202F to ASCII space", () => {
    // Real-world filename Eric Olivier's macOS produced — note the NARROW
    // NO-BREAK SPACE between '4.10.46' and 'PM'.
    const macosName =
      "Screenshot 2026-05-15 at 4.10.46" + NARROW_NBSP + "PM.png";
    expect(sanitizeStorageName(macosName)).toBe(
      "Screenshot 2026-05-15 at 4.10.46 PM.png",
    );
  });

  it("normalizes other unusual whitespace categories", () => {
    expect(sanitizeStorageName("a" + NBSP + "b.pdf")).toBe("a b.pdf");
    expect(sanitizeStorageName("a" + ZERO_WIDTH + "b.pdf")).toBe("a b.pdf");
    expect(sanitizeStorageName("a" + IDEOGRAPHIC + "b.pdf")).toBe("a b.pdf");
  });

  it("strips ASCII control chars and DEL", () => {
    expect(sanitizeStorageName("foo" + NULL_CHAR + "bar.png")).toBe(
      "foobar.png",
    );
    expect(sanitizeStorageName("foo" + DEL_CHAR + "bar.png")).toBe(
      "foobar.png",
    );
    expect(sanitizeStorageName("foo" + BEL_CHAR + "bar.png")).toBe(
      "foobar.png",
    );
  });

  it("replaces non-ASCII characters with underscore", () => {
    // 'é' becomes '_' since it's outside printable ASCII after NFC.
    expect(sanitizeStorageName("café.pdf")).toBe("caf_.pdf");
    // Three CJK chars become three underscores.
    expect(sanitizeStorageName("日本語.png")).toBe("___.png");
  });

  it("replaces Windows-reserved path chars with underscore", () => {
    expect(sanitizeStorageName("a/b\\c:d*e?f.png")).toBe("a_b_c_d_e_f.png");
    expect(sanitizeStorageName('q"r<s>t|u.png')).toBe("q_r_s_t_u.png");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeStorageName("  hello.png  ")).toBe("hello.png");
  });

  it("caps the resulting name at 200 chars", () => {
    const longName = "a".repeat(500) + ".png";
    const result = sanitizeStorageName(longName);
    expect(result.length).toBe(200);
  });

  it("returns 'untitled' when input sanitizes to empty string", () => {
    expect(sanitizeStorageName(" ")).toBe("untitled");
    expect(sanitizeStorageName("   ")).toBe("untitled");
    expect(sanitizeStorageName("")).toBe("untitled");
  });

  it("NFC-normalizes combining marks", () => {
    // 'é' as 'e' + combining acute U+0301 vs precomposed U+00E9.
    // After NFC both become U+00E9, which is non-ASCII → '_'.
    const decomposed = "caf" + "é" + ".pdf";
    const composed = "caf" + "é" + ".pdf";
    expect(sanitizeStorageName(decomposed)).toBe(
      sanitizeStorageName(composed),
    );
  });
});
