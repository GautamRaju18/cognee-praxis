import { motion } from "framer-motion";
import {
  BarChart3,
  Command,
  FileInput,
  FlaskConical,
  History,
  LayoutDashboard,
  type LucideIcon,
  Network,
  PlusCircle,
  ShieldQuestion,
  Sparkles,
  Table2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getHealth } from "./api";
import CommandPalette from "./CommandPalette";
import { NavContext } from "./nav";
import Ask from "./pages/Ask";
import Assumptions from "./pages/Assumptions";
import Brain from "./pages/Brain";
import CheckProposal from "./pages/CheckProposal";
import Dashboard from "./pages/Dashboard";
import Decisions from "./pages/Decisions";
import Ingest from "./pages/Ingest";
import Insights from "./pages/Insights";
import LogDecision from "./pages/LogDecision";
import People from "./pages/People";
import Timeline from "./pages/Timeline";
import Splash from "./Splash";
import type { Health } from "./types";

const PAGES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Overview", icon: LayoutDashboard },
  { key: "ask", label: "Ask Praxis", icon: Sparkles },
  { key: "brain", label: "Company Brain", icon: Network },
  { key: "insights", label: "Insights", icon: BarChart3 },
  { key: "timeline", label: "Timeline", icon: History },
  { key: "decisions", label: "Decisions", icon: Table2 },
  { key: "people", label: "Decision-makers", icon: Users },
  { key: "assumptions", label: "Assumptions", icon: FlaskConical },
  { key: "check", label: "Check Proposal", icon: ShieldQuestion },
  { key: "log", label: "Log Decision", icon: PlusCircle },
  { key: "ingest", label: "Ingest", icon: FileInput },
];

type PageKey = (typeof PAGES)[number]["key"];

export default function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [health, setHealth] = useState<Health | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openDecisionId, setOpenDecisionId] = useState<string | null>(null);
  const [graphFocusId, setGraphFocusId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const bump = () => setRefreshKey((k) => k + 1);

  const openDecision = useCallback((id: string) => {
    setOpenDecisionId(id);
    setPage("decisions");
  }, []);

  const openInGraph = useCallback((decisionId: string) => {
    setGraphFocusId(decisionId);
    setPage("brain");
  }, []);

  const go = useCallback((key: PageKey) => {
    setPage(key);
    if (key !== "decisions") setOpenDecisionId(null);
    if (key !== "brain") setGraphFocusId(null);
  }, []);

  const nav = useMemo(
    () => ({ openDecision, openInGraph, goToPage: (k: string) => go(k as PageKey) }),
    [openDecision, openInGraph, go],
  );

  useEffect(() => {
    let alive = true;
    const check = () =>
      getHealth()
        .then((h) => alive && (setHealth(h), setChecked(true)))
        .catch(() => alive && (setHealth(null), setChecked(true)));
    check();
    const id = setInterval(check, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
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
    <NavContext.Provider value={nav}>
    <Splash />
    <CommandPalette />
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
                aria-label={p.label}
                aria-current={active ? "page" : undefined}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition active:scale-[0.98] ${
                  active
                    ? "bg-[var(--color-panel-2)] text-[var(--color-fg)]"
                    : "text-[var(--color-fg-muted)] hover:bg-[var(--color-panel)] hover:text-[var(--color-fg)]"
                }`}
              >
                <p.icon
                  size={17}
                  strokeWidth={active ? 2.3 : 1.8}
                  className={
                    active
                      ? "text-[var(--color-signal)]"
                      : "text-[var(--color-fg-faint)] group-hover:text-[var(--color-fg-muted)]"
                  }
                />
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
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              aria-label="Open command palette"
              className="flex items-center gap-1 rounded border border-[var(--color-hair)] px-1.5 py-0.5 transition active:scale-95 hover:border-[var(--color-signal-dim)] hover:text-[var(--color-signal)]"
            >
              <Command size={11} strokeWidth={2} />K
            </button>
            <span>dataset · praxis</span>
            <span>cognee {health?.cognee_version ?? "—"}</span>
          </div>
        </header>

        {checked && !online && (
          <div className="flex items-center gap-2 border-b border-[#7a2c37] bg-[#2a1015] px-6 py-2 text-sm text-[var(--color-neg)]">
            <span className="px-live-dot h-2 w-2 rounded-full bg-[var(--color-neg)]" />
            <span className="px-mono text-[11px] uppercase tracking-wider">backend unreachable</span>
            <span className="text-[var(--color-fg-muted)]">
              — the API isn’t responding. Retrying every few seconds.
            </span>
          </div>
        )}

        {page === "brain" ? (
          <main key={page} className="px-fade-up relative min-h-0 flex-1 overflow-hidden">
            <Brain onOpenDecision={openDecision} focusDecisionId={graphFocusId} />
          </main>
        ) : (
          <main className="min-h-0 flex-1 overflow-y-auto">
            {/* keyed enter animation (no AnimatePresence exit — it deadlocks with
                the vanilla-tilt transforms and can freeze navigation) */}
            <motion.div
                key={page}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                className="mx-auto max-w-6xl px-6 py-7"
              >
                {page === "dashboard" && (
                  <Dashboard onNavigate={(k) => go(k as PageKey)} onOpenDecision={openDecision} />
                )}
                {page === "ask" && <Ask />}
                {page === "insights" && <Insights onOpenDecision={openDecision} />}
                {page === "timeline" && <Timeline />}
                {page === "decisions" && (
                  <Decisions
                    refreshKey={refreshKey}
                    initialOpen={openDecisionId}
                    onDrawerClosed={() => setOpenDecisionId(null)}
                  />
                )}
                {page === "people" && <People />}
                {page === "assumptions" && <Assumptions />}
                {page === "check" && <CheckProposal />}
                {page === "log" && <LogDecision onLogged={bump} />}
                {page === "ingest" && <Ingest onIngested={bump} />}
              </motion.div>
          </main>
        )}
      </div>
    </div>
    </NavContext.Provider>
  );
}
