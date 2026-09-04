import { cn } from "@/lib/utils";

/**
 * Wraps a card and stamps an oversized watermark numeral in its top-right
 * corner (see `.numbered::before` in globals.css). Used to break the
 * "twelve identical cards" rhythm without every component needing a prop.
 * Skip it on cards whose header already carries controls on the right.
 */
export function Numbered({
  n,
  children,
  className,
}: {
  n: number | string;
  children: React.ReactNode;
  className?: string;
}) {
  const label = typeof n === "number" ? String(n).padStart(2, "0") : n;
  return (
    <div data-n={label} className={cn("numbered relative", className)}>
      {children}
    </div>
  );
}
