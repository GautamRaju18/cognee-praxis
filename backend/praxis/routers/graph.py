from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from praxis import models
from praxis.db import get_session
from praxis.schemas import GraphEdgeOut, GraphNodeOut, GraphOut
from praxis.services import cognee_service

router = APIRouter(tags=["graph"])

# The ontology types shown by default; everything else (chunks, summaries,
# document plumbing) is noise for the company-brain view.
PRAXIS_TYPES = {
    "Decision",
    "Person",
    "Topic",
    "Rationale",
    "Assumption",
    "Outcome",
    "Entity",
    "PraxisGraph",
}

_LABEL_FIELDS = ("title", "name", "description", "statement", "text", "summary")


def _label(props: dict) -> str:
    for field in _LABEL_FIELDS:
        value = props.get(field)
        if value:
            text = str(value)
            return text if len(text) <= 80 else text[:77] + "…"
    return str(props.get("type", "node"))


@router.get("/graph", response_model=GraphOut)
async def get_graph(
    full: bool = False, session: AsyncSession = Depends(get_session)
) -> GraphOut:
    raw_nodes, raw_edges = await cognee_service.get_graph_data()

    result = await session.execute(
        select(models.Decision.id, models.Decision.cognee_node_id).where(
            models.Decision.cognee_node_id.is_not(None)
        )
    )
    node_to_decision = {node_id: dec_id for dec_id, node_id in result.all()}

    nodes: list[GraphNodeOut] = []
    kept: set[str] = set()
    for n in raw_nodes:
        node_id = str(n[0]) if isinstance(n, (tuple, list)) else str(n)
        props = n[1] if isinstance(n, (tuple, list)) and isinstance(n[1], dict) else {}
        node_type = str(props.get("type", "?"))
        if not full and node_type not in PRAXIS_TYPES:
            continue
        kept.add(node_id)
        nodes.append(
            GraphNodeOut(
                id=node_id,
                label=_label(props),
                type=node_type,
                decision_id=node_to_decision.get(node_id),
            )
        )

    edges = [
        GraphEdgeOut(source=str(e[0]), target=str(e[1]), relationship=str(e[2]))
        for e in raw_edges
        if isinstance(e, (tuple, list))
        and len(e) >= 3
        and str(e[0]) in kept
        and str(e[1]) in kept
    ]
    return GraphOut(nodes=nodes, edges=edges)
