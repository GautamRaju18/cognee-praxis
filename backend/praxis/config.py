"""Central configuration.

IMPORTANT: this module must be imported before anything imports `cognee`,
because cognee reads its settings from environment variables at import time.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

load_dotenv(PROJECT_ROOT / ".env")

# Praxis is a single-user local app; cognee 1.x defaults to multi-tenant auth ON.
os.environ.setdefault("ENABLE_BACKEND_ACCESS_CONTROL", "false")


class Settings:
    project_root: Path = PROJECT_ROOT

    # Cognee storage lives inside the repo (gitignored), not in site-packages.
    cognee_data_root: Path = PROJECT_ROOT / ".data_storage"
    cognee_system_root: Path = PROJECT_ROOT / ".cognee_system"

    # One cognee dataset for the whole company brain; tests use their own.
    cognee_dataset: str = os.getenv("PRAXIS_DATASET", "praxis")

    database_url: str = os.getenv(
        "PRAXIS_DATABASE_URL",
        f"sqlite+aiosqlite:///{PROJECT_ROOT / 'praxis.db'}",
    )

    api_host: str = os.getenv("PRAXIS_API_HOST", "127.0.0.1")
    api_port: int = int(os.getenv("PRAXIS_API_PORT", "8000"))

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    llm_provider: str = os.getenv("LLM_PROVIDER", "")
    llm_model: str = os.getenv("LLM_MODEL", "")

    # Demo cache: serve curated, grounded answers for the scripted demo queries
    # instantly and deterministically (no LLM), with the live path as fallback.
    # On by default so the demo never depends on model latency/quota; set
    # PRAXIS_DEMO_CACHE=false to force every query through the live LLM.
    demo_cache: bool = os.getenv("PRAXIS_DEMO_CACHE", "true").lower() not in ("0", "false", "no")


settings = Settings()
