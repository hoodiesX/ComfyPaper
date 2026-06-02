import { describe, expect, it } from "vitest";
import { evaluateProductUxReadiness } from "@/lib/product/productUxReadiness";

describe("product UX readiness gate", () => {
  it("scores a premium beta UX as good or better", () => {
    const readiness = evaluateProductUxReadiness({
      userReport: {
        exportReadinessReason: "Your paper is ready.",
        exportLimitApplied: false
      } as never,
      exportReadiness: "ready",
      presetState: {
        selectedPresetLabel: "Academic Paper",
        copyRendered: true,
        ctaLabel: "Export PDF"
      },
      batchState: {
        available: true,
        visible: true,
        queuedHasNextAction: true
      },
      planTier: "pro",
      optimizationSummary: {
        landingDemoRealistic: true,
        heroMockupExplainsValue: true,
        beforeAfterMockupConcrete: true,
        uploadAnchorVisible: true,
        freeProPlanAwareRendering: true,
        proUpgradeCtaHidden: true,
        proOperationalDashboardVisible: true,
        bestComparisonMeaningful: true,
        exportLimitVisible: true,
        preservedPagesExplained: true,
        proFeaturesUnderstandable: true,
        rawDiagnosticsHidden: true,
        localFirstTrustCopyPresent: true,
        nextActionClear: true
      }
    });

    expect(readiness.score).toBeGreaterThanOrEqual(90);
    expect(readiness.grade).toBe("excellent");
  });

  it("can score Free as excellent when the limited plan is communicated honestly", () => {
    const readiness = evaluateProductUxReadiness({
      userReport: {
        exportReadinessReason: "Ready with limited export.",
        exportLimitApplied: true
      } as never,
      exportReadiness: "ready",
      presetState: {
        selectedPresetLabel: "Academic Paper",
        copyRendered: true,
        ctaLabel: "Export preview PDF"
      },
      batchState: {
        available: false,
        visible: true,
        queuedHasNextAction: true
      },
      planTier: "free",
      optimizationSummary: {
        landingDemoRealistic: true,
        heroMockupExplainsValue: true,
        beforeAfterMockupConcrete: true,
        uploadAnchorVisible: true,
        freeProPlanAwareRendering: true,
        freeUpgradeCtaVisible: true,
        bestComparisonMeaningful: true,
        exportLimitVisible: true,
        preservedPagesExplained: true,
        proFeaturesUnderstandable: true,
        rawDiagnosticsHidden: true,
        localFirstTrustCopyPresent: true,
        nextActionClear: true
      }
    });

    expect(readiness.score).toBeGreaterThanOrEqual(90);
    expect(readiness.strengths.join(" ")).toContain("Free export limit is explicit");
  });

  it("flags Pro upgrade CTA leakage and queued batch dead ends", () => {
    const readiness = evaluateProductUxReadiness({
      userReport: {
        exportReadinessReason: "Ready.",
        exportLimitApplied: false
      } as never,
      exportReadiness: "ready",
      presetState: {
        selectedPresetLabel: "Academic Paper",
        copyRendered: true,
        ctaLabel: "Export PDF"
      },
      batchState: {
        available: true,
        visible: true,
        queuedHasNextAction: false
      },
      planTier: "pro",
      optimizationSummary: {
        landingDemoRealistic: true,
        heroMockupExplainsValue: true,
        beforeAfterMockupConcrete: true,
        uploadAnchorVisible: true,
        freeProPlanAwareRendering: false,
        proUpgradeCtaHidden: false,
        proOperationalDashboardVisible: true,
        bestComparisonMeaningful: true,
        exportLimitVisible: true,
        preservedPagesExplained: true,
        proFeaturesUnderstandable: true,
        rawDiagnosticsHidden: true,
        localFirstTrustCopyPresent: true,
        nextActionClear: true
      }
    });

    expect(readiness.score).toBeLessThan(90);
    expect(readiness.issues.join(" ")).toContain("Pro users should not see upgrade sales copy");
    expect(readiness.issues.join(" ")).toContain("Queued batch jobs need");
  });

  it("flags mixed real and synthetic hero demo visuals", () => {
    const readiness = evaluateProductUxReadiness({
      userReport: {
        exportReadinessReason: "Ready.",
        exportLimitApplied: false
      } as never,
      exportReadiness: "ready",
      presetState: {
        selectedPresetLabel: "Academic Paper",
        copyRendered: true,
        ctaLabel: "Export PDF"
      },
      batchState: {
        available: true,
        visible: true,
        queuedHasNextAction: true
      },
      planTier: "pro",
      optimizationSummary: {
        landingDemoRealistic: true,
        heroMockupExplainsValue: true,
        beforeAfterMockupConcrete: true,
        uploadAnchorVisible: true,
        freeProPlanAwareRendering: true,
        proUpgradeCtaHidden: true,
        proOperationalDashboardVisible: true,
        bestComparisonMeaningful: true,
        exportLimitVisible: true,
        preservedPagesExplained: true,
        proFeaturesUnderstandable: true,
        rawDiagnosticsHidden: true,
        localFirstTrustCopyPresent: true,
        nextActionClear: true,
        heroUsesRealOptimizedAssetWhenAvailable: false,
        heroDoesNotMixRealOriginalWithSyntheticOptimizedWhenAssetExists: false
      }
    });

    expect(readiness.score).toBeLessThan(90);
    expect(readiness.issues.join(" ")).toContain("Hero should use the real optimized asset");
    expect(readiness.issues.join(" ")).toContain("mixing a real original screenshot");
  });
});
