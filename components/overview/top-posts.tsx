import { Section } from "@/components/charts/section";
import { PlatformBadge } from "@/components/charts/platform-badge";
import { fmt, fmtPct, fmtDate } from "@/lib/format";
import { topPosts, toNum, windowLabel } from "@/lib/derive";
import { Numbered } from "@/components/charts/numbered";
import type { Post } from "@/lib/types";

export function TopPosts({ posts, days = 30 }: { posts: Post[]; days?: number }) {
  const top = topPosts(posts, days, 10);

  return (
    <Numbered n={5}>
    <Section
      kicker="Ranked by views"
      title="Top Performing Posts"
      hint={`${windowLabel(days)}, ranked by views`}
      bodyClassName="-mx-5"
    >
      <div className="overflow-x-auto">
        <table className="data-table tabular w-full text-sm">
          <thead>
            <tr className="border-y border-border bg-muted/40 text-left">
              <th className="w-12 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                #
              </th>
              <th className="px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                Platform
              </th>
              <th className="px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                Date
              </th>
              <th className="px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                Title
              </th>
              <th className="px-2 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                Views
              </th>
              <th className="px-2 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                Likes
              </th>
              <th className="px-2 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                Comments
              </th>
              <th className="px-5 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                Engage
              </th>
            </tr>
          </thead>
          <tbody>
            {top.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-8 text-center text-sm text-ink-muted"
                >
                  No posts in this window.
                </td>
              </tr>
            ) : (
              top.map((p, i) => (
                <tr
                  key={p.id}
                  className="border-b border-border transition even:bg-muted/30 last:border-b-0 hover:bg-muted/40"
                >
                  <td className="tabular px-5 py-3 font-display text-lg font-semibold leading-none text-brand/70">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="px-2 py-3">
                    <PlatformBadge platform={p.platform} />
                  </td>
                  <td className="px-2 py-3 text-ink-muted">
                    {fmtDate(p.date)}
                  </td>
                  <td className="px-2 py-3 max-w-[460px] truncate text-ink">
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="hover:text-brand hover:underline underline-offset-2"
                      >
                        {p.title || p.caption?.slice(0, 80) || "(no title)"}
                      </a>
                    ) : (
                      p.title || p.caption?.slice(0, 80) || "(no title)"
                    )}
                  </td>
                  <td className="px-2 py-3 text-right text-ink">
                    {fmt(p.views)}
                  </td>
                  <td className="px-2 py-3 text-right text-ink-soft">
                    {fmt(p.likes)}
                  </td>
                  <td className="px-2 py-3 text-right text-ink-soft">
                    {fmt(p.comments)}
                  </td>
                  <td className="px-5 py-3 text-right text-brand">
                    {fmtPct(toNum(p.engagementRate))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Section>
    </Numbered>
  );
}
