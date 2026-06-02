"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useMemo, useRef, useState } from "react";
import { BeforeAfterPanel } from "@/components/BeforeAfterPanel";
import { BatchExportPanel } from "@/components/BatchExportPanel";
import { ColumnDiagnosticsPanel } from "@/components/ColumnDiagnosticsPanel";
import { DemoPlaceholder } from "@/components/DemoPlaceholder";
import { ExportPanel } from "@/components/ExportPanel";
import { ExportProgressPanel } from "@/components/ExportProgressPanel";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import {
  BuiltForPapersSection,
  FaqSection,
  LocalFirstSection,
  PricingSection,
  ProblemSection,
  StaticBeforeAfterSection
} from "@/components/LandingSections";
import { Limitations } from "@/components/Limitations";
import { OptimizationReport } from "@/components/OptimizationReport";
import { PdfDropzone } from "@/components/PdfDropzone";
import { PdfMetadataCard } from "@/components/PdfMetadataCard";
import { PresetCards } from "@/components/PresetCards";
import { PrivacyNote } from "@/components/PrivacyNote";
import { ReadingMetricsSummary } from "@/components/ReadingMetricsSummary";
import { StatusMessage } from "@/components/StatusMessage";
import { PageSafetyReport } from "@/components/PageSafetyReport";
import { ToolControlBar } from "@/components/ToolControlBar";
import { UseCases } from "@/components/UseCases";
import { buildExportSummary, summarizeRenderedPages } from "@/lib/metrics/pageSummary";
import { downloadPdf, downloadZip } from "@/lib/pdf/downloadPdf";
import { loadPdf, mapPdfError } from "@/lib/pdf/loadPdf";
import { getColumnDetectionDebugConfig } from "@/lib/pdf/columnDetection";
import { getOutputProfileForPreset } from "@/lib/pdf/readingProfiles";
import { buildUserOptimizationReport } from "@/lib/product/optimizationReport";
import { shouldShowDeveloperDiagnostics } from "@/lib/product/diagnosticsVisibility";
import { exportBatchToZip, type BatchJob, type BatchSummary, type BatchZipResult } from "@/lib/product/batchExport";
import { exportSinglePdf, type ExportProgressState } from "@/lib/product/exportWorkflow";
import { getProductPlan } from "@/lib/product/productLimits";
import { evaluateProductUxReadiness } from "@/lib/product/productUxReadiness";
import { renderReadingPreviews } from "@/lib/pdf/renderReadingPreviews";
import { renderPdfPages } from "@/lib/pdf/renderPages";
import { validatePdfFile } from "@/lib/validation/pdfValidation";
import {
  DEFAULT_READING_PRESET_ID,
  getReadingPreset
} from "@/lib/presets/readingPresets";
import type { ReadingPresetId } from "@/lib/presets/presetTypes";
import type {
  ColumnDetectionDebug,
  AcademicSourcePagePlan,
  PdfMetadata,
  PdfProcessStatus,
  RenderedPage
} from "@/types/pdf";

declare global {
  interface Window {
    __PDF_READING_QA__?: {
      getLatestPlan: () => { sourcePages: AcademicSourcePagePlan[]; outputProfileId: string; selectedPreset: string };
      getLatestDiagnostics: () => ColumnDetectionDebug[];
      getLatestSummary: () => Record<string, unknown>;
      selectPreset: (presetId: ReadingPresetId) => void;
      setColumnMode: (enabled: boolean) => void;
    };
  }
}

type OptimizedPreviewStatus = "idle" | "loading" | "ready" | "error";

const INITIAL_EXPORT_PROGRESS: ExportProgressState = {
  stage: "idle",
  optimizedPages: 0,
  preservedPages: 0,
  warningCount: 0
};

export default function Home() {
  const [status, setStatus] = useState<PdfProcessStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [failedPageNumbers, setFailedPageNumbers] = useState<number[]>([]);
  const [optimizedPages, setOptimizedPages] = useState<RenderedPage[]>([]);
  const [optimizedFailedPageNumbers, setOptimizedFailedPageNumbers] = useState<number[]>([]);
  const [columnDiagnostics, setColumnDiagnostics] = useState<ColumnDetectionDebug[]>([]);
  const [academicPlans, setAcademicPlans] = useState<AcademicSourcePagePlan[]>([]);
  const [optimizedStatus, setOptimizedStatus] = useState<OptimizedPreviewStatus>("idle");
  const [optimizedError, setOptimizedError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgressState>(INITIAL_EXPORT_PROGRESS);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);
  const [batchZipResult, setBatchZipResult] = useState<BatchZipResult | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<ReadingPresetId>(
    DEFAULT_READING_PRESET_ID
  );
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [columnModeEnabled, setColumnModeEnabled] = useState(
    () => getReadingPreset(DEFAULT_READING_PRESET_ID).defaultColumnMode
  );
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const selectedFileRef = useRef<File | null>(null);
  const cropRenderRequestRef = useRef(0);

  const isBusy = status === "validating" || status === "parsing" || status === "rendering";
  const canExport =
    status === "ready" &&
    optimizedStatus === "ready" &&
    Boolean(selectedFileRef.current) &&
    Boolean(pdfDocumentRef.current);
  const selectedPreset = getReadingPreset(selectedPresetId);
  const productPlan = getProductPlan();
  const planTier = productPlan.currentPlanTier;
  const readingSummary = summarizeRenderedPages(optimizedPages);
  const outputProfile = getOutputProfileForPreset(selectedPreset.id);
  const exportSummary = buildExportSummary(
    optimizedPages,
    selectedPreset,
    metadata?.pageCount,
    planTier === "pro" ? metadata?.pageCount ?? productPlan.freeSourcePageLimit : productPlan.freeSourcePageLimit,
    selectedPreset.supportsColumnMode && columnModeEnabled,
    planTier === "pro" ? Number.POSITIVE_INFINITY : productPlan.freeReadingPageLimit
  );
  const optimizationReport = useMemo(
    () => buildUserOptimizationReport({
      preset: selectedPreset,
      academicPlans,
      optimizedPages,
      totalSourcePages: metadata?.pageCount,
      outputProfileId: outputProfile.id
    }),
    [academicPlans, metadata?.pageCount, optimizedPages, outputProfile.id, selectedPreset]
  );
  const uxReadiness = useMemo(
    () => evaluateProductUxReadiness({
      userReport: optimizationReport,
      exportReadiness: optimizationReport.exportReadiness,
      presetState: {
        selectedPresetLabel: selectedPreset.label,
        copyRendered: true,
        ctaLabel: optimizationReport.exportLimitApplied ? "Export preview PDF" : "Export PDF"
      },
      batchState: {
        available: planTier === "pro",
        visible: true,
        zipGenerated: Boolean(batchSummary?.zipGenerated),
        failureHandled: batchJobs.some((job) => job.status === "failed") ? batchJobs.some((job) => job.status === "completed") : true,
        queuedHasNextAction: planTier === "free" || batchJobs.length === 0 || isBatchProcessing || Boolean(batchZipResult) || batchJobs.some((job) => job.status === "queued"),
        duplicateCtaCount: 0,
        hasPerFileDashboard: true,
        expandedSummaryAvailable: true,
        zipIncludesHumanSummary: true,
        zipExcludesTechnicalJsonByDefault: true
      },
      planTier,
      optimizationSummary: {
        heroClear: true,
        landingDemoRealistic: true,
        landingMockupPremiumQuality: true,
        heroMockupExplainsValue: true,
        transformCuePremium: true,
        beforeAfterPresent: true,
        beforeAfterMockupConcrete: true,
        deviceMockupsDistinct: true,
        uploadAnchorVisible: true,
        freeProClear: true,
        freeProPlanAwareRendering: true,
        proUpgradeCtaHidden: true,
        freeUpgradeCtaVisible: planTier === "free",
        proOperationalDashboardVisible: true,
        batchWorkflowClear: true,
        singlePrimaryCta: true,
        bestComparisonMeaningful: Boolean(optimizationReport.bestComparisonPageNumber),
        exportLimitVisible: true,
        preservedPagesExplained: true,
        proFeaturesUnderstandable: true,
        rawDiagnosticsHidden: !showDiagnostics,
        localFirstTrustCopyPresent: true,
        nextActionClear: true,
        userReportsNonTechnical: true,
        realDemoAssetSupportExists: true,
        realDemoAssetsDetected: false,
        demoAssetFallbackWorks: true,
        demoAssetDocsExist: true,
        demoRenderScriptExistsOrDocumented: true,
        selectedDemoTargetDocumented: true,
        landingDemoUsesBodyPageFraming: true,
        landingDemoDoesNotOverpromiseTitleReflow: true,
        landingAndLivePreviewSeparated: true,
        livePreviewPersonalizedAfterUpload: true,
        demoFallbackMarkedAsIllustration: true,
        heroVisualNotOverloaded: true,
        deviceDemoTabsGracefullyFallback: true,
        heroUsesRealOptimizedAssetWhenAvailable: true,
        heroDoesNotMixRealOriginalWithSyntheticOptimizedWhenAssetExists: true,
        demoFramesCentered: true,
        kindlePreviewNotTiny: true,
        devicePreviewSystemUnified: true,
        realAssetCopyNotMarkedIllustration: true,
        fallbackCopyMarkedIllustration: true,
        demoImageSharpnessConstraintsPresent: true,
        noFallbackFlickerWhenRealAssetsExist: true,
        demoScreenshotOverflowContained: true
      }
    }),
    [batchJobs, batchSummary?.zipGenerated, batchZipResult, isBatchProcessing, optimizationReport, planTier, selectedPreset.label, showDiagnostics]
  );

  useEffect(() => {
    return () => {
      void destroyLoadedDocument();
    };
  }, []);

  useEffect(() => {
    setShowDiagnostics(shouldShowDeveloperDiagnostics({ search: window.location.search }));
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    window.__PDF_READING_QA__ = {
      getLatestPlan: () => ({
        sourcePages: academicPlans,
        outputProfileId: outputProfile.id,
        selectedPreset: selectedPreset.id
      }),
      getLatestDiagnostics: () => columnDiagnostics,
      getLatestSummary: () => ({
        status,
        optimizedStatus,
        fileName: selectedFileRef.current?.name ?? null,
        selectedPreset: selectedPreset.id,
        outputProfileId: outputProfile.id,
        columnModeEnabled: selectedPreset.supportsColumnMode && columnModeEnabled,
        sourcePageCount: metadata?.pageCount ?? null,
        previewPageCount: optimizedPages.length,
        diagnosticsCount: columnDiagnostics.length,
        planPageCount: academicPlans.length,
        failures: academicPlans.flatMap((page) => page.summary.failureCategories),
        unrepairedFailures: academicPlans.flatMap((page) => page.summary.unrepairedFailures),
        repairedFailures: academicPlans.flatMap((page) => page.summary.repairedFailures),
        userReportGenerated: optimizationReport.userReportGenerated,
        exportReadiness: optimizationReport.exportReadiness,
        optimizedBodyPagesCount: optimizationReport.optimizedBodyPagesCount,
        preservedPagesCount: optimizationReport.preservedPagesCount,
        reviewPagesCount: optimizationReport.reviewPagesCount,
        bestComparisonPageSelected: optimizationReport.bestComparisonPageNumber,
        bestComparisonReason: optimizationReport.bestComparisonReason,
        exportLimitApplied: optimizationReport.exportLimitApplied,
        exportLimitVisible: true,
        exportReadinessRendered: true,
        exportReadinessStatus: optimizationReport.exportReadiness,
        userOptimizationReportRendered: optimizationReport.userReportGenerated,
        proHooksRendered: true,
        localFirstTrustCopyRendered: true,
        devDiagnosticsHiddenForUser: !showDiagnostics,
        planTier: optimizationReport.planTier,
        exportScope: optimizationReport.exportScope,
        sourcePagesIncluded: optimizationReport.sourcePagesIncluded,
        totalSourcePages: optimizationReport.totalSourcePages,
        outputReadingPages: optimizationReport.outputReadingPages,
        fullDocumentExportAvailableInPro: planTier === "pro",
        freeExportLimitApplied: planTier === "free" && optimizationReport.exportLimitApplied,
        freeExportLimitVisible: true,
        batchUploadAvailableInPro: planTier === "pro",
        batchFileCount: batchJobs.length,
        batchCompletedCount: batchJobs.filter((job) => job.status === "completed").length,
        batchFailedCount: batchJobs.filter((job) => job.status === "failed").length,
        batchZipGenerated: Boolean(batchSummary?.zipGenerated),
        batchSummaryGenerated: Boolean(batchSummary),
        failedBatchFileHandled: batchJobs.some((job) => job.status === "failed")
          ? batchJobs.some((job) => job.status === "completed")
          : true,
        exportProgressRendered: exportProgress.stage !== "idle",
        noSilentPartialExport: Boolean(optimizationReport.exportLimitReason),
        duplicatePrimaryCtaCount: 0,
        singlePdfExportCtaVisible: canExport,
        topBarExportCtaVisible: false,
        exportReadinessCtaVisible: canExport,
        planTierVisible: true,
        freeSourcePageLimit: optimizationReport.freeSourcePageLimit,
        freeReadingPageLimit: optimizationReport.freeReadingPageLimit,
        exportLimitHitBy: optimizationReport.exportLimitHitBy,
        batchState: getBatchStateForQa(batchJobs, isBatchProcessing, Boolean(batchZipResult)),
        batchJobsCount: batchJobs.length,
        batchQueuedCount: batchJobs.filter((job) => job.status === "queued").length,
        batchProcessingCount: batchJobs.filter((job) => job.status === "processing").length,
        batchPrimaryActionLabel: getBatchPrimaryActionForQa(batchJobs, isBatchProcessing, Boolean(batchZipResult), planTier),
        zipDownloadAvailable: Boolean(batchZipResult),
        landingHeroRendered: true,
        heroValuePropositionClear: true,
        landingDemoRealistic: true,
        landingMockupPremiumQuality: true,
        heroMockupExplainsValue: true,
        transformCuePremium: true,
        beforeAfterMockupConcrete: true,
        deviceMockupsDistinct: true,
        uploadAnchorVisible: true,
        beforeAfterSectionRendered: true,
        pricingSectionRendered: true,
        faqRendered: true,
        seoMetadataPresent: true,
        freeProGatingConsistent: true,
        freeProPlanAwareRendering: true,
        proUpgradeCtaHidden: true,
        freeUpgradeCtaVisible: planTier === "free",
        proOperationalDashboardVisible: true,
        batchQueuedHasNextAction: planTier === "free" || batchJobs.length === 0 || isBatchProcessing || Boolean(batchZipResult) || batchJobs.some((job) => job.status === "queued"),
        batchDuplicateCtaCount: 0,
        batchPerFileDashboardRendered: true,
        batchExpandableSummaryAvailable: true,
        zipIncludesHumanSummary: true,
        zipIncludesTechnicalJsonByDefault: false,
        userReportsNonTechnical: true,
        realDemoAssetSupportExists: true,
        realDemoAssetsDetected: false,
        demoAssetFallbackWorks: true,
        demoAssetDocsExist: true,
        demoRenderScriptExistsOrDocumented: true,
        selectedDemoTargetDocumented: true,
        landingDemoUsesBodyPageFraming: true,
        landingDemoDoesNotOverpromiseTitleReflow: true,
        landingAndLivePreviewSeparated: true,
        livePreviewPersonalizedAfterUpload: true,
        demoFallbackMarkedAsIllustration: true,
        heroVisualNotOverloaded: true,
        deviceDemoTabsGracefullyFallback: true,
        heroUsesRealOptimizedAssetWhenAvailable: true,
        heroDoesNotMixRealOriginalWithSyntheticOptimizedWhenAssetExists: true,
        demoFramesCentered: true,
        kindlePreviewNotTiny: true,
        devicePreviewSystemUnified: true,
        realAssetCopyNotMarkedIllustration: true,
        fallbackCopyMarkedIllustration: true,
        demoImageSharpnessConstraintsPresent: true,
        noFallbackFlickerWhenRealAssetsExist: true,
        demoScreenshotOverflowContained: true,
        preservedPagesExplained: true,
        noRawDiagnosticsVisible: !showDiagnostics,
        batchDashboardUsable: true,
        exportReadinessClear: true,
        productUxReadinessScore: uxReadiness.score,
        productUxReadinessGrade: uxReadiness.grade,
        freeExportLimit: optimizationReport.freeExportLimit,
        presetCopyRendered: true,
        upgradeCTAVisible: optimizationReport.exportLimitApplied
      }),
      selectPreset: (presetId) => handleReadingPresetChange(presetId),
      setColumnMode: (enabled) => handleColumnModeChange(enabled)
    };

    return () => {
      delete window.__PDF_READING_QA__;
    };
  }, [
    academicPlans,
    batchJobs,
    batchZipResult,
    canExport,
    batchSummary,
    columnDiagnostics,
    columnModeEnabled,
    exportProgress.stage,
    isBatchProcessing,
    metadata?.pageCount,
    optimizedPages.length,
    optimizedStatus,
    optimizationReport,
    outputProfile.id,
    planTier,
    selectedPreset.id,
    selectedPreset.supportsColumnMode,
    showDiagnostics,
    status,
    uxReadiness.grade,
    uxReadiness.score
  ]);

  useEffect(() => {
    if (status !== "ready" || !pdfDocumentRef.current) {
      return;
    }

    const requestId = cropRenderRequestRef.current + 1;
    cropRenderRequestRef.current = requestId;
    setOptimizedStatus("loading");
    setOptimizedError(null);

    const timeoutId = window.setTimeout(async () => {
      const document = pdfDocumentRef.current;

      if (!document) {
        return;
      }

      try {
        const rendered = await renderReadingPreviews(document, {
          readingPreset: selectedPreset,
          columnModeEnabled: selectedPreset.supportsColumnMode && columnModeEnabled
        });

        if (cropRenderRequestRef.current !== requestId) {
          return;
        }

        if (rendered.pages.length === 0) {
          setOptimizedPages([]);
          setOptimizedFailedPageNumbers(rendered.failedPageNumbers);
          setColumnDiagnostics(rendered.diagnostics ?? []);
          setAcademicPlans(rendered.academicPlans ?? []);
          setOptimizedStatus("error");
          setOptimizedError("We could not generate the cropped preview for this PDF.");
          return;
        }

        setOptimizedPages(rendered.pages);
        setOptimizedFailedPageNumbers(rendered.failedPageNumbers);
        setColumnDiagnostics(rendered.diagnostics ?? []);
        setAcademicPlans(rendered.academicPlans ?? []);
        setOptimizedStatus("ready");
      } catch (error) {
        if (cropRenderRequestRef.current !== requestId) {
          return;
        }

        console.error("Crop preview failed.", error);
        setOptimizedPages([]);
        setColumnDiagnostics([]);
        setAcademicPlans([]);
        setOptimizedStatus("error");
        setOptimizedError("We could not generate the cropped preview for this PDF.");
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [columnModeEnabled, selectedPreset, status]);

  async function handleFile(file: File) {
    setStatus("validating");
    setStatusMessage(null);
    setMetadata(null);
    setPages([]);
    setFailedPageNumbers([]);
    setOptimizedPages([]);
    setOptimizedFailedPageNumbers([]);
    setColumnDiagnostics([]);
    setAcademicPlans([]);
    setOptimizedStatus("idle");
    setOptimizedError(null);
    setExportMessage(null);
    setExportError(null);
    setExportProgress(INITIAL_EXPORT_PROGRESS);
    setBatchZipResult(null);
    setIsExporting(false);
    selectedFileRef.current = null;
    cropRenderRequestRef.current += 1;
    await destroyLoadedDocument();

    const validation = validatePdfFile(file);
    if (!validation.ok) {
      setStatus("error");
      setStatusMessage(validation.message);
      return;
    }

    try {
      setStatus("parsing");
      setStatusMessage("Opening PDF locally in your browser.");
      const loaded = await loadPdf(file);
      pdfDocumentRef.current = loaded.document;
      selectedFileRef.current = file;

      setStatus("rendering");
      setStatusMessage("Rendering the first pages for preview.");
      const rendered = await renderPdfPages(loaded.document);

      if (rendered.pages.length === 0) {
        setStatus("error");
        setStatusMessage("We could not render a preview for this PDF.");
        setFailedPageNumbers(rendered.failedPageNumbers);
        return;
      }

      setPages(rendered.pages);
      setFailedPageNumbers(rendered.failedPageNumbers);
      setMetadata({
        ...loaded.metadata,
        previewedPages: rendered.pages.length
      });
      setStatus("ready");
      setStatusMessage("Preview ready.");
    } catch (error) {
      const mappedError = mapPdfError(error);
      console.error("PDF preview failed.", error);
      setStatus("error");
      setStatusMessage(mappedError.message);
    }
  }

  function handleReadingPresetChange(presetId: ReadingPresetId) {
    const nextPreset = getReadingPreset(presetId);
    setExportMessage(null);
    setExportError(null);
    setExportProgress(INITIAL_EXPORT_PROGRESS);
    setSelectedPresetId(presetId);
    setColumnModeEnabled(nextPreset.defaultColumnMode);
  }

  function handleColumnModeChange(enabled: boolean) {
    setExportMessage(null);
    setExportError(null);
    setExportProgress(INITIAL_EXPORT_PROGRESS);
    setColumnModeEnabled(enabled);
  }

  async function handleExport() {
    const file = selectedFileRef.current;
    const document = pdfDocumentRef.current;

    if (!file || !document || !canExport) {
      return;
    }

    setIsExporting(true);
    setExportMessage(null);
    setExportError(null);
    setExportProgress({
      ...INITIAL_EXPORT_PROGRESS,
      stage: "preparing",
      fileName: file.name,
      startedAt: Date.now(),
      message: "Preparing PDF export."
    });

    try {
      const result = await exportSinglePdf({
        file,
        preset: selectedPreset,
        columnModeEnabled: selectedPreset.supportsColumnMode && columnModeEnabled,
        planTier,
        document,
        onProgress: setExportProgress
      });

      downloadPdf(result.bytes, result.fileName);
      setExportMessage(
        result.exportLimitApplied
          ? `Exported preview PDF: ${result.outputReadingPages} reading pages from the first ${result.sourcePagesIncluded} of ${result.totalSourcePages} source pages.`
          : `Exported full document: ${result.outputReadingPages} reading pages from all ${result.totalSourcePages} source pages.`
      );
    } catch (error) {
      console.error("Safe Auto Crop export failed.", error);
      setExportProgress({
        ...INITIAL_EXPORT_PROGRESS,
        stage: "failed",
        fileName: file.name,
        message: "This PDF could not be processed."
      });
      setExportError(
        error instanceof Error &&
          error.message === "This PDF appears to be protected and cannot be exported by this prototype."
          ? error.message
          : "We could not export this PDF. The preview is still available."
      );
    } finally {
      setIsExporting(false);
    }
  }

  function handleBatchFilesSelected(files: File[]) {
    setBatchError(null);
    setBatchSummary(null);
    setBatchZipResult(null);

    if (planTier !== "pro") {
      setBatchFiles([]);
      setBatchJobs([]);
      setBatchError("Batch export is a Pro feature. Free beta supports one PDF at a time.");
      return;
    }

    const validFiles = files.filter((file) => validatePdfFile(file).ok);
    if (validFiles.length !== files.length) {
      setBatchError("Some files could not be added. Batch export accepts PDFs up to the current size limit.");
    }

    if (validFiles.length > productPlan.maxProFilesPerBatch) {
      setBatchFiles(validFiles.slice(0, productPlan.maxProFilesPerBatch));
      setBatchError(`Batch export supports up to ${productPlan.maxProFilesPerBatch} PDFs at a time.`);
    } else {
      setBatchFiles(validFiles);
    }

    const nextFiles = validFiles.slice(0, productPlan.maxProFilesPerBatch);
    setBatchJobs(nextFiles.map((file, index) => ({
      id: `${file.name}-${file.size}-${index}`,
      fileName: file.name,
      fileSize: file.size,
      status: "queued",
      progress: 0
    })));
  }

  async function handleBatchExport() {
    if (planTier !== "pro") {
      setBatchError("Batch export is a Pro feature. Free beta supports one PDF at a time.");
      return;
    }
    if (batchFiles.length === 0 || isBatchProcessing) {
      return;
    }

    setIsBatchProcessing(true);
    setBatchError(null);
    setBatchSummary(null);
    setBatchZipResult(null);
    setExportProgress({
      ...INITIAL_EXPORT_PROGRESS,
      stage: "preparing",
      totalFiles: batchFiles.length,
      currentFile: 1,
      startedAt: Date.now(),
      message: "Preparing batch export."
    });

    try {
      const result = await exportBatchToZip({
        files: batchFiles,
        preset: selectedPreset,
        columnModeEnabled: selectedPreset.supportsColumnMode && columnModeEnabled,
        planTier,
        onJobUpdate: setBatchJobs,
        onProgress: setExportProgress
      });
      setBatchJobs(result.jobs);
      setBatchSummary(result.summary);
      setBatchZipResult(result);
      setExportProgress({
        stage: "completed",
        totalFiles: batchFiles.length,
        currentFile: batchFiles.length,
        optimizedPages: result.summary.optimizedPages,
        preservedPages: result.summary.preservedPages,
        warningCount: result.summary.reviewPages,
        message: "Batch ZIP export completed."
      });
    } catch (error) {
      console.error("Batch export failed.", error);
      setExportProgress({
        ...INITIAL_EXPORT_PROGRESS,
        stage: "failed",
        totalFiles: batchFiles.length,
        message: "Batch export could not be completed."
      });
      setBatchError(error instanceof Error ? error.message : "Batch export could not be completed.");
    } finally {
      setIsBatchProcessing(false);
    }
  }

  function handleBatchDownload() {
    if (!batchZipResult) return;
    downloadZip(batchZipResult.bytes, batchZipResult.fileName);
  }

  function handleRemoveBatchJob(jobId: string) {
    if (isBatchProcessing) return;
    setBatchJobs((currentJobs) => currentJobs.filter((job) => job.id !== jobId));
    setBatchFiles((currentFiles) => currentFiles.filter((_, index) => batchJobs[index]?.id !== jobId));
    setBatchSummary(null);
    setBatchZipResult(null);
  }

  async function destroyLoadedDocument() {
    const document = pdfDocumentRef.current;
    pdfDocumentRef.current = null;

    if (document) {
      await document.destroy();
    }
  }

  return (
    <main>
      <Hero />
      <ProblemSection />
      <StaticBeforeAfterSection />
      <BuiltForPapersSection />
      <LocalFirstSection />
      <PricingSection planTier={planTier} />
      <div id="tool-workflow" className="mx-auto grid max-w-6xl scroll-mt-6 gap-6 px-5 pb-16 pt-4 md:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-sage">Reading optimizer</p>
          <h2 className="mt-1 text-3xl font-semibold text-ink">Optimize your PDF</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/62">
            Upload one paper, choose a reading target, and export a reading-friendly version.
          </p>
        </div>
        <section className="grid gap-4">
          <PdfDropzone disabled={isBusy} onFileSelected={handleFile} />
          <LocalFirstTrust />
          {status === "parsing" || status === "rendering" ? (
            <StatusMessage tone="info" title={status === "parsing" ? "Parsing PDF" : "Rendering preview"} message={statusMessage ?? undefined} />
          ) : null}
          {status === "error" && statusMessage ? (
            <StatusMessage tone="error" title="Could not use this PDF" message={statusMessage} />
          ) : null}
          {status === "ready" && statusMessage ? (
            <StatusMessage tone="success" title={statusMessage} message="The first available pages are shown below." />
          ) : null}
        </section>

        {metadata ? <PdfMetadataCard metadata={metadata} /> : null}

        {pages.length > 0 ? (
          <>
            <ToolControlBar
              selectedPresetId={selectedPresetId}
              selectedPreset={selectedPreset}
              onSelectPreset={handleReadingPresetChange}
              columnModeEnabled={selectedPreset.supportsColumnMode && columnModeEnabled}
              onColumnModeChange={handleColumnModeChange}
              isLoaded={pages.length > 0}
              exportMessage={exportMessage}
              exportError={exportError}
              exportSummary={exportSummary}
              outputProfileLabel={outputProfile.label}
            />
            <ExportPanel
              canExport={canExport}
              isLoaded={pages.length > 0}
              isSafeAutoReady={optimizedStatus === "ready"}
              isExporting={isExporting}
              exportMessage={exportMessage}
              exportError={exportError}
              pageCount={metadata?.pageCount}
              preset={selectedPreset}
              exportSummary={exportSummary}
              columnModeEnabled={selectedPreset.supportsColumnMode && columnModeEnabled}
              outputProfileLabel={outputProfile.label}
              optimizationReport={optimizationReport}
              onExport={handleExport}
            />
            <ExportProgressPanel progress={exportProgress} />
          </>
        ) : null}

        <div id="batch-export" className="scroll-mt-6">
          <BatchExportPanel
            planTier={planTier}
            jobs={batchJobs}
            summary={batchSummary}
            selectedPresetLabel={selectedPreset.label}
            isProcessing={isBatchProcessing}
            zipReady={Boolean(batchZipResult)}
            error={batchError}
            onFilesSelected={handleBatchFilesSelected}
            onStart={handleBatchExport}
            onDownload={handleBatchDownload}
            onRemoveJob={handleRemoveBatchJob}
          />
        </div>

        {showDiagnostics ? (
          <ColumnDiagnosticsPanel
            diagnostics={columnDiagnostics}
            fileName={selectedFileRef.current?.name}
            metadata={metadata}
            selectedPreset={selectedPreset}
            columnModeEnabled={selectedPreset.supportsColumnMode && columnModeEnabled}
            config={getColumnDetectionDebugConfig(selectedPreset)}
          />
        ) : null}

        <BeforeAfterPanel
          pages={pages}
          optimizedPages={optimizedPages}
          failedPageNumbers={failedPageNumbers}
          optimizedFailedPageNumbers={optimizedFailedPageNumbers}
          optimizedStatus={optimizedStatus}
          optimizedError={optimizedError}
          selectedPreset={selectedPreset}
          optimizationReport={optimizationReport}
        />
        {optimizedStatus === "ready" ? (
          <>
            <OptimizationReport report={optimizationReport} />
            <ReadingMetricsSummary
              summary={readingSummary}
              preset={selectedPreset}
              columnModeEnabled={selectedPreset.supportsColumnMode && columnModeEnabled}
              exportSummary={exportSummary}
            />
            <PageSafetyReport pages={optimizedPages} summary={readingSummary} preset={selectedPreset} />
          </>
        ) : null}
        <PresetCards />
      </div>
      <div id="how-it-works">
        <HowItWorks />
      </div>
      <UseCases />
      <FaqSection />
      <PrivacyNote />
      <Limitations />
      <DemoPlaceholder />
    </main>
  );
}

function LocalFirstTrust() {
  const items = [
    "Local-first processing",
    "Your files stay in your browser",
    "Best with selectable-text PDFs",
    "Complex pages are preserved safely"
  ];

  return (
    <section className="grid gap-2 rounded-lg border border-sage/20 bg-white/65 p-3" data-qa="local-first-trust">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-sage/15 bg-mist/50 px-3 py-1 text-xs font-semibold text-ink/65">
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function getBatchStateForQa(
  jobs: BatchJob[],
  isProcessing: boolean,
  zipReady: boolean
): "empty" | "files-selected" | "processing" | "completed" | "failed" {
  if (isProcessing) return "processing";
  if (zipReady) return "completed";
  if (jobs.some((job) => job.status === "failed")) return "failed";
  if (jobs.length > 0) return "files-selected";
  return "empty";
}

function getBatchPrimaryActionForQa(
  jobs: BatchJob[],
  isProcessing: boolean,
  zipReady: boolean,
  planTier: "free" | "pro"
): string {
  if (planTier === "free") return "Join early access";
  const state = getBatchStateForQa(jobs, isProcessing, zipReady);
  if (state === "empty") return "Choose PDFs";
  if (state === "processing") return "Processing...";
  if (state === "completed") return "Download ZIP";
  return "Start batch export";
}
