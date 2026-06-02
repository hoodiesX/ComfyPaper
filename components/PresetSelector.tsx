import React from "react";
import { READING_PRESETS } from "@/lib/presets/readingPresets";
import type { ReadingPresetConfig, ReadingPresetId } from "@/lib/presets/presetTypes";

type PresetSelectorProps = {
  selectedPresetId: ReadingPresetId;
  onSelectPreset: (presetId: ReadingPresetId) => void;
};

export function PresetSelector({ selectedPresetId, onSelectPreset }: PresetSelectorProps) {
  return (
    <div className="min-w-0">
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-sage/10 p-1">
        {READING_PRESETS.map((preset) => {
          const selected = preset.id === selectedPresetId;

          return (
            <button
              key={preset.id}
              type="button"
              title={preset.label}
              onClick={() => onSelectPreset(preset.id)}
              data-testid={`preset-${preset.id}`}
              className={`min-w-fit rounded-md px-2.5 py-1.5 text-left transition ${
                selected
                  ? "bg-ink text-paper shadow-sm"
                  : "text-ink/62 hover:bg-white/75 hover:text-ink"
              }`}
            >
              <span className="flex items-center justify-between gap-2 whitespace-nowrap">
                <span className="text-sm font-semibold">{getCompactPresetLabel(preset)}</span>
                <span className={`hidden rounded px-1.5 py-0.5 text-[11px] font-semibold xl:inline ${selected ? "bg-paper/10 text-paper/80" : "bg-white/80 text-sage"}`}>
                  {preset.tag}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getCompactPresetLabel(preset: ReadingPresetConfig): string {
  if (preset.id === "safe-default") return "Safe";
  if (preset.id === "academic-paper") return "Academic";
  if (preset.id === "kindle-ereader") return "Kindle";
  if (preset.id === "ipad-tablet") return "iPad";
  return preset.label;
}
