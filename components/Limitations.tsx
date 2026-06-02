const limitations = [
  "Works best with text-based PDFs.",
  "Scanned or image-heavy PDFs may be less predictable.",
  "Protected PDFs may fail.",
  "Free beta export is limited to 5 source pages or 12 generated reading pages.",
  "This is not OCR and does not reflow text."
];

export function Limitations() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-10 md:px-8">
      <h2 className="text-2xl font-semibold text-ink">Current limitations</h2>
      <ul className="mt-4 grid gap-2 md:grid-cols-2">
        {limitations.map((limitation) => (
          <li key={limitation} className="rounded-lg border border-sage/20 bg-white/65 p-3 text-sm text-ink/65">
            {limitation}
          </li>
        ))}
      </ul>
    </section>
  );
}
