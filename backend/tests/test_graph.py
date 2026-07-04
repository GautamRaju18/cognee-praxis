"""Phase 8: GET /graph export. LLM-free (reads whatever the graph holds)."""


async def test_graph_shape(client):
    resp = await client.get("/graph")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert set(body.keys()) == {"nodes", "edges"}

    kept_ids = {n["id"] for n in body["nodes"]}
    for node in body["nodes"]:
        assert node["id"] and node["label"] and node["type"]
        # default view only shows ontology-level types
        assert node["type"] in {
            "Decision",
            "Person",
            "Topic",
            "Rationale",
            "Assumption",
            "Outcome",
            "Entity",
            "PraxisGraph",
        }
    for edge in body["edges"]:
        assert edge["source"] in kept_ids and edge["target"] in kept_ids


async def test_graph_full_is_superset(client):
    default = (await client.get("/graph")).json()
    full = (await client.get("/graph", params={"full": "true"})).json()
    assert len(full["nodes"]) >= len(default["nodes"])
    assert {n["id"] for n in default["nodes"]} <= {n["id"] for n in full["nodes"]}
