import { useState } from "react";
import { query } from "../api";
import { DecisionCard, ErrorNote, Spinner, buttonCls, inputCls } from "../components";
import type { QueryResult } from "../types";

const SUGGESTIONS = [
  "What have we decided about pricing, and why?",
  "What did we try before on churn, and what actually happened?",
  "Which of our past assumptions were proven wrong?",
];

export default function Ask() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);

  async function run(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await query(text));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-zinc-100">Ask Praxis</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Ask the company brain what was decided, why, and what actually happened.
      </p>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
      >
        <input
          className={`${inputCls} py-3 text-base`}
          placeholder="e.g. What did we try before on churn, and what actually happened?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className={buttonCls} disabled={busy || !q.trim()}>
          Ask
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            onClick={() => {
              setQ(s);
              run(s);
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-6">
        {busy && <Spinner label="Traversing the decision graph… (10–30s)" />}
        {error && <ErrorNote message={error} />}
        {result && (
          <>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Answer
              </div>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-zinc-100">
                {result.answer}
              </p>
            </div>
            {result.cited_decisions.length > 0 && (
              <div>
                <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Grounded in {result.cited_decisions.length} decision
                  {result.cited_decisions.length > 1 ? "s" : ""}
                </div>
                <div className="space-y-3">
                  {result.cited_decisions.map((d) => (
                    <DecisionCard key={d.id} decision={d} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
