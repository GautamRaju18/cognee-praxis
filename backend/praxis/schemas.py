"""Pydantic v2 schemas for the API layer."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DecisionStatus = Literal["proposed", "decided", "reversed", "superseded"]
Reversibility = Literal["one_way", "two_way"]
Confidence = Literal["low", "med", "high"]
Valence = Literal["positive", "negative", "mixed"]


class AssumptionIn(BaseModel):
    statement: str
    confidence: Confidence = "med"


class AssumptionOut(AssumptionIn):
    model_config = ConfigDict(from_attributes=True)

    id: str
    invalidated_by_outcome_id: str | None = None


class DecisionCreate(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    statement: str
    rationale: str = ""
    owner: str
    participants: list[str] = []
    topic: str
    assumptions: list[AssumptionIn] = []
    status: DecisionStatus = "decided"
    reversibility: Reversibility = "two_way"
    decided_on: date | None = None
    supersedes_id: str | None = None


class OutcomeCreate(BaseModel):
    decision_id: str
    description: str
    valence: Valence = "mixed"
    observed_on: date | None = None
    evidence_source: str | None = None


class OutcomeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    decision_id: str
    description: str
    valence: Valence
    observed_on: date
    evidence_source: str | None = None
    created_at: datetime


class DecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    statement: str
    rationale: str
    owner: str
    participants: list[str]
    topic: str
    status: DecisionStatus
    reversibility: Reversibility
    decided_on: date
    supersedes_id: str | None = None
    created_at: datetime
    assumptions: list[AssumptionOut] = []
    outcomes: list[OutcomeOut] = []


class QueryOut(BaseModel):
    answer: str
    cited_decisions: list[DecisionOut] = []
    context: str = ""


class ProposalCheckOut(BaseModel):
    repeats_prior: bool
    contradicts: list[str] = []
    relevant_history: list[DecisionOut] = []
    warning: str = ""


class IngestReport(BaseModel):
    chars_ingested: int
    decisions: list[DecisionOut] = []  # newly created register entries
    extracted: dict[str, list[str]] = {}  # names of new graph nodes by kind


class RevisitReport(BaseModel):
    newly_linked_outcomes: list[dict] = []
    invalidated_assumptions: list[dict] = []


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    db: str
    cognee: str
    cognee_version: str | None = None
    llm_provider: str | None = None
