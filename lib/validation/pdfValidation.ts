import type { ValidationResult } from "@/types/pdf";

export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export function validatePdfFile(file: File): ValidationResult {
  if (file.size === 0) {
    return {
      ok: false,
      code: "empty",
      message: "This file is empty. Choose a PDF with readable pages."
    };
  }

  if (file.size > MAX_PDF_BYTES) {
    return {
      ok: false,
      code: "too-large",
      message: "This PDF is larger than the current 25 MB prototype limit."
    };
  }

  const hasPdfMime = file.type === "application/pdf";
  const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");

  if (!hasPdfMime && !hasPdfExtension) {
    return {
      ok: false,
      code: "not-pdf",
      message: "This file does not look like a valid PDF."
    };
  }

  return { ok: true };
}
