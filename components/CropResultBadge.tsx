import type { ColumnSplitStatus, CropStatus } from "@/types/pdf";

type CropResultBadgeProps = {
  status?: CropStatus;
  columnStatus?: ColumnSplitStatus;
  gainPercent?: number;
};

const labels: Record<CropStatus, string> = {
  "auto-cropped": "Auto cropped",
  "minimal-crop": "Minimal crop",
  "no-safe-crop": "No safe crop detected",
  "manual-crop": "Manual crop",
  failed: "Crop failed"
};

const columnLabels: Record<ColumnSplitStatus, string> = {
  split: "Split into columns",
  "not-two-column": "Margin crop only",
  uncertain: "Uncertain layout",
  "full-width-content": "Preserved: no safe column split",
  "low-confidence": "Uncertain layout",
  failed: "Column split failed"
};

export function CropResultBadge({ status, columnStatus, gainPercent }: CropResultBadgeProps) {
  if (columnStatus) {
    return (
      <span className="inline-flex items-center gap-2 rounded-md border border-sage/25 bg-mist/70 px-2 py-1 text-xs font-semibold text-ink/72">
        <span>{columnLabels[columnStatus]}</span>
        {gainPercent && columnStatus === "split" ? <span className="text-sage">+{gainPercent}%</span> : null}
      </span>
    );
  }

  if (!status) {
    return null;
  }

  const showGain = status === "auto-cropped" || status === "manual-crop";
  const detail = showGain && gainPercent ? `+${gainPercent}% reading area` : null;

  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-sage/25 bg-mist/70 px-2 py-1 text-xs font-semibold text-ink/72">
      <span>{labels[status]}</span>
      {detail ? <span className="text-sage">{detail}</span> : null}
    </span>
  );
}
