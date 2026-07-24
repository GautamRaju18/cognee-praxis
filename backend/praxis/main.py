"""Praxis API entrypoint."""

import mimetypes
import os
from contextlib import asynccontextmanager

# Slim Python images (e.g. python:3.12-slim) ship without /etc/mime.types, and
# Python < 3.13 leans on that file — so StaticFiles guesses text/plain for .css
# and browsers refuse to apply the stylesheet (page renders unstyled). Register
# the web types explicitly so serving is correct on any base image / Python.
for _ext, _type in (
    (".css", "text/css"),
    (".js", "text/javascript"),
    (".mjs", "text/javascript"),
    (".json", "application/json"),
    (".svg", "image/svg+xml"),
    (".woff2", "font/woff2"),
    (".woff", "font/woff"),
):
    mimetypes.add_type(_type, _ext)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from praxis import __version__
from praxis.config import settings  # noqa: F401  (must load env before cognee)
from praxis.db import engine, init_db
from praxis.routers import decisions, graph, ingest, outcomes, query
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

app.include_router(decisions.router)
app.include_router(outcomes.router)
app.include_router(query.router)
app.include_router(ingest.router)
app.include_router(graph.router)


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
        llm_provider=settings.llm_model or settings.llm_provider or "cache-only",
    )


# Single-container deploy: serve the built React app at "/" so one service hosts
# both the API and the UI. Mounted LAST so every API route above wins; guarded so
# local dev (where Vite serves the frontend) is unaffected. html=True makes it an
# SPA — unknown paths fall back to index.html.
if settings.frontend_dist and os.path.isdir(settings.frontend_dist):
    app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="spa")
