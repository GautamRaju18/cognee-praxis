from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from praxis.db import get_session
from praxis.schemas import DecisionCreate, DecisionOut, DecisionUpdate
from praxis.services import decision_service

router = APIRouter(tags=["decisions"])


@router.post("/decisions", response_model=DecisionOut, status_code=201)
async def create_decision(
    payload: DecisionCreate, session: AsyncSession = Depends(get_session)
) -> DecisionOut:
    if payload.supersedes_id:
        superseded = await decision_service.get_decision(session, payload.supersedes_id)
        if superseded is None:
            raise HTTPException(404, f"supersedes_id {payload.supersedes_id} not found")
    decision = await decision_service.create_decision(session, payload)
    return DecisionOut.model_validate(decision)


@router.get("/decisions", response_model=list[DecisionOut])
async def list_decisions(
    topic: str | None = None,
    status: str | None = None,
    owner: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[DecisionOut]:
    decisions = await decision_service.list_decisions(session, topic, status, owner)
    return [DecisionOut.model_validate(d) for d in decisions]


@router.get("/decisions/{decision_id}", response_model=DecisionOut)
async def get_decision(
    decision_id: str, session: AsyncSession = Depends(get_session)
) -> DecisionOut:
    decision = await decision_service.get_decision(session, decision_id)
    if decision is None:
        raise HTTPException(404, "decision not found")
    return DecisionOut.model_validate(decision)


@router.patch("/decisions/{decision_id}", response_model=DecisionOut)
async def update_decision(
    decision_id: str,
    payload: DecisionUpdate,
    session: AsyncSession = Depends(get_session),
) -> DecisionOut:
    try:
        decision = await decision_service.update_decision(
            session, decision_id, status=payload.status, supersedes_id=payload.supersedes_id
        )
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    if decision is None:
        raise HTTPException(404, "decision not found")
    return DecisionOut.model_validate(decision)
