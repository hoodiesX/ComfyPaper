export function PrivacyNote() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-10 md:px-8">
      <div className="rounded-lg border border-sage/25 bg-white/75 p-5 shadow-soft">
        <h2 className="text-2xl font-semibold text-ink">Local-first by design</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
          PDFs are parsed, previewed and exported in your browser for this prototype. There is no backend upload,
          account system or cloud storage in the current product.
        </p>
        <div className="mt-4 grid gap-2 text-sm leading-6 text-ink/65 md:grid-cols-2">
          <p>Best results come from selectable-text academic PDFs.</p>
          <p>Complex title, figure and table pages may be preserved for safety.</p>
          <p>Academic Paper is the recommended first choice.</p>
          <p>Kindle mode is an advanced e-reader profile with review warnings when needed.</p>
        </div>
      </div>
    </section>
  );
}
