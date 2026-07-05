import { useEffect, useRef, useState } from "react";
import { checkProposal, createDecision } from "../api";
import {
  ErrorNote,
  Eyebrow,
  Spinner,
  buttonCls,
  ghostButtonCls,
  inputCls,
  labelCls,
} from "../components";
import { useNav } from "../nav";
import type { Confidence, DecisionCreate, ProposalCheck } from "../types";

interface AssumptionDraft {
  statement: string;
  confidence: Confidence;
}

export default function LogDecision({ onLogged }: { onLogged: () => void }) {
  const [form, setForm] = useState({
    title: "",
    statement: "",
    rationale: "",
    owner: "",
    participants: "",
    topic: "",
    status: "decided" as DecisionCreate["status"],
    reversibility: "two_way" as DecisionCreate["reversibility"],
  });
  const [assumptions, setAssumptions] = useState<AssumptionDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [guard, setGuard] = useState<ProposalCheck | null>(null);
  const nav = useNav();
  const guardSeq = useRef(0);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Live "have we done this before?" check while drafting — reuses check-proposal.
  useEffect(() => {
    const probe = `${form.title}. ${form.statement}`.trim();
    if (form.title.trim().length < 5 || probe.length < 15) {
      setGuard(null);
      return;
    }
    const seq = ++guardSeq.current;
    const t = setTimeout(() => {
      checkProposal(probe, form.topic || undefined)
        .then((r) => {
          if (seq === guardSeq.current) setGuard(r.repeats_prior || r.contradicts.length ? r : null);
        })
        .catch(() => {});
    }, 650);
    return () => clearTimeout(t);
  }, [form.title, form.statement, form.topic]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDone("");
    try {
      const created = await createDecision({
        ...form,
        participants: form.participants
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        assumptions: assumptions.filter((a) => a.statement.trim()),
      });
      setCreatedId(created.id);
      setDone(`Logged "${created.title}" and wired it into the memory graph.`);
      setAssumptions([]);
      setForm({
        title: "",
        statement: "",
        rationale: "",
        owner: "",
        participants: "",
        topic: "",
        status: "decided",
        reversibility: "two_way",
      });
      onLogged();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Eyebrow>capture</Eyebrow>
      <h1 className="px-display mt-2 text-2xl text-[var(--color-fg)]">Log a decision</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Stored in the register and extracted into the memory graph — ready to be judged by its
        outcome later.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className={labelCls}>Title</label>
          <input
            className={inputCls}
            required
            minLength={3}
            value={form.title}
            onChange={set("title")}
            placeholder="Switch to annual-only pricing"
          />
        </div>
        <div>
          <label className={labelCls}>What was decided</label>
          <textarea
            className={`${inputCls} min-h-20`}
            required
            value={form.statement}
            onChange={set("statement")}
            placeholder="One or two sentences stating exactly what was decided."
          />
        </div>
        <div>
          <label className={labelCls}>Rationale — why</label>
          <textarea
            className={`${inputCls} min-h-20`}
            value={form.rationale}
            onChange={set("rationale")}
            placeholder="Why this decision was made."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Owner</label>
            <input
              className={inputCls}
              required
              value={form.owner}
              onChange={set("owner")}
              placeholder="Dana Kim"
            />
          </div>
          <div>
            <label className={labelCls}>Topic</label>
            <input
              className={inputCls}
              required
              value={form.topic}
              onChange={set("topic")}
              placeholder="pricing"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Participants (comma-separated)</label>
          <input
            className={inputCls}
            value={form.participants}
            onChange={set("participants")}
            placeholder="Marcus Lee, Elena Petrova"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status} onChange={set("status")}>
              <option value="decided">decided</option>
              <option value="proposed">proposed</option>
              <option value="reversed">reversed</option>
              <option value="superseded">superseded</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Reversibility</label>
            <select
              className={inputCls}
              value={form.reversibility}
              onChange={set("reversibility")}
            >
              <option value="two_way">two-way door (reversible)</option>
              <option value="one_way">one-way door (hard to undo)</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Assumptions</label>
            <button
              type="button"
              className={ghostButtonCls}
              onClick={() => setAssumptions((a) => [...a, { statement: "", confidence: "med" }])}
            >
              + add assumption
            </button>
          </div>
          <div className="space-y-2">
            {assumptions.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="What must be true for this to work?"
                  value={a.statement}
                  onChange={(e) =>
                    setAssumptions((list) =>
                      list.map((x, j) => (j === i ? { ...x, statement: e.target.value } : x)),
                    )
                  }
                />
                <select
                  className={`${inputCls} w-28`}
                  value={a.confidence}
                  onChange={(e) =>
                    setAssumptions((list) =>
                      list.map((x, j) =>
                        j === i ? { ...x, confidence: e.target.value as Confidence } : x,
                      ),
                    )
                  }
                >
                  <option value="low">low</option>
                  <option value="med">med</option>
                  <option value="high">high</option>
                </select>
                <button
                  type="button"
                  className={ghostButtonCls}
                  onClick={() => setAssumptions((list) => list.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {guard && (
          <div className="px-fade-up rounded-lg border border-[var(--color-mixed)] bg-[#241d0e]/70 p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-mixed)]">⚠</span>
              <span className="px-mono text-[11px] uppercase tracking-wider text-[var(--color-mixed)]">
                {guard.repeats_prior ? "seen before" : "conflicts with history"}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">{guard.warning}</p>
            {guard.relevant_history[0] && (
              <button
                type="button"
                onClick={() => nav.openDecision(guard.relevant_history[0].id)}
                className="px-mono mt-1.5 text-[11px] text-[var(--color-fg-faint)] transition hover:text-[var(--color-signal)]"
              >
                see · {guard.relevant_history[0].title} →
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 pt-2">
          <button className={buttonCls} disabled={busy}>
            Log decision
          </button>
          {busy && <Spinner label="Writing to graph… (~20s)" />}
        </div>
        {error && <ErrorNote message={error} />}
        {done && (
          <div className="px-fade-up flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1f6b43] bg-[#0c2418]/70 px-3.5 py-3 text-sm text-[var(--color-pos)]">
            <span>{done}</span>
            {createdId && (
              <button
                type="button"
                onClick={() => nav.openInGraph(createdId)}
                className="px-mono shrink-0 rounded-md border border-[var(--color-signal-dim)] bg-[var(--color-signal-deep)] px-2.5 py-1 text-[11px] text-[var(--color-signal)] transition hover:brightness-125"
              >
                ⬡ watch it appear in the brain →
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
