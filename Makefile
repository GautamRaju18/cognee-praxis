# Praxis task runner. Windows without GNU make: use `.\tasks.ps1 <target>` instead
# (same targets, same commands).

PY := .venv/Scripts/python.exe
ifeq ($(OS),)
PY := .venv/bin/python
endif

.PHONY: api web dev seed test reset-memory smoke lint

api:
	$(PY) -m uvicorn praxis.main:app --app-dir backend --reload --port 8000

web:
	cd frontend && npm run dev

dev:
	$(MAKE) -j2 api web

seed:
	$(PY) scripts/seed.py

test:
	$(PY) -m pytest -v

reset-memory:
	$(PY) scripts/reset_memory.py

smoke:
	$(PY) scripts/cognee_smoke.py

lint:
	$(PY) -m ruff check backend scripts
	$(PY) -m black --check backend scripts
