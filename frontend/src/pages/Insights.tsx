import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { listDecisions } from "../api";
import { CountUp, Eyebrow, Panel, Skeleton } from "../components";
import type { Decision, Valence } from "../types";

const VALENCE_COLOR: Record<Valence, string> = {
  positive: "#43e08b",
  negative: "#fb6b7c",
  mixed: "#f5b23d",
};
const CONF_COLOR: Record<string, string> = { high: "#43e08b", med: "#f5b23d", low: "#fb6b7c" };

/* ── animated donut (SVG arcs grown with framer-motion) ── */
function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 54;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-hair)" strokeWidth="14" />
        {segments.map((s) => {
          const len = (s.value / total) * C;
          const start = (acc / total) * 360 - 90;
          acc += s.value;
          return (
            <motion.circle
              key={s.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeLinecap="round"
              transform={`rotate(${start} 70 70)`}
              initial={{ strokeDasharray: `0 ${C}` }}
              animate={{ strokeDasharray: `${Math.max(0, len - 3)} ${C}` }}
              transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
            />
          );
        })}
        <text
          x="70"
          y="66"
          textAnchor="middle"
          className="px-mono"
          fill="var(--color-fg)"
          fontSize="24"
        >
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" className="px-mono" fill="var(--color-fg-faint)" fontSize="9">
          OUTCOMES
        </text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-[var(--color-fg-muted)]">{s.label}</span>
            <span className="px-mono text-[var(--color-fg)]">{s.value}</span>
            <span className="px-mono text-[11px] text-[var(--color-fg-faint)]">
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── animated horizontal bar ── */
function Bar({ label, value, max, color, sub }: { label: string; value: number; max: number; color: string; sub?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm text-[var(--color-fg-muted)]">{label}</span>
        <span className="px-mono text-[11px] text-[var(--color-fg-faint)]">{sub ?? value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-ink-2)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${max ? (value / max) * 100 : 0}%` }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
        />
      </div>
    </div>
  );
}

export default function Insights({ onOpenDecision }: { onOpenDecision: (id: string) => void }) {
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  useEffect(() => {
    listDecisions()
      .then(setDecisions)
      .catch(() => setDecisions([]));
  }, []);

  const stats = useMemo(() => {
    const ds = decisions ?? [];
    const outcomes = ds.flatMap((d) => d.outcomes);
    const valence: Record<Valence, number> = { positive: 0, negative: 0, mixed: 0 };
    outcomes.forEach((o) => (valence[o.valence] += 1));

    const byTopic = new Map<string, number>();
    ds.forEach((d) => byTopic.set(d.topic, (byTopic.get(d.topic) ?? 0) + 1));
    const topics = [...byTopic.entries()].sort((a, b) => b[1] - a[1]);

    // batting average by assumption confidence
    const conf: Record<string, { held: number; total: number }> = {
      high: { held: 0, total: 0 },
      med: { held: 0, total: 0 },
      low: { held: 0, total: 0 },
    };
    ds.forEach((d) =>
      d.assumptions.forEach((a) => {
        const c = conf[a.confidence] ?? conf.med;
        c.total += 1;
        if (!a.invalidated_by_outcome_id) c.held += 1;
      }),
    );

    const decided = outcomes.length;
    const posRate = decided ? Math.round((valence.positive / decided) * 100) : 0;
    return { outcomes, valence, topics, conf, posRate, total: ds.length };
  }, [decisions]);

  const maxTopic = stats.topics[0]?.[1] ?? 1;

  return (
    <div>
      <Eyebrow>analytics</Eyebrow>
      <h1 className="px-display mt-2 text-2xl text-[var(--color-fg)]">Insights</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        What the decision record reveals about how your team actually performs.
      </p>

      {!decisions ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* headline stats */}
          <Panel className="p-5 sm:col-span-2">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="px-mono text-3xl text-[var(--color-fg)]">
                  <CountUp value={stats.total} />
                </div>
                <div className="px-eyebrow mt-1">decisions on record</div>
              </div>
              <div>
                <div className="px-mono text-3xl text-[var(--color-pos)]">
                  <CountUp value={stats.posRate} />%
                </div>
                <div className="px-eyebrow mt-1">outcomes that went well</div>
              </div>
              <div>
                <div className="px-mono text-3xl text-[var(--color-neg)]">
                  <CountUp value={stats.valence.negative} />
                </div>
                <div className="px-eyebrow mt-1">calls that backfired</div>
              </div>
            </div>
          </Panel>

          {/* valence donut */}
          <Panel className="p-5">
            <Eyebrow>outcome valence</Eyebrow>
            <div className="mt-4">
              <Donut
                segments={[
                  { label: "positive", value: stats.valence.positive, color: VALENCE_COLOR.positive },
                  { label: "mixed", value: stats.valence.mixed, color: VALENCE_COLOR.mixed },
                  { label: "negative", value: stats.valence.negative, color: VALENCE_COLOR.negative },
                ]}
              />
            </div>
          </Panel>

          {/* decisions by topic */}
          <Panel className="p-5">
            <Eyebrow>decisions by topic</Eyebrow>
            <div className="mt-4 space-y-3">
              {stats.topics.slice(0, 6).map(([topic, n]) => (
                <Bar key={topic} label={`#${topic}`} value={n} max={maxTopic} color="var(--color-topic)" />
              ))}
            </div>
          </Panel>

          {/* batting average by confidence */}
          <Panel className="p-5 sm:col-span-2">
            <Eyebrow>assumption batting average — how confidence tracks reality</Eyebrow>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(["high", "med", "low"] as const).map((c) => {
                const { held, total } = stats.conf[c];
                const pct = total ? Math.round((held / total) * 100) : 0;
                return (
                  <div key={c} className="rounded-lg border border-[var(--color-hair)] bg-[var(--color-ink-2)]/40 p-3">
                    <Bar
                      label={`${c} confidence`}
                      value={pct}
                      max={100}
                      color={CONF_COLOR[c]}
                      sub={`${held}/${total} held · ${pct}%`}
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[13px] text-[var(--color-fg-muted)]">
              If low-confidence assumptions fail more often than high-confidence ones, the team is
              calibrated — it knows what it doesn&apos;t know.
            </p>
          </Panel>

          {/* worst calls shortcut */}
          {stats.valence.negative > 0 && (
            <Panel className="p-5 sm:col-span-2">
              <Eyebrow>the calls that backfired</Eyebrow>
              <div className="mt-3 flex flex-wrap gap-2">
                {(decisions ?? [])
                  .filter((d) => d.outcomes.some((o) => o.valence === "negative"))
                  .map((d) => (
                    <button
                      key={d.id}
                      onClick={() => onOpenDecision(d.id)}
                      className="px-mono rounded-lg border border-[#7a2c37] bg-[#2a1015]/50 px-3 py-1.5 text-[12px] text-[var(--color-neg)] transition hover:brightness-125"
                    >
                      {d.title} →
                    </button>
                  ))}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
