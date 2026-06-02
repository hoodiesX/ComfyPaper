export function createCroppedPdfFileName(originalName: string, presetSuffix?: string): string {
  const safeBase = getSafeBaseName(originalName);
  const safeSuffix = sanitizeSuffix(presetSuffix);

  return `${safeBase}${safeSuffix ? `-${safeSuffix}` : ""}-reading.pdf`;
}

export function createColumnReadingPdfFileName(originalName: string, presetSuffix: string): string {
  const safeBase = getSafeBaseName(originalName);
  const safeSuffix = sanitizeSuffix(presetSuffix) || "column";

  return `${safeBase}-${safeSuffix}-reading.pdf`;
}

function getSafeBaseName(originalName: string): string {
  const withoutExtension = originalName.replace(/\.pdf$/i, "");
  return withoutExtension
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "document";
}

function sanitizeSuffix(presetSuffix?: string): string {
  return presetSuffix
    ? presetSuffix
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
    : "";
}

export function downloadPdf(bytes: Uint8Array, fileName: string) {
  downloadBytes(bytes, fileName, "application/pdf");
}

export function downloadZip(bytes: Uint8Array, fileName: string) {
  downloadBytes(bytes, fileName, "application/zip");
}

function downloadBytes(bytes: Uint8Array, fileName: string, type: string) {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
