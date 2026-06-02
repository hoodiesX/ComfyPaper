import type { ExportReadiness, UserOptimizationReport } from "./optimizationReport";
import type { PlanTier } from "./productLimits";

export type ProductUxReadiness = {
  score: number;
  grade: "excellent" | "good" | "needs-polish" | "not-ready";
  strengths: string[];
  issues: string[];
  recommendedNextActions: string[];
};

export function evaluateProductUxReadiness({
  userReport,
  exportReadiness,
  presetState,
  batchState,
  planTier,
  optimizationSummary
}: {
  userReport?: UserOptimizationReport;
  exportReadiness?: ExportReadiness;
  presetState: {
    selectedPresetLabel?: string;
    copyRendered: boolean;
    ctaLabel?: string;
  };
  batchState: {
    available: boolean;
    visible: boolean;
    zipGenerated?: boolean;
    failureHandled?: boolean;
    queuedHasNextAction?: boolean;
    duplicateCtaCount?: number;
    hasPerFileDashboard?: boolean;
    expandedSummaryAvailable?: boolean;
    zipIncludesHumanSummary?: boolean;
    zipExcludesTechnicalJsonByDefault?: boolean;
  };
  planTier: PlanTier;
  optimizationSummary: {
    heroClear?: boolean;
    landingDemoRealistic?: boolean;
    landingMockupPremiumQuality?: boolean;
    heroMockupExplainsValue?: boolean;
    transformCuePremium?: boolean;
    beforeAfterPresent?: boolean;
    beforeAfterMockupConcrete?: boolean;
    deviceMockupsDistinct?: boolean;
    uploadAnchorVisible?: boolean;
    freeProClear?: boolean;
    freeProPlanAwareRendering?: boolean;
    proUpgradeCtaHidden?: boolean;
    freeUpgradeCtaVisible?: boolean;
    proOperationalDashboardVisible?: boolean;
    batchWorkflowClear?: boolean;
    singlePrimaryCta?: boolean;
    bestComparisonMeaningful: boolean;
    exportLimitVisible: boolean;
    preservedPagesExplained: boolean;
    proFeaturesUnderstandable: boolean;
    rawDiagnosticsHidden: boolean;
    localFirstTrustCopyPresent: boolean;
    nextActionClear: boolean;
    userReportsNonTechnical?: boolean;
    realDemoAssetSupportExists?: boolean;
    realDemoAssetsDetected?: boolean;
    demoAssetFallbackWorks?: boolean;
    demoAssetDocsExist?: boolean;
    demoRenderScriptExistsOrDocumented?: boolean;
    selectedDemoTargetDocumented?: boolean;
    landingDemoUsesBodyPageFraming?: boolean;
    landingDemoDoesNotOverpromiseTitleReflow?: boolean;
    landingAndLivePreviewSeparated?: boolean;
    livePreviewPersonalizedAfterUpload?: boolean;
    demoFallbackMarkedAsIllustration?: boolean;
    heroVisualNotOverloaded?: boolean;
    deviceDemoTabsGracefullyFallback?: boolean;
    heroUsesRealOptimizedAssetWhenAvailable?: boolean;
    heroDoesNotMixRealOriginalWithSyntheticOptimizedWhenAssetExists?: boolean;
    demoFramesCentered?: boolean;
    kindlePreviewNotTiny?: boolean;
    devicePreviewSystemUnified?: boolean;
    realAssetCopyNotMarkedIllustration?: boolean;
    fallbackCopyMarkedIllustration?: boolean;
    demoImageSharpnessConstraintsPresent?: boolean;
    noFallbackFlickerWhenRealAssetsExist?: boolean;
    demoScreenshotOverflowContained?: boolean;
  };
}): ProductUxReadiness {
  let score = 100;
  const strengths: string[] = [];
  const issues: string[] = [];
  const recommendedNextActions: string[] = [];

  applyCheck(Boolean(presetState.selectedPresetLabel && presetState.copyRendered), 8, "Selected preset is clear.", "Selected preset needs clearer copy.");
  applyCheck(optimizationSummary.heroClear !== false, 6, "Hero communicates the research paper and e-reader value.", "Hero value proposition is unclear.");
  applyCheck(optimizationSummary.heroMockupExplainsValue !== false, 6, "Hero mockup explains the paper-to-reading-layout value.", "Hero mockup is too abstract.");
  applyCheck(optimizationSummary.landingDemoRealistic !== false, 6, "Landing demo looks like an academic paper workflow.", "Landing demo should look like a real academic-paper conversion.");
  applyCheck(optimizationSummary.landingMockupPremiumQuality !== false, 6, "Landing mockups have premium visual quality.", "Landing mockups still feel too much like skeleton placeholders.");
  applyCheck(optimizationSummary.transformCuePremium !== false, 6, "Transformation cue feels polished.", "Transformation cue feels cheap or literal.");
  applyCheck(optimizationSummary.beforeAfterPresent !== false, 6, "Before/after demo is present.", "Before/after demo is missing.");
  applyCheck(optimizationSummary.beforeAfterMockupConcrete !== false, 6, "Before/after mockup is concrete.", "Before/after mockup is too generic.");
  applyCheck(optimizationSummary.deviceMockupsDistinct !== false, 6, "Device mockups are distinct.", "Academic, Kindle and iPad mockups need clearer visual differences.");
  applyCheck(optimizationSummary.uploadAnchorVisible !== false, 6, "Upload entry point is visible.", "Upload/tool entry point is buried.");
  applyCheck(optimizationSummary.freeProClear !== false, 6, "Free and Pro are clearly packaged.", "Free/Pro distinction is unclear.");
  applyCheck(optimizationSummary.freeProPlanAwareRendering !== false, 8, "Free/Pro rendering matches the active plan.", "Free/Pro rendering is ambiguous for the active plan.");
  applyCheck(Boolean(exportReadiness && userReport?.exportReadinessReason), 10, "Export readiness is understandable.", "Export readiness is missing or too vague.");
  applyCheck(optimizationSummary.bestComparisonMeaningful, 10, "Before/after preview shows meaningful value.", "Before/after preview should avoid preserved page 1 when optimized body pages exist.");
  applyCheck(optimizationSummary.exportLimitVisible, 12, "Full vs limited export status is obvious.", "Export scope must be visible before export.");
  applyCheck(optimizationSummary.preservedPagesExplained, 8, "Preserved pages are explained.", "Preserved-page safety behavior needs explanation.");
  applyCheck(optimizationSummary.proFeaturesUnderstandable, 8, "Pro features are understandable.", "Pro value needs clearer packaging.");
  applyCheck(optimizationSummary.rawDiagnosticsHidden, 12, "Raw diagnostics are hidden from normal users.", "Developer diagnostics are leaking into the product UI.");
  applyCheck(optimizationSummary.localFirstTrustCopyPresent, 8, "Local-first trust copy is present.", "Local-first trust copy is missing.");
  applyCheck(optimizationSummary.batchWorkflowClear !== false, 6, "Batch workflow has clear states and actions.", "Batch workflow is unclear or has dead-end states.");
  applyCheck(batchState.queuedHasNextAction !== false, 8, "Queued batch jobs have a clear next action.", "Queued batch jobs need a clear Start batch export action.");
  applyCheck((batchState.duplicateCtaCount ?? 0) === 0, 8, "Batch CTA hierarchy is clean.", "Duplicate batch CTAs are present.");
  applyCheck(batchState.hasPerFileDashboard !== false, 6, "Batch per-file dashboard is available.", "Batch needs a per-file dashboard.");
  applyCheck(batchState.expandedSummaryAvailable !== false, 6, "Batch per-file summaries are available.", "Batch needs expandable per-file summaries.");
  applyCheck(batchState.zipIncludesHumanSummary !== false, 6, "ZIP includes a human-readable summary.", "ZIP should include a human-readable summary.");
  applyCheck(batchState.zipExcludesTechnicalJsonByDefault !== false, 8, "ZIP excludes technical JSON by default.", "ZIP should not include technical JSON by default.");
  applyCheck(optimizationSummary.singlePrimaryCta !== false, 6, "Single primary CTA hierarchy is respected.", "Duplicate primary CTAs are present.");
  applyCheck(ctaMatchesReadiness(presetState.ctaLabel, exportReadiness, userReport?.exportLimitApplied), 8, "CTA matches export readiness.", "CTA does not match current readiness state.");
  applyCheck(optimizationSummary.nextActionClear, 8, "The next action is clear.", "User may not know what to do next.");
  applyCheck(optimizationSummary.userReportsNonTechnical !== false, 8, "User-facing reports use non-technical language.", "User-facing reports include technical diagnostic language.");
  applyCheck(optimizationSummary.realDemoAssetSupportExists !== false, 6, "Real demo asset support exists.", "Landing needs support for real demo assets.");
  if (optimizationSummary.realDemoAssetsDetected) {
    strengths.push("Real demo assets are detected.");
  } else {
    strengths.push("Demo asset fallback is available when real assets are missing.");
  }
  applyCheck(optimizationSummary.demoAssetFallbackWorks !== false, 8, "Demo asset fallback works.", "Missing demo assets should not break the page.");
  applyCheck(optimizationSummary.demoAssetDocsExist !== false, 6, "Demo asset documentation exists.", "Demo asset workflow should be documented.");
  applyCheck(optimizationSummary.demoRenderScriptExistsOrDocumented !== false, 6, "Demo render workflow exists or is documented.", "Demo capture workflow needs a command or documentation.");
  applyCheck(optimizationSummary.selectedDemoTargetDocumented !== false, 6, "Selected ASP demo target is documented.", "Selected ASP demo target must be documented.");
  applyCheck(optimizationSummary.landingDemoUsesBodyPageFraming !== false, 8, "Landing demo uses body-page framing.", "Landing demo should focus on body pages, not title-page reflow.");
  applyCheck(optimizationSummary.landingDemoDoesNotOverpromiseTitleReflow !== false, 8, "Landing does not overpromise title-page reflow.", "Landing copy should not imply title pages always reflow.");
  applyCheck(optimizationSummary.landingAndLivePreviewSeparated !== false, 6, "Landing demo and live preview are separated.", "Landing demo and live uploaded preview need distinct framing.");
  applyCheck(optimizationSummary.livePreviewPersonalizedAfterUpload !== false, 6, "Live preview is personalized after upload.", "Live preview should be clearly tied to the uploaded PDF.");
  applyCheck(optimizationSummary.demoFallbackMarkedAsIllustration !== false, 6, "Fallback demo is marked as an illustration.", "Fallback demo should be labeled as an illustration.");
  applyCheck(optimizationSummary.heroVisualNotOverloaded !== false, 6, "Hero visual is not overloaded.", "Hero visual should be simpler and less cramped.");
  applyCheck(optimizationSummary.deviceDemoTabsGracefullyFallback !== false, 6, "Device demo tabs fallback gracefully.", "Missing device demo assets should fallback gracefully.");
  applyCheck(optimizationSummary.heroUsesRealOptimizedAssetWhenAvailable !== false, 8, "Hero uses a real optimized asset when available.", "Hero should use the real optimized asset when one exists.");
  applyCheck(optimizationSummary.heroDoesNotMixRealOriginalWithSyntheticOptimizedWhenAssetExists !== false, 8, "Hero does not mix real original and synthetic optimized visuals when optimized assets exist.", "Hero is mixing a real original screenshot with a synthetic optimized fallback.");
  applyCheck(optimizationSummary.demoFramesCentered !== false, 6, "Demo frames are centered.", "Device preview frames should be centered consistently.");
  applyCheck(optimizationSummary.kindlePreviewNotTiny !== false, 6, "Kindle preview is visually substantial.", "Kindle preview is too small.");
  applyCheck(optimizationSummary.devicePreviewSystemUnified !== false, 6, "Device preview frames use a unified system.", "Device previews still look like ad-hoc layouts.");
  applyCheck(optimizationSummary.realAssetCopyNotMarkedIllustration !== false, 6, "Real demo assets are not labeled as illustrations.", "Real demo asset copy should not say Illustration.");
  applyCheck(optimizationSummary.fallbackCopyMarkedIllustration !== false, 6, "Fallback demo copy is clearly marked as an illustration.", "Fallback demo copy should be marked as an illustration.");
  applyCheck(optimizationSummary.demoImageSharpnessConstraintsPresent !== false, 6, "Demo image sharpness constraints are present.", "Demo images need object-fit and aspect-ratio constraints to prevent blur or distortion.");
  applyCheck(optimizationSummary.noFallbackFlickerWhenRealAssetsExist !== false, 8, "Real demo assets render without fallback flicker.", "Synthetic fallback should not render when real demo assets exist.");
  applyCheck(optimizationSummary.demoScreenshotOverflowContained !== false, 8, "Demo screenshots are contained inside their frames.", "Demo screenshots should not overflow their visual frames.");

  if (planTier === "free" && userReport?.exportLimitApplied) {
    strengths.push("Free export limit is explicit.");
    recommendedNextActions.push("Verify Pro full-document export before rating the product excellent.");
  } else {
    strengths.push("Full-document export is available for the current tier.");
  }

  if (planTier === "pro") {
    applyCheck(batchState.available && batchState.visible, 8, "Batch export is visible in Pro.", "Batch export is missing in Pro.");
    applyCheck(optimizationSummary.proUpgradeCtaHidden !== false, 8, "Upgrade CTAs are hidden for Pro.", "Pro users should not see upgrade sales copy.");
    applyCheck(optimizationSummary.proOperationalDashboardVisible !== false, 6, "Pro dashboard is operational.", "Pro mode should show operational tools.");
  } else if (batchState.visible) {
    strengths.push("Batch export is positioned as a Pro feature.");
    applyCheck(optimizationSummary.freeUpgradeCtaVisible !== false, 6, "Free upgrade path is visible.", "Free mode should show an early-access path.");
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  return {
    score: boundedScore,
    grade: getGrade(boundedScore),
    strengths,
    issues,
    recommendedNextActions: recommendedNextActions.length > 0 ? recommendedNextActions : ["Continue monitoring QA reports before widening beta access."]
  };

  function applyCheck(ok: boolean, penalty: number, strength: string, issue: string) {
    if (ok) {
      strengths.push(strength);
      return;
    }
    score -= penalty;
    issues.push(issue);
    recommendedNextActions.push(issue);
  }
}

function ctaMatchesReadiness(ctaLabel?: string, readiness?: ExportReadiness, limited?: boolean): boolean {
  if (!ctaLabel || !readiness) return false;
  if (limited) return ctaLabel === "Export preview PDF" || ctaLabel.includes("Unlock");
  if (readiness === "review-recommended") return ctaLabel === "Export with warnings";
  if (readiness === "not-recommended") return ctaLabel.includes("Unlock") || ctaLabel.includes("Review");
  return ctaLabel === "Export PDF";
}

function getGrade(score: number): ProductUxReadiness["grade"] {
  if (score >= 90) return "excellent";
  if (score >= 80) return "good";
  if (score >= 65) return "needs-polish";
  return "not-ready";
}
