"""Phase 6: /ingest/document — auto-extraction from free text.

One real cognify run (quota-frugal); validation paths are LLM-free.
"""

TRANSCRIPT = """Weekly product sync — 2025-06-12

Attendees: Omar Haddad (VP Product), Lena Fischer, Raj Patel.

Omar: after reviewing the support load numbers, I'm making the call — we will
sunset the legacy v1 API on September 30th. Maintaining it consumes a full
engineer and blocks the auth migration. The main risk is that we believe fewer
than forty customers still depend on v1, though we're not fully sure of that
number. Lena will own the customer migration comms.

Raj: noted. I'll schedule the deprecation warnings for July.
"""


async def test_ingest_document_extracts_decision(client, clean_cognee_test_dataset):
    resp = await client.post("/ingest/document", data={"text": TRANSCRIPT})
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["chars_ingested"] == len(TRANSCRIPT)
    assert body["extracted"]["decisions"], f"no decisions extracted: {body['extracted']}"
    assert body["decisions"], "extracted decision was not synced into the register"

    synced = body["decisions"][0]
    assert "v1" in synced["title"].lower() or "api" in synced["title"].lower(), synced["title"]

    # The register (SQLite) now lists it.
    listed = (await client.get("/decisions")).json()
    assert any(d["id"] == synced["id"] for d in listed)


async def test_ingest_document_validation(client):
    # neither file nor text
    resp = await client.post("/ingest/document", data={})
    assert resp.status_code == 422

    # wrong file type
    resp = await client.post(
        "/ingest/document",
        files={"file": ("notes.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert resp.status_code == 422

    # empty text
    resp = await client.post("/ingest/document", data={"text": "   "})
    assert resp.status_code == 422
