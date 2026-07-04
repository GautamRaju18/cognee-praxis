import { useState } from "react";
import { checkProposal } from "../api";
import { DecisionCard, ErrorNote, Spinner, buttonCls, inputCls, labelCls } from "../components";
import type { ProposalCheck } from "../types";

export default function CheckProposal() {
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProposalCheck | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await checkProposal(text, topic || undefined));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-zinc-100">Check a proposal</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Before pitching it — has this been tried, decided, or ruled out already?
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className={labelCls}>Proposal</label>
          <textarea
            className={`${inputCls} min-h-28`}
            required
            placeholder="Let's build a referral program where existing users get rewards for inviting friends…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-3">
          <div className="w-56">
            <label className={labelCls}>Topic (optional)</label>
            <input
              className={inputCls}
              placeholder="growth"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <button className={buttonCls} disabled={busy || !text.trim()}>
            Check against memory
          </button>
          {busy && <Spinner label="Consulting the company brain…" />}
        </div>
      </form>

      {error && (
        <div className="mt-6">
          <ErrorNote message={error} />
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-5">
          <div
            className={`rounded-xl border p-4 ${
              result.repeats_prior || result.contradicts.length > 0
                ? "border-amber-800 bg-amber-950/40"
                : "border-emerald-900 bg-emerald-950/30"
            }`}
          >
            <div className="text-sm font-semibold">
              {result.repeats_prior
                ? "⚠ This repeats something we already tried or decided."
                : result.contradicts.length > 0
                  ? "⚠ This contradicts a past decision."
                  : "✓ No conflicting history found."}
            </div>
            {result.warning && (
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">{result.warning}</p>
            )}
          </div>

          {result.relevant_history.length > 0 && (
            <div>
              <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Relevant history
              </div>
              <div className="space-y-3">
                {result.relevant_history.map((d) => (
                  <div
                    key={d.id}
                    className={
                      result.contradicts.includes(d.id)
                        ? "rounded-xl ring-2 ring-amber-700"
                        : undefined
                    }
                  >
                    <DecisionCard decision={d} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
