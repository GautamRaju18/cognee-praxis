import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { getGraph } from "../api";
import { ErrorNote, Spinner, ghostButtonCls } from "../components";
import type { GraphData, GraphNode } from "../types";

const TYPE_COLORS: Record<string, string> = {
  Decision: "#34d399", // emerald
  Outcome: "#f472b6", // pink
  Assumption: "#fbbf24", // amber
  Person: "#60a5fa", // blue
  Topic: "#a78bfa", // violet
  Rationale: "#2dd4bf", // teal
  Entity: "#71717a", // zinc
  PraxisGraph: "#3f3f46",
};

interface FGNode extends GraphNode {
  x?: number;
  y?: number;
  decision_id?: string | null;
}

export default function Brain({ onOpenDecision }: { onOpenDecision: (id: string) => void }) {
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<FGNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    getGraph()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: el.clientWidth, height: el.clientHeight }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return {
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.edges.map((e) => ({
        source: e.source,
        target: e.target,
        relationship: e.relationship,
      })),
    };
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Company brain</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {data
              ? `${data.nodes.length} nodes · ${data.edges.length} relationships`
              : "Loading the memory graph…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
          {Object.entries(TYPE_COLORS)
            .filter(([t]) => t !== "PraxisGraph" && t !== "Entity")
            .map(([type, color]) => (
              <span key={type} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                {type}
              </span>
            ))}
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      )}
      {!data && !error && (
        <div className="mt-8">
          <Spinner label="Fetching graph…" />
        </div>
      )}

      <div
        ref={containerRef}
        className="mt-4 min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40"
      >
        {data && (
          <ForceGraph2D
            width={size.width}
            height={size.height}
            graphData={graphData}
            backgroundColor="rgba(0,0,0,0)"
            nodeLabel={(n) => `${(n as FGNode).type}: ${(n as FGNode).label}`}
            nodeColor={(n) => TYPE_COLORS[(n as FGNode).type] ?? "#52525b"}
            nodeVal={(n) => ((n as FGNode).type === "Decision" ? 6 : 2)}
            linkColor={() => "#3f3f46"}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            linkLabel={(l) => (l as { relationship: string }).relationship}
            onNodeClick={(n) => setSelected(n as FGNode)}
            cooldownTicks={120}
          />
        )}
      </div>

      {selected && (
        <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <div className="min-w-0">
            <span
              className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: TYPE_COLORS[selected.type] ?? "#52525b" }}
            />
            <span className="text-xs uppercase tracking-wide text-zinc-500">{selected.type}</span>
            <div className="truncate text-sm text-zinc-100">{selected.label}</div>
          </div>
          <div className="flex shrink-0 gap-2">
            {selected.decision_id && (
              <button
                className={ghostButtonCls}
                onClick={() => onOpenDecision(selected.decision_id!)}
              >
                open decision
              </button>
            )}
            <button className={ghostButtonCls} onClick={() => setSelected(null)}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
