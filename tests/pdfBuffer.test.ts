import { describe, expect, it } from "vitest";
import { copyArrayBufferForPdfJs } from "@/lib/pdf/loadPdf";

describe("copyArrayBufferForPdfJs", () => {
  it("returns a dedicated Uint8Array copy for PDF.js", () => {
    const source = new Uint8Array([37, 80, 68, 70]).buffer;
    const copy = copyArrayBufferForPdfJs(source);

    expect(copy.buffer).not.toBe(source);
    expect(Array.from(copy)).toEqual([37, 80, 68, 70]);
  });

  it("does not reflect later mutations to the source buffer", () => {
    const sourceView = new Uint8Array([1, 2, 3]);
    const copy = copyArrayBufferForPdfJs(sourceView.buffer);

    sourceView[0] = 9;

    expect(Array.from(copy)).toEqual([1, 2, 3]);
  });
});
