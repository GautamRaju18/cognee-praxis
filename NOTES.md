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

## Phase 2 — Ontology + cognee_service (2026-07-04)

How cognee 1.2.2 really consumes `graph_model` (read the source, not the docs):
- If the model is NOT a `KnowledgeGraph` subclass, the LLM fills an instance of it per
  chunk (instructor structured output) and `add_data_points` converts nested DataPoint
  fields into typed graph edges — **edge name = field name**.
- So `praxis/ontology.py` defines DataPoint subclasses; spec edges map to lowercase
  fields: MADE_BY→`made_by`, PARTICIPANT→`participant`, CONCERNS→`concerns`,
  JUSTIFIED_BY→`justified_by`, BASED_ON→`based_on`, RESULTED_IN→`resulted_in`,
  INVALIDATED_BY→`invalidated_by` (Assumption→Outcome).
- **`identity_fields` metadata → deterministic node ids** (`Class.id_for(value)`),
  namespaced by class name. Decision identity = title, Person/Topic = name,
  Outcome = description, Assumption = statement. This is the mechanism that merges a
  decision mentioned in a *later* outcome document onto the SAME node — the
  decision→outcome edge forms across separate cognify runs.
- **SUPERSEDES / CONTRADICTS are not extraction fields**: a self-referential
  `Decision` field would leak raw DataPoint infrastructure (id/created_at/
  belongs_to_set...) into the LLM schema, because cognee's cycle-breaking returns the
  unsimplified class. They're written as explicit edges via
  `cognee_service.add_graph_edges()` (graph engine `add_edges`).
- Field descriptions are stripped by cognee's schema simplification
  (`datapoint_model_to_basemodel` keeps only annotation+default), so all extraction
  semantics live in `prompts.EXTRACTION_PROMPT`, passed as `cognify(custom_prompt=...)`.
- Default graph store is **ladybug** (embedded, Kuzu lineage); exposes
  `get_graph_data()` and Cypher-ish `query()` — will power `GET /graph` in Phase 8.
- `praxis.ontology` is the only module besides `cognee_service` that imports cognee
  (its classes must subclass cognee's DataPoint) — the two files are the cognee layer.

Smoke test (`scripts/praxis_smoke.py`) PASSED: one decision-log text produced
Decision/Person(3)/Topic(2)/Rationale/Assumption(2) nodes with made_by/participant/
concerns/justified_by/based_on edges, and GRAPH_COMPLETION returned the decision +
rationale. Cognee still adds its generic Entity/EntityType/TextSummary nodes alongside —
harmless, and useful for recall.

## Phase 4 — Outcomes, the decision→outcome edge, /revisit (2026-07-04)

- **The killer edge is deterministic, not LLM-dependent**: POST /outcomes builds
  ontology instances directly (Decision stub with authoritative SQLite properties +
  Outcome) and pushes them via cognee's `add_data_points` — identity ids make the stub
  land on the existing Decision node, guaranteeing `resulted_in`. The outcome document
  is ALSO added + cognified so its text is embedded and extraction re-links by title.
- `/revisit`: re-cognifies the dataset, repairs any missing decision→outcome edges from
  SQLite (reports newly linked), then LLM-judges (via cognee's LLMGateway) whether
  negative/mixed outcomes invalidate still-open assumptions → sets
  `invalidated_by_outcome_id` in SQLite + writes `invalidated_by` graph edges.
- **Gemini free-tier gotchas (cost half a day of quota):**
  - `gemini-flash-latest` resolves to gemini-3.5-flash with a 20 req/DAY free quota.
    Daily quotas are per-model, so we pin `gemini/gemini-2.5-flash` (250 req/day).
  - Client-side rate limiting (`LLM_RATE_LIMIT_ENABLED` etc.) is ON in `.env` for the
    server.
- **Cognee holds asyncio locks bound to the first event loop that uses it.** Any second
  loop touching the LLM path dies with "Lock is bound to a different event loop". All
  tests therefore run on ONE session-scoped loop (pytest-asyncio
  `asyncio_default_test_loop_scope = session`) and exercise the app through
  `httpx.ASGITransport` — never the sync `TestClient` (it spins a loop per block), and
  the limiter stays off in tests. The uvicorn server has a single loop, so it's safe.
- Full suite: 4 passed in ~71s (real LLM calls).

## Phase 5 — /query + /check-proposal (2026-07-04)

- `/query`: GRAPH_COMPLETION (with a Praxis system prompt) for the answer + a second
  `only_context=True` retrieval; decisions are cited by matching their titles against
  the retrieved context/answer and returned as full SQLite records (with outcomes), so
  the decision→outcome connection is visible in the response itself.
- `/check-proposal`: graph context for the proposal + same-topic SQLite decisions are
  fed to an LLM judge (structured verdict) → repeats_prior / contradicts (mapped back
  to decision ids by title) / warning.
- **Dataset scoping is soft**: with access control disabled, the graph and vector
  collections are global — context can bleed across datasets. Fine for the product
  (one company brain); to keep tests clean the graph was fully pruned once.
- **Free-tier quota discovery**: this Gemini key allows **20 generate requests per DAY
  per model** (GenerateRequestsPerDayPerProjectPerModel-FreeTier). Strategy: pin a
  model, hop to a fresh per-model bucket when exhausted (3.5-flash and 2.5-flash burned
  today; now on 2.5-flash-lite), run each phase's LLM test exactly once. Ollama is
  installed locally (llama3.2 3B) but CPU extraction latency and 3B JSON-schema
  adherence make it a poor default; it stays an env-swap option.

## Phase 6 — /ingest/document (2026-07-04)

- Extraction reporting works by diffing graph node ids before/after cognify; new
  Decision nodes (plus their based_on / resulted_in neighbors, and owner/topic/
  rationale resolved through edges) are synced into SQLite so auto-extracted decisions
  appear in the register and in /check-proposal.

## Phases 7–8 — Frontend + /graph (2026-07-04)

- Vite 7 + React 19 + TS + Tailwind v4 (`@tailwindcss/vite`, no config file); no
  router — state-based nav. Typed API client; `VITE_API_URL` overridable.
- Company Brain: `react-force-graph-2d`; GET /graph filters to ontology-level types by
  default (`?full=true` for plumbing nodes); Decision nodes carry their register id
  (join on `cognee_node_id`) enabling graph→drawer deep links.
- Chrome-extension screenshots of localhost pages stall on document_idle; verified via
  tab title + console (zero errors) + curl instead.

## Phase 9 — Seed + docs (2026-07-04)

- `make seed` is **LLM-generation-free**: it stages composed documents with add()
  (registers the dataset — a search precondition), then builds the graph directly from
  ontology DataPoints via `add_data_points` (embeddings only) and writes the
  supersedes edge explicitly. `--documents` additionally cognifies the staged docs.
  Verified: 48 nodes / 51 edges (9 Decision, 5 Outcome, resulted_in ×5,
  invalidated_by ×2, supersedes ×1) and the churn demo query answers with 5 cited
  decisions.
- **Discoveries that cost time:**
  - `search()` requires cognee's relational DB + default user; the direct-push path
    bypasses their implicit creation → `cognee_service.ensure_setup()` (wraps
    `cognee.low_level.setup()`) runs before `add_data_points`, and the dataset must
    exist (hence staging docs with add()).
  - **Cognee's settings prefer the `.env` FILE over process env vars** (custom
    pydantic-settings priority). Model hops must edit `.env`; `$env:LLM_MODEL=...`
    overrides are silently ignored.
  - **The embedded graph store (ladybug/kuzu) is single-process.** Run the API *or*
    scripts/tests, never both; cognee can also leave a multiprocessing child alive
    holding the lock (kill stray `python` processes if `Could not set lock` appears).
  - Free-tier embedding quota (gemini-embedding: 100 requests/bucket) is hit during
    seeding; cognee's tenacity retries ride it out — seed just takes longer.
  - **Quota map of this Gemini key (free tier)**: only gemini-3.5-flash,
    gemini-2.5-flash and gemini-2.5-flash-lite have generation quota (20/day each);
    2.0-flash, 2.0-flash-lite and 2.5-pro report `limit: 0`. All three usable buckets
    were consumed on build day (2026-07-04); they reset at midnight Pacific.
    Default left at `gemini/gemini-2.5-flash`.

### Verification status at end of build day
- Everything green in pytest earlier today: health, decisions e2e, the critical
  decision→outcome test, /query + /check-proposal (referral scenario), ingest, graph.
- Seeded demo verified live: graph shape (48 nodes/51 edges, all ontology edge types)
  and the churn /query with 5 cited decisions.
- Not re-verified after seeding (quota exhausted): /check-proposal against seed data —
  same code path as its passing pytest, so expected fine after quota reset.

### Assumptions / cautions
- `cognee.prune.prune_data()` wipes *all* datasets in the configured storage root.
  Because storage is project-local, that's safe for `make reset-memory`, but tests will
  still prefer per-dataset isolation (`forget(dataset=...)` / dedicated dataset names).
- One paragraph ≈ 30s end-to-end with Gemini Flash — ingest endpoints must be async and
  the frontend must show progress states; cognify supports `run_in_background=True` if needed.

## Post-build — LLM quota outage & local Ollama fallback (2026-07-04)

**Symptom:** `/query`, `/check-proposal`, `/ingest` hung forever (frontend spinner
never resolved). The bare `127.0.0.1:8000/` "Not Found" is unrelated — the API has
no root route by design.

**Root cause:** Gemini free-tier LLM quota exhausted
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, limit **20/day**, all usable
model buckets burned). Cognee's tenacity backoff retries a 429 with a ~128s sleep,
so the request never returns. The Gemini *embedding* endpoint was still fine (200).

**Fix — swap only the LLM to local Ollama, keep Gemini embeddings (no re-seed):**
- `.env` LLM block now: `LLM_PROVIDER=ollama`, `LLM_MODEL=llama3.2`,
  `LLM_ENDPOINT=http://localhost:11434/v1`, `LLM_API_KEY=ollama`. The Gemini LLM
  block is kept commented for a one-move switch-back after the daily reset
  (~12:30 PM IST / midnight Pacific).
- Embeddings stay `gemini-embedding-001` so the existing seeded vectors (3072-dim)
  remain valid — **no reset/re-seed needed**.

**Gotchas hit (all fixed):**
1. Cognee's `LLMConfig` requires **`EMBEDDING_DIMENSIONS`** to be explicit once the
   LLM provider is non-default → added `EMBEDDING_DIMENSIONS="3072"`.
2. Cognee's native Ollama adapter passes `LLM_MODEL` **verbatim** to Ollama, so a
   litellm-style `ollama/llama3.2` 404s ("model not found"). Use the **bare** name
   `llama3.2`. (The repo's old `.env.example` Ollama line used the wrong prefix.)
3. **Stale ladybug lock** after restarts: force-killing uvicorn orphans the
   `multiprocess`-spawned cognee DB-worker children (their parent PID dies but they
   keep the graph-DB lock → `Could not set lock ... Error: 33`). Kill ALL cognee
   python incl. workers before relaunch:
   `Get-CimInstance Win32_Process -Filter "Name='python.exe'" | ? { $_.CommandLine -match 'multiprocess|uvicorn|praxis|cognee|ladybug' } | % { Stop-Process -Id $_.ProcessId -Force }`
   (the earlier `' -c '` regex missed the quoted `"-c"` arg — match `multiprocess`).

**Verified on Ollama:** `/query` returns coherent cited answers (~43s cold, model on
CPU; single uvicorn worker briefly blocks during generation so a concurrent /health
can read 000 mid-call — not a crash). `/check-proposal` responds (200) and retrieval
correctly surfaces the prior referral decision in `relevant_history`, **but llama3.2
(3B) mis-judged `repeats_prior=False`** — the structured verdict quality is the known
3B weakness. Switch back to Gemini after quota reset for demo-grade judgments.

## Post-build — /ingest hardened (retry-storm timeout) (2026-07-04)

**Symptom:** `/ingest` appeared to "crash the server." **Corrected diagnosis:** it
does NOT crash. Two things confused the early triage:
1. The endpoint takes multipart form (`file`/`text=` Form fields). Early tests
   POSTed a JSON body, which FastAPI rejects with 422 *before* the handler runs —
   so cognify never executed in those; the process deaths seen then were unrelated
   (stale-lock cleanup / manual kills), not the ingest handler.
2. With a *correct* multipart request, in-process add+cognify runs fine but, on a
   weak LLM (llama3.2 3B), the cognify pipeline **retry-storms**: the same pipeline
   run id re-executes every ~28s indefinitely because the model keeps emitting
   structured output that fails validation. That looked like a hang.

**What was tried and rejected:** an out-of-process cognify worker
(`asyncio.create_subprocess_exec`). It isolates faults but **deadlocks on the
ladybug single-writer lock** whenever the server already holds the graph open (i.e.
after any `/query` or `/graph`) → clean 500 but unusable live. Removed.

**Fix (in-process + bounded, ingest_service.py):** keep add+cognify in-process (one
process owns the single-writer graph DB, so no lock contention) and wrap it in
`asyncio.wait_for(..., timeout=150s)`. A retry storm now returns a clean **504** with
an actionable message instead of hanging; `wait_for` cancellation stops the loop
(verified: no pipeline runs after the 504, `/health` 200 throughout). A good pass is
~15–35s, well under the ceiling; the 150s headroom also covers legit multi-chunk
Gemini ingests.

**Remaining limit (model, not stability):** even when it completes, llama3.2 can't
fill the nested PraxisGraph schema — an extracted decision collapses into a single
`PraxisGraph` node instead of a typed `Decision`, so the ingest diff (type=="Decision")
finds nothing → ~0 yield on the local model. **Ingest needs Gemini** (phase-6 test
passed there). On Ollama, `/ingest` is now safe (bounded 504) but low-yield; the
other endpoints (`/query`, `/check-proposal`, register, graph) are the usable local
demo surface.

## Post-build — live graph growth + fully-local embeddings (2026-07-05)

- **Logging a decision now pushes it to the graph deterministically** (embeddings
  only, no LLM): `decision_service.create_decision` builds an `ontology.Decision`
  DataPoint and `push_data_points([...])` instead of the old add+cognify. A new
  decision appears in the Company Brain immediately (verified: 138→141 nodes with
  made_by/participant/concerns/justified_by/based_on edges), reliable even when the
  LLM is slow/offline. UI: "watch it appear in the brain →" deep-link after logging.
- **Embeddings moved to local Ollama nomic** (Gemini's 1000/day embed quota was
  exhausted by repeated reseeds). cognee's OllamaEmbeddingEngine needs a HF
  tokenizer for token counting → requires `pip install transformers` and
  `HUGGINGFACE_TOKENIZER="bert-base-uncased"` in .env. EMBEDDING_DIMENSIONS=768.
  The stack is now fully local (llama3.2 + nomic-embed-text) — zero external quota.
  A reset+reseed is required when switching embedding models (vector dims differ).
