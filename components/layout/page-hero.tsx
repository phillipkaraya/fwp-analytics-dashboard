import { fmtPct, numeralShift } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface HeroStat {
  label: string;
  value: React.ReactNode;
  /** Percent change vs a prior window. null = no baseline; omit = show hint. */
  pct?: number | null;
  hint?: React.ReactNode;
}

interface PageHeroProps {
  eyebrow: React.ReactNode;
  title?: React.ReactNode;
  lede?: React.ReactNode;
  stats?: HeroStat[];
  /** Right-hand panel; use <HeroPanel> for the standard translucent card. */
  aside?: React.ReactNode;
  /** Extra content under the stats (a sentence, a note). */
  footer?: React.ReactNode;
}

/**
 * The dark band every tab opens on: eyebrow, optional title, display-size
 * numerals, and an optional side panel. Phil approved this shape on the
 * Overview (2026-09-04) and asked for it on every tab.
 */
export function PageHero({ eyebrow, title, lede, stats = [], aside, footer }: PageHeroProps) {
  return (
    <section className="hero relative overflow-hidden text-white">
      <div aria-hidden className="hero-grid absolute inset-0" />
      <div className="relative mx-auto max-w-[1500px] px-6 pb-12 pt-8 lg:pb-14 lg:pt-10">
        <div
          className={cn(
            "grid gap-10",
            aside && "lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-16",
          )}
        >
          <div className="min-w-0">
            <p className="rise font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
              {eyebrow}
            </p>
            {title && (
              <h2
                className="rise font-display mt-2 text-3xl font-medium tracking-[-0.02em] sm:text-4xl"
                style={{ "--rise-delay": "40ms" } as React.CSSProperties}
              >
                {title}
              </h2>
            )}
            {lede && (
              <p
                className="rise mt-3 max-w-2xl text-sm text-white/65"
                style={{ "--rise-delay": "80ms" } as React.CSSProperties}
              >
                {lede}
              </p>
            )}
            {/* Phones: a strict 2x2 grid, so a long hint under one stat cannot
                push the next stat onto its own row. From sm: natural widths
                with one even gap, so a short value next to a long one does not
                leave a hole (equal columns did). */}
            {stats.length > 0 && (
              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:flex sm:flex-wrap sm:gap-x-12 lg:justify-between lg:gap-x-8">
                {stats.map((s, i) => (
                  <div
                    key={s.label}
                    className="rise min-w-0 break-words sm:min-w-[8.5rem]"
                    style={{ "--rise-delay": `${120 + i * 70}ms` } as React.CSSProperties}
                  >
                    {/* Digit ink, not the glyph box, sits on the label's left
                        edge; a leading 1 aligns by its stem. See numeralShift. */}
                    <dd
                      className="tabular font-display text-5xl font-semibold leading-[0.95] tracking-[-0.03em] sm:text-6xl lg:text-7xl"
                      style={{ marginLeft: numeralShift(s.value) }}
                    >
                      {s.value}
                    </dd>
                    <dt className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">
                      {s.label}
                    </dt>
                    {(s.pct !== undefined || s.hint) && (
                      <div className="mt-2 text-xs text-white/55">
                        {s.pct !== undefined ? <HeroDelta pct={s.pct} /> : s.hint}
                      </div>
                    )}
                  </div>
                ))}
              </dl>
            )}
            {footer && (
              <div
                className="rise mt-8 text-sm text-white/60"
                style={{ "--rise-delay": "420ms" } as React.CSSProperties}
              >
                {footer}
              </div>
            )}
          </div>
          {aside}
        </div>
      </div>
    </section>
  );
}

/** Translucent card on the right of the band. */
export function HeroPanel({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "rise self-start rounded-lg bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur-sm",
        className,
      )}
      style={{ "--rise-delay": "200ms" } as React.CSSProperties}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">{label}</p>
      {children}
    </aside>
  );
}

/** Row inside a HeroPanel: label on the left, value(s) on the right. */
export function HeroRow({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-white/10 pt-2.5 text-sm first:border-t-0 first:pt-0">
      <span className="flex min-w-0 items-center gap-2 text-white/80 [&>span:last-child]:truncate">{label}</span>
      <span className="flex shrink-0 items-baseline gap-2">{children}</span>
    </li>
  );
}

export function HeroDelta({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
        no prior window
      </span>
    );
  }
  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium",
        flat ? "text-white/70" : up ? "on-dark-up" : "on-dark-down",
      )}
    >
      {flat ? "=" : up ? "▲" : "▼"} {fmtPct(Math.abs(pct), Math.abs(pct) >= 100 ? 0 : 1)}
      <span className="font-normal text-white/50">vs prior</span>
    </span>
  );
}

export function SignedCount({ n }: { n: number }) {
  if (n === 0) return <span>0</span>;
  return (
    <span className={n > 0 ? "on-dark-up" : "on-dark-down"}>
      {n > 0 ? "+" : "−"}
      {Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}K` : Math.abs(n)}
    </span>
  );
}
