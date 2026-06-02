import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfLoadResult } from "@/types/pdf";

export async function getPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  return pdfjs;
}

export async function loadPdf(file: File): Promise<PdfLoadResult> {
  const pdfjs = await getPdfJs();
  const buffer = await file.arrayBuffer();
  const data = copyArrayBufferForPdfJs(buffer);

  try {
    const document: PDFDocumentProxy = await pdfjs
      .getDocument({
        data,
        stopAtErrors: true
      })
      .promise;

    const pageCount = document.numPages;

    return {
      document,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        pageCount
      }
    };
  } catch (error) {
    throw mapPdfError(error);
  }
}

export function copyArrayBufferForPdfJs(buffer: ArrayBuffer): Uint8Array {
  // PDF.js may transfer and detach the buffer it receives when using a worker.
  // Every getDocument call gets a dedicated copy that is never reused afterward.
  return new Uint8Array(buffer.slice(0));
}

export function mapPdfError(error: unknown): Error {
  if (error instanceof Error) {
    if (isDetachedArrayBufferError(error)) {
      console.error("PDF.js received or reused a detached ArrayBuffer.", error);
      return new Error("We could not load this PDF preview. Please try another PDF.");
    }

    if (isUserSafePdfMessage(error.message)) {
      return new Error(error.message);
    }

    if (error.name === "PasswordException") {
      return new Error(
        "This PDF appears to be encrypted or password-protected. This prototype does not bypass protected files."
      );
    }

    if (error.name === "InvalidPDFException") {
      return new Error("This file does not look like a valid PDF.");
    }

    if (error.name === "MissingPDFException" || error.name === "UnexpectedResponseException") {
      return new Error("This file does not look like a valid PDF.");
    }
  }

  return new Error("This PDF could not be opened. It may be unsupported or corrupted.");
}

function isDetachedArrayBufferError(error: Error): boolean {
  return /detached|out-of-bounds ArrayBuffer|TypedArray/i.test(error.message);
}

function isUserSafePdfMessage(message: string): boolean {
  return [
    "This PDF appears to be encrypted or password-protected. This prototype does not bypass protected files.",
    "This file does not look like a valid PDF.",
    "We could not load this PDF preview. Please try another PDF.",
    "This PDF could not be opened. It may be unsupported or corrupted."
  ].includes(message);
}
