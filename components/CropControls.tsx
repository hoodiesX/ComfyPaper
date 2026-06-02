"use client";

import type { CropMode, ManualCropPreset } from "@/types/pdf";
import {
  MAX_CROP_PERCENTAGE,
  MIN_CROP_PERCENTAGE
} from "@/lib/pdf/cropPreview";

type CropControlsProps = {
  cropMode: CropMode;
  manualPreset: ManualCropPreset;
  percentage: number;
  onCropModeChange: (mode: CropMode) => void;
  onManualPresetChange: (preset: ManualCropPreset) => void;
  onCustomPercentageChange: (percentage: number) => void;
  onReset: () => void;
};

const manualOptions: Array<{ preset: ManualCropPreset; label: string; detail: string }> = [
  { preset: "conservative", label: "Manual Conservative", detail: "5%" },
  { preset: "balanced", label: "Manual Balanced", detail: "8%" },
  { preset: "aggressive", label: "Manual Aggressive", detail: "12%" },
  { preset: "custom", label: "Manual Custom", detail: "0-18%" }
];

export function CropControls({
  cropMode,
  manualPreset,
  percentage,
  onCropModeChange,
  onManualPresetChange,
  onCustomPercentageChange,
  onReset
}: CropControlsProps) {
  return (
    <div className="rounded-lg border border-sage/25 bg-white/80 p-4 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink">Crop Margins</h3>
          <p className="mt-1 text-sm leading-6 text-ink/62">
            Make dense PDFs easier to read by reducing empty page space.
          </p>
          <p className="mt-1 text-sm text-ink/55">
            Preview only. Export will be added next.
          </p>
          <p className="mt-1 text-sm text-ink/55">
            Works best on text-based PDFs with large margins.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="w-fit rounded-md border border-sage/35 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-sage hover:bg-mist"
        >
          Reset
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onCropModeChange("safe-auto")}
          className={`rounded-lg border p-3 text-left transition ${
            cropMode === "safe-auto"
              ? "border-ink bg-ink text-paper"
              : "border-sage/25 bg-mist/55 text-ink hover:border-sage/55"
          }`}
        >
          <span className="block text-sm font-semibold">Safe Auto Crop</span>
          <span className={`mt-1 block text-xs ${cropMode === "safe-auto" ? "text-paper/72" : "text-ink/55"}`}>
            Recommended
          </span>
        </button>
        <button
          type="button"
          onClick={() => onCropModeChange("manual")}
          className={`rounded-lg border p-3 text-left transition ${
            cropMode === "manual"
              ? "border-ink bg-ink text-paper"
              : "border-sage/25 bg-mist/55 text-ink hover:border-sage/55"
          }`}
        >
          <span className="block text-sm font-semibold">Manual Crop</span>
          <span className={`mt-1 block text-xs ${cropMode === "manual" ? "text-paper/72" : "text-ink/55"}`}>
            Uniform crop
          </span>
        </button>
      </div>

      {cropMode === "safe-auto" ? (
        <p className="mt-4 rounded-md border border-sage/25 bg-mist/55 px-3 py-2 text-sm leading-6 text-ink/68">
          Detects safe removable margins page by page. If a page has no safe margins, it will not be cropped.
        </p>
      ) : (
        <>
          <p className="mt-4 rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm leading-6 text-ink/72">
            Manual crop can cut content on pages with narrow margins. Use Safe Auto Crop for safer results.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {manualOptions.map((option) => {
              const isSelected = manualPreset === option.preset;

              return (
                <button
                  key={option.preset}
                  type="button"
                  onClick={() => onManualPresetChange(option.preset)}
                  className={`rounded-lg border p-3 text-left transition ${
                    isSelected
                      ? "border-ink bg-ink text-paper"
                      : "border-sage/25 bg-mist/55 text-ink hover:border-sage/55"
                  }`}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className={`mt-1 block text-xs ${isSelected ? "text-paper/72" : "text-ink/55"}`}>
                    {option.detail}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="mt-4 block">
            <span className="flex items-center justify-between text-sm font-semibold text-ink">
              <span>Crop strength</span>
              <span>{Math.round(percentage)}%</span>
            </span>
            <input
              type="range"
              min={MIN_CROP_PERCENTAGE}
              max={MAX_CROP_PERCENTAGE}
              step={1}
              value={percentage}
              onChange={(event) => onCustomPercentageChange(Number(event.target.value))}
              className="mt-3 w-full accent-ink"
              aria-label="Custom crop percentage"
            />
          </label>
        </>
      )}
    </div>
  );
}
