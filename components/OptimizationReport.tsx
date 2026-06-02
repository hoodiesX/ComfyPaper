import type { UserOptimizationReport } from "@/lib/product/optimizationReport";

type OptimizationReportProps = {
  report: UserOptimizationReport;
};

export function OptimizationReport({ report }: OptimizationReportProps) {
  return (
    <section className="grid gap-4 rounded-lg border border-sage/20 bg-white/75 p-4 shadow-soft" data-qa="user-optimization-report">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-sage">Optimization report</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">{report.qualityBadge}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/65">
            Preserved pages are kept close to the original to avoid damaging complex content.
          </p>
        </div>
        <span className={getBadgeClass(report.qualityBadge)}>
          {report.exportReadiness.replaceAll("-", " ")}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ReportSection
          title="What changed"
          items={[
            `${report.optimizedBodyPagesCount} body page${report.optimizedBodyPagesCount === 1 ? "" : "s"} optimized`,
            `${report.optimizedBodyPagesCount} page${report.optimizedBodyPagesCount === 1 ? "" : "s"} split into reading pages`,
            report.readingImprovementItems.find((item) => item.startsWith("Average page fill")) ?? "Margins cleaned where safe",
            `${report.preservedPagesCount} page${report.preservedPagesCount === 1 ? "" : "s"} preserved safely`
          ]}
        />
        <ReportSection
          title="Preserved safely"
          items={[
            "Title and cover pages may be preserved.",
            "Figures, tables and complex layouts stay close to the original.",
            "Uncertain first pages are handled conservatively."
          ]}
        />
        <ReportSection
          title="Recommended preset"
          items={[`${report.recommendedPresetLabel}: ${report.recommendedPresetReason}`]}
        />
      </div>

      {report.reviewPagesCount > 0 ? (
        <ReportSection
          title="Pages to review"
          items={report.reviewOutcomes.slice(0, 4).map((item) => `Page ${item.pageNumber}: ${item.message}`)}
        />
      ) : null}

      <div className="rounded-md border border-sage/15 bg-paper/80 px-3 py-2 text-sm leading-6 text-ink/65">
        <strong className="text-ink">Export status:</strong> {report.exportLimitReason}
      </div>
    </section>
  );
}

function ReportSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-ink/65">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function getBadgeClass(badge: UserOptimizationReport["qualityBadge"]): string {
  const base = "w-fit rounded-full border px-3 py-1 text-xs font-semibold";
  if (badge === "Ready") return `${base} border-sage/25 bg-sage/10 text-sage`;
  if (badge === "Good") return `${base} border-sage/20 bg-mist/70 text-sage`;
  if (badge === "Review suggested") return `${base} border-amber-300/50 bg-amber-50 text-amber-700`;
  return `${base} border-clay/30 bg-clay/10 text-clay`;
}
