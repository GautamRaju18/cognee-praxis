export type DecisionStatus = "proposed" | "decided" | "reversed" | "superseded";
export type Valence = "positive" | "negative" | "mixed";
export type Confidence = "low" | "med" | "high";

export interface Assumption {
  id: string;
  statement: string;
  confidence: Confidence;
  invalidated_by_outcome_id: string | null;
}

export interface Outcome {
  id: string;
  decision_id: string;
  description: string;
  valence: Valence;
  observed_on: string;
  evidence_source: string | null;
  created_at: string;
}

export interface Decision {
  id: string;
  title: string;
  statement: string;
  rationale: string;
  owner: string;
  participants: string[];
  topic: string;
  status: DecisionStatus;
  reversibility: "one_way" | "two_way";
  decided_on: string;
  supersedes_id: string | null;
  created_at: string;
  assumptions: Assumption[];
  outcomes: Outcome[];
}

export interface DecisionCreate {
  title: string;
  statement: string;
  rationale: string;
  owner: string;
  participants: string[];
  topic: string;
  assumptions: { statement: string; confidence: Confidence }[];
  status: DecisionStatus;
  reversibility: "one_way" | "two_way";
  supersedes_id?: string | null;
}

export interface QueryResult {
  answer: string;
  cited_decisions: Decision[];
  context: string;
}

export interface ProposalCheck {
  repeats_prior: boolean;
  contradicts: string[];
  relevant_history: Decision[];
  warning: string;
}

export interface IngestReport {
  chars_ingested: number;
  decisions: Decision[];
  extracted: Record<string, string[]>;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  decision_id: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Health {
  status: string;
  db: string;
  cognee: string;
  cognee_version: string | null;
  llm_provider: string | null;
}
