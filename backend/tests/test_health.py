from fastapi.testclient import TestClient
from praxis.main import app


def test_health_ok():
    with TestClient(app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["db"] == "ok"
    assert body["cognee"] == "ok"
    assert body["cognee_version"]
    assert body["status"] == "ok"
