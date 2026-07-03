"""Phase 0 smoke test: prove the installed Cognee can add -> cognify -> search.

Run:  .venv/Scripts/python.exe scripts/cognee_smoke.py

Verifies, against the *installed* cognee (1.2.2):
  1. .env config (provider-agnostic: gemini / openai / ollama) is picked up.
  2. V1 pipeline API works: add() -> cognify() -> search(GRAPH_COMPLETION).
  3. Storage is redirected to project-local dirs (.data_storage / .cognee_system),
     NOT the default inside site-packages.
"""

import asyncio
import os
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# --- env must be configured BEFORE importing cognee (settings read at import) ---
from dotenv import load_dotenv  # noqa: E402

load_dotenv(PROJECT_ROOT / ".env")
# Single-user local app: disable multi-tenant access control (default is ON in 1.x).
os.environ.setdefault("ENABLE_BACKEND_ACCESS_CONTROL", "false")

import cognee  # noqa: E402
from cognee.modules.search.types import SearchType  # noqa: E402

DATASET = "praxis_smoke"

SAMPLE = (
    "On 2025-03-10, Acme's growth team, led by Dana Kim, decided to switch from "
    "monthly billing to annual-only pricing. The rationale was to reduce churn and "
    "increase upfront cash flow. The decision was based on the assumption that "
    "enterprise customers prefer annual contracts."
)

QUERY = "What pricing decision did the team make, who led it, and why?"


async def main() -> int:
    # Keep all cognee state inside the repo (both dirs are gitignored).
    cognee.config.data_root_directory(str(PROJECT_ROOT / ".data_storage"))
    cognee.config.system_root_directory(str(PROJECT_ROOT / ".cognee_system"))

    print(f"cognee version : {cognee.get_cognee_version()}")
    print(f"LLM provider   : {os.getenv('LLM_PROVIDER')} / {os.getenv('LLM_MODEL')}")
    print(f"Embeddings     : {os.getenv('EMBEDDING_PROVIDER')} / {os.getenv('EMBEDDING_MODEL')}")

    t0 = time.time()
    print(f"\n[1/3] add() -> dataset '{DATASET}' ...")
    await cognee.add(SAMPLE, dataset_name=DATASET)
    print(f"      ok ({time.time() - t0:.1f}s)")

    t0 = time.time()
    print("[2/3] cognify() (default graph model for smoke) ...")
    await cognee.cognify(datasets=[DATASET])
    print(f"      ok ({time.time() - t0:.1f}s)")

    t0 = time.time()
    print(f"[3/3] search(GRAPH_COMPLETION): {QUERY!r}")
    results = await cognee.search(
        query_text=QUERY,
        query_type=SearchType.GRAPH_COMPLETION,
        datasets=[DATASET],
    )
    print(f"      ok ({time.time() - t0:.1f}s)\n")

    answer_text = ""
    for r in results:
        text = getattr(r, "text", None) or str(r)
        answer_text += text
        print("ANSWER:", text)

    lowered = answer_text.lower()
    if "annual" in lowered or "pricing" in lowered:
        print("\nSMOKE TEST PASSED: graph completion answered from ingested content.")
        return 0
    print("\nSMOKE TEST INCONCLUSIVE: got an answer but it does not mention the decision.")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
