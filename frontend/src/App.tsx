import { useEffect, useState } from "react";
import { getHealth } from "./api";
import Ask from "./pages/Ask";
import Brain from "./pages/Brain";
import CheckProposal from "./pages/CheckProposal";
import Decisions from "./pages/Decisions";
import Ingest from "./pages/Ingest";
import LogDecision from "./pages/LogDecision";
import type { Health } from "./types";

const PAGES = [
  { key: "ask", label: "Ask Praxis" },
  { key: "decisions", label: "Decisions" },
  { key: "log", label: "Log a decision" },
  { key: "check", label: "Check a proposal" },
  { key: "ingest", label: "Ingest" },
  { key: "brain", label: "Company brain" },
] as const;

type PageKey = (typeof PAGES)[number]["key"];

export default function App() {
  const [page, setPage] = useState<PageKey>("ask");
  const [health, setHealth] = useState<Health | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-4">
        <div className="px-2 py-1">
          <div className="text-lg font-black tracking-tight text-zinc-100">Praxis</div>
          <div className="text-[11px] leading-tight text-zinc-500">
            institutional decision memory
          </div>
        </div>
        <nav className="mt-6 space-y-1">
          {PAGES.map((p) => (
            <button
              key={p.key}
              onClick={() => setPage(p.key)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                page === p.key
                  ? "bg-zinc-800 font-semibold text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-2 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                health?.status === "ok" ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            {health ? `cognee ${health.cognee_version ?? "?"}` : "API offline"}
          </div>
          {health?.llm_provider && (
            <div className="mt-1 truncate" title={health.llm_provider}>
              {health.llm_provider}
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {page === "ask" && <Ask />}
        {page === "decisions" && <Decisions refreshKey={refreshKey} />}
        {page === "log" && <LogDecision onLogged={bump} />}
        {page === "check" && <CheckProposal />}
        {page === "ingest" && <Ingest onIngested={bump} />}
        {page === "brain" && <Brain />}
      </main>
    </div>
  );
}
