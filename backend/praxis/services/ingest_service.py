"""Free-text ingestion: transcripts/docs -> auto-extracted decisions.

Extraction diffing: snapshot graph node ids, add+cognify the document, then
diff. New Decision/Outcome/Assumption nodes are synced back into SQLite so the
register (GET /decisions) and /check-proposal see auto-extracted decisions too.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from praxis import models, ontology
from praxis.config import settings
from praxis.services import cognee_service

_DATE_FMT = "%Y-%m-%d"


def _node_id(node) -> str:
    return str(node[0]) if isinstance(node, (tuple, list)) else str(node)


def _node_props(node) -> dict:
    if isinstance(node, (tuple, list)) and len(node) > 1 and isinstance(node[1], dict):
        return node[1]
    return {}


def _parse_date(value: str | None) -> date:
    if value:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            pass
    return date.today()


async def ingest_document(session: AsyncSession, text: str) -> dict:
    nodes_before, _ = await cognee_service.get_graph_data()
    before_ids = {_node_id(n) for n in nodes_before}

    await cognee_service.add_text(text, dataset=settings.cognee_dataset)
    await cognee_service.cognify_dataset(dataset=settings.cognee_dataset)

    nodes_after, edges_after = await cognee_service.get_graph_data()
    new_nodes = [n for n in nodes_after if _node_id(n) not in before_ids]

    by_type: dict[str, list] = {}
    node_map: dict[str, dict] = {}
    for n in nodes_after:
        props = _node_props(n)
        node_map[_node_id(n)] = props
    for n in new_nodes:
        props = _node_props(n)
        by_type.setdefault(str(props.get("type", "?")), []).append((_node_id(n), props))

    # edge lookup: source -> [(relationship, target_id)]
    out_edges: dict[str, list[tuple[str, str]]] = {}
    for e in edges_after:
        if isinstance(e, (tuple, list)) and len(e) >= 3:
            out_edges.setdefault(str(e[0]), []).append((str(e[2]), str(e[1])))

    def neighbor(node_id: str, relationship: str) -> list[dict]:
        return [
            node_map.get(target, {})
            for rel, target in out_edges.get(node_id, [])
            if rel == relationship
        ]

    # Sync new Decision nodes into the SQLite register (skip known node ids).
    created_decisions: list[models.Decision] = []
    for node_id, props in by_type.get("Decision", []):
        exists = await session.execute(
            select(models.Decision).where(models.Decision.cognee_node_id == node_id)
        )
        if exists.scalar_one_or_none() is not None:
            continue
        made_by = neighbor(node_id, ontology.EDGE_MADE_BY)
        topics = neighbor(node_id, ontology.EDGE_CONCERNS)
        rationales = neighbor(node_id, ontology.EDGE_JUSTIFIED_BY)
        participants = [p.get("name", "") for p in neighbor(node_id, ontology.EDGE_PARTICIPANT)]
        assumptions = neighbor(node_id, ontology.EDGE_BASED_ON)

        decision = models.Decision(
            title=str(props.get("title") or props.get("name") or "Untitled decision"),
            statement=str(props.get("statement") or ""),
            rationale=str(rationales[0].get("text", "")) if rationales else "",
            owner=str(made_by[0].get("name", "")) if made_by else "",
            participants=[p for p in participants if p],
            topic=str(topics[0].get("name", "")).lower() if topics else "general",
            status=str(props.get("status") or "decided"),
            reversibility=str(props.get("reversibility") or "two_way"),
            decided_on=_parse_date(props.get("decided_on")),
            cognee_dataset=settings.cognee_dataset,
            cognee_node_id=node_id,
            assumptions=[
                models.Assumption(
                    statement=str(a.get("statement", "")),
                    confidence=str(a.get("confidence", "med")),
                )
                for a in assumptions
                if a.get("statement")
            ],
        )
        session.add(decision)
        created_decisions.append(decision)

        # Outcomes reported in the same document.
        for rel, target in out_edges.get(node_id, []):
            if rel != ontology.EDGE_RESULTED_IN:
                continue
            outcome_props = node_map.get(target, {})
            if not outcome_props.get("description"):
                continue
            session.add(
                models.Outcome(
                    decision=decision,
                    description=str(outcome_props["description"]),
                    valence=str(outcome_props.get("valence") or "mixed"),
                    observed_on=_parse_date(outcome_props.get("observed_on")),
                    evidence_source=str(outcome_props.get("evidence_source") or "") or None,
                    cognee_node_id=target,
                )
            )

    await session.commit()
    for d in created_decisions:
        await session.refresh(d)

    def names(type_name: str, field: str) -> list[str]:
        return [str(p.get(field, "")) for _, p in by_type.get(type_name, []) if p.get(field)]

    return {
        "chars_ingested": len(text),
        "decisions": created_decisions,
        "extracted": {
            "decisions": names("Decision", "title"),
            "people": names("Person", "name"),
            "topics": names("Topic", "name"),
            "outcomes": names("Outcome", "description"),
            "assumptions": names("Assumption", "statement"),
        },
    }
