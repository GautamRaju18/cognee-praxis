# Praxis

**An institutional decision-memory system — a company brain.**

Praxis captures every meaningful *decision* with its rationale, owner and assumptions,
and links each decision to its actual *outcome* weeks or months later. The
decision→outcome edge — which exists in no single document — is the product. Praxis
answers questions like:

- *"What have we already decided about pricing, and why?"*
- *"What did we try before on churn, and what actually happened?"*
- *"Does this new proposal contradict or repeat a past decision?"*
- *"Which of our past assumptions were later proven wrong?"*

Built on [Cognee](https://docs.cognee.ai/) (graph + vector memory) with a custom
decision ontology, FastAPI, SQLite, and a Vite/React frontend.

## Status

Under construction — see NOTES.md for engineering decisions per phase.

## Setup

```bash
# 1. Python deps live in .venv (uv-managed). Missing deps:
uv pip install --python .venv/Scripts/python.exe pytest pytest-asyncio ruff

# 2. Configure the LLM provider
cp .env.example .env   # then fill in your key (Gemini / OpenAI / Ollama)

# 3. Verify cognee works end-to-end
make smoke             # Windows without make: .\tasks.ps1 smoke
```

## Running

| Task | make | Windows (no make) |
| --- | --- | --- |
| API (http://127.0.0.1:8000) | `make api` | `.\tasks.ps1 api` |
| Frontend dev server | `make web` | `.\tasks.ps1 web` |
| Both | `make dev` | `.\tasks.ps1 dev` |
| Tests | `make test` | `.\tasks.ps1 test` |
| Seed demo data | `make seed` | `.\tasks.ps1 seed` |
| Wipe memory + DB | `make reset-memory` | `.\tasks.ps1 reset-memory` |

API docs: http://127.0.0.1:8000/docs
