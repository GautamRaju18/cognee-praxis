import { useEffect, useRef, useState } from "react";
import { query } from "../api";
import { DecisionCard, Eyebrow, ErrorNote, GraphPath, Panel, buttonCls } from "../components";
import type { QueryResult } from "../types";

const SUGGESTIONS = [
  "What did we try before on churn, and what actually happened?",
  "What have we decided about pricing, and why?",
  "Which of our past assumptions were proven wrong?",
];

// Every follow-up hits the curated cache (churn/pricing/assumption/referral/infra
// keywords) so the conversation stays instant and deterministic on camera.
const FOLLOWUPS = [
  "What did we try before on churn, and what actually happened?",
  "What have we decided about pricing, and why?",
  "Which of our past assumptions were proven wrong?",
  "What happened with our referral program?",
  "What have we decided about infrastructure?",
];

const STEPS = ["Embedding the question", "Traversing the decision graph", "Composing the answer"];

function useTypewriter(text: string, active: boolean) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!active) {
      setOut(text);
      return;
    }
    setOut("");
    let i = 0;
    const step = Math.max(1, Math.round(text.length / 140));
    const id = setInterval(() => {
      i += step;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [text, active]);
  return out;
}

function Thinking() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <Panel className="p-5">
      <div className="space-y-2.5">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-3 text-sm">
            <span
              className={`px-mono flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                i < step
                  ? "border-[var(--color-signal-dim)] text-[var(--color-signal)]"
                  : i === step
                    ? "border-[var(--color-signal)] text-[var(--color-signal)]"
                    : "border-[var(--color-hair)] text-[var(--color-fg-faint)]"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className={i <= step ? "text-[var(--color-fg-muted)]" : "text-[var(--color-fg-faint)]"}>
              {s}
              {i === step && <span className="px-live-dot text-[var(--color-signal)]"> …</span>}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function Ask() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [typing, setTyping] = useState(false);
  const [asked, setAsked] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const answer = useTypewriter(result?.answer ?? "", typing);

  async function run(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await query(text);
      setResult(r);
      setAsked(text);
      setTyping(true);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Eyebrow>ask the brain</Eyebrow>
      <h1 className="px-display mt-2 text-2xl text-[var(--color-fg)]">
        What has your team decided — and what happened?
      </h1>

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="px-mono pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-signal)]">
              ›
            </span>
            <input
              ref={inputRef}
              className="w-full rounded-xl border border-[var(--color-hair)] bg-[var(--color-ink-2)] py-3.5 pl-8 pr-3 text-base text-[var(--color-fg)] placeholder-[var(--color-fg-faint)] outline-none transition focus:border-[var(--color-signal-dim)]"
              placeholder="What did we try before on churn?"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className={`${buttonCls} px-5`} disabled={busy || !q.trim()}>
            {busy ? "Thinking…" : "Ask"}
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="px-mono rounded-full border border-[var(--color-hair)] px-3 py-1 text-[11px] text-[var(--color-fg-muted)] transition hover:border-[var(--color-signal-dim)] hover:text-[var(--color-fg)]"
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
        {busy && <Thinking />}
        {error && <ErrorNote message={error} />}
        {result && !busy && (
          <div className="px-fade-up space-y-6">
            <Panel className="relative overflow-hidden p-5">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-signal)] to-transparent opacity-60" />
              <Eyebrow>answer</Eyebrow>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-[var(--color-fg)]">
                {answer}
                {typing && answer.length < (result.answer?.length ?? 0) && (
                  <span className="ml-0.5 inline-block h-4 w-1.5 -translate-y-px animate-pulse bg-[var(--color-signal)] align-middle" />
                )}
              </p>
            </Panel>

            {result.reasoning.length > 0 && <GraphPath triples={result.reasoning} />}

            {result.cited_decisions.length > 0 && (
              <div>
                <Eyebrow>
                  grounded in {result.cited_decisions.length} decision
                  {result.cited_decisions.length > 1 ? "s" : ""}
                </Eyebrow>
                <div className="mt-3 space-y-3">
                  {result.cited_decisions.map((d) => (
                    <DecisionCard key={d.id} decision={d} />
                  ))}
                </div>
              </div>
            )}

            {answer.length >= (result.answer?.length ?? 0) && (
              <div className="px-fade-up border-t border-[var(--color-hair)] pt-5">
                <Eyebrow>keep pulling the thread</Eyebrow>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FOLLOWUPS.filter((f) => f !== asked)
                    .slice(0, 3)
                    .map((s) => (
                      <button
                        key={s}
                        className="px-mono group flex items-center gap-1.5 rounded-full border border-[var(--color-hair)] px-3 py-1.5 text-[11px] text-[var(--color-fg-muted)] transition hover:border-[var(--color-signal-dim)] hover:text-[var(--color-fg)]"
                        onClick={() => {
                          setQ(s);
                          run(s);
                        }}
                      >
                        <span className="text-[var(--color-signal)] transition group-hover:translate-x-0.5">
                          ↳
                        </span>
                        {s}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
