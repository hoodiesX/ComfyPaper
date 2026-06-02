import { describe, expect, it } from "vitest";
import { MAX_PDF_BYTES, validatePdfFile } from "@/lib/validation/pdfValidation";

function file(name: string, size: number, type = "application/pdf") {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validatePdfFile", () => {
  it("accepts pdf mime or extension", () => {
    expect(validatePdfFile(file("paper.pdf", 10)).ok).toBe(true);
    expect(validatePdfFile(file("paper.pdf", 10, "application/octet-stream")).ok).toBe(true);
  });

  it("rejects empty files", () => {
    const result = validatePdfFile(file("empty.pdf", 0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("empty");
  });

  it("rejects files over the prototype limit", () => {
    const result = validatePdfFile(file("huge.pdf", MAX_PDF_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("too-large");
  });

  it("rejects files that do not look like PDFs", () => {
    const result = validatePdfFile(file("notes.txt", 10, "text/plain"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not-pdf");
  });
});
