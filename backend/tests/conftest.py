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

if TEST_DB.exists():
    TEST_DB.unlink()

import pytest  # noqa: E402


@pytest.fixture(scope="session")
def clean_cognee_test_dataset():
    """Forget the test dataset once per test session (repeatable LLM tests)."""
    import asyncio

    from praxis.services import cognee_service

    asyncio.run(cognee_service.forget_dataset("praxis_test"))
    yield
