import { describe, expect, it } from "vitest";
import { createColumnReadingPdfFileName, createCroppedPdfFileName } from "@/lib/pdf/downloadPdf";

describe("createCroppedPdfFileName", () => {
  it("adds the reading crop suffix", () => {
    expect(createCroppedPdfFileName("paper.pdf")).toBe("paper-reading.pdf");
  });

  it("adds a preset suffix when provided", () => {
    expect(createCroppedPdfFileName("paper.pdf", "academic")).toBe(
      "paper-academic-reading.pdf"
    );
  });

  it("sanitizes multi-part names", () => {
    expect(createCroppedPdfFileName("my paper.final.pdf")).toBe(
      "my-paper-final-reading.pdf"
    );
  });

  it("removes problematic characters", () => {
    expect(createCroppedPdfFileName("../../Résumé: draft #1!!.pdf")).toBe(
      "resume-draft-1-reading.pdf"
    );
  });

  it("avoids empty file names", () => {
    expect(createCroppedPdfFileName("@@@.pdf")).toBe("document-reading.pdf");
  });

  it("creates column reading file names", () => {
    expect(createColumnReadingPdfFileName("paper.pdf", "kindle")).toBe(
      "paper-kindle-reading.pdf"
    );
  });
});
