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
}: {
  date?: string;
  label?: string;
  detail?: string;
  className?: string;
}) {
  if (!date) return null;
  return (
    <p
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-warn",
        className,
      )}
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-warn" />
      <span>
        {label} through {fmtDate(date)}
      </span>
      {detail && (
        <span className="font-sans text-xs normal-case tracking-normal text-ink-muted">
          {detail}
        </span>
      )}
    </p>
  );
}
