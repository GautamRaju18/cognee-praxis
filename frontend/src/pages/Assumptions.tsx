import { useEffect, useMemo, useState } from "react";
import { listDecisions } from "../api";
import { Eyebrow, Panel, Skeleton } from "../components";
import { useNav } from "../nav";
import type { Assumption, Decision } from "../types";

interface Row {
  assumption: Assumption;
  decision: Decision;
  killedBy: string | null;
}

export default function Assumptions() {
  const nav = useNav();
  const [decisions, setDecisions] = useState<Decision[] | null>(null);

  useEffect(() => {
    listDecisions()
      .then(setDecisions)
      .catch(() => setDecisions([]));
  }, []);

  const rows = useMemo<Row[]>(() => {
    if (!decisions) return [];
    const out: Row[] = [];
    for (const d of decisions) {
      for (const a of d.assumptions) {
        const killedBy = a.invalidated_by_outcome_id
          ? (d.outcomes.find((o) => o.id === a.invalidated_by_outcome_id)?.description ?? null)
          : null;
        out.push({ assumption: a, decision: d, killedBy });
      }
    }
    return out;
  }, [decisions]);

  const disproven = rows.filter((r) => r.assumption.invalidated_by_outcome_id);
  const holding = rows.filter((r) => !r.assumption.invalidated_by_outcome_id);
  const total = rows.length;
  const heldPct = total ? Math.round((holding.length / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <Eyebrow>institutional learning</Eyebrow>
      <h1 className="px-display mt-2 text-2xl text-[var(--color-fg)]">Assumptions ledger</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Every belief a decision rested on — and whether reality upheld it.
      </p>

      {decisions === null ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <>
          {/* batting average */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Panel className="px-4 py-3.5">
              <div className="px-mono text-3xl text-[var(--color-fg)]">{total}</div>
              <div className="px-eyebrow mt-1">assumptions tracked</div>
            </Panel>
            <Panel className="px-4 py-3.5">
              <div className="px-mono text-3xl text-[var(--color-pos)]">{heldPct}%</div>
              <div className="px-eyebrow mt-1">still holding</div>
            </Panel>
            <Panel className="px-4 py-3.5">
              <div className="px-mono text-3xl text-[var(--color-neg)]">{disproven.length}</div>
              <div className="px-eyebrow mt-1">proven wrong</div>
            </Panel>
          </div>

          {/* proven wrong — the learning */}
          {disproven.length > 0 && (
            <section className="mt-8">
              <Eyebrow>proven wrong</Eyebrow>
              <div className="mt-3 space-y-2.5">
                {disproven.map((r) => (
                  <Panel key={r.assumption.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="px-strike text-sm">{r.assumption.statement}</div>
                      <span className="px-stamp shrink-0">disproven</span>
                    </div>
                    {r.killedBy && (
                      <div className="mt-2 flex items-start gap-2 border-t border-[var(--color-hair)]/60 pt-2">
                        <span className="px-mono text-[10px] text-[var(--color-neg)]">reality →</span>
                        <span className="text-sm text-[var(--color-fg-muted)]">{r.killedBy}</span>
                      </div>
                    )}
                    <button
                      onClick={() => nav.openDecision(r.decision.id)}
                      className="px-mono mt-2 text-[11px] text-[var(--color-fg-faint)] transition hover:text-[var(--color-signal)]"
                    >
                      from · {r.decision.title} →
                    </button>
                  </Panel>
                ))}
              </div>
            </section>
          )}

          {/* still holding */}
          <section className="mt-8">
            <Eyebrow>still holding</Eyebrow>
            <div className="mt-3 space-y-2">
              {holding.map((r) => (
                <button
                  key={r.assumption.id}
                  onClick={() => nav.openDecision(r.decision.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-hair)]/60 bg-[var(--color-ink-2)]/40 px-3.5 py-2.5 text-left transition hover:border-[var(--color-hair-bright)]"
                >
                  <span className="px-mono rounded border border-[var(--color-hair)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--color-fg-faint)]">
                    {r.assumption.confidence}
                  </span>
                  <span className="flex-1 text-sm text-[var(--color-fg-muted)]">
                    {r.assumption.statement}
                  </span>
                  <span className="px-mono hidden shrink-0 text-[10px] text-[var(--color-fg-faint)] sm:block">
                    #{r.decision.topic}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
