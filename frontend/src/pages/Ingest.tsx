import { useState } from "react";
import { ingestFile, ingestText } from "../api";
import { DecisionCard, ErrorNote, Spinner, buttonCls, inputCls, labelCls } from "../components";
import type { IngestReport } from "../types";

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
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-zinc-100">Ingest a document</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Paste meeting notes or upload a .txt/.md transcript — Praxis extracts the decisions
        automatically.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className={labelCls}>Paste text</label>
          <textarea
            className={`${inputCls} min-h-40 font-mono text-xs`}
            placeholder="Weekly product sync — …"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={file !== null}
          />
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className={labelCls}>…or upload a file</label>
            <input
              type="file"
              accept=".txt,.md"
              className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-zinc-200"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <button className={buttonCls} disabled={busy || (!text.trim() && !file)}>
            Ingest
          </button>
          {busy && <Spinner label="Extracting decisions… (~30s)" />}
        </div>
      </form>

      {error && (
        <div className="mt-6">
          <ErrorNote message={error} />
        </div>
      )}

      {report && (
        <div className="mt-8 space-y-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm">
            <div className="font-semibold text-zinc-100">
              Ingested {report.chars_ingested} characters.
            </div>
            <ul className="mt-2 space-y-1 text-zinc-400">
              {Object.entries(report.extracted).map(([kind, items]) =>
                items.length > 0 ? (
                  <li key={kind}>
                    <span className="text-zinc-500">{kind}:</span> {items.join(" · ")}
                  </li>
                ) : null,
              )}
            </ul>
          </div>
          {report.decisions.length > 0 && (
            <div>
              <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Added to the register
              </div>
              <div className="space-y-3">
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
