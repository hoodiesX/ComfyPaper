export function shouldShowDeveloperDiagnostics({
  nodeEnv = process.env.NODE_ENV,
  diagnosticsFlag = process.env.NEXT_PUBLIC_ENABLE_DIAGNOSTICS,
  search = ""
}: {
  nodeEnv?: string;
  diagnosticsFlag?: string;
  search?: string;
} = {}): boolean {
  if (diagnosticsFlag === "true") return true;
  if (search) {
    const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    if (params.get("debug") === "true") return true;
  }
  return nodeEnv === "development" && diagnosticsFlag === "true";
}
