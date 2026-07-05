import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { listDecisions } from "./api";
import { StatusBadge } from "./components";
import { useNav } from "./nav";
import type { Decision } from "./types";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
  badge?: string;
}

const PAGES: { key: string; label: string }[] = [
  { key: "dashboard", label: "Overview" },
  { key: "ask", label: "Ask Praxis" },
  { key: "brain", label: "Company Brain" },
  { key: "timeline", label: "Timeline" },
  { key: "decisions", label: "Decisions" },
  { key: "assumptions", label: "Assumptions" },
  { key: "check", label: "Check Proposal" },
  { key: "log", label: "Log Decision" },
  { key: "ingest", label: "Ingest" },
];

export default function CommandPalette() {
  const nav = useNav();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      listDecisions()
        .then(setDecisions)
        .catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    const list: Cmd[] = PAGES.map((p) => ({
      id: `page:${p.key}`,
      label: p.label,
      group: "Go to",
      run: () => nav.goToPage(p.key),
    }));
    for (const d of decisions) {
      list.push({
        id: `dec:${d.id}`,
        label: d.title,
        hint: `#${d.topic}`,
        badge: d.status,
        group: "Decisions",
        run: () => nav.openDecision(d.id),
      });
    }
    return list;
  }, [decisions, nav]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? commands.filter((c) => (c.label + " " + (c.hint ?? "")).toLowerCase().includes(term))
      : commands;
    if (term) {
      base.unshift({
        id: "ask",
        label: `Ask Praxis: “${q.trim()}”`,
        group: "Action",
        run: () => nav.goToPage("ask"),
      });
    }
    return base.slice(0, 24);
  }, [q, commands, nav]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const choose = (c?: Cmd) => {
    if (!c) return;
    c.run();
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="px-panel w-[min(620px,92vw)] overflow-hidden p-0 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--color-hair)] px-4 py-3">
          <Search size={16} className="text-[var(--color-signal)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(filtered[active]);
              }
            }}
            placeholder="Search decisions, jump to a page, or ask…"
            className="flex-1 bg-transparent text-sm text-[var(--color-fg)] placeholder-[var(--color-fg-faint)] outline-none"
          />
          <span className="px-mono text-[10px] text-[var(--color-fg-faint)]">esc</span>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[var(--color-fg-faint)]">
              No matches.
            </div>
          )}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(c)}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition ${
                i === active ? "bg-[var(--color-panel-2)]" : ""
              }`}
            >
              <span className="px-mono w-14 shrink-0 text-[9px] uppercase tracking-wider text-[var(--color-fg-faint)]">
                {c.group}
              </span>
              <span className="flex-1 truncate text-[var(--color-fg)]">{c.label}</span>
              {c.hint && (
                <span className="px-mono text-[10px] text-[var(--color-topic)]">{c.hint}</span>
              )}
              {c.badge && <StatusBadge status={c.badge} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
