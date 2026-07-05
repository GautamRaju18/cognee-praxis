import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { listDecisions } from "../api";
import { Eyebrow, Panel, Skeleton, StatusBadge } from "../components";
import { useNav } from "../nav";
import type { Decision } from "../types";

const AVATAR_COLORS = ["#4ee1c3", "#7aa2ff", "#b98bff", "#f2c14e", "#ff8f6b", "#43e08b"];
function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface PersonStat {
  name: string;
  decisions: Decision[];
  pos: number;
  neg: number;
  mixed: number;
  disproven: number;
  judged: number;
}

export default function People() {
  const nav = useNav();
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  useEffect(() => {
    listDecisions()
      .then(setDecisions)
      .catch(() => setDecisions([]));
  }, []);

  const people = useMemo<PersonStat[]>(() => {
    const map = new Map<string, PersonStat>();
    for (const d of decisions ?? []) {
      const name = d.owner || "Unassigned";
      if (!map.has(name))
        map.set(name, { name, decisions: [], pos: 0, neg: 0, mixed: 0, disproven: 0, judged: 0 });
      const p = map.get(name)!;
      p.decisions.push(d);
      for (const o of d.outcomes) {
        p.judged += 1;
        if (o.valence === "positive") p.pos += 1;
        else if (o.valence === "negative") p.neg += 1;
        else p.mixed += 1;
      }
      p.disproven += d.assumptions.filter((a) => a.invalidated_by_outcome_id).length;
    }
    return [...map.values()].sort((a, b) => b.decisions.length - a.decisions.length);
  }, [decisions]);

  return (
    <div>
      <Eyebrow>the people</Eyebrow>
      <h1 className="px-display mt-2 text-2xl text-[var(--color-fg)]">Decision-makers</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Who owned which calls — and how they were judged by their outcomes.
      </p>

      {!decisions ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {people.map((p, i) => {
            const hitRate = p.judged ? Math.round((p.pos / p.judged) * 100) : null;
            return (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <Panel className="p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                      style={{ background: `${colorFor(p.name)}22`, color: colorFor(p.name) }}
                    >
                      {initials(p.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="px-display text-[15px] text-[var(--color-fg)]">{p.name}</div>
                      <div className="px-mono text-[11px] text-[var(--color-fg-faint)]">
                        {p.decisions.length} decision{p.decisions.length > 1 ? "s" : ""}
                        {p.judged > 0 && ` · ${p.judged} judged`}
                      </div>
                    </div>
                    {hitRate !== null && (
                      <div className="ml-auto text-right">
                        <div
                          className="px-mono text-xl"
                          style={{
                            color:
                              hitRate >= 60
                                ? "var(--color-pos)"
                                : hitRate >= 40
                                  ? "var(--color-mixed)"
                                  : "var(--color-neg)",
                          }}
                        >
                          {hitRate}%
                        </div>
                        <div className="px-eyebrow">hit rate</div>
                      </div>
                    )}
                  </div>

                  {p.judged > 0 && (
                    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--color-ink-2)]">
                      {p.pos > 0 && (
                        <div style={{ flex: p.pos, background: "var(--color-pos)" }} />
                      )}
                      {p.mixed > 0 && (
                        <div style={{ flex: p.mixed, background: "var(--color-mixed)" }} />
                      )}
                      {p.neg > 0 && (
                        <div style={{ flex: p.neg, background: "var(--color-neg)" }} />
                      )}
                    </div>
                  )}

                  <div className="px-mono mt-2 flex flex-wrap gap-x-3 text-[11px] text-[var(--color-fg-faint)]">
                    {p.pos > 0 && <span className="text-[var(--color-pos)]">▲ {p.pos} paid off</span>}
                    {p.neg > 0 && <span className="text-[var(--color-neg)]">▼ {p.neg} backfired</span>}
                    {p.mixed > 0 && <span className="text-[var(--color-mixed)]">◆ {p.mixed} mixed</span>}
                    {p.disproven > 0 && <span className="px-stamp">{p.disproven} disproven</span>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--color-hair)]/60 pt-3">
                    {p.decisions.slice(0, 5).map((d) => (
                      <button
                        key={d.id}
                        onClick={() => nav.openDecision(d.id)}
                        className="group flex items-center gap-1.5 rounded-md border border-[var(--color-hair)] px-2 py-1 text-[11px] text-[var(--color-fg-muted)] transition hover:border-[var(--color-signal-dim)] hover:text-[var(--color-fg)]"
                      >
                        <span className="max-w-[150px] truncate">{d.title}</span>
                        <StatusBadge status={d.status} />
                      </button>
                    ))}
                    {p.decisions.length > 5 && (
                      <span className="px-mono self-center text-[11px] text-[var(--color-fg-faint)]">
                        +{p.decisions.length - 5}
                      </span>
                    )}
                  </div>
                </Panel>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
