type StatusMessageProps = {
  tone: "info" | "error" | "success";
  title: string;
  message?: string;
};

const toneStyles = {
  info: "border-sage/30 bg-white/70 text-ink",
  error: "border-clay/40 bg-clay/10 text-ink",
  success: "border-sage/40 bg-sage/10 text-ink"
};

export function StatusMessage({ tone, title, message }: StatusMessageProps) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneStyles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      <p className="text-sm font-semibold">{title}</p>
      {message ? <p className="mt-1 text-sm text-ink/70">{message}</p> : null}
    </div>
  );
}
