import { useState } from "react";
import { checkProposal } from "../api";
import {
  DecisionCard,
  ErrorNote,
  Eyebrow,
  Spinner,
  buttonCls,
  inputCls,
  labelCls,
} from "../components";
import type { ProposalCheck } from "../types";

const EXAMPLE =
  "Let's build a referral program: existing users get a cash reward for every friend they invite who signs up.";

type Verdict = "repeat" | "contradict" | "clear";

function verdictOf(r: ProposalCheck): Verdict {
  if (r.repeats_prior) return "repeat";
  if (r.contradicts.length > 0) return "contradict";
  return "clear";
}

const VERDICT_META: Record<
  Verdict,
  { label: string; sub: string; color: string; bg: string; glyph: string }
> = {
  repeat: {
    label: "Repeats prior history",
    sub: "Your team has tried or decided this before.",
    color: "var(--color-mixed)",
    bg: "#241d0e",
    glyph: "↺",
  },
  contradict: {
    label: "Contradicts a decision",
    sub: "This runs against a standing decision.",
    color: "var(--color-neg)",
    bg: "#2a1015",
    glyph: "⊘",
  },
  clear: {
    label: "No conflicting history",
    sub: "Nothing on record repeats or contradicts this.",
    color: "var(--color-pos)",
    bg: "#0c2418",
    glyph: "✓",
  },
};

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
      setError(String(err).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  const verdict = result ? verdictOf(result) : null;
  const meta = verdict ? VERDICT_META[verdict] : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Eyebrow>pre-mortem</Eyebrow>
      <h1 className="px-display mt-2 text-2xl text-[var(--color-fg)]">Check a proposal</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Before you pitch it — has this been tried, decided, or ruled out already?
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className={labelCls}>proposal</label>
          <textarea
            className={`${inputCls} min-h-28 resize-y`}
            required
            placeholder={EXAMPLE}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setText(EXAMPLE)}
            className="px-mono mt-1.5 text-[11px] text-[var(--color-fg-faint)] transition hover:text-[var(--color-signal)]"
          >
            use example →
          </button>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-56">
            <label className={labelCls}>topic (optional)</label>
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
        </div>
        {busy && <Spinner label="Consulting the company brain…" />}
      </form>

      {error && (
        <div className="mt-6">
          <ErrorNote message={error} />
        </div>
      )}

      {result && meta && (
        <div className="px-fade-up mt-8 space-y-5">
          <div
            className="flex items-start gap-4 rounded-xl border p-5"
            style={{ borderColor: meta.color, background: meta.bg }}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl"
              style={{ color: meta.color, border: `1.5px solid ${meta.color}` }}
            >
              {meta.glyph}
            </div>
            <div>
              <div className="px-display text-lg" style={{ color: meta.color }}>
                {meta.label}
              </div>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                {result.warning || meta.sub}
              </p>
            </div>
          </div>

          {result.relevant_history.length > 0 && (
            <div>
              <Eyebrow>relevant history</Eyebrow>
              <div className="mt-3 space-y-3">
                {result.relevant_history.map((d) => (
                  <div
                    key={d.id}
                    className={
                      result.contradicts.includes(d.id)
                        ? "rounded-[15px] ring-2 ring-[var(--color-neg)]"
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
