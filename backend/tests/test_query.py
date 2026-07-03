"""Phase 5: /query (GRAPH_COMPLETION + cited decisions) and /check-proposal.

The spec's canonical scenario: a referral program tried before and killed by
fraud; a new referral proposal must trigger repeats_prior with the earlier
decision id. Slow: real LLM calls.
"""

DECISION = {
    "title": "Launch customer referral program",
    "statement": "We will launch a referral program paying $30 per successfully invited customer.",
    "rationale": "Paid acquisition is too expensive; referrals should lower CAC.",
    "owner": "Ana Lima",
    "participants": ["Tom Baker"],
    "topic": "growth",
    "assumptions": [
        {
            "statement": "Referral rewards will attract genuine customers rather than fraudsters",
            "confidence": "high",
        }
    ],
    "status": "decided",
    "reversibility": "two_way",
}

OUTCOME_DESCRIPTION = (
    "The referral program was shut down after six weeks because coordinated fraud "
    "rings claimed over 80% of the referral rewards with fake accounts."
)

PROPOSAL = (
    "I think we should build a referral program: existing users get a cash reward "
    "for every friend they invite who signs up."
)


async def test_query_cites_decision_outcome(client, clean_cognee_test_dataset):
    created = await client.post("/decisions", json=DECISION)
    assert created.status_code == 201, created.text
    decision_id = created.json()["id"]

    outcome = await client.post(
        "/outcomes",
        json={
            "decision_id": decision_id,
            "description": OUTCOME_DESCRIPTION,
            "valence": "negative",
            "evidence_source": "Growth weekly report, week 26",
        },
    )
    assert outcome.status_code == 201, outcome.text

    resp = await client.get(
        "/query",
        params={"q": "What did we try before about referral programs and what happened?"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    lowered = body["answer"].lower()
    assert "referral" in lowered, body["answer"]
    assert "fraud" in lowered or "shut down" in lowered, body["answer"]

    cited_ids = [d["id"] for d in body["cited_decisions"]]
    assert decision_id in cited_ids, f"decision not cited: {body['cited_decisions']}"
    # The cited card carries its outcomes -> the decision->outcome connection
    # is visible in the response itself.
    cited = next(d for d in body["cited_decisions"] if d["id"] == decision_id)
    assert any("fraud" in o["description"].lower() for o in cited["outcomes"])


async def test_check_proposal_flags_repeat(client, clean_cognee_test_dataset):
    resp = await client.post(
        "/check-proposal", json={"proposal_text": PROPOSAL, "topic": "growth"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["repeats_prior"] is True, body
    history_ids = [d["title"] for d in body["relevant_history"]]
    assert DECISION["title"] in history_ids, body
    assert body["warning"], "expected a non-empty warning about the failed referral program"
