import { Section } from "@/components/charts/section";
import { PlatformBadge } from "@/components/charts/platform-badge";
import type { HighValueComment } from "@/lib/types";
import { StaleNote } from "@/components/layout/stale-note";

interface TopQuestionsProps {
  comments: HighValueComment[];
  /** Newest comment date in the dataset; comments are not re-scraped yet. */
  asOf?: string;
}

/** Audience questions ranked by likes. Deliberately says nothing about
 *  whether Phil replied: the snapshot's reply flag is not trustworthy. */
export function TopQuestions({ comments, asOf }: TopQuestionsProps) {
  return (
    <Section
      title="Questions Worth Answering"
      hint={`Top ${comments.length} audience questions, ranked by likes`}
      action={<StaleNote date={asOf} label="Comments" />}
      bodyClassName="max-h-[480px] overflow-y-auto pr-1"
    >
      <ul className="space-y-3">
        {comments.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-muted">
            No questions in the comment snapshot.
          </li>
        )}
        {comments.slice(0, 30).map((c) => (
          <li
            key={c.id}
            className="rounded-md bg-muted/40 p-3 ring-1 ring-ink/[0.04] transition hover:ring-brand/40"
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
