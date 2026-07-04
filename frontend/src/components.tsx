import type { ReactNode } from "react";
import type { Decision, Valence } from "./types";

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    decided: "bg-emerald-950 text-emerald-300 ring-emerald-800",
    proposed: "bg-sky-950 text-sky-300 ring-sky-800",
    reversed: "bg-amber-950 text-amber-300 ring-amber-800",
    superseded: "bg-zinc-800 text-zinc-400 ring-zinc-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${colors[status] ?? colors.superseded}`}
    >
      {status}
    </span>
  );
}

export function ValenceChip({ valence }: { valence: Valence }) {
  const map: Record<Valence, string> = {
    positive: "bg-emerald-950 text-emerald-300 ring-emerald-800",
    negative: "bg-rose-950 text-rose-300 ring-rose-800",
    mixed: "bg-amber-950 text-amber-300 ring-amber-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${map[valence]}`}
    >
      {valence}
    </span>
  );
}

export function Card({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 ${onClick ? "cursor-pointer transition hover:border-zinc-600" : ""}`}
    >
      {children}
    </div>
  );
}

export function DecisionCard({ decision, onOpen }: { decision: Decision; onOpen?: () => void }) {
  return (
    <Card onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-100">{decision.title}</div>
          <div className="mt-1 text-sm text-zinc-400">{decision.statement}</div>
        </div>
        <StatusBadge status={decision.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span className="rounded bg-zinc-800 px-1.5 py-0.5">{decision.topic}</span>
        <span>{decision.owner}</span>
        <span>{decision.decided_on}</span>
      </div>
      {decision.outcomes.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">
          {decision.outcomes.map((o) => (
            <div key={o.id} className="flex items-start gap-2 text-sm">
              <ValenceChip valence={o.valence} />
              <span className="text-zinc-300">{o.description}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-zinc-400">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
      {label ?? "Working…"}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-900 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
      {message}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-400";
export const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500";
export const buttonCls =
  "rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed";
export const ghostButtonCls =
  "rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500";
