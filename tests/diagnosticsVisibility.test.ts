import { describe, expect, it } from "vitest";
import { shouldShowDeveloperDiagnostics } from "@/lib/product/diagnosticsVisibility";

describe("developer diagnostics visibility", () => {
  it("hides Column Reading Diagnostics by default for normal users", () => {
    expect(shouldShowDeveloperDiagnostics({ nodeEnv: "production", diagnosticsFlag: undefined, search: "" })).toBe(false);
    expect(shouldShowDeveloperDiagnostics({ nodeEnv: "development", diagnosticsFlag: undefined, search: "" })).toBe(false);
  });

  it("shows diagnostics behind an explicit debug flag", () => {
    expect(shouldShowDeveloperDiagnostics({ nodeEnv: "production", search: "?debug=true" })).toBe(true);
    expect(shouldShowDeveloperDiagnostics({ nodeEnv: "development", diagnosticsFlag: "true" })).toBe(true);
  });
});
