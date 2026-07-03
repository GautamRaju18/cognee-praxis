"""All cognee calls live in this module — nothing else calls cognee directly.

Verified against cognee 1.2.2 (see NOTES.md): the V1 pipeline API
(add / cognify / search) is used because cognify() accepts a custom
graph_model, which carries the Praxis ontology (praxis.ontology.PraxisGraph).

The one other cognee-importing module is praxis.ontology (its models subclass
cognee's DataPoint) — together they form the cognee-facing layer.
"""

from datetime import UTC
from typing import Any

from praxis.config import settings  # must be imported before cognee

_configured = False


def _cognee():
    """Import cognee lazily and point its storage at the project-local dirs."""
    global _configured
    import cognee

    if not _configured:
        cognee.config.data_root_directory(str(settings.cognee_data_root))
        cognee.config.system_root_directory(str(settings.cognee_system_root))
        _configured = True
    return cognee


async def cognee_health() -> str:
    """Cheap reachability check: import + version + storage config."""
    cognee = _cognee()
    return cognee.get_cognee_version()


async def add_text(text: str, dataset: str | None = None) -> None:
    """Stage a document (raw text) into a cognee dataset."""
    cognee = _cognee()
    await cognee.add(text, dataset_name=dataset or settings.cognee_dataset)


async def cognify_dataset(dataset: str | None = None) -> None:
    """Build/extend the graph from staged documents using the Praxis ontology."""
    cognee = _cognee()
    from praxis.ontology import PraxisGraph
    from praxis.prompts import EXTRACTION_PROMPT

    await cognee.cognify(
        datasets=[dataset or settings.cognee_dataset],
        graph_model=PraxisGraph,
        custom_prompt=EXTRACTION_PROMPT,
    )


def _result_text(result: Any) -> str:
    text = getattr(result, "text", None)
    return text if isinstance(text, str) else str(result)


async def graph_completion(
    query_text: str,
    dataset: str | None = None,
    top_k: int = 15,
    system_prompt: str | None = None,
) -> str:
    """LLM answer grounded in graph traversal (never vector chunks alone)."""
    cognee = _cognee()
    from cognee.modules.search.types import SearchType

    results = await cognee.search(
        query_text=query_text,
        query_type=SearchType.GRAPH_COMPLETION,
        datasets=[dataset or settings.cognee_dataset],
        top_k=top_k,
        system_prompt=system_prompt,
    )
    return "\n".join(_result_text(r) for r in results)


async def graph_context(
    query_text: str,
    dataset: str | None = None,
    top_k: int = 15,
) -> str:
    """The retrieved graph context (triplets as text) without an LLM answer."""
    cognee = _cognee()
    from cognee.modules.search.types import SearchType

    results = await cognee.search(
        query_text=query_text,
        query_type=SearchType.GRAPH_COMPLETION,
        datasets=[dataset or settings.cognee_dataset],
        top_k=top_k,
        only_context=True,
    )
    return "\n".join(_result_text(r) for r in results)


async def get_graph_data() -> tuple[list, list]:
    """Raw (nodes, edges) from the graph engine — for /graph and diagnostics."""
    _cognee()
    from cognee.infrastructure.databases.graph import get_graph_engine

    engine = await get_graph_engine()
    return await engine.get_graph_data()


async def add_graph_edges(edges: list[tuple[str, str, str]]) -> None:
    """Write explicit typed edges (source_id, target_id, relationship_name).

    Used for SUPERSEDES / CONTRADICTS and service-created RESULTED_IN links,
    which are deliberately not part of the LLM extraction schema.
    """
    _cognee()
    from datetime import datetime

    from cognee.infrastructure.databases.graph import get_graph_engine

    engine = await get_graph_engine()
    now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
    payload = [
        (
            source_id,
            target_id,
            relationship,
            {
                "source_node_id": source_id,
                "target_node_id": target_id,
                "relationship_name": relationship,
                "updated_at": now,
            },
        )
        for source_id, target_id, relationship in edges
    ]
    await engine.add_edges(payload)


async def prune_all() -> None:
    """Wipe all cognee data + system state (project-local storage only)."""
    cognee = _cognee()
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)
