"""Phase 2 smoke test: prove the custom PraxisGraph ontology drives extraction.

Run:  .venv/Scripts/python.exe scripts/praxis_smoke.py

Ingests one decision-shaped text through cognee_service (add -> cognify with
graph_model=PraxisGraph + custom extraction prompt), then verifies:
  1. The graph contains OUR node types (Decision, Person, Topic, Assumption...),
     not just generic Entity nodes.
  2. The ontology edges exist (made_by / concerns / justified_by / based_on).
  3. GRAPH_COMPLETION answers the decision + rationale back.
"""

import asyncio
import sys
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from praxis.config import settings  # noqa: F401  (env before cognee)
from praxis.services import cognee_service

DATASET = "praxis_smoke2"

SAMPLE = """Decision log — 2025-04-02

Priya Sharma (Head of Infrastructure) decided that we will migrate our primary
database from self-hosted Postgres to a managed cloud Postgres service.
Marcus Lee and Elena Petrova participated in the review.

Rationale: the team spends roughly 20% of its time on database maintenance and
on-call incidents, and a managed service removes that toil.

This decision rests on two assumptions: first, that the managed service's added
latency will stay under 5 milliseconds (high confidence); second, that migration
downtime can be kept under one hour (low confidence).

The decision is hard to reverse once data is migrated. Topics: infra, reliability.
"""

QUERY = "What did Priya Sharma decide about the database, and what was the rationale?"

PRAXIS_NODE_TYPES = {"Decision", "Person", "Topic", "Rationale", "Assumption", "Outcome"}
PRAXIS_EDGES = {"made_by", "participant", "concerns", "justified_by", "based_on", "resulted_in"}


def node_type(node) -> str:
    props = node[1] if isinstance(node, (tuple, list)) and len(node) > 1 else node
    if isinstance(props, dict):
        return str(props.get("type", "?"))
    return "?"


def edge_name(edge) -> str:
    if isinstance(edge, (tuple, list)):
        if len(edge) > 2 and isinstance(edge[2], str):
            return edge[2]
    if isinstance(edge, dict):
        return str(edge.get("relationship_name", "?"))
    return "?"


async def main() -> int:
    print("[1/4] add_text() ...")
    await cognee_service.add_text(SAMPLE, dataset=DATASET)

    print("[2/4] cognify_dataset() with PraxisGraph ontology ...")
    await cognee_service.cognify_dataset(dataset=DATASET)

    print("[3/4] inspecting graph node/edge types ...")
    nodes, edges = await cognee_service.get_graph_data()
    type_counts = Counter(node_type(n) for n in nodes)
    edge_counts = Counter(edge_name(e) for e in edges)
    print("      node types:", dict(type_counts))
    print("      edge types:", dict(edge_counts))

    found_types = PRAXIS_NODE_TYPES & set(type_counts)
    found_edges = PRAXIS_EDGES & set(edge_counts)
    if "Decision" not in found_types:
        print("FAIL: no Decision nodes extracted — ontology not applied.")
        return 1
    if not found_edges:
        print("FAIL: none of the Praxis edge types found.")
        return 1
    print(f"      OK: praxis node types {sorted(found_types)}")
    print(f"      OK: praxis edge types {sorted(found_edges)}")

    print(f"[4/4] graph_completion(): {QUERY!r}")
    answer = await cognee_service.graph_completion(QUERY, dataset=DATASET)
    print("ANSWER:", answer)

    lowered = answer.lower()
    if ("managed" in lowered or "postgres" in lowered.replace("postgresql", "postgres")) and (
        "maintenance" in lowered or "toil" in lowered or "on-call" in lowered or "20%" in lowered
    ):
        print("\nPHASE 2 SMOKE TEST PASSED.")
        return 0
    print("\nSMOKE TEST INCONCLUSIVE: answer did not clearly include decision + rationale.")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
