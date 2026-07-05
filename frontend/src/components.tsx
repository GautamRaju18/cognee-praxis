import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNav } from "./nav";
import type { Decision, Outcome, ReasoningTriple, Valence } from "./types";

/* ── count-up number (micro-interaction) ────────────────── */
export function CountUp({ value, ms = 750 }: { value: number; ms?: number }) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    startRef.current = null;
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{n}</>;
}

/* ── tiny utils ─────────────────────────────────────────── */
export function daysBetween(from?: string, to?: string): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

export function fmtDate(d?: string): string {
  if (!d) return "—";
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return d;
  return t.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* ── badges / chips ─────────────────────────────────────── */
const STATUS_STYLE: Record<string, string> = {
  decided: "text-[var(--color-signal)] border-[var(--color-signal-dim)] bg-[var(--color-signal-deep)]",
  proposed: "text-[var(--color-person)] border-[#2f4173] bg-[#141b30]",
  reversed: "text-[var(--color-mixed)] border-[#6b5320] bg-[#241d0e]",
  superseded: "text-[var(--color-fg-faint)] border-[var(--color-hair)] bg-[var(--color-panel)]",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`px-mono inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_STYLE[status] ?? STATUS_STYLE.superseded}`}
    >
      {status}
    </span>
  );
}

const VALENCE_STYLE: Record<Valence, string> = {
  positive: "text-[var(--color-pos)] border-[#1f6b43] bg-[#0c2418]",
  negative: "text-[var(--color-neg)] border-[#7a2c37] bg-[#2a1015]",
  mixed: "text-[var(--color-mixed)] border-[#6b5320] bg-[#241d0e]",
};

export function ValenceChip({ valence }: { valence: Valence }) {
  const dot = { positive: "▲", negative: "▼", mixed: "◆" }[valence];
  return (
    <span
      className={`px-mono inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${VALENCE_STYLE[valence]}`}
    >
      <span aria-hidden>{dot}</span>
      {valence}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="px-eyebrow">{children}</div>;
}

export function TimeGap({ days }: { days: number | null }) {
  if (days === null) return null;
  const sign = days >= 0 ? "+" : "−";
  return (
    <span className="px-gap" title="Time between the decision and this outcome">
      {sign}
      {Math.abs(days)}d
    </span>
  );
}

/* ── surfaces ───────────────────────────────────────────── */
export function Panel({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`px-panel ${onClick ? "px-panel-hover cursor-pointer active:scale-[0.995]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/* ── the decision→outcome card (signature: the thread) ──── */
function OutcomeThreadItem({ decision, outcome }: { decision: Decision; outcome: Outcome }) {
  return (
    <div className="px-thread-node pb-3 last:pb-0">
      <div className="flex items-center gap-2">
        <ValenceChip valence={outcome.valence} />
        <TimeGap days={daysBetween(decision.decided_on, outcome.observed_on)} />
        <span className="px-mono text-[10px] text-[var(--color-fg-faint)]">
          {fmtDate(outcome.observed_on)}
        </span>
      </div>
      <div className="mt-1 text-sm text-[var(--color-fg-muted)]">{outcome.description}</div>
    </div>
  );
}

export function DecisionCard({
  decision,
  onOpen,
  compact = false,
  showGraphLink = true,
}: {
  decision: Decision;
  onOpen?: () => void;
  compact?: boolean;
  showGraphLink?: boolean;
}) {
  const nav = useNav();
  const disproven = decision.assumptions.filter((a) => a.invalidated_by_outcome_id);
  return (
    <Panel onClick={onOpen} className="group/card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="px-display text-[15px] leading-tight text-[var(--color-fg)]">
            {decision.title}
          </div>
          {!compact && (
            <div className="mt-1 line-clamp-2 text-sm text-[var(--color-fg-muted)]">
              {decision.statement}
            </div>
          )}
        </div>
        <StatusBadge status={decision.status} />
      </div>

      <div className="px-mono mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-fg-faint)]">
        <span className="text-[var(--color-topic)]">#{decision.topic}</span>
        <span>{decision.owner || "unassigned"}</span>
        <span>{fmtDate(decision.decided_on)}</span>
        {disproven.length > 0 && <span className="px-stamp">disproven</span>}
      </div>

      {decision.outcomes.length > 0 && (
        <div className="px-thread mt-3 border-t border-[var(--color-hair)] pt-3">
          {decision.outcomes.map((o) => (
            <OutcomeThreadItem key={o.id} decision={decision} outcome={o} />
          ))}
        </div>
      )}

      {showGraphLink && (
        <div className="mt-3 flex justify-end border-t border-[var(--color-hair)]/60 pt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              nav.openInGraph(decision.id);
            }}
            className="px-mono flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-fg-faint)] opacity-0 transition group-hover/card:opacity-100 hover:text-[var(--color-signal)]"
          >
            <span>⬡</span> view in graph
          </button>
        </div>
      )}
    </Panel>
  );
}

/* ── graph reasoning (proves the answer came from the graph) ── */
const REL_COLOR: Record<string, string> = {
  resulted_in: "var(--color-signal)",
  invalidated_by: "var(--color-neg)",
  supersedes: "var(--color-decision)",
  made_by: "var(--color-person)",
  concerns: "var(--color-topic)",
  based_on: "#5aa0a0",
  justified_by: "#4a8f86",
};

export function GraphPath({ triples }: { triples: ReasoningTriple[] }) {
  if (!triples.length) return null;
  return (
    <div className="px-panel p-4">
      <div className="flex items-center gap-2">
        <Eyebrow>graph path · how praxis reached this</Eyebrow>
        <span className="px-mono text-[10px] text-[var(--color-fg-faint)]">
          {triples.length} relationships traversed
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        {triples.map((t, i) => {
          const c = REL_COLOR[t.relation] ?? "var(--color-fg-faint)";
          return (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border border-[var(--color-hair)]/70 bg-[var(--color-ink-2)]/60 px-2.5 py-1.5 text-[12px]"
            >
              <span className="max-w-[38%] truncate text-[var(--color-fg-muted)]">{t.source}</span>
              <span className="px-mono flex shrink-0 items-center gap-1 text-[10px]" style={{ color: c }}>
                <span className="h-px w-3" style={{ background: c }} />
                {t.relation}
                <span aria-hidden>→</span>
              </span>
              <span className="max-w-[42%] truncate text-[var(--color-fg)]">{t.target}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── states ─────────────────────────────────────────────── */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-[var(--color-fg-muted)]">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-hair-bright)] border-t-[var(--color-signal)]" />
      {label ?? "Working…"}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--color-panel-2)] ${className}`} />;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-[#7a2c37] bg-[#2a1015]/60 px-3 py-2 text-sm text-[var(--color-neg)]">
      {message}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-panel flex flex-col items-center justify-center gap-1 p-10 text-center">
      <div className="px-display text-[var(--color-fg-muted)]">{title}</div>
      {hint && <div className="text-sm text-[var(--color-fg-faint)]">{hint}</div>}
    </div>
  );
}

/* ── form primitives ────────────────────────────────────── */
export const inputCls =
  "w-full rounded-lg border border-[var(--color-hair)] bg-[var(--color-ink-2)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-fg-faint)] outline-none transition focus:border-[var(--color-signal-dim)]";
export const labelCls = "px-eyebrow mb-1 block";
export const buttonCls =
  "inline-flex items-center gap-2 rounded-lg bg-[var(--color-signal)] px-4 py-2 text-sm font-semibold text-[#05201b] transition duration-150 hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";
export const ghostButtonCls =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--color-hair-bright)] px-3 py-1.5 text-sm text-[var(--color-fg-muted)] transition duration-150 hover:border-[var(--color-signal-dim)] hover:text-[var(--color-fg)] active:scale-[0.97]";
