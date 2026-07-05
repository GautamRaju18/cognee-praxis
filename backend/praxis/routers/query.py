from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from praxis.db import get_session
from praxis.schemas import DecisionOut, ProposalCheckOut, QueryOut, ReasoningTriple
from praxis.services import query_service

router = APIRouter(tags=["query"])


@router.get("/query", response_model=QueryOut)
async def query(
    q: str = Query(min_length=3), session: AsyncSession = Depends(get_session)
) -> QueryOut:
    result = await query_service.answer_query(session, q)
    return QueryOut(
        answer=result["answer"],
        cited_decisions=[DecisionOut.model_validate(d) for d in result["cited_decisions"]],
        context=result["context"],
        reasoning=[ReasoningTriple(**t) for t in result.get("reasoning", [])],
    )


class ProposalIn(BaseModel):
    proposal_text: str
    topic: str | None = None


@router.post("/check-proposal", response_model=ProposalCheckOut)
async def check_proposal(
    payload: ProposalIn, session: AsyncSession = Depends(get_session)
) -> ProposalCheckOut:
    result = await query_service.check_proposal(session, payload.proposal_text, payload.topic)
    return ProposalCheckOut(
        repeats_prior=result["repeats_prior"],
        contradicts=result["contradicts"],
        relevant_history=[DecisionOut.model_validate(d) for d in result["relevant_history"]],
        warning=result["warning"],
    )
