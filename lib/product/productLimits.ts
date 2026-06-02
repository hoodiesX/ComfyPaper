export type PlanTier = "free" | "pro";
export type ExportLimitHitBy = "source-pages" | "reading-pages" | "none";

export type ProductPlanConfig = {
  currentPlanTier: PlanTier;
  freeSourcePageLimit: number;
  freeReadingPageLimit: number;
  maxProFilesPerBatch: number;
  proFeatureBadges: string[];
  upgradeCTA: string;
};

export const PRODUCT_PLAN: ProductPlanConfig = {
  currentPlanTier: getConfiguredPlanTier(),
  freeSourcePageLimit: 5,
  freeReadingPageLimit: 12,
  maxProFilesPerBatch: 20,
  proFeatureBadges: ["Full-document export", "Batch processing", "ZIP export", "Saved presets", "Reading pack export later"],
  upgradeCTA: "Unlock full-document export"
};

export function getConfiguredPlanTier(): PlanTier {
  return process.env.NEXT_PUBLIC_PLAN_TIER === "pro" ? "pro" : "free";
}

export function getProductPlan(): ProductPlanConfig {
  return {
    ...PRODUCT_PLAN,
    currentPlanTier: getConfiguredPlanTier()
  };
}

export function getExportLimitStatus(totalPages?: number, plan = PRODUCT_PLAN) {
  return getExportLimitStatusForReadingPages({
    totalSourcePages: totalPages,
    totalReadingPagesEstimated: totalPages,
    plan
  });
}

export function getExportLimitStatusForReadingPages({
  totalSourcePages,
  totalReadingPagesEstimated,
  plan = PRODUCT_PLAN
}: {
  totalSourcePages?: number;
  totalReadingPagesEstimated?: number;
  plan?: ProductPlanConfig;
}) {
  const isFree = plan.currentPlanTier === "free";
  const sourceLimitHit = Boolean(isFree && totalSourcePages && totalSourcePages > plan.freeSourcePageLimit);
  const readingLimitHit = Boolean(isFree && totalReadingPagesEstimated && totalReadingPagesEstimated > plan.freeReadingPageLimit);
  const exportLimitApplied = sourceLimitHit || readingLimitHit;
  const sourcePagesIncluded = isFree
    ? Math.min(totalSourcePages ?? plan.freeSourcePageLimit, plan.freeSourcePageLimit)
    : totalSourcePages;
  const readingPagesIncluded = isFree
    ? Math.min(totalReadingPagesEstimated ?? plan.freeReadingPageLimit, plan.freeReadingPageLimit)
    : totalReadingPagesEstimated;
  const exportLimitHitBy: ExportLimitHitBy = readingLimitHit
    ? "reading-pages"
    : sourceLimitHit
      ? "source-pages"
      : "none";
  const exportLimitMessage = exportLimitApplied
    ? `Free beta exports up to ${plan.freeSourcePageLimit} source pages or ${plan.freeReadingPageLimit} reading pages. Full-document export is Pro.`
    : "Full document export enabled.";

  return {
    planTier: plan.currentPlanTier,
    freeExportLimit: plan.freeSourcePageLimit,
    freeSourcePageLimit: plan.freeSourcePageLimit,
    freeReadingPageLimit: plan.freeReadingPageLimit,
    exportScope: exportLimitApplied ? "limited-preview" as const : "full-document" as const,
    sourcePagesIncluded,
    readingPagesIncluded,
    totalSourcePages,
    totalReadingPagesEstimated,
    exportLimitHitBy,
    exportLimitApplied,
    exportLimitReason: exportLimitMessage,
    exportLimitMessage,
    proFeatureBadges: plan.proFeatureBadges,
    upgradeCTA: plan.upgradeCTA
  };
}
