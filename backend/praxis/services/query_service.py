"""/query and /check-proposal — the value endpoints."""

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from praxis import demo_cache, models
from praxis.config import settings
from praxis.services import cognee_service


async def _decisions_by_titles(
    session: AsyncSession, titles: list[str]
) -> list[models.Decision]:
    """Resolve curated titles to real SQLite decisions, preserving order."""
    wanted = {t.lower(): i for i, t in enumerate(titles)}
    result = await session.execute(select(models.Decision))
    hits = [d for d in result.scalars().all() if d.title.lower() in wanted]
    hits.sort(key=lambda d: wanted[d.title.lower()])
    return hits

QUERY_SYSTEM_PROMPT = """You are Praxis, an institutional decision-memory assistant.
Answer strictly from the provided graph context of decisions, rationales, assumptions
and outcomes. When a decision led to an outcome, always say what actually happened.
If the context does not contain the answer, say so plainly — never invent decisions."""


async def _decisions_cited_in(session: AsyncSession, text: str) -> list[models.Decision]:
    """Decisions whose title appears in the retrieved context/answer text."""
    lowered = text.lower()
    result = await session.execute(select(models.Decision))
    return [d for d in result.scalars().all() if d.title.lower() in lowered]


async def answer_query(session: AsyncSession, question: str) -> dict:
    if settings.demo_cache:
        hit = demo_cache.match_query(question)
        if hit:
            cited = await _decisions_by_titles(session, hit.cited_titles)
            return {"answer": hit.answer, "cited_decisions": cited, "context": "", "cached": True}

    context = await cognee_service.graph_context(question)
    answer = await cognee_service.graph_completion(question, system_prompt=QUERY_SYSTEM_PROMPT)
    cited = await _decisions_cited_in(session, f"{context}\n{answer}")
    return {"answer": answer, "cited_decisions": cited, "context": context}


class ProposalVerdict(BaseModel):
    repeats_prior: bool = False
    contradicts_titles: list[str] = []
    warning: str = ""


PROPOSAL_JUDGE_PROMPT = """You are Praxis, the institutional decision memory.
You are given PAST DECISIONS (with rationales, assumptions and actual outcomes) and a
NEW PROPOSAL. Compare them:
- repeats_prior=true if the proposal substantially repeats something already tried or
  decided (even under different wording).
- contradicts_titles: exact titles of past decisions the proposal conflicts with
  (e.g. proposing what was explicitly rejected, reversed, or superseded by policy).
- warning: one or two sentences a colleague would want to hear BEFORE pursuing this —
  especially if a similar attempt failed and why. Empty string if there is no history
  worth flagging.
Only reference decisions that are actually in the provided history."""


async def check_proposal(
    session: AsyncSession, proposal_text: str, topic: str | None = None
) -> dict:
    if settings.demo_cache:
        hit = demo_cache.match_proposal(proposal_text, topic)
        if hit:
            history = await _decisions_by_titles(session, hit.relevant_titles)
            title_to_id = {d.title.lower(): d.id for d in history}
            contradicts = [
                title_to_id[t.lower()] for t in hit.contradicts_titles if t.lower() in title_to_id
            ]
            return {
                "repeats_prior": hit.repeats_prior,
                "contradicts": contradicts,
                "relevant_history": history,
                "warning": hit.warning,
            }

    probe = f"{proposal_text}\nTopic: {topic}" if topic else proposal_text
    context = await cognee_service.graph_context(probe)

    # History = graph-retrieved decisions + same-topic decisions from SQLite.
    relevant = {d.id: d for d in await _decisions_cited_in(session, context)}
    if topic:
        result = await session.execute(
            select(models.Decision).where(models.Decision.topic == topic.strip().lower())
        )
        for d in result.scalars().all():
            relevant[d.id] = d

    history_lines = []
    for d in relevant.values():
        outcomes = (
            "; ".join(f"[{o.valence}] {o.description}" for o in d.outcomes) or "none recorded"
        )
        history_lines.append(
            f"- Title: {d.title}\n  Status: {d.status}\n  Statement: {d.statement}\n"
            f"  Rationale: {d.rationale}\n  Outcomes: {outcomes}"
        )
    history = "\n".join(history_lines) if history_lines else "(no related past decisions)"

    verdict: ProposalVerdict = await cognee_service.llm_structured(
        f"PAST DECISIONS:\n{history}\n\nGRAPH CONTEXT:\n{context}\n\n"
        f"NEW PROPOSAL:\n{proposal_text}",
        PROPOSAL_JUDGE_PROMPT,
        ProposalVerdict,
    )

    title_to_id = {d.title.lower(): d.id for d in relevant.values()}
    contradicts_ids = [
        title_to_id[t.lower()] for t in verdict.contradicts_titles if t.lower() in title_to_id
    ]
    return {
        "repeats_prior": verdict.repeats_prior,
        "contradicts": contradicts_ids,
        "relevant_history": list(relevant.values()),
        "warning": verdict.warning,
    }
