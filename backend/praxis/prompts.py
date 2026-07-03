"""Prompts used with cognee (extraction) and the query layer."""

EXTRACTION_PROMPT = """You are Praxis, an institutional decision-memory extractor.
From the provided text, extract every meaningful DECISION into the structured schema.

Rules:
- A Decision is a committed choice ("we will X", "we decided to X", "approved X"),
  or an explicit proposal (status="proposed"). Ignore trivia and process chatter.
- `title`: a short, stable, canonical name for the decision (e.g. "Switch to
  annual-only pricing"). Reuse the exact same title if the text refers to a
  decision already named elsewhere in the text.
- `statement`: one sentence stating precisely what was decided.
- `decided_on`: ISO date (YYYY-MM-DD) if the text gives one, else "".
- `status`: one of proposed | decided | reversed | superseded.
- `reversibility`: "one_way" if the text implies it is hard to undo, else "two_way".
- `made_by`: the single person who owns/made the decision, with their role if stated.
- `participant`: other people involved in making it.
- `concerns`: 1-3 short lowercase topics (e.g. "pricing", "churn", "infra", "hiring").
- `justified_by`: the rationale — WHY it was decided, as stated in the text.
- `based_on`: explicit or clearly implied assumptions behind the decision, each with
  confidence low | med | high. An assumption is a belief about the world that, if
  false, would undermine the decision.
- `resulted_in`: ONLY outcomes the text explicitly reports as having happened
  (results, metrics moving, failures, wins). `valence`: positive | negative | mixed.
  `observed_on`: ISO date if given, else "". `evidence_source`: where the result was
  reported (report name, dashboard, meeting), else "".
- If an outcome proves an assumption wrong, also attach that outcome to the
  assumption's `invalidated_by` list (use the identical outcome description).
- Do NOT invent people, dates, outcomes, or assumptions that are not in the text.
- `summary`: one sentence describing what the whole text covers.

Extract ALL decisions present; an empty decisions list is valid if the text truly
contains none."""
