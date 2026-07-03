"""Wipe Praxis's cognee memory (project-local storage only) and the SQLite record.

Usage: .venv/Scripts/python.exe scripts/reset_memory.py [--keep-sqlite]
"""

import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from praxis.config import settings  # noqa: E402 (sets env before cognee import)


async def main() -> None:
    from praxis.services.cognee_service import _cognee

    cognee = _cognee()
    print(f"Pruning cognee data + system state under {settings.cognee_data_root} ...")
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)
    print("Cognee memory pruned.")

    if "--keep-sqlite" not in sys.argv:
        db_path = PROJECT_ROOT / "praxis.db"
        if db_path.exists():
            db_path.unlink()
            print(f"Deleted {db_path}.")
    print("Reset complete.")


if __name__ == "__main__":
    asyncio.run(main())
