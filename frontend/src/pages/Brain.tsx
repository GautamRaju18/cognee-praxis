import { Download, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
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

/* Per-type geometry radius + shape — distinct shapes make types legible at a glance. */
const GEO_RADIUS: Record<string, number> = {
  Decision: 5,
  Outcome: 3.8,
  Topic: 3.2,
  Assumption: 2.6,
  Person: 2.4,
  Rationale: 1.8,
};
const _geoCache: Record<string, THREE.BufferGeometry> = {};
function geometryFor(type: string): THREE.BufferGeometry {
  if (_geoCache[type]) return _geoCache[type]; // reuse (skill: geometry reuse)
  const s = GEO_RADIUS[type] ?? 2.4;
  let g: THREE.BufferGeometry;
  switch (type) {
    case "Decision":
      g = new THREE.IcosahedronGeometry(s, 0);
      break;
    case "Outcome":
      g = new THREE.OctahedronGeometry(s, 0);
      break;
    case "Assumption":
      g = new THREE.TetrahedronGeometry(s, 0);
      break;
    case "Topic":
      g = new THREE.BoxGeometry(s * 1.5, s * 1.5, s * 1.5);
      break;
    case "Rationale":
      g = new THREE.SphereGeometry(s, 12, 12);
      break;
    default:
      g = new THREE.SphereGeometry(s, 20, 20); // Person + fallback
  }
  _geoCache[type] = g;
  return g;
}

/* Soft radial-gradient sprite → an additive glow aura behind each node. */
let _glowTex: THREE.Texture | null = null;
function glowTexture(): THREE.Texture {
  if (_glowTex) return _glowTex;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.22, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _glowTex = tex;
  return tex;
}

interface FNode {
  id: string;
  label: string;
  type: string;
  decision_id: string | null;
  disproven?: boolean;
  x?: number;
  y?: number;
  z?: number;
  __mat?: THREE.MeshStandardMaterial;
  __halo?: THREE.SpriteMaterial;
  __baseEmissive?: number;
  __label?: { visible: boolean };
}

/** Labels shown at rest; the rest appear on hover/highlight to keep the graph clean. */
const ALWAYS_LABEL = new Set(["Decision", "Topic"]);
interface FLink {
  source: string | FNode;
  target: string | FNode;
  relationship: string;
}

const idOf = (v: string | FNode) => (typeof v === "string" ? v : v.id);

export default function Brain({
  onOpenDecision,
  focusDecisionId = null,
}: {
  onOpenDecision: (id: string) => void;
  focusDecisionId?: string | null;
}) {
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
  const highlightRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    highlightRef.current = highlightNodes;
  }, [highlightNodes]);

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

  // Scene atmosphere: depth fog + three-point lighting so the PBR node materials
  // read with dimension, plus a richer bloom pass for the neural-glow look.
  useEffect(() => {
    const fg = fgRef.current;
    if (!raw || !fg) return;
    const scene: THREE.Scene = fg.scene();
    (window as any).__brainFg = fg; // debug handle: pause/resume animation for screenshots

    scene.fog = new THREE.FogExp2(0x080a0e, 0.0018); // distant nodes fade into ink

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    const key = new THREE.PointLight(0x4ee1c3, 0.7, 0, 1.6); // teal key
    key.position.set(220, 160, 180);
    const fill = new THREE.PointLight(0x7aa2ff, 0.45, 0, 1.6); // blue fill
    fill.position.set(-220, -120, -160);
    const rim = new THREE.DirectionalLight(0xffffff, 0.35); // rim for edge definition
    rim.position.set(0, 200, -240);
    scene.add(ambient, key, fill, rim);

    let cancelled = false;
    let bloom: { dispose?: () => void } | null = null;
    (async () => {
      try {
        const { UnrealBloomPass } = await import(
          "three/examples/jsm/postprocessing/UnrealBloomPass.js"
        );
        if (cancelled || !fgRef.current) return;
        const pass = new UnrealBloomPass();
        pass.strength = 1.0; // glowy — the dark-pill labels stay readable through it
        pass.radius = 0.65;
        pass.threshold = 0.25;
        fgRef.current.postProcessingComposer().addPass(pass);
        bloom = pass as unknown as { dispose?: () => void };
      } catch {
        /* bloom optional (headless / no WebGL) */
      }
    })();

    return () => {
      cancelled = true;
      scene.remove(ambient, key, fill, rim);
      scene.fog = null;
      bloom?.dispose?.();
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

  // gentle idle auto-rotation; pauses while a node is selected (camera is focusing)
  useEffect(() => {
    const controls = fgRef.current?.controls?.();
    if (!controls) return;
    controls.autoRotate = !selected && !focusDecisionId;
    controls.autoRotateSpeed = 0.5;
  }, [raw, selected, focusDecisionId]);

  // deep-link: focus a decision's node when arriving from a citation
  useEffect(() => {
    if (!raw || !focusDecisionId) return;
    const node = data.nodes.find((n) => n.decision_id === focusDecisionId);
    if (!node) return;
    const t = setTimeout(() => handleClick(node), 1300); // let the sim place nodes first
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, focusDecisionId]);

  // search-to-highlight
  useEffect(() => {
    if (!query.trim()) return;
    const q = query.toLowerCase();
    const hits = data.nodes.filter((n) => n.label.toLowerCase().includes(q));
    setHighlightNodes(new Set(hits.map((n) => n.id)));
    setHighlightLinks(new Set());
  }, [query, data.nodes]);

  // Custom node: a per-type emissive solid (PBR) + a mono label, grouped.
  const buildNode = useCallback((n: FNode) => {
    const color = n.disproven ? DISPROVEN : (TYPE_COLOR[n.type] ?? "#8892a0");
    const base = n.disproven ? 0.75 : 0.5;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: base,
      metalness: 0.3,
      roughness: 0.35,
      transparent: true,
      opacity: 1,
    });
    const group = new THREE.Group();

    // soft glow aura (additive) — the "catchy" glow, controlled per node
    const rr = GEO_RADIUS[n.type] ?? 2.4;
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color,
        transparent: true,
        opacity: n.disproven ? 0.6 : 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.scale.setScalar(rr * (n.type === "Decision" ? 7 : 5.5));
    (halo as any).renderOrder = -1;
    group.add(halo);
    group.add(new THREE.Mesh(geometryFor(n.type), mat));

    const text = n.label.length > 34 ? n.label.slice(0, 32) + "…" : n.label;
    const spr = new SpriteText(text);
    // Solid dark pill + bright text so labels stay readable over the node glow.
    spr.color = "#eef3f9";
    spr.backgroundColor = "rgba(5,7,11,0.82)";
    spr.padding = 2.4;
    spr.borderRadius = 3;
    spr.fontFace = "JetBrains Mono, monospace";
    spr.fontWeight = "600";
    spr.textHeight = n.type === "Decision" ? 4 : 3.1;
    (spr as any).material.depthWrite = false;
    (spr as any).material.depthTest = false; // labels always render on top, never behind glow
    (spr as any).renderOrder = 10;
    (spr as any).position.y = (GEO_RADIUS[n.type] ?? 2.4) + 6.5;
    spr.visible = ALWAYS_LABEL.has(n.type); // rest reveal on hover/highlight
    group.add(spr);

    n.__mat = mat; // handle for the pulse/dim loop
    n.__halo = halo.material;
    n.__baseEmissive = base;
    n.__label = spr as unknown as { visible: boolean };
    return group;
  }, []);

  // Per-frame: dim non-highlighted nodes and pulse the disproven (proven-wrong) ones.
  useEffect(() => {
    if (!raw) return;
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const hl = highlightRef.current;
      const anyHl = hl.size > 0;
      const t = (performance.now() - start) / 1000;
      for (const n of data.nodes) {
        const mat = n.__mat;
        if (!mat) continue;
        const dimmed = anyHl && !hl.has(n.id);
        const targetOpacity = dimmed ? 0.14 : 1;
        let targetEmis = dimmed ? 0.04 : (n.__baseEmissive ?? 0.5);
        if (n.disproven && !dimmed) targetEmis = 0.6 + 0.4 * Math.sin(t * 3);
        mat.opacity += (targetOpacity - mat.opacity) * 0.18;
        mat.emissiveIntensity += (targetEmis - mat.emissiveIntensity) * 0.18;
        const halo = n.__halo;
        if (halo) {
          let targetHalo = dimmed ? 0.06 : n.disproven ? 0.62 : 0.5;
          if (n.disproven && !dimmed) targetHalo = 0.5 + 0.28 * Math.sin(t * 3);
          halo.opacity += (targetHalo - halo.opacity) * 0.18;
        }
        if (n.__label) {
          n.__label.visible = hl.has(n.id) || (!anyHl && ALWAYS_LABEL.has(n.type));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [raw, data.nodes]);

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

  // Snapshot the live graph to PNG — great for slides/thumbnails. We render the
  // post-processing composer (so the bloom glow is captured) and read the buffer
  // synchronously, before the browser composites and clears the WebGL drawing buffer.
  const capture = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    try {
      const renderer = fg.renderer();
      const composer = fg.postProcessingComposer?.();
      if (composer) composer.render();
      else renderer.render(fg.scene(), fg.camera());
      const url = renderer.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `praxis-company-brain-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
      a.click();
    } catch {
      /* no WebGL / headless — capture unavailable */
    }
  }, []);

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
          controlType="orbit"
          showNavInfo={false}
          nodeThreeObject={buildNode as any}
          linkColor={
            ((l: FLink) =>
              highlightLinks.has(l)
                ? (LINK_COLOR[l.relationship] ?? "#4ee1c3")
                : highlightLinks.size > 0
                  ? "#1b2029"
                  : (LINK_COLOR[l.relationship] ?? "#39424f")) as any
          }
          linkCurvature={0.18}
          linkWidth={((l: FLink) => (highlightLinks.has(l) ? 2.4 : 0.6)) as any}
          linkOpacity={0.5}
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
        <button
          className={`${ghostButtonCls} flex items-center gap-1.5`}
          onClick={capture}
          title="Download this view as a PNG"
        >
          <Download size={12} strokeWidth={2} />
          capture
        </button>
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
        {/* non-interactive key: the pulsing red nodes */}
        <span className="px-mono flex items-center gap-1.5 rounded-md border border-[var(--color-hair)] bg-[var(--color-ink)]/60 px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] backdrop-blur">
          <span
            className="px-live-dot h-2 w-2 rounded-full"
            style={{ background: DISPROVEN }}
          />
          disproven
        </span>
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
              aria-label="Close details"
              className="text-[var(--color-fg-faint)] transition hover:text-[var(--color-fg)]"
              onClick={() => {
                setSelected(null);
                focus(null);
              }}
            >
              <X size={16} />
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
