"""Decision lifecycle: SQLite (system of record) + cognee (semantic graph)."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from praxis import models, ontology
from praxis.config import settings
from praxis.schemas import DecisionCreate
from praxis.services import cognee_service


def compose_decision_document(decision: models.Decision) -> str:
    """Render a decision as structured text that maps 1:1 onto the ontology.

    The extraction prompt + PraxisGraph model parse this reliably because every
    ontology field is stated explicitly and unambiguously.
    """
    lines = [
        "DECISION RECORD",
        "",
        f"Title: {decision.title}",
        f"Statement: {decision.statement}",
        f"Status: {decision.status}",
        f"Reversibility: {decision.reversibility}",
        f"Decided on: {decision.decided_on.isoformat()}",
        f"Decision made by: {decision.owner}",
    ]
    if decision.participants:
        lines.append(f"Participants: {', '.join(decision.participants)}")
    lines.append(f"Topic: {decision.topic}")
    if decision.rationale:
        lines.append(f"Rationale: {decision.rationale}")
    if decision.assumptions:
        lines.append("Assumptions this decision is based on:")
        for a in decision.assumptions:
            lines.append(f"- (confidence: {a.confidence}) {a.statement}")
    return "\n".join(lines)


async def create_decision(session: AsyncSession, payload: DecisionCreate) -> models.Decision:
    dataset = settings.cognee_dataset

    decision = models.Decision(
        title=payload.title,
        statement=payload.statement,
        rationale=payload.rationale,
        owner=payload.owner,
        participants=payload.participants,
        topic=payload.topic.strip().lower(),
        status=payload.status,
        reversibility=payload.reversibility,
        decided_on=payload.decided_on or date.today(),
        supersedes_id=payload.supersedes_id,
        cognee_dataset=dataset,
        cognee_node_id=ontology.decision_node_id(payload.title),
        assumptions=[
            models.Assumption(statement=a.statement, confidence=a.confidence)
            for a in payload.assumptions
        ],
    )
    session.add(decision)

    superseded: models.Decision | None = None
    if payload.supersedes_id:
        superseded = await session.get(models.Decision, payload.supersedes_id)
        if superseded is not None:
            superseded.status = "superseded"

    # SQLite is the system of record: commit before pushing to cognee, so a
    # failed push never loses the decision (it can be re-pushed by /revisit).
    await session.commit()
    await session.refresh(decision)

    document = compose_decision_document(decision)
    if superseded is not None:
        document += f"\nThis decision supersedes the earlier decision: {superseded.title}"
    await cognee_service.add_text(document, dataset=dataset)
    await cognee_service.cognify_dataset(dataset=dataset)

    if superseded is not None and superseded.cognee_node_id:
        await cognee_service.add_graph_edges(
            [(decision.cognee_node_id, superseded.cognee_node_id, ontology.EDGE_SUPERSEDES)]
        )

    return decision


async def list_decisions(
    session: AsyncSession,
    topic: str | None = None,
    status: str | None = None,
    owner: str | None = None,
) -> list[models.Decision]:
    stmt = select(models.Decision).order_by(models.Decision.decided_on.desc())
    if topic:
        stmt = stmt.where(models.Decision.topic == topic.strip().lower())
    if status:
        stmt = stmt.where(models.Decision.status == status)
    if owner:
        stmt = stmt.where(models.Decision.owner == owner)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_decision(session: AsyncSession, decision_id: str) -> models.Decision | None:
    return await session.get(models.Decision, decision_id)


async def update_decision(
    session: AsyncSession,
    decision_id: str,
    status: str | None = None,
    supersedes_id: str | None = None,
) -> models.Decision | None:
    """Evolve a decision's lifecycle (reverse / supersede / reactivate).

    SQLite-only and synchronous — no re-cognify — so it's instant and can't hang.
    The supersedes edge is mirrored into the graph best-effort; a graph hiccup
    never fails the status change (SQLite is the system of record)."""
    decision = await session.get(models.Decision, decision_id)
    if decision is None:
        return None

    if status is not None:
        decision.status = status

    superseded: models.Decision | None = None
    if supersedes_id:
        superseded = await session.get(models.Decision, supersedes_id)
        if superseded is None:
            raise ValueError(f"supersedes_id {supersedes_id} not found")
        decision.supersedes_id = supersedes_id
        superseded.status = "superseded"

    await session.commit()
    await session.refresh(decision)

    if superseded is not None and superseded.cognee_node_id and decision.cognee_node_id:
        try:
            await cognee_service.add_graph_edges(
                [(decision.cognee_node_id, superseded.cognee_node_id, ontology.EDGE_SUPERSEDES)]
            )
        except Exception:
            pass  # graph is secondary; the SQLite change already succeeded

    return decision
