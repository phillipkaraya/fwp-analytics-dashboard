import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One consistent label for data that is a frozen snapshot (comments and
 * follow data have no scraper yet). Mono eyebrow, warn dot, the date.
 */
export function StaleNote({
  date,
  label = "Snapshot",
  detail,
  className,
  tone = "light",
}: {
  date?: string;
  label?: string;
  detail?: string;
  className?: string;
  /** "dark" lifts the colors for use inside the hero band. */
  tone?: "light" | "dark";
}) {
  if (!date) return null;
  return (
    <p
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em]",
        tone === "dark" ? "on-dark-warn" : "text-warn",
        className,
      )}
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      <span>
        {label} through {fmtDate(date)}
      </span>
      {detail && (
        <span
          className={cn(
            "font-sans text-xs normal-case tracking-normal",
            tone === "dark" ? "text-white/60" : "text-ink-muted",
          )}
        >
          {detail}
        </span>
      )}
    </p>
  );
}
