"""Outcomes + the decision->outcome edge (the point of the product) + /revisit."""

from datetime import date

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from praxis import models, ontology
from praxis.config import settings
from praxis.schemas import OutcomeCreate
from praxis.services import cognee_service


def compose_outcome_document(decision: models.Decision, outcome: models.Outcome) -> str:
    """Structured text naming the decision by its exact title, so LLM extraction
    merges the outcome onto the SAME decision node (title = identity field)."""
    lines = [
        "OUTCOME RECORD",
        "",
        f"For decision: {decision.title}",
        f"Outcome: {outcome.description}",
        f"Valence: {outcome.valence}",
        f"Observed on: {outcome.observed_on.isoformat()}",
    ]
    if outcome.evidence_source:
        lines.append(f"Evidence source: {outcome.evidence_source}")
    lines.append(f"Topic: {decision.topic}")
    return "\n".join(lines)


def _graph_decision_stub(decision: models.Decision, outcome: models.Outcome) -> list:
    """Build ontology instances for a deterministic RESULTED_IN edge.

    The Decision instance carries the authoritative SQLite properties, and its
    identity id (title) makes the upsert land on the existing graph node.
    """
    outcome_node = ontology.Outcome(
        description=outcome.description,
        observed_on=outcome.observed_on.isoformat(),
        valence=outcome.valence,
        evidence_source=outcome.evidence_source or "",
    )
    decision_node = ontology.Decision(
        title=decision.title,
        statement=decision.statement,
        decided_on=decision.decided_on.isoformat(),
        status=decision.status,
        reversibility=decision.reversibility,
        resulted_in=[outcome_node],
    )
    return [decision_node]


async def create_outcome(
    session: AsyncSession, payload: OutcomeCreate
) -> tuple[models.Outcome, models.Decision]:
    decision = await session.get(models.Decision, payload.decision_id)
    if decision is None:
        raise LookupError(f"decision {payload.decision_id} not found")

    outcome = models.Outcome(
        decision_id=decision.id,
        description=payload.description,
        valence=payload.valence,
        observed_on=payload.observed_on or date.today(),
        evidence_source=payload.evidence_source,
        cognee_node_id=ontology.outcome_node_id(payload.description),
    )
    session.add(outcome)
    await session.commit()
    await session.refresh(outcome)

    # 1) Deterministic graph write: guarantees Decision -resulted_in-> Outcome
    #    regardless of LLM extraction quality.
    await cognee_service.push_data_points(_graph_decision_stub(decision, outcome))

    # 2) Semantic write: the outcome document goes through add+cognify so its
    #    text is chunked/embedded and extraction re-links it by decision title.
    document = compose_outcome_document(decision, outcome)
    await cognee_service.add_text(document, dataset=decision.cognee_dataset)
    await cognee_service.cognify_dataset(dataset=decision.cognee_dataset)

    return outcome, decision


class InvalidationVerdict(BaseModel):
    invalidated: bool
    reason: str = ""


INVALIDATION_JUDGE_PROMPT = """You judge whether an OBSERVED OUTCOME disproves an
ASSUMPTION that a past decision was based on. Answer invalidated=true only when the
outcome provides concrete evidence that the assumption was wrong — not merely that
things went badly for unrelated reasons. Keep reason to one sentence."""


def _edge_key(edge) -> tuple[str, str, str]:
    if isinstance(edge, (tuple, list)) and len(edge) >= 3:
        return (str(edge[0]), str(edge[1]), str(edge[2]))
    return ("", "", "")


async def revisit(session: AsyncSession) -> dict:
    """The outcome-linking pass.

    1. Re-cognify the main dataset (processes any staged-but-unprocessed docs;
       incremental, so cheap when there is nothing new).
    2. Ensure every SQLite decision->outcome pair has its resulted_in graph
       edge; create missing ones explicitly.
    3. For decisions with negative/mixed outcomes, LLM-judge whether any
       not-yet-invalidated assumption was proven wrong; record it in SQLite and
       as an invalidated_by graph edge.
    """
    await cognee_service.cognify_dataset(dataset=settings.cognee_dataset)

    _nodes, edges = await cognee_service.get_graph_data()
    existing = {_edge_key(e)[:3] for e in edges}

    result = await session.execute(select(models.Outcome))
    outcomes = list(result.scalars().all())

    newly_linked = []
    for outcome in outcomes:
        decision = await session.get(models.Decision, outcome.decision_id)
        if not (decision and decision.cognee_node_id and outcome.cognee_node_id):
            continue
        key = (decision.cognee_node_id, outcome.cognee_node_id, ontology.EDGE_RESULTED_IN)
        if key not in existing:
            await cognee_service.add_graph_edges([key])
            newly_linked.append(
                {
                    "decision_id": decision.id,
                    "decision_title": decision.title,
                    "outcome_id": outcome.id,
                    "outcome_description": outcome.description,
                }
            )

    invalidated = []
    result = await session.execute(select(models.Decision))
    for decision in result.scalars().all():
        bad_outcomes = [o for o in decision.outcomes if o.valence in ("negative", "mixed")]
        open_assumptions = [
            a for a in decision.assumptions if a.invalidated_by_outcome_id is None
        ]
        for assumption in open_assumptions:
            for outcome in bad_outcomes:
                verdict = await cognee_service.llm_structured(
                    f"ASSUMPTION: {assumption.statement}\n"
                    f"OBSERVED OUTCOME: {outcome.description} (valence: {outcome.valence})",
                    INVALIDATION_JUDGE_PROMPT,
                    InvalidationVerdict,
                )
                if verdict.invalidated:
                    assumption.invalidated_by_outcome_id = outcome.id
                    await cognee_service.add_graph_edges(
                        [
                            (
                                ontology.assumption_node_id(assumption.statement),
                                outcome.cognee_node_id,
                                ontology.EDGE_INVALIDATED_BY,
                            )
                        ]
                    )
                    invalidated.append(
                        {
                            "decision_id": decision.id,
                            "decision_title": decision.title,
                            "assumption_id": assumption.id,
                            "assumption": assumption.statement,
                            "outcome_id": outcome.id,
                            "reason": verdict.reason,
                        }
                    )
                    break  # assumption is invalidated; move to the next one

    await session.commit()
    return {
        "newly_linked_outcomes": newly_linked,
        "invalidated_assumptions": invalidated,
    }
