import { cn } from "@/lib/utils";

interface SectionProps {
  title: string;
  /** Small mono label above the title. Optional; most cards only need a title. */
  kicker?: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * The card every chart and table sits in. The title is real display type
 * (the old version used the mono label as the only heading, which is what
 * made the card layer read as generic next to the hero).
 */
export function Section({
  title,
  kicker,
  hint,
  action,
  children,
  className,
  bodyClassName,
}: SectionProps) {
  return (
    <section className={cn("card relative p-5", className)}>
      <header className="relative z-[1] mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {kicker && (
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-brand">
              {kicker}
            </p>
          )}
          <h3 className="font-display text-lg font-semibold leading-tight tracking-[-0.02em] text-ink">
            {title}
          </h3>
          {hint && <p className="mt-1 max-w-prose text-sm text-ink-muted">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
