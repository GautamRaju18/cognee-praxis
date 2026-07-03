# Praxis — Engineering Notes

## Phase 0 — Cognee recon (2026-07-04)

### Installed environment
- **cognee 1.2.2** in a uv-managed `.venv` (Python **3.14.3**, no pip module — install deps with `uv pip install --python .venv/Scripts/python.exe ...`).
- Already in venv: fastapi 0.139, uvicorn 0.49, SQLAlchemy 2.0.51, pydantic 2.13 (v2), python-dotenv, python-multipart, aiosqlite, black. Missing (to add): pytest, ruff.
- Node v24.8 + npm 11.6 available for the frontend. Git 2.54 (repo initialized in this phase — folder was not a git repo).

### API surface (verified by introspection, not docs)
Cognee 1.2.2 exposes **both** surfaces:
- V2 memory API: `remember() / recall() / forget() / improve()` — does **not** accept a custom graph model.
- V1 pipeline API: `add(data, dataset_name=...)`, `cognify(datasets=..., graph_model=<pydantic BaseModel>)`, `search(query_text, query_type=SearchType.X, datasets=...)`, `cognee.prune.prune_data() / prune_system()`.

**Decision: Praxis uses the V1 pipeline API**, because `cognify()` is what accepts
`graph_model=` and the custom PraxisGraph ontology is the core of the product.
All version-specific calls live only in `backend/praxis/services/cognee_service.py`.

Useful extras found on `search()` for later phases:
- `include_references=True` — returns supporting references (for cited answers in `/query`).
- `only_context=True` — returns retrieved graph context instead of an LLM answer.
- `top_k`, `node_type` / `node_name` filtering, `SearchType` values include
  `GRAPH_COMPLETION`, `GRAPH_COMPLETION_COT`, `CHUNKS`, `CYPHER`, `TEMPORAL`, `FEELING_LUCKY`.
- `cognee.visualize_graph` / `cognee.get_memory_provenance_graph` / `cognee.export` exist — candidates for `GET /graph`.

### Configuration decisions
- **Storage redirected to project-local dirs** via `cognee.config.data_root_directory()` /
  `system_root_directory()` → `./.data_storage` and `./.cognee_system` (both gitignored).
  Default in 1.2.2 was *inside site-packages*, which would not survive venv rebuilds.
- **`ENABLE_BACKEND_ACCESS_CONTROL=false`** set before importing cognee. Cognee 1.x
  defaults to multi-tenant auth ON; Praxis is a single-user local app.
- LLM config comes straight from `.env` (`LLM_PROVIDER/LLM_MODEL/LLM_API_KEY`,
  `EMBEDDING_*`) — cognee reads these env vars natively via litellm. Current `.env` uses
  **Gemini** (working key); OpenAI and local Ollama work by swapping the same vars
  (e.g. `LLM_PROVIDER=ollama`, `LLM_MODEL=ollama/llama3.1`, `LLM_ENDPOINT` as needed).
- Env vars must be set **before** `import cognee` (settings are read at import time).
- All cognee calls are async; FastAPI endpoints will `await` them directly.

### Smoke test result (`scripts/cognee_smoke.py`)
PASSED against dataset `praxis_smoke` with Gemini:
- `add()` 9.6s → `cognify()` (default KnowledgeGraph model) 16.8s → `search(GRAPH_COMPLETION)` 7.6s.
- Answer correctly recovered decision, owner and rationale from one ingested paragraph.

## Phase 1 — Skeleton (2026-07-04)

- **No GNU make on this machine** (checked PowerShell and Git Bash). The Makefile exists
  as specified, and `tasks.ps1` mirrors every target for Windows (`.\tasks.ps1 api`).
- App DB is **async SQLAlchemy** (`sqlite+aiosqlite`) so FastAPI endpoints never block;
  tables are created on startup via lifespan (no alembic — SQLite file is disposable
  via `reset-memory`).
- `participants` stored as a JSON column on `decisions` (no join table — they're just
  display names; Person is a first-class node in the *cognee* graph, not in SQLite).
- Decision/Outcome rows carry `cognee_dataset` / `cognee_document_id` columns for
  SQLite↔cognee linkage (populated from Phase 3 on).
- Enum-ish fields (status, valence, confidence, reversibility) are validated at the
  Pydantic layer with `Literal` types; SQLite stores plain strings.
- `praxis.config` must be imported before any module that imports cognee (it loads
  `.env` and sets `ENABLE_BACKEND_ACCESS_CONTROL` first); ruff's E402 is disabled to
  allow this ordering where needed.
- `/health` verified two ways: pytest (`backend/tests/test_health.py`) and a live
  uvicorn boot → `{"status":"ok","db":"ok","cognee":"ok","cognee_version":"1.2.2"}`.

### Assumptions / cautions
- `cognee.prune.prune_data()` wipes *all* datasets in the configured storage root.
  Because storage is project-local, that's safe for `make reset-memory`, but tests will
  still prefer per-dataset isolation (`forget(dataset=...)` / dedicated dataset names).
- One paragraph ≈ 30s end-to-end with Gemini Flash — ingest endpoints must be async and
  the frontend must show progress states; cognify supports `run_in_background=True` if needed.
