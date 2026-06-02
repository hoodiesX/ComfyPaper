import { READING_PRESETS } from "@/lib/presets/readingPresets";

export function PresetCards() {
  return (
    <section className="rounded-lg border border-sage/20 bg-white/60 p-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-sage">Reading presets</p>
        <h2 className="mt-1 text-xl font-semibold text-ink">Choose the output for your device</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {READING_PRESETS.map((preset) => (
          <article key={preset.id} className="rounded-md border border-sage/15 bg-mist/45 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-ink">{preset.label}</h3>
                <p className="mt-1 text-sm leading-6 text-ink/62">{preset.shortDescription}</p>
              </div>
              <span className="shrink-0 rounded-full border border-sage/20 bg-white/80 px-2.5 py-1 text-xs font-semibold text-sage">
                {preset.badge ?? preset.tag}
              </span>
            </div>
            <ul className="mt-2 grid gap-1 text-sm leading-6 text-ink/62">
              {preset.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/62">{getPresetNote(preset.id)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function getPresetNote(presetId: string): string {
  if (presetId === "academic-paper") return "Best first choice.";
  if (presetId === "kindle-ereader") return "Best for body-heavy papers. Some complex pages may be preserved.";
  if (presetId === "ipad-tablet") return "Comfortable reading with fewer splits and larger page chunks.";
  return "Conservative cleanup for complex PDFs.";
}
