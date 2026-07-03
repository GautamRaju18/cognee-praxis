"""Praxis API entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from praxis import __version__
from praxis.config import settings  # noqa: F401  (must load env before cognee)
from praxis.db import engine, init_db
from praxis.schemas import HealthOut


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Praxis", version=__version__, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthOut)
async def health() -> HealthOut:
    db_status = "ok"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover
        db_status = f"error: {exc}"

    cognee_status = "ok"
    cognee_version: str | None = None
    try:
        from praxis.services.cognee_service import cognee_health

        cognee_version = await cognee_health()
    except Exception as exc:
        cognee_status = f"error: {exc}"

    ok = db_status == "ok" and cognee_status == "ok"
    return HealthOut(
        status="ok" if ok else "degraded",
        db=db_status,
        cognee=cognee_status,
        cognee_version=cognee_version,
        llm_provider=settings.llm_model or settings.llm_provider,
    )
