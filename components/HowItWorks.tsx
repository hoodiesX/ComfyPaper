const steps = [
  ["Upload", "Choose an academic paper, lecture note or dense report."],
  ["Preview", "Compare original pages with safe per-page margin cleanup."],
  ["Export", "Download a cropped PDF that preserves text and vector quality where possible."]
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-10 md:px-8">
      <h2 className="text-2xl font-semibold text-ink">How it works</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map(([title, copy]) => (
          <div key={title} className="rounded-lg border border-sage/20 bg-white/70 p-4">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/62">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
