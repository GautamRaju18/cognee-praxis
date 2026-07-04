import { useEffect, useState } from "react";
import { createOutcome, getDecision, listDecisions } from "../api";
import {
  ErrorNote,
  Eyebrow,
  Skeleton,
  Spinner,
  StatusBadge,
  TimeGap,
  ValenceChip,
  buttonCls,
  daysBetween,
  fmtDate,
  ghostButtonCls,
  inputCls,
} from "../components";
import type { Decision, Valence } from "../types";

function OutcomeForm({ decision, onSaved }: { decision: Decision; onSaved: () => void }) {
  const [description, setDescription] = useState("");
  const [valence, setValence] = useState<Valence>("mixed");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createOutcome({
        decision_id: decision.id,
        description,
        valence,
        evidence_source: evidence || undefined,
      });
      setDescription("");
      setEvidence("");
      onSaved();
    } catch (err) {
      setError(String(err).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-2.5 rounded-lg border border-[var(--color-hair)] bg-[var(--color-ink-2)] p-3.5"
    >
      <Eyebrow>log an outcome</Eyebrow>
      <textarea
        className={`${inputCls} min-h-16 resize-y`}
        placeholder="What actually happened?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      <div className="flex gap-2">
        <select
          className={`${inputCls} w-32`}
          value={valence}
          onChange={(e) => setValence(e.target.value as Valence)}
        >
          <option value="positive">positive</option>
          <option value="negative">negative</option>
          <option value="mixed">mixed</option>
        </select>
        <input
          className={inputCls}
          placeholder="evidence source (dashboard, report…)"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <button className={buttonCls} disabled={busy || !description.trim()}>
          Save outcome
        </button>
        {busy && <Spinner label="Linking decision → outcome…" />}
      </div>
      {error && <ErrorNote message={error} />}
    </form>
  );
}

function Drawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [error, setError] = useState("");

  const load = () =>
    getDecision(id)
      .then(setDecision)
      .catch((e) => setError(String(e).replace(/^Error:\s*/, "")));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="px-fade-up h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-hair-bright)] bg-[var(--color-ink)] p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ animationDuration: "0.28s" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <Eyebrow>decision</Eyebrow>
            <h2 className="px-display mt-1 text-lg leading-tight text-[var(--color-fg)]">
              {decision?.title ?? "Loading…"}
            </h2>
          </div>
          <button className={ghostButtonCls} onClick={onClose}>
            close ✕
          </button>
        </div>
        {error && <div className="mt-4"><ErrorNote message={error} /></div>}
        {!decision && !error && <div className="mt-6"><Skeleton className="h-64" /></div>}
        {decision && (
          <div className="mt-5 space-y-6 text-sm">
            <div className="px-mono flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-fg-faint)]">
              <StatusBadge status={decision.status} />
              <span className="text-[var(--color-topic)]">#{decision.topic}</span>
              <span>{decision.reversibility === "one_way" ? "one-way door" : "two-way door"}</span>
              <span>·</span>
              <span>{fmtDate(decision.decided_on)}</span>
              <span>·</span>
              <span>{decision.owner || "unassigned"}</span>
            </div>

            <section>
              <Eyebrow>what was decided</Eyebrow>
              <p className="mt-1.5 leading-relaxed text-[var(--color-fg)]">{decision.statement}</p>
            </section>

            {decision.rationale && (
              <section>
                <Eyebrow>rationale</Eyebrow>
                <p className="mt-1.5 leading-relaxed text-[var(--color-fg-muted)]">
                  {decision.rationale}
                </p>
              </section>
            )}

            {decision.participants.length > 0 && (
              <section>
                <Eyebrow>participants</Eyebrow>
                <p className="px-mono mt-1.5 text-[var(--color-fg-muted)]">
                  {decision.participants.join(" · ")}
                </p>
              </section>
            )}

            {decision.assumptions.length > 0 && (
              <section>
                <Eyebrow>assumptions</Eyebrow>
                <ul className="mt-2 space-y-2">
                  {decision.assumptions.map((a) => {
                    const dead = !!a.invalidated_by_outcome_id;
                    return (
                      <li key={a.id} className="flex items-start gap-2.5">
                        <span className="px-mono mt-0.5 rounded border border-[var(--color-hair)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--color-fg-faint)]">
                          {a.confidence}
                        </span>
                        <span className="flex-1">
                          <span className={dead ? "px-strike" : "text-[var(--color-fg-muted)]"}>
                            {a.statement}
                          </span>
                          {dead && <span className="px-stamp ml-2">disproven</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section>
              <Eyebrow>outcomes — what actually happened</Eyebrow>
              {decision.outcomes.length === 0 ? (
                <p className="mt-1.5 text-[var(--color-fg-faint)]">
                  No verdict yet. This decision is still open.
                </p>
              ) : (
                <div className="px-thread mt-3">
                  {decision.outcomes.map((o) => (
                    <div key={o.id} className="px-thread-node pb-4 last:pb-0">
                      <div className="flex items-center gap-2">
                        <ValenceChip valence={o.valence} />
                        <TimeGap days={daysBetween(decision.decided_on, o.observed_on)} />
                        <span className="px-mono text-[10px] text-[var(--color-fg-faint)]">
                          {fmtDate(o.observed_on)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[var(--color-fg)]">{o.description}</p>
                      {o.evidence_source && (
                        <p className="px-mono mt-1 text-[10px] text-[var(--color-fg-faint)]">
                          source · {o.evidence_source}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <OutcomeForm decision={decision} onSaved={load} />
          </div>
        )}
      </div>
    </div>
  );
}

const STATUSES = ["", "decided", "proposed", "reversed", "superseded"];

export default function Decisions({
  refreshKey,
  initialOpen = null,
  onDrawerClosed,
}: {
  refreshKey: number;
  initialOpen?: string | null;
  onDrawerClosed?: () => void;
}) {
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(initialOpen);
  const [error, setError] = useState("");

  useEffect(() => {
    setDecisions(null);
    listDecisions({ topic: topic || undefined, status: status || undefined })
      .then(setDecisions)
      .catch((e) => {
        setError(String(e).replace(/^Error:\s*/, ""));
        setDecisions([]);
      });
  }, [topic, status, refreshKey, open]);

  return (
    <div className="mx-auto max-w-5xl">
      <Eyebrow>the register</Eyebrow>
      <h1 className="px-display mt-2 text-2xl text-[var(--color-fg)]">Decision register</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Every decision on record, with the outcomes that judged it.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <input
          className={`${inputCls} max-w-52`}
          placeholder="filter by topic…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s || "any"}
              onClick={() => setStatus(s)}
              className={`px-mono rounded-lg border px-3 py-1.5 text-[11px] uppercase tracking-wider transition ${
                status === s
                  ? "border-[var(--color-signal-dim)] bg-[var(--color-signal-deep)] text-[var(--color-signal)]"
                  : "border-[var(--color-hair)] text-[var(--color-fg-muted)] hover:border-[var(--color-hair-bright)]"
              }`}
            >
              {s || "all"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-hair)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-hair)] bg-[var(--color-panel)]">
              {["decision", "topic", "owner", "status", "verdict"].map((h) => (
                <th key={h} className="px-eyebrow px-4 py-2.5 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {decisions === null &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t border-[var(--color-hair)]/60">
                  <td colSpan={5} className="px-4 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            {decisions?.map((d) => {
              const disproven = d.assumptions.some((a) => a.invalidated_by_outcome_id);
              return (
                <tr
                  key={d.id}
                  className="group cursor-pointer border-t border-[var(--color-hair)]/60 transition hover:bg-[var(--color-panel)]/60"
                  onClick={() => setOpen(d.id)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-[var(--color-fg)] group-hover:text-[var(--color-signal)]">
                      {d.title}
                    </span>
                    {disproven && <span className="px-stamp ml-2">disproven</span>}
                  </td>
                  <td className="px-mono px-4 py-3 text-[var(--color-topic)]">#{d.topic}</td>
                  <td className="px-mono px-4 py-3 text-[11px] text-[var(--color-fg-muted)]">
                    {d.owner || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3">
                    {d.outcomes.length > 0 ? (
                      <div className="flex gap-1">
                        {d.outcomes.map((o) => (
                          <ValenceChip key={o.id} valence={o.valence} />
                        ))}
                      </div>
                    ) : (
                      <span className="px-mono text-[11px] text-[var(--color-fg-faint)]">pending</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {decisions?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--color-fg-muted)]">
                  No decisions match — clear the filters or log one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <Drawer
          id={open}
          onClose={() => {
            setOpen(null);
            onDrawerClosed?.();
          }}
        />
      )}
    </div>
  );
}
