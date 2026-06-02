import { formatFileSize } from "@/lib/formatting";
import type { PdfMetadata } from "@/types/pdf";

type PdfMetadataCardProps = {
  metadata: PdfMetadata;
};

export function PdfMetadataCard({ metadata }: PdfMetadataCardProps) {
  const items = [
    ["File", metadata.fileName],
    ["Size", formatFileSize(metadata.fileSize)],
    ["Pages", metadata.pageCount.toLocaleString("en-US")],
    ["Previewed", metadata.previewedPages.toLocaleString("en-US")]
  ];

  return (
    <section className="rounded-lg border border-sage/25 bg-white/80 p-5 shadow-soft">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-sage">
        PDF details
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-md bg-mist/70 p-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/50">
              {label}
            </dt>
            <dd className="mt-1 truncate text-sm font-medium text-ink" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
