"use client";

import type { ExportSummary } from "@/lib/metrics/pageSummary";
import { getCommandBarChips } from "@/lib/metrics/exportSummaryCopy";
import type { ReadingPresetConfig, ReadingPresetId } from "@/lib/presets/presetTypes";
import { ColumnModeToggle } from "./ColumnModeToggle";
import { PresetSelector } from "./PresetSelector";

type ToolControlBarProps = {
  selectedPresetId: ReadingPresetId;
  selectedPreset: ReadingPresetConfig;
  onSelectPreset: (presetId: ReadingPresetId) => void;
  columnModeEnabled: boolean;
  onColumnModeChange: (enabled: boolean) => void;
  isLoaded: boolean;
  exportMessage?: string | null;
  exportError?: string | null;
  exportSummary: ExportSummary;
  outputProfileLabel: string;
};

export function ToolControlBar({
  selectedPresetId,
  selectedPreset,
  onSelectPreset,
  columnModeEnabled,
  onColumnModeChange,
  isLoaded,
  exportMessage,
  exportError,
  exportSummary,
  outputProfileLabel
}: ToolControlBarProps) {
  const chips = getCommandBarChips(exportSummary, columnModeEnabled);
  const feedback = exportError ? "Export failed" : exportMessage ? "Downloaded" : null;

  return (
    <section className="rounded-2xl border border-sage/20 bg-paper/90 p-2.5 shadow-soft md:sticky md:top-3 md:z-10 md:backdrop-blur">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <span className="hidden whitespace-nowrap text-xs font-semibold uppercase tracking-[0.08em] text-ink/45 sm:inline">
            Target
          </span>
        </div>
        <PresetSelector selectedPresetId={selectedPresetId} onSelectPreset={onSelectPreset} />
        <ColumnModeToggle
          preset={selectedPreset}
          enabled={columnModeEnabled}
          onChange={onColumnModeChange}
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm lg:justify-end">
          {chips.map((chip, index) => (
            <span
              key={chip}
              className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${
                index === 0
                  ? "border-sage/30 bg-mist/75 text-sage"
                  : "border-sage/20 bg-white/70 text-ink/55"
              }`}
            >
              {chip}
            </span>
          ))}
          {columnModeEnabled ? (
            <span className="hidden whitespace-nowrap rounded-full border border-sage/20 bg-white/70 px-2.5 py-1 text-xs font-semibold text-ink/45 xl:inline-flex">
              {outputProfileLabel}
            </span>
          ) : null}
          {feedback ? (
            <span
              className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${
                exportError
                  ? "border-clay/25 bg-clay/10 text-clay"
                  : "border-sage/25 bg-sage/10 text-sage"
              }`}
            >
              {feedback}
            </span>
          ) : null}
        </div>
      </div>
      {!isLoaded ? (
        <p className="mt-2 text-sm text-ink/55">Upload a PDF to enable preview and export.</p>
      ) : null}
    </section>
  );
}
