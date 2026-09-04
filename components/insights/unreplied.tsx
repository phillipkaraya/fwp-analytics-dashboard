import { Section } from "@/components/charts/section";
import { PlatformBadge } from "@/components/charts/platform-badge";
import type { HighValueComment } from "@/lib/types";
import { fmtDate } from "@/lib/format";

interface UnrepliedProps {
  comments: HighValueComment[];
  /** Newest comment date in the dataset; comments are not re-scraped yet. */
  asOf?: string;
}

export function HighValueQuestions({ comments, asOf }: UnrepliedProps) {
  return (
    <Section
      title="High-Value Unreplied Questions"
      hint={`${comments.length} questions with engagement, awaiting reply${asOf ? ` · comments through ${fmtDate(asOf)}` : ""}`}
      bodyClassName="max-h-[480px] overflow-y-auto pr-1"
    >
      <ul className="space-y-3">
        {comments.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-muted">
            All caught up.
          </li>
        )}
        {comments.slice(0, 30).map((c) => (
          <li
            key={c.id}
            className="rounded-md border border-border p-3 hover:border-brand/40"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlatformBadge platform={c.platform} />
                <span className="text-sm font-medium text-ink">
                  {c.username}
                </span>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                {c.likes} ♥
              </div>
            </div>
            <p className="text-sm text-ink-soft line-clamp-3">{c.text}</p>
            {c.postUrl && (
              <a
                href={c.postUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-block font-mono text-[11px] uppercase tracking-wider text-brand hover:underline"
              >
                Open post →
              </a>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
