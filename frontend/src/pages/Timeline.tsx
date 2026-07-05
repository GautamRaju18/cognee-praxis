import { useEffect, useState } from "react";
import { listDecisions } from "../api";
import {
  Eyebrow,
  Skeleton,
  StatusBadge,
  TimeGap,
  ValenceChip,
  daysBetween,
  fmtDate,
} from "../components";
import { useNav } from "../nav";
import type { Decision } from "../types";

interface Event {
  date: string;
  decision: Decision;
}

export default function Timeline() {
  const nav = useNav();
  const [decisions, setDecisions] = useState<Decision[] | null>(null);

  useEffect(() => {
    listDecisions()
      .then(setDecisions)
      .catch(() => setDecisions([]));
  }, []);

  const events: Event[] = (decisions ?? [])
    .map((d) => ({ date: d.decided_on, decision: d }))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <div className="mx-auto max-w-4xl">
      <Eyebrow>chronology</Eyebrow>
      <h1 className="px-display mt-2 text-2xl text-[var(--color-fg)]">Timeline</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Decisions in order, each with the outcome that judged it — and how long the verdict took.
      </p>

      <div className="mt-8">
        {decisions === null ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <ol className="relative border-l border-[var(--color-hair)] pl-6">
            {events.map(({ date, decision }) => (
              <li key={decision.id} className="relative pb-8 last:pb-0">
                {/* axis node */}
                <span className="absolute -left-[30px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[var(--color-signal)] bg-[var(--color-ink)]">
                  <span className="h-1 w-1 rounded-full bg-[var(--color-signal)]" />
                </span>
                <div className="px-mono text-[11px] text-[var(--color-fg-faint)]">
                  {fmtDate(date)}
                </div>
                <button
                  onClick={() => nav.openDecision(decision.id)}
                  className="mt-1 flex items-center gap-2 text-left"
                >
                  <span className="px-display text-[15px] text-[var(--color-fg)] transition hover:text-[var(--color-signal)]">
                    {decision.title}
                  </span>
                  <StatusBadge status={decision.status} />
                  <span className="px-mono text-[10px] text-[var(--color-topic)]">
                    #{decision.topic}
                  </span>
                </button>

                {decision.outcomes.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {decision.outcomes.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-start gap-2 rounded-lg border border-[var(--color-hair)]/60 bg-[var(--color-ink-2)]/40 px-3 py-2"
                      >
                        <ValenceChip valence={o.valence} />
                        <TimeGap days={daysBetween(decision.decided_on, o.observed_on)} />
                        <span className="flex-1 text-sm text-[var(--color-fg-muted)]">
                          {o.description}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {decision.outcomes.length === 0 && (
                  <div className="px-mono mt-1.5 text-[11px] text-[var(--color-fg-faint)]">
                    awaiting outcome
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
