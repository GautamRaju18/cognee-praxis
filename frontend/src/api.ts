import type {
  Decision,
  DecisionCreate,
  GraphData,
  Health,
  IngestReport,
  ProposalCheck,
  QueryResult,
  Valence,
} from "./types";

const API = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API}${path}`, init);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`${resp.status}: ${body.slice(0, 300)}`);
  }
  return resp.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const getHealth = () => request<Health>("/health");

export const query = (q: string) => request<QueryResult>(`/query?q=${encodeURIComponent(q)}`);

export const listDecisions = (filters?: { topic?: string; status?: string }) => {
  const params = new URLSearchParams();
  if (filters?.topic) params.set("topic", filters.topic);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();
  return request<Decision[]>(`/decisions${qs ? `?${qs}` : ""}`);
};

export const getDecision = (id: string) => request<Decision>(`/decisions/${id}`);

export const createDecision = (payload: DecisionCreate) =>
  request<Decision>("/decisions", json(payload));

export const updateDecision = (
  id: string,
  patch: { status?: string; supersedes_id?: string },
) => request<Decision>(`/decisions/${id}`, { ...json(patch), method: "PATCH" });

export const createOutcome = (payload: {
  decision_id: string;
  description: string;
  valence: Valence;
  evidence_source?: string;
}) => request<unknown>("/outcomes", json(payload));

export const checkProposal = (proposal_text: string, topic?: string) =>
  request<ProposalCheck>("/check-proposal", json({ proposal_text, topic: topic || null }));

export const ingestText = (text: string) => {
  const form = new FormData();
  form.set("text", text);
  return request<IngestReport>("/ingest/document", { method: "POST", body: form });
};

export const ingestFile = (file: File) => {
  const form = new FormData();
  form.set("file", file);
  return request<IngestReport>("/ingest/document", { method: "POST", body: form });
};

export const getGraph = () => request<GraphData>("/graph");

export interface BrainStats {
  decisions: number;
  outcomes: number;
  assumptions: number;
  disproven: number;
  topics: string[];
  nodes: number;
  edges: number;
}

export async function getBrainStats(decisions: Decision[]): Promise<BrainStats> {
  let nodes = 0;
  let edges = 0;
  try {
    const g = await getGraph();
    nodes = g.nodes.length;
    edges = g.edges.length;
  } catch {
    /* graph optional for stats */
  }
  const outcomes = decisions.reduce((n, d) => n + d.outcomes.length, 0);
  const assumptions = decisions.reduce((n, d) => n + d.assumptions.length, 0);
  const disproven = decisions.reduce(
    (n, d) => n + d.assumptions.filter((a) => a.invalidated_by_outcome_id).length,
    0,
  );
  const topics = [...new Set(decisions.map((d) => d.topic).filter(Boolean))];
  return { decisions: decisions.length, outcomes, assumptions, disproven, topics, nodes, edges };
}
