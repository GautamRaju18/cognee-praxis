import { useEffect, useState } from "react";
import { getBrainStats, listDecisions, type BrainStats } from "../api";
import {
  CountUp,
  DecisionCard,
  Eyebrow,
  Panel,
  Skeleton,
  StatusBadge,
  TimeGap,
  ValenceChip,
  daysBetween,
  fmtDate,
} from "../components";
import Tilt from "../Tilt";
import type { Decision, Outcome } from "../types";

interface Reckoning {
  decision: Decision;
  outcome: Outcome;
  disprovenAssumption: string | null;
}

function pickReckoning(decisions: Decision[]): Reckoning | null {
  // Prefer a decision whose assumption was proven wrong by an outcome — the core loop.
  for (const d of decisions) {
    const bad = d.assumptions.find((a) => a.invalidated_by_outcome_id);
    if (bad) {
      const outcome =
        d.outcomes.find((o) => o.id === bad.invalidated_by_outcome_id) ?? d.outcomes[0];
      if (outcome) return { decision: d, outcome, disprovenAssumption: bad.statement };
    }
  }
  // Fallback: most recent outcome anywhere.
  let best: Reckoning | null = null;
  for (const d of decisions) {
    for (const o of d.outcomes) {
      if (!best || new Date(o.observed_on) > new Date(best.outcome.observed_on)) {
        best = { decision: d, outcome: o, disprovenAssumption: null };
      }
    }
  }
  return best;
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: string }) {
  return (
    <Tilt max={10}>
      <Panel className="px-4 py-3.5">
        <div className={`px-mono text-3xl font-medium ${accent ?? "text-[var(--color-fg)]"}`}>
          <CountUp value={value} />
        </div>
        <div className="px-eyebrow mt-1">{label}</div>
      </Panel>
    </Tilt>
  );
}

export default function Dashboard({
  onNavigate,
  onOpenDecision,
}: {
  onNavigate: (k: string) => void;
  onOpenDecision: (id: string) => void;
}) {
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [stats, setStats] = useState<BrainStats | null>(null);

  useEffect(() => {
    listDecisions()
      .then(async (ds) => {
        setDecisions(ds);
        setStats(await getBrainStats(ds));
      })
      .catch(() => setDecisions([]));
  }, []);

  const reckoning = decisions ? pickReckoning(decisions) : null;
  const recent = (decisions ?? [])
    .slice()
    .sort((a, b) => +new Date(b.decided_on) - +new Date(a.decided_on))
    .slice(0, 4);

  if (decisions && decisions.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="px-glow flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-signal-deep)] text-2xl text-[var(--color-signal)]">
          ◈
        </div>
        <h1 className="px-display mt-5 text-2xl text-[var(--color-fg)]">Your company brain is empty</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Praxis has no decisions yet. Log your first one, paste a meeting transcript to
          auto-extract them, or run{" "}
          <code className="px-mono rounded bg-[var(--color-panel-2)] px-1.5 py-0.5 text-[12px] text-[var(--color-signal)]">
            make seed
          </code>{" "}
          for a demo company.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onNavigate("log")}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-signal)] px-4 py-2 text-sm font-semibold text-[#05201b] transition hover:brightness-110"
          >
            + Log a decision
          </button>
          <button
            onClick={() => onNavigate("ingest")}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-hair-bright)] px-4 py-2 text-sm text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
          >
            Ingest a transcript
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero thesis */}
      <section>
        <Eyebrow>the company brain</Eyebrow>
        <h1 className="px-display mt-2 max-w-2xl text-3xl leading-[1.15] text-[var(--color-fg)]">
          Every decision, wired to the{" "}
          <span className="px-signal-text">outcome that proved it</span> right or wrong.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--color-fg-muted)]">
          Praxis remembers what your team decided, why, and what actually happened months later —
          the link no single document holds.
        </p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats ? (
          <>
            <Stat value={stats.decisions} label="decisions" />
            <Stat value={stats.outcomes} label="outcomes linked" accent="text-[var(--color-signal)]" />
            <Stat value={stats.disproven} label="assumptions disproven" accent="text-[var(--color-neg)]" />
            <Stat value={stats.nodes} label="graph nodes" accent="text-[var(--color-topic)]" />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)
        )}
      </section>

      {/* Latest reckoning — the core loop, made visible */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow>latest reckoning</Eyebrow>
          <button
            onClick={() => onNavigate("decisions")}
            className="px-mono text-[11px] text-[var(--color-fg-faint)] transition hover:text-[var(--color-signal)]"
          >
            all decisions →
          </button>
        </div>

        {!decisions ? (
          <Skeleton className="h-40" />
        ) : reckoning ? (
          <Panel
            className="p-5 px-panel-hover cursor-pointer"
            onClick={() => onOpenDecision(reckoning.decision.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="px-display text-lg text-[var(--color-fg)]">
                {reckoning.decision.title}
              </div>
              <StatusBadge status={reckoning.decision.status} />
            </div>

            <div className="px-thread mt-4 space-y-4">
              {reckoning.disprovenAssumption && (
                <div className="px-thread-node">
                  <div className="flex items-center gap-2">
                    <span className="px-stamp">disproven</span>
                    <span className="px-eyebrow">assumption</span>
                  </div>
                  <div className="px-strike mt-1 text-sm">{reckoning.disprovenAssumption}</div>
                </div>
              )}
              <div className="px-thread-node">
                <div className="flex items-center gap-2">
                  <ValenceChip valence={reckoning.outcome.valence} />
                  <TimeGap
                    days={daysBetween(reckoning.decision.decided_on, reckoning.outcome.observed_on)}
                  />
                  <span className="px-mono text-[10px] text-[var(--color-fg-faint)]">
                    {fmtDate(reckoning.outcome.observed_on)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-[var(--color-fg-muted)]">
                  {reckoning.outcome.description}
                </div>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel className="p-5 text-sm text-[var(--color-fg-muted)]">
            No outcomes logged yet — decisions are waiting on their verdicts.
          </Panel>
        )}
      </section>

      {/* Recent decisions */}
      <section>
        <Eyebrow>recent decisions</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {!decisions
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
            : recent.map((d, i) => (
                <div key={d.id} className="px-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <DecisionCard decision={d} onOpen={() => onOpenDecision(d.id)} compact />
                </div>
              ))}
        </div>
      </section>
    </div>
  );
}
