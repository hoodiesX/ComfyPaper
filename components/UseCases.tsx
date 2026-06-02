const useCases = [
  "Academic papers with large margins",
  "Lecture notes on iPad",
  "Technical PDFs on Kindle Scribe and e-readers",
  "Dense reports on tablets",
  "White-margin cleanup before reading"
];

export function UseCases() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-10 md:px-8">
      <h2 className="text-2xl font-semibold text-ink">Built for reading workflows</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {useCases.map((useCase) => (
          <div key={useCase} className="rounded-lg border border-sage/20 bg-mist/55 p-3 text-sm leading-6 text-ink/70">
            {useCase}
          </div>
        ))}
      </div>
    </section>
  );
}
