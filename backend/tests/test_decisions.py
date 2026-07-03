"""Phase 3: POST/GET /decisions end-to-end (SQLite + cognee graph).

Slow: exercises the real LLM extraction pipeline once.
"""

import uuid

PAYLOAD = {
    "title": "Adopt four-day support rotation",
    "statement": "We will move the support team to a four-day on-call rotation.",
    "rationale": "Support burnout is driving attrition; shorter rotations reduce fatigue.",
    "owner": "Jonas Weber",
    "participants": ["Mia Chen"],
    "topic": "Hiring",
    "assumptions": [
        {"statement": "Coverage stays adequate with four-day rotations", "confidence": "med"}
    ],
    "status": "decided",
    "reversibility": "two_way",
}


async def test_create_and_get_decision(client, clean_cognee_test_dataset):
    resp = await client.post("/decisions", json=PAYLOAD)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["id"]
    assert body["topic"] == "hiring"  # normalized
    assert body["assumptions"][0]["confidence"] == "med"

    # GET list with topic filter
    listed = (await client.get("/decisions", params={"topic": "hiring"})).json()
    assert any(d["id"] == body["id"] for d in listed)

    # GET by id
    got = await client.get(f"/decisions/{body['id']}")
    assert got.status_code == 200
    assert got.json()["title"] == PAYLOAD["title"]

    # 404 for unknown id
    assert (await client.get(f"/decisions/{uuid.uuid4().hex}")).status_code == 404


async def test_decision_reached_cognee_graph(client, clean_cognee_test_dataset):
    """The decision created above must exist as a typed node in the graph."""
    from praxis import ontology
    from praxis.services import cognee_service

    expected_id = ontology.decision_node_id(PAYLOAD["title"])
    nodes, _edges = await cognee_service.get_graph_data()

    node_ids = {str(n[0]) if isinstance(n, (tuple, list)) else str(n) for n in nodes}
    assert expected_id in node_ids, "Decision node with deterministic id not found in graph"
