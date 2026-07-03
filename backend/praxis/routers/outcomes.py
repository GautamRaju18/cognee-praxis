from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from praxis.db import get_session
from praxis.schemas import OutcomeCreate, OutcomeOut, RevisitReport
from praxis.services import outcome_service

router = APIRouter(tags=["outcomes"])


@router.post("/outcomes", response_model=OutcomeOut, status_code=201)
async def create_outcome(
    payload: OutcomeCreate, session: AsyncSession = Depends(get_session)
) -> OutcomeOut:
    try:
        outcome, _decision = await outcome_service.create_outcome(session, payload)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    return OutcomeOut.model_validate(outcome)


@router.post("/revisit", response_model=RevisitReport)
async def revisit(session: AsyncSession = Depends(get_session)) -> RevisitReport:
    report = await outcome_service.revisit(session)
    return RevisitReport(**report)
