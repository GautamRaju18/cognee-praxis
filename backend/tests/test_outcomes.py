"""Phase 4 — THE critical test: the decision->outcome edge.

Logs a decision, then an outcome, then verifies:
  1. structural: Decision -resulted_in-> Outcome edge exists in the graph
     between the deterministic node ids;
  2. semantic: asking "what actually happened" returns the outcome;
  3. /revisit judges the assumption invalidated by the negative outcome and
     records it in SQLite.
Slow: several real LLM calls.
"""

DECISION = {
    "title": "Introduce annual contract discounts",
    "statement": "We will offer a 20% discount to customers who commit to annual contracts.",
    "rationale": "Annual commitments should reduce monthly churn.",
    "owner": "Sara Novak",
    "participants": [],
    "topic": "churn",
    "assumptions": [
        {
            "statement": "Customers will accept annual commitments if given a 20% discount",
            "confidence": "high",
        }
    ],
    "status": "decided",
    "reversibility": "two_way",
}

OUTCOME_DESCRIPTION = (
    "Three months after launching annual contract discounts, churn increased by 5% "
    "and fewer than 3% of customers accepted the annual commitment."
)


async def test_decision_outcome_edge_and_query(client, clean_cognee_test_dataset):
    from praxis import ontology
    from praxis.services import cognee_service

    created = await client.post("/decisions", json=DECISION)
    assert created.status_code == 201, created.text
    decision = created.json()

    outcome_resp = await client.post(
        "/outcomes",
        json={
            "decision_id": decision["id"],
            "description": OUTCOME_DESCRIPTION,
            "valence": "negative",
            "evidence_source": "Q3 churn dashboard",
        },
    )
    assert outcome_resp.status_code == 201, outcome_resp.text

    # 1) Structural: the killer edge exists between deterministic node ids.
    decision_node = ontology.decision_node_id(DECISION["title"])
    outcome_node = ontology.outcome_node_id(OUTCOME_DESCRIPTION)
    _nodes, edges = await cognee_service.get_graph_data()
    edge_keys = {
        (str(e[0]), str(e[1]), str(e[2]))
        for e in edges
        if isinstance(e, (tuple, list)) and len(e) >= 3
    }
    assert (decision_node, outcome_node, "resulted_in") in edge_keys, (
        "Decision -resulted_in-> Outcome edge missing"
    )

    # 2) Semantic: querying what happened returns the outcome, linked.
    answer = await cognee_service.graph_completion(
        "What actually happened as a result of the decision "
        "'Introduce annual contract discounts'?",
    )
    lowered = answer.lower()
    assert "churn" in lowered, answer
    assert "5%" in lowered or "increase" in lowered, answer

    # 3) /revisit: the negative outcome invalidates the assumption.
    report = await client.post("/revisit")
    assert report.status_code == 200, report.text
    body = report.json()
    invalidated = body["invalidated_assumptions"]
    assert any(inv["decision_id"] == decision["id"] for inv in invalidated), (
        f"assumption not invalidated: {body}"
    )

    # SQLite reflects the invalidation.
    detail = (await client.get(f"/decisions/{decision['id']}")).json()
    assert detail["assumptions"][0]["invalidated_by_outcome_id"], detail
