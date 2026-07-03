"""The Praxis graph ontology — cognee DataPoint models.

These classes ARE the product: cognify() extracts instances of PraxisGraph
from text, and cognee turns nested DataPoint references into typed graph
edges named after the field (made_by, resulted_in, ...).

Design notes (verified against cognee 1.2.2 internals, see NOTES.md):
- ``identity_fields`` make node ids deterministic (``Class.id_for(*values)``),
  so a Decision mentioned in a later outcome document merges onto the SAME
  node as the original decision — this is what makes the decision->outcome
  edge form across separate ingests.
- SUPERSEDES / CONTRADICTS are intentionally NOT fields here: a self-referential
  ``Decision`` field would leak DataPoint infrastructure into the LLM extraction
  schema. Those edges are written explicitly via cognee_service.add_edges().
- Field descriptions don't survive cognee's schema simplification, so the
  extraction semantics live in prompts.EXTRACTION_PROMPT instead.
"""

# isort: off
import praxis.config  # noqa: F401  (env vars must be set before cognee imports)

from cognee.infrastructure.engine import DataPoint

# isort: on

EDGE_MADE_BY = "made_by"
EDGE_PARTICIPANT = "participant"
EDGE_CONCERNS = "concerns"
EDGE_JUSTIFIED_BY = "justified_by"
EDGE_BASED_ON = "based_on"
EDGE_RESULTED_IN = "resulted_in"
EDGE_SUPERSEDES = "supersedes"
EDGE_CONTRADICTS = "contradicts"
EDGE_INVALIDATED_BY = "invalidated_by"


class Person(DataPoint):
    name: str
    role: str = ""
    metadata: dict = {"index_fields": ["name"], "identity_fields": ["name"]}


class Topic(DataPoint):
    name: str
    metadata: dict = {"index_fields": ["name"], "identity_fields": ["name"]}


class Rationale(DataPoint):
    text: str
    metadata: dict = {"index_fields": ["text"]}


class Outcome(DataPoint):
    description: str
    observed_on: str = ""  # ISO date
    valence: str = "mixed"  # positive | negative | mixed
    evidence_source: str = ""
    metadata: dict = {"index_fields": ["description"], "identity_fields": ["description"]}


class Assumption(DataPoint):
    statement: str
    confidence: str = "med"  # low | med | high
    invalidated_by: list[Outcome] = []
    metadata: dict = {"index_fields": ["statement"], "identity_fields": ["statement"]}


class Decision(DataPoint):
    title: str
    statement: str = ""
    decided_on: str = ""  # ISO date
    status: str = "decided"  # proposed | decided | reversed | superseded
    reversibility: str = "two_way"  # one_way | two_way
    made_by: Person | None = None
    participant: list[Person] = []
    concerns: list[Topic] = []
    justified_by: Rationale | None = None
    based_on: list[Assumption] = []
    resulted_in: list[Outcome] = []
    metadata: dict = {"index_fields": ["title", "statement"], "identity_fields": ["title"]}


class PraxisGraph(DataPoint):
    """Top-level extraction target passed to cognify(graph_model=PraxisGraph)."""

    summary: str = ""
    decisions: list[Decision] = []
    metadata: dict = {"index_fields": ["summary"]}


def decision_node_id(title: str) -> str:
    """Deterministic graph node id for a Decision by title (same as extraction)."""
    return str(Decision.id_for(title))


def outcome_node_id(description: str) -> str:
    return str(Outcome.id_for(description))


def assumption_node_id(statement: str) -> str:
    return str(Assumption.id_for(statement))
