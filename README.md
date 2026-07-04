# Praxis

**An institutional decision-memory system — a company brain.**

Praxis captures every meaningful *decision* with its rationale, owner and assumptions,
and links each decision to its actual *outcome* weeks or months later. The
decision→outcome edge — which exists in no single document — is the product. Praxis
answers questions a document search can't:

- *"What have we already decided about pricing, and why?"*
- *"What did we try before on churn, and what actually happened?"*
- *"Does this new proposal contradict or repeat a past decision?"*
- *"Which of our past assumptions were later proven wrong?"*

## How it works

```
            ┌────────────────────────── FastAPI ──────────────────────────┐
  React SPA │  /decisions  /outcomes  /ingest  /query  /check-proposal    │
  (Vite+TS) │  /revisit    /graph     /health                             │
            └──────┬────────────────────────────────────┬─────────────────┘
                   │ system of record                   │ semantic layer
              SQLite (SQLAlchemy)                  Cognee (graph + vector)
         decisions/assumptions/outcomes      PraxisGraph ontology: Decision,
              ids, status, listing           Person, Topic, Rationale,
                                             Assumption, Outcome + typed edges
```

- **Custom ontology** (`backend/praxis/ontology.py`): cognee's `cognify()` extracts
  *these* node types with typed edges (`made_by`, `concerns`, `justified_by`,
  `based_on`, `resulted_in`, `supersedes`, `contradicts`, `invalidated_by`) — not a
  generic entity graph.
- **Deterministic node identity**: a Decision's graph id derives from its title, so an
  outcome logged months later lands on the *same* node — that is how the
  decision→outcome edge forms across separate ingests. The `resulted_in` edge is also
  written directly (not LLM-dependent) when you log an outcome.
- **SQLite is authoritative** for records and ids; cognee owns semantics and traversal.
  `/query` answers via `GRAPH_COMPLETION` (graph traversal, never vector chunks alone)
  and cites the underlying decisions with their outcomes.

## Setup

Requirements: the uv-managed `.venv` in this repo (Python 3.14), Node 18+.

```bash
# 1. Python deps are already in .venv; dev extras if missing:
uv pip install --python .venv/Scripts/python.exe pytest pytest-asyncio ruff

# 2. Frontend deps
cd frontend && npm install && cd ..

# 3. Configure the LLM provider
cp .env.example .env    # fill in your key (Gemini / OpenAI / local Ollama)
```

Key env vars (cognee reads them natively; switching provider is env-only):

| Var | Example | Notes |
| --- | --- | --- |
| `LLM_PROVIDER` / `LLM_MODEL` / `LLM_API_KEY` | `gemini` / `gemini/gemini-2.5-flash` / … | pin a model, not `-latest` (free-tier quotas are per-model, per-day) |
| `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` / `EMBEDDING_API_KEY` | `gemini` / `gemini/gemini-embedding-001` | changing embedding models invalidates existing vectors — `reset-memory` after |
| `LLM_RATE_LIMIT_*` | see `.env.example` | client-side limiter for free-tier keys |
| `PRAXIS_DATASET` / `PRAXIS_DATABASE_URL` | `praxis` / `sqlite+aiosqlite:///./praxis.db` | defaults are fine |

## Running

| Task | make | Windows (no make) |
| --- | --- | --- |
| API — http://127.0.0.1:8000 (docs at `/docs`) | `make api` | `.\tasks.ps1 api` |
| Frontend — http://localhost:5173 | `make web` | `.\tasks.ps1 web` |
| Both | `make dev` | `.\tasks.ps1 dev` |
| Seed demo data | `make seed` | `.\tasks.ps1 seed` |
| Tests (real LLM calls, one shared event loop) | `make test` | `.\tasks.ps1 test` |
| Wipe cognee memory + SQLite | `make reset-memory` | `.\tasks.ps1 reset-memory` |
| Cognee smoke test | `make smoke` | `.\tasks.ps1 smoke` |

> **Single-writer store**: cognee's embedded graph DB allows one process at a time.
> Stop the API before running `seed` / `reset-memory` / tests, and vice versa.

## Demo (2 minutes)

```bash
make reset-memory && make seed   # 9 decisions, 5 outcomes, 2 disproven assumptions
make api                         # + make web in another terminal
```

1. **Ask Praxis**: *"What did we try before on churn, and what actually happened?"* —
   the answer recounts the save-offers failure, the annual-pricing win and the
   onboarding-concierge result, with the cited decisions (and their outcomes) as cards.
2. **Check a proposal**: paste *"Let's build a referral program: users get cash rewards
   for inviting friends"* (topic `growth`) — Praxis flags that the Q2 referral program
   was shut down after fraud rings claimed 80% of rewards, with the earlier decision id.
3. **Decisions**: open *"Add cancellation save-offers flow"* — its assumption
   *"Discounts address the real reason customers cancel"* is struck through:
   **invalidated by** the observed outcome.
4. **Company brain**: the live graph — Decisions (green) linked to Outcomes (pink),
   Assumptions (amber), People (blue), Topics (violet); the `supersedes` edge between
   the pricing decisions.
5. **Ingest**: paste meeting notes; decisions are auto-extracted into the register.

`make seed` builds the graph *directly from the ontology* (embeddings only — no LLM
generations), so it works on strict free-tier keys. `seed --documents` additionally
pushes the composed documents through `cognify` for richer text recall.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /decisions` | log a decision (SQLite + graph extraction) |
| `GET /decisions[?topic=&status=&owner=]`, `GET /decisions/{id}` | the register |
| `POST /outcomes` | log an outcome; writes the `resulted_in` edge deterministically |
| `POST /revisit` | outcome-linking pass: repairs edges, LLM-judges assumption invalidations |
| `GET /query?q=` | graph-grounded answer + cited decisions with outcomes |
| `POST /check-proposal` | `{repeats_prior, contradicts[], relevant_history[], warning}` |
| `POST /ingest/document` | .txt/.md or raw text → auto-extracted decisions |
| `GET /graph[?full=true]` | nodes/edges for the visualization |
| `GET /health` | API + cognee reachability |

See `NOTES.md` for the cognee 1.2.2 recon, verified API surface, and every
engineering decision per phase.
