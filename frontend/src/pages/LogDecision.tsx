import { useState } from "react";
import { createDecision } from "../api";
import { ErrorNote, Spinner, buttonCls, ghostButtonCls, inputCls, labelCls } from "../components";
import type { Confidence, DecisionCreate } from "../types";

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

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

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
      setDone(`Logged "${created.title}" and pushed it into the memory graph.`);
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
      <h1 className="text-2xl font-bold text-zinc-100">Log a decision</h1>
      <p className="mt-1 text-sm text-zinc-400">
        The record is stored in the register and extracted into the memory graph.
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

        <div className="flex items-center gap-4 pt-2">
          <button className={buttonCls} disabled={busy}>
            Log decision
          </button>
          {busy && <Spinner label="Writing to graph… (~20s)" />}
        </div>
        {error && <ErrorNote message={error} />}
        {done && (
          <div className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300">
            {done}
          </div>
        )}
      </form>
    </div>
  );
}
