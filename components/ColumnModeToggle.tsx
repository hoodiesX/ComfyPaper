import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";

type ColumnModeToggleProps = {
  preset: ReadingPresetConfig;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export function ColumnModeToggle({ preset, enabled, onChange }: ColumnModeToggleProps) {
  if (!preset.supportsColumnMode) {
    return null;
  }

  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-sage/20 bg-white/75 px-2.5 py-1.5">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-ink"
      />
      <span className="whitespace-nowrap text-sm font-semibold text-ink">
        Column {enabled ? "On" : "Off"}
      </span>
    </label>
  );
}
