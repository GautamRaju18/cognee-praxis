import type { ReactNode } from "react";
import type { Decision, Outcome, Valence } from "./types";

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
      className={`px-panel ${onClick ? "px-panel-hover cursor-pointer" : ""} ${className}`}
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
}: {
  decision: Decision;
  onOpen?: () => void;
  compact?: boolean;
}) {
  const disproven = decision.assumptions.filter((a) => a.invalidated_by_outcome_id);
  return (
    <Panel onClick={onOpen} className="p-4">
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
    </Panel>
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
  "inline-flex items-center gap-2 rounded-lg bg-[var(--color-signal)] px-4 py-2 text-sm font-semibold text-[#05201b] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40";
export const ghostButtonCls =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--color-hair-bright)] px-3 py-1.5 text-sm text-[var(--color-fg-muted)] transition hover:border-[var(--color-signal-dim)] hover:text-[var(--color-fg)]";
