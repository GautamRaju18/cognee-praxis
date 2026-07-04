import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import { getGraph } from "../api";
import { ErrorNote, Spinner, ghostButtonCls } from "../components";
import type { GraphData } from "../types";

/* Node palette — types come straight from the Praxis ontology. */
const TYPE_COLOR: Record<string, string> = {
  Decision: "#f2c14e",
  Outcome: "#ff8f6b",
  Assumption: "#9db2c9",
  Person: "#7aa2ff",
  Topic: "#b98bff",
  Rationale: "#4ee1c3",
};
const TYPE_SIZE: Record<string, number> = {
  Decision: 9,
  Outcome: 6,
  Assumption: 4,
  Rationale: 3,
  Person: 3,
  Topic: 4,
};
const DISPROVEN = "#fb6b7c";

/* Link styling by relationship — the meaningful edges glow and flow. */
const LINK_COLOR: Record<string, string> = {
  resulted_in: "#4ee1c3",
  invalidated_by: "#fb6b7c",
  supersedes: "#f2c14e",
  made_by: "#3a4658",
  participant: "#33404f",
  concerns: "#5a4a78",
  justified_by: "#245049",
  based_on: "#2c4a63",
};
const FLOW_LINKS = new Set(["resulted_in", "invalidated_by", "supersedes"]);

interface FNode {
  id: string;
  label: string;
  type: string;
  decision_id: string | null;
  disproven?: boolean;
  x?: number;
  y?: number;
  z?: number;
}
interface FLink {
  source: string | FNode;
  target: string | FNode;
  relationship: string;
}

const idOf = (v: string | FNode) => (typeof v === "string" ? v : v.id);

export default function Brain({ onOpenDecision }: { onOpenDecision: (id: string) => void }) {
  const fgRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [raw, setRaw] = useState<GraphData | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<FNode | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<FLink>>(new Set());

  useEffect(() => {
    getGraph()
      .then(setRaw)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    // a couple of rAF retries cover the mount/transition where layout isn't settled yet
    const r1 = requestAnimationFrame(measure);
    const r2 = requestAnimationFrame(() => requestAnimationFrame(measure));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      ro.disconnect();
    };
  }, []);

  // Bloom glow — makes nodes read as neurons firing. Guarded for headless/WebGL-less.
  useEffect(() => {
    if (!raw || !fgRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { UnrealBloomPass } = await import(
          "three/examples/jsm/postprocessing/UnrealBloomPass.js"
        );
        if (cancelled || !fgRef.current) return;
        const bloom = new UnrealBloomPass();
        bloom.strength = 1.1;
        bloom.radius = 0.55;
        bloom.threshold = 0.12;
        fgRef.current.postProcessingComposer().addPass(bloom);
      } catch {
        /* bloom optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [raw]);

  const data = useMemo(() => {
    if (!raw) return { nodes: [] as FNode[], links: [] as FLink[] };
    const disprovenAssumptions = new Set(
      raw.edges.filter((e) => e.relationship === "invalidated_by").map((e) => e.source),
    );
    const nodes: FNode[] = raw.nodes
      .filter((n) => !hidden.has(n.type))
      .map((n) => ({ ...n, disproven: disprovenAssumptions.has(n.id) }));
    const present = new Set(nodes.map((n) => n.id));
    const links: FLink[] = raw.edges
      .filter((e) => present.has(e.source) && present.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, relationship: e.relationship }));
    return { nodes, links };
  }, [raw, hidden]);

  const adjacency = useMemo(() => {
    const map = new Map<string, { nodes: Set<string>; links: Set<FLink> }>();
    for (const l of data.links) {
      const s = idOf(l.source);
      const t = idOf(l.target);
      if (!map.has(s)) map.set(s, { nodes: new Set(), links: new Set() });
      if (!map.has(t)) map.set(t, { nodes: new Set(), links: new Set() });
      map.get(s)!.nodes.add(t);
      map.get(s)!.links.add(l);
      map.get(t)!.nodes.add(s);
      map.get(t)!.links.add(l);
    }
    return map;
  }, [data.links]);

  const focus = useCallback(
    (node: FNode | null) => {
      if (!node) {
        setHighlightNodes(new Set());
        setHighlightLinks(new Set());
        return;
      }
      const nbr = adjacency.get(node.id);
      setHighlightNodes(new Set([node.id, ...(nbr ? [...nbr.nodes] : [])]));
      setHighlightLinks(new Set(nbr ? [...nbr.links] : []));
    },
    [adjacency],
  );

  const handleClick = useCallback(
    (node: FNode) => {
      setSelected(node);
      focus(node);
      const fg = fgRef.current;
      if (fg && node.x !== undefined) {
        const dist = 90;
        const r = 1 + dist / Math.hypot(node.x, node.y ?? 0, node.z ?? 1);
        fg.cameraPosition(
          { x: (node.x ?? 0) * r, y: (node.y ?? 0) * r, z: (node.z ?? 0) * r },
          node,
          1400,
        );
      }
    },
    [focus],
  );

  // search-to-highlight
  useEffect(() => {
    if (!query.trim()) return;
    const q = query.toLowerCase();
    const hits = data.nodes.filter((n) => n.label.toLowerCase().includes(q));
    setHighlightNodes(new Set(hits.map((n) => n.id)));
    setHighlightLinks(new Set());
  }, [query, data.nodes]);

  const nodeColor = useCallback(
    (n: FNode) => {
      const base = n.disproven ? DISPROVEN : (TYPE_COLOR[n.type] ?? "#8892a0");
      if (highlightNodes.size === 0) return base;
      return highlightNodes.has(n.id) ? base : "#2a2f3a";
    },
    [highlightNodes],
  );

  const label = useCallback((n: FNode) => {
    const spr = new SpriteText(n.label.length > 34 ? n.label.slice(0, 32) + "…" : n.label);
    spr.color = n.disproven ? DISPROVEN : (TYPE_COLOR[n.type] ?? "#c3ccd8");
    spr.textHeight = n.type === "Decision" ? 5 : 3.4;
    spr.fontFace = "JetBrains Mono, monospace";
    (spr as any).material.depthWrite = false;
    (spr as any).position.y = (TYPE_SIZE[n.type] ?? 3) + 3;
    return spr;
  }, []);

  const relCounts = useMemo(() => {
    const c = new Map<string, number>();
    raw?.edges.forEach((e) => c.set(e.relationship, (c.get(e.relationship) ?? 0) + 1));
    return c;
  }, [raw]);

  const toggleType = (t: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const resetView = () => {
    setSelected(null);
    setQuery("");
    focus(null);
    fgRef.current?.zoomToFit(700, 60);
  };

  const types = Object.keys(TYPE_COLOR);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {error && (
        <div className="absolute left-6 top-6 z-20 max-w-sm">
          <ErrorNote message={error} />
        </div>
      )}
      {!raw && !error && (
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <Spinner label="Projecting the memory graph…" />
        </div>
      )}

      {raw && (
        <ForceGraph3D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={data}
          backgroundColor="#080a0e"
          showNavInfo={false}
          nodeColor={nodeColor as any}
          nodeVal={((n: FNode) => TYPE_SIZE[n.type] ?? 3) as any}
          nodeOpacity={0.95}
          nodeResolution={16}
          nodeThreeObjectExtend
          nodeThreeObject={label as any}
          linkColor={
            ((l: FLink) =>
              highlightLinks.has(l)
                ? (LINK_COLOR[l.relationship] ?? "#4ee1c3")
                : highlightLinks.size > 0
                  ? "#1b2029"
                  : (LINK_COLOR[l.relationship] ?? "#39424f")) as any
          }
          linkWidth={((l: FLink) => (highlightLinks.has(l) ? 2.2 : 0.5)) as any}
          linkOpacity={0.55}
          linkDirectionalParticles={
            ((l: FLink) => (FLOW_LINKS.has(l.relationship) || highlightLinks.has(l) ? 3 : 0)) as any
          }
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={((l: FLink) => LINK_COLOR[l.relationship] ?? "#4ee1c3") as any}
          onNodeClick={handleClick as any}
          onNodeHover={((n: FNode | null) => !query && focus(n)) as any}
          onBackgroundClick={() => {
            setSelected(null);
            focus(null);
          }}
        />
      )}

      {/* Top-left: title + counts */}
      <div className="pointer-events-none absolute left-6 top-6 z-10">
        <div className="px-eyebrow">the company brain</div>
        <h1 className="px-display mt-1 text-xl text-[var(--color-fg)]">Knowledge graph</h1>
        {raw && (
          <div className="px-mono mt-1 text-[11px] text-[var(--color-fg-faint)]">
            {raw.nodes.length} nodes · {raw.edges.length} relationships
          </div>
        )}
      </div>

      {/* Top-right: search + reset */}
      <div className="absolute right-6 top-6 z-10 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search nodes…"
          className="px-mono w-44 rounded-lg border border-[var(--color-hair)] bg-[var(--color-ink-2)]/80 px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder-[var(--color-fg-faint)] outline-none backdrop-blur focus:border-[var(--color-signal-dim)]"
        />
        <button className={ghostButtonCls} onClick={resetView}>
          reset
        </button>
      </div>

      {/* Bottom-left: type legend / filters */}
      <div className="absolute bottom-6 left-6 z-10 flex flex-wrap gap-1.5">
        {types.map((t) => {
          const off = hidden.has(t);
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`px-mono flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] uppercase tracking-wider backdrop-blur transition ${
                off
                  ? "border-[var(--color-hair)] bg-[var(--color-ink)]/60 text-[var(--color-fg-faint)] line-through"
                  : "border-[var(--color-hair-bright)] bg-[var(--color-panel)]/70 text-[var(--color-fg-muted)]"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: off ? "#3a4150" : TYPE_COLOR[t] }}
              />
              {t}
            </button>
          );
        })}
      </div>

      {/* Bottom-right: legend for the meaningful edges */}
      <div className="px-mono absolute bottom-6 right-6 z-10 hidden gap-3 rounded-lg border border-[var(--color-hair)] bg-[var(--color-ink)]/60 px-3 py-2 text-[10px] backdrop-blur sm:flex">
        <LegendEdge color="#4ee1c3" label={`resulted in · ${relCounts.get("resulted_in") ?? 0}`} />
        <LegendEdge color="#fb6b7c" label={`invalidated · ${relCounts.get("invalidated_by") ?? 0}`} />
        <LegendEdge color="#f2c14e" label={`supersedes · ${relCounts.get("supersedes") ?? 0}`} />
      </div>

      {/* Selected node detail */}
      {selected && (
        <div className="px-panel absolute bottom-20 left-1/2 z-20 w-[min(460px,90vw)] -translate-x-1/2 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="px-eyebrow flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: selected.disproven ? DISPROVEN : TYPE_COLOR[selected.type] }}
                />
                {selected.disproven ? "disproven assumption" : selected.type}
              </div>
              <div className="px-display mt-1 text-[15px] leading-snug text-[var(--color-fg)]">
                {selected.label}
              </div>
            </div>
            <button
              className="px-mono text-[var(--color-fg-faint)] transition hover:text-[var(--color-fg)]"
              onClick={() => {
                setSelected(null);
                focus(null);
              }}
            >
              ✕
            </button>
          </div>
          {selected.decision_id && (
            <button
              className={`${ghostButtonCls} mt-3`}
              onClick={() => onOpenDecision(selected.decision_id!)}
            >
              open decision →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LegendEdge({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[var(--color-fg-muted)]">
      <span className="h-[2px] w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
