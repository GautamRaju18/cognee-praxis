import { useState } from "react";
import { ingestFile, ingestText } from "../api";
import { DecisionCard, ErrorNote, Eyebrow, Panel, Spinner, buttonCls, inputCls, labelCls } from "../components";
import type { IngestReport } from "../types";

const SAMPLE = `Weekly product sync — 2025-06-12
Attendees: Omar Haddad (VP Product), Lena Fischer, Raj Patel.

Omar: we will move new-user onboarding to a guided checklist next sprint.
Rationale: activation stalls when users land on an empty dashboard.
Assumption: a checklist lifts week-1 activation without adding support load.`;

export default function Ingest({ onIngested }: { onIngested: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<IngestReport | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const result = file ? await ingestFile(file) : await ingestText(text);
      setReport(result);
      onIngested();
    } catch (err) {
      setError(String(err).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  const extractedEntries = report
    ? Object.entries(report.extracted).filter(([, items]) => items.length > 0)
    : [];

  return (
    <div className="mx-auto max-w-3xl">
      <Eyebrow>auto-capture</Eyebrow>
      <h1 className="px-display mt-2 text-2xl text-[var(--color-fg)]">Ingest a transcript</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Paste meeting notes or upload a .txt/.md file — Praxis extracts the decisions, owners, and
        assumptions into the graph.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>paste text</label>
            <button
              type="button"
              onClick={() => setText(SAMPLE)}
              className="px-mono text-[11px] text-[var(--color-fg-faint)] transition hover:text-[var(--color-signal)]"
            >
              use sample →
            </button>
          </div>
          <textarea
            className={`${inputCls} min-h-40 resize-y font-[var(--font-mono)] text-xs`}
            placeholder="Weekly product sync — …"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={file !== null}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>…or upload a file</label>
            <input
              type="file"
              accept=".txt,.md"
              className="px-mono text-xs text-[var(--color-fg-muted)] file:mr-3 file:rounded-lg file:border file:border-[var(--color-hair-bright)] file:bg-[var(--color-panel)] file:px-3 file:py-1.5 file:text-[var(--color-fg-muted)]"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <button className={buttonCls} disabled={busy || (!text.trim() && !file)}>
            Extract decisions
          </button>
        </div>
        {busy && <Spinner label="Reading the transcript and building the graph… (~30s)" />}
      </form>

      {error && (
        <div className="mt-6">
          <ErrorNote message={error} />
        </div>
      )}

      {report && (
        <div className="px-fade-up mt-8 space-y-5">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <Eyebrow>ingest report</Eyebrow>
              <span className="px-mono text-[11px] text-[var(--color-fg-faint)]">
                {report.chars_ingested} chars
              </span>
            </div>
            {extractedEntries.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {extractedEntries.map(([kind, items]) => (
                  <div key={kind} className="text-sm">
                    <span className="px-eyebrow">{kind}</span>
                    <div className="mt-0.5 text-[var(--color-fg-muted)]">{items.join(" · ")}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
                Ingested, but no new decisions were extracted from this text.
              </p>
            )}
          </Panel>

          {report.decisions.length > 0 && (
            <div>
              <Eyebrow>added to the register</Eyebrow>
              <div className="mt-3 space-y-3">
                {report.decisions.map((d) => (
                  <DecisionCard key={d.id} decision={d} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
