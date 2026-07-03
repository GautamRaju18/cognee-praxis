import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Isolate tests BEFORE any praxis import: own SQLite file, own cognee dataset.
# (praxis.config reads env at import; load_dotenv never overrides existing vars.)
TEST_DB = BACKEND_DIR / "tests" / ".test.db"
os.environ["PRAXIS_DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB}"
os.environ["PRAXIS_DATASET"] = "praxis_test"
# Keep cognee's client-side limiter off in tests (it binds an asyncio.Lock to
# the current loop; harmless here because ALL tests share one session loop —
# see asyncio_default_test_loop_scope in pyproject.toml — but the pinned
# model's daily quota is protection enough for the small test workload).
os.environ["LLM_RATE_LIMIT_ENABLED"] = "false"
os.environ["EMBEDDING_RATE_LIMIT_ENABLED"] = "false"

if TEST_DB.exists():
    TEST_DB.unlink()

import httpx  # noqa: E402
import pytest_asyncio  # noqa: E402

# NOTE: cognee holds asyncio locks created on first use, bound to the running
# event loop. Every test that touches cognee MUST therefore run on the same
# loop: all tests are async with session loop scope, and the app is exercised
# through ASGITransport (never the sync TestClient, which spins its own loop).


@pytest_asyncio.fixture(scope="session")
async def client():
    from praxis.db import init_db
    from praxis.main import app

    await init_db()  # ASGITransport does not run the lifespan
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture(scope="session")
async def clean_cognee_test_dataset():
    """Forget the test dataset once per test session (repeatable LLM tests)."""
    from praxis.services import cognee_service

    await cognee_service.forget_dataset("praxis_test")
    yield
