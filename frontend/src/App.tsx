import { useCallback, useEffect, useState } from "react";
import { getHealth } from "./api";
import Ask from "./pages/Ask";
import Brain from "./pages/Brain";
import CheckProposal from "./pages/CheckProposal";
import Dashboard from "./pages/Dashboard";
import Decisions from "./pages/Decisions";
import Ingest from "./pages/Ingest";
import LogDecision from "./pages/LogDecision";
import type { Health } from "./types";

const PAGES = [
  { key: "dashboard", label: "Overview", glyph: "◈" },
  { key: "ask", label: "Ask Praxis", glyph: "▹" },
  { key: "brain", label: "Company Brain", glyph: "⬡" },
  { key: "decisions", label: "Decisions", glyph: "▤" },
  { key: "check", label: "Check Proposal", glyph: "⊘" },
  { key: "log", label: "Log Decision", glyph: "＋" },
  { key: "ingest", label: "Ingest", glyph: "⇥" },
] as const;

type PageKey = (typeof PAGES)[number]["key"];

export default function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [health, setHealth] = useState<Health | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openDecisionId, setOpenDecisionId] = useState<string | null>(null);
  const bump = () => setRefreshKey((k) => k + 1);

  const openDecision = useCallback((id: string) => {
    setOpenDecisionId(id);
    setPage("decisions");
  }, []);

  const go = useCallback((key: PageKey) => {
    setPage(key);
    if (key !== "decisions") setOpenDecisionId(null);
  }, []);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  // keyboard nav: 1..7 jump between pages
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < PAGES.length) go(PAGES[idx].key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const provider = health?.llm_provider ?? "offline";
  const online = health?.status === "ok";

  return (
    <div className="relative flex h-full">
      <div className="px-app-bg" />

      {/* Console rail */}
      <aside className="relative z-10 flex w-60 shrink-0 flex-col border-r border-[var(--color-hair)] bg-[var(--color-ink)]/70 backdrop-blur">
        <div className="flex items-center gap-2.5 px-5 pt-5">
          <div className="px-glow flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-signal-deep)] text-[var(--color-signal)]">
            <span className="px-display text-lg leading-none">P</span>
          </div>
          <div>
            <div className="px-display text-[15px] leading-none text-[var(--color-fg)]">Praxis</div>
            <div className="px-eyebrow mt-1 !text-[9px]">decision intelligence</div>
          </div>
        </div>

        <nav className="mt-7 space-y-0.5 px-3">
          {PAGES.map((p, i) => {
            const active = page === p.key;
            return (
              <button
                key={p.key}
                onClick={() => go(p.key)}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  active
                    ? "bg-[var(--color-panel-2)] text-[var(--color-fg)]"
                    : "text-[var(--color-fg-muted)] hover:bg-[var(--color-panel)] hover:text-[var(--color-fg)]"
                }`}
              >
                <span
                  className={`text-base leading-none ${active ? "text-[var(--color-signal)]" : "text-[var(--color-fg-faint)] group-hover:text-[var(--color-fg-muted)]"}`}
                >
                  {p.glyph}
                </span>
                <span className="flex-1">{p.label}</span>
                <span className="px-mono text-[10px] text-[var(--color-fg-faint)] opacity-0 transition group-hover:opacity-100">
                  {i + 1}
                </span>
                {active && <span className="h-4 w-0.5 rounded-full bg-[var(--color-signal)]" />}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 px-5 pb-5">
          <div className="px-eyebrow">system</div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`px-live-dot h-2 w-2 rounded-full ${online ? "bg-[var(--color-signal)]" : "bg-[var(--color-neg)]"}`}
            />
            <span className="text-[var(--color-fg-muted)]">
              {online ? "cognee online" : "API offline"}
            </span>
          </div>
          <div className="px-mono truncate text-[10px] text-[var(--color-fg-faint)]" title={provider}>
            {provider}
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-hair)] px-6">
          <div className="px-mono flex items-center gap-2 text-[11px] text-[var(--color-fg-faint)]">
            <span className="text-[var(--color-fg-muted)]">praxis</span>
            <span>/</span>
            <span className="text-[var(--color-signal)]">
              {PAGES.find((p) => p.key === page)?.label.toLowerCase()}
            </span>
          </div>
          <div className="px-mono flex items-center gap-4 text-[10px] text-[var(--color-fg-faint)]">
            <span>dataset · praxis</span>
            <span>cognee {health?.cognee_version ?? "—"}</span>
          </div>
        </header>

        {page === "brain" ? (
          <main key={page} className="px-fade-up relative min-h-0 flex-1 overflow-hidden">
            <Brain onOpenDecision={openDecision} />
          </main>
        ) : (
          <main key={page} className="px-fade-up min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-6 py-7">
              {page === "dashboard" && <Dashboard onNavigate={go} onOpenDecision={openDecision} />}
              {page === "ask" && <Ask />}
              {page === "decisions" && (
                <Decisions
                  refreshKey={refreshKey}
                  initialOpen={openDecisionId}
                  onDrawerClosed={() => setOpenDecisionId(null)}
                />
              )}
              {page === "check" && <CheckProposal />}
              {page === "log" && <LogDecision onLogged={bump} />}
              {page === "ingest" && <Ingest onIngested={bump} />}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
