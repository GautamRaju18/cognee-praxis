"""SQLAlchemy models — the structured, authoritative record.

Cognee holds the semantic graph; these tables are the system of record for
IDs, listing and status. Status/valence/confidence values are validated at
the Pydantic layer (schemas.py); SQLite stores plain strings.
"""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from praxis.db import Base


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(UTC)


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(300))
    statement: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str] = mapped_column(Text, default="")
    owner: Mapped[str] = mapped_column(String(200))
    participants: Mapped[list] = mapped_column(JSON, default=list)
    topic: Mapped[str] = mapped_column(String(120), index=True)
    status: Mapped[str] = mapped_column(String(20), default="decided", index=True)
    reversibility: Mapped[str] = mapped_column(String(20), default="two_way")
    decided_on: Mapped[date] = mapped_column(Date, default=date.today)
    supersedes_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("decisions.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Cognee linkage: dataset it was pushed to + deterministic graph node id
    # (= ontology.decision_node_id(title)), for graph<->SQLite mapping.
    cognee_dataset: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cognee_node_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    assumptions: Mapped[list["Assumption"]] = relationship(
        back_populates="decision",
        cascade="all, delete-orphan",
        lazy="selectin",
        foreign_keys="Assumption.decision_id",
    )
    outcomes: Mapped[list["Outcome"]] = relationship(
        back_populates="decision",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Assumption(Base):
    __tablename__ = "assumptions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    decision_id: Mapped[str] = mapped_column(String(32), ForeignKey("decisions.id"), index=True)
    statement: Mapped[str] = mapped_column(Text)
    confidence: Mapped[str] = mapped_column(String(10), default="med")
    invalidated_by_outcome_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("outcomes.id"), nullable=True
    )

    decision: Mapped[Decision] = relationship(
        back_populates="assumptions", foreign_keys=[decision_id]
    )


class Outcome(Base):
    __tablename__ = "outcomes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    decision_id: Mapped[str] = mapped_column(String(32), ForeignKey("decisions.id"), index=True)
    description: Mapped[str] = mapped_column(Text)
    valence: Mapped[str] = mapped_column(String(10), default="mixed")
    observed_on: Mapped[date] = mapped_column(Date, default=date.today)
    evidence_source: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    cognee_node_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    decision: Mapped[Decision] = relationship(back_populates="outcomes")
