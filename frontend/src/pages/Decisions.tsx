import { useEffect, useState } from "react";
import { createOutcome, getDecision, listDecisions } from "../api";
import {
  ErrorNote,
  Spinner,
  StatusBadge,
  ValenceChip,
  buttonCls,
  ghostButtonCls,
  inputCls,
  labelCls,
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
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-zinc-800 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Log an outcome
      </div>
      <textarea
        className={`${inputCls} min-h-16`}
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
          placeholder="Evidence source (dashboard, report…)"
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
      .catch((e) => setError(String(e)));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-zinc-100">{decision?.title ?? "…"}</h2>
          <button className={ghostButtonCls} onClick={onClose}>
            close
          </button>
        </div>
        {error && <ErrorNote message={error} />}
        {decision && (
          <div className="mt-4 space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={decision.status} />
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">{decision.topic}</span>
              <span className="text-xs text-zinc-500">
                {decision.reversibility === "one_way" ? "one-way door" : "two-way door"} ·{" "}
                {decision.decided_on} · {decision.owner}
              </span>
            </div>

            <section>
              <div className={labelCls}>Decision</div>
              <p className="text-zinc-200">{decision.statement}</p>
            </section>

            {decision.rationale && (
              <section>
                <div className={labelCls}>Rationale</div>
                <p className="text-zinc-300">{decision.rationale}</p>
              </section>
            )}

            {decision.participants.length > 0 && (
              <section>
                <div className={labelCls}>Participants</div>
                <p className="text-zinc-300">{decision.participants.join(", ")}</p>
              </section>
            )}

            {decision.assumptions.length > 0 && (
              <section>
                <div className={labelCls}>Assumptions</div>
                <ul className="space-y-1.5">
                  {decision.assumptions.map((a) => (
                    <li key={a.id} className="flex items-start gap-2">
                      <span className="mt-0.5 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                        {a.confidence}
                      </span>
                      <span
                        className={
                          a.invalidated_by_outcome_id
                            ? "text-rose-300 line-through decoration-rose-500/60"
                            : "text-zinc-300"
                        }
                      >
                        {a.statement}
                        {a.invalidated_by_outcome_id && (
                          <span className="ml-2 text-xs text-rose-400 no-underline">
                            (proven wrong)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <div className={labelCls}>Outcomes</div>
              {decision.outcomes.length === 0 && (
                <p className="text-zinc-500">None recorded yet.</p>
              )}
              <ul className="space-y-2">
                {decision.outcomes.map((o) => (
                  <li key={o.id} className="rounded-lg border border-zinc-800 p-3">
                    <div className="flex items-center gap-2">
                      <ValenceChip valence={o.valence} />
                      <span className="text-xs text-zinc-500">{o.observed_on}</span>
                    </div>
                    <p className="mt-1.5 text-zinc-200">{o.description}</p>
                    {o.evidence_source && (
                      <p className="mt-1 text-xs text-zinc-500">source: {o.evidence_source}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <OutcomeForm decision={decision} onSaved={load} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Decisions({ refreshKey }: { refreshKey: number }) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listDecisions({ topic: topic || undefined, status: status || undefined })
      .then(setDecisions)
      .catch((e) => setError(String(e)));
  }, [topic, status, refreshKey, open]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-zinc-100">Decision register</h1>
      <div className="mt-4 flex gap-2">
        <input
          className={`${inputCls} max-w-48`}
          placeholder="filter by topic…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <select
          className={`${inputCls} max-w-40`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">any status</option>
          <option value="decided">decided</option>
          <option value="proposed">proposed</option>
          <option value="reversed">reversed</option>
          <option value="superseded">superseded</option>
        </select>
      </div>
      {error && (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      )}
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2.5">Decision</th>
              <th className="px-4 py-2.5">Topic</th>
              <th className="px-4 py-2.5">Owner</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Outcomes</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((d) => (
              <tr
                key={d.id}
                className="cursor-pointer border-t border-zinc-800/70 transition hover:bg-zinc-900/60"
                onClick={() => setOpen(d.id)}
              >
                <td className="px-4 py-3 font-medium text-zinc-200">{d.title}</td>
                <td className="px-4 py-3 text-zinc-400">{d.topic}</td>
                <td className="px-4 py-3 text-zinc-400">{d.owner}</td>
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
                    <span className="text-xs text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
            {decisions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No decisions yet — log one or run the seed script.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {open && <Drawer id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
