"""Seed Praxis with a demoable company memory.

Usage:
  .venv/Scripts/python.exe scripts/seed.py [--force] [--documents]

Nine decisions across pricing/churn/growth/infra/hiring, outcomes on four,
two assumptions proven wrong (incl. the Q2 referral program killed by fraud —
the /check-proposal demo), one superseded decision.

By default the graph is built DIRECTLY from ontology DataPoints (embeddings
only — no LLM generations, so it works on free-tier keys). Pass --documents
to also push composed decision documents through add+cognify (uses LLM quota,
adds text chunks for richer retrieval).
"""

import asyncio
import sys
from datetime import date
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from praxis import models, ontology  # noqa: E402
from praxis.config import settings  # noqa: E402
from praxis.db import SessionLocal, init_db  # noqa: E402
from praxis.services import cognee_service  # noqa: E402
from praxis.services.decision_service import compose_decision_document  # noqa: E402
from praxis.services.outcome_service import compose_outcome_document  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

D = date  # brevity in the data table below


def person(cache: dict, name: str, role: str = "") -> ontology.Person:
    if name not in cache:
        cache[name] = ontology.Person(name=name, role=role)
    return cache[name]


def topic(cache: dict, name: str) -> ontology.Topic:
    if name not in cache:
        cache[name] = ontology.Topic(name=name)
    return cache[name]


SEED = [
    {
        "title": "Monthly-first pricing strategy",
        "statement": "Price all plans monthly by default with no annual commitment.",
        "rationale": "Low-friction signup mattered most while finding product-market fit.",
        "owner": ("Dana Kim", "Head of Growth"),
        "participants": [],
        "topic": "pricing",
        "status": "superseded",
        "decided_on": D(2024, 3, 5),
        "assumptions": [("Buyers churn less when they feel no lock-in", "med", None)],
        "outcomes": [],
    },
    {
        "title": "Switch to annual-only pricing",
        "statement": "All paid plans move to annual billing; monthly plans are discontinued.",
        "rationale": "Reduce churn and increase upfront cash flow for hiring runway.",
        "owner": ("Dana Kim", "Head of Growth"),
        "participants": ["Marcus Lee"],
        "topic": "pricing",
        "status": "decided",
        "decided_on": D(2025, 3, 10),
        "supersedes": "Monthly-first pricing strategy",
        "assumptions": [("Enterprise customers prefer annual contracts", "high", None)],
        "outcomes": [
            (
                "Six months after the switch to annual-only pricing, upfront cash collections "
                "rose 18% and logo churn was unchanged.",
                "positive",
                D(2025, 9, 20),
                "Finance QBR deck, Q3 2025",
            )
        ],
    },
    {
        "title": "Introduce usage-based pricing tier",
        "statement": "Add a metered tier billed per 1,000 API calls for developer accounts.",
        "rationale": "Self-serve developers balk at seat pricing; usage pricing matches value.",
        "owner": ("Marcus Lee", "PM, Monetization"),
        "participants": ["Dana Kim"],
        "topic": "pricing",
        "status": "proposed",
        "decided_on": D(2025, 11, 2),
        "assumptions": [("Developers can predict their monthly usage well enough", "low", None)],
        "outcomes": [],
    },
    {
        "title": "Launch onboarding concierge for new accounts",
        "statement": "Every new account above 20 seats gets a human-led onboarding session.",
        "rationale": "Most churn happens in the first 60 days, before activation.",
        "owner": ("Elena Petrova", "Head of Customer Success"),
        "participants": ["Sara Novak"],
        "topic": "churn",
        "status": "decided",
        "decided_on": D(2025, 1, 14),
        "assumptions": [("Early activation is the main driver of retention", "high", None)],
        "outcomes": [
            (
                "90-day activation rose 22% for concierge-onboarded cohorts and their "
                "6-month churn halved.",
                "positive",
                D(2025, 7, 30),
                "CS dashboard, July 2025 cohort review",
            )
        ],
    },
    {
        "title": "Add cancellation save-offers flow",
        "statement": "Show a 30% discount offer to customers who click cancel.",
        "rationale": "Cheaper to discount than to lose the account entirely.",
        "owner": ("Sara Novak", "Growth PM"),
        "participants": [],
        "topic": "churn",
        "status": "decided",
        "decided_on": D(2025, 2, 3),
        "assumptions": [
            (
                "Discounts address the real reason customers cancel",
                "med",
                # invalidated by outcome index 0 below
                0,
            )
        ],
        "outcomes": [
            (
                "Save offers only delayed cancellations by about one month; six-month churn "
                "was unchanged and discounted accounts churned at the same rate.",
                "negative",
                D(2025, 8, 12),
                "Retention analysis, August 2025",
            )
        ],
    },
    {
        "title": "Launch customer referral program",
        "statement": "Pay existing users $30 for each successfully invited new customer.",
        "rationale": "Paid acquisition costs were rising; referrals should lower CAC.",
        "owner": ("Ana Lima", "Head of Marketing"),
        "participants": ["Tom Baker"],
        "topic": "growth",
        "status": "reversed",
        "decided_on": D(2025, 4, 7),
        "assumptions": [
            (
                "Referral rewards will attract genuine customers rather than fraudsters",
                "high",
                0,
            )
        ],
        "outcomes": [
            (
                "The referral program was shut down after six weeks in Q2 because coordinated "
                "fraud rings claimed over 80% of referral rewards using fake accounts.",
                "negative",
                D(2025, 5, 26),
                "Growth weekly report, week 21",
            )
        ],
    },
    {
        "title": "Migrate primary database to managed Postgres",
        "statement": "Move the primary database from self-hosted Postgres to a managed service.",
        "rationale": "The team spends ~20% of its time on database maintenance and on-call toil.",
        "owner": ("Priya Sharma", "Head of Infrastructure"),
        "participants": ["Raj Patel"],
        "topic": "infra",
        "status": "decided",
        "reversibility": "one_way",
        "decided_on": D(2025, 4, 2),
        "assumptions": [
            ("Managed-service latency overhead stays under 5ms", "high", None),
            ("Migration downtime can be kept under one hour", "low", None),
        ],
        "outcomes": [
            (
                "Migration completed with 40 minutes of downtime; on-call incidents fell 60% "
                "but p99 latency rose 3ms.",
                "mixed",
                D(2025, 6, 18),
                "Infra postmortem, June 2025",
            )
        ],
    },
    {
        "title": "Adopt Kubernetes for all services",
        "statement": "Standardize all backend services on Kubernetes within a year.",
        "rationale": "Heterogeneous deployment tooling slows releases and complicates on-call.",
        "owner": ("Priya Sharma", "Head of Infrastructure"),
        "participants": [],
        "topic": "infra",
        "status": "decided",
        "reversibility": "one_way",
        "decided_on": D(2025, 9, 15),
        "assumptions": [
            ("The team can absorb the k8s learning curve within a quarter", "med", None)
        ],
        "outcomes": [],
    },
    {
        "title": "Hire only senior engineers for the platform team",
        "statement": "Platform team roles are opened at senior level and above only.",
        "rationale": "The platform surface is too critical for long ramp-up times.",
        "owner": ("Jonas Weber", "VP Engineering"),
        "participants": ["Mia Chen"],
        "topic": "hiring",
        "status": "decided",
        "decided_on": D(2025, 5, 20),
        "assumptions": [
            ("Senior-only hiring keeps velocity without mentorship overhead", "med", None)
        ],
        "outcomes": [],
    },
]


async def main() -> None:
    force = "--force" in sys.argv
    with_documents = "--documents" in sys.argv

    await init_db()
    async with SessionLocal() as session:
        count = (await session.execute(select(func.count(models.Decision.id)))).scalar_one()
        if count and not force:
            print(f"Register already has {count} decisions — rerun with --force to seed anyway.")
            return

        people_cache: dict = {}
        topic_cache: dict = {}
        graph_points = []
        supersedes_edges: list[tuple[str, str, str]] = []
        documents: list[str] = []
        by_title: dict[str, models.Decision] = {}
        pending_invalidations: list[tuple[models.Assumption, models.Outcome]] = []

        for spec in SEED:
            outcome_rows = [
                models.Outcome(
                    description=desc,
                    valence=valence,
                    observed_on=observed,
                    evidence_source=source,
                    cognee_node_id=ontology.outcome_node_id(desc),
                )
                for desc, valence, observed, source in spec["outcomes"]
            ]
            assumption_rows = []
            for statement, confidence, invalidated_by in spec["assumptions"]:
                row = models.Assumption(statement=statement, confidence=confidence)
                if invalidated_by is not None:
                    # ids are only assigned at flush — link after the flush below
                    pending_invalidations.append((row, outcome_rows[invalidated_by]))
                assumption_rows.append(row)

            decision = models.Decision(
                title=spec["title"],
                statement=spec["statement"],
                rationale=spec["rationale"],
                owner=spec["owner"][0],
                participants=spec["participants"],
                topic=spec["topic"],
                status=spec["status"],
                reversibility=spec.get("reversibility", "two_way"),
                decided_on=spec["decided_on"],
                cognee_dataset=settings.cognee_dataset,
                cognee_node_id=ontology.decision_node_id(spec["title"]),
                assumptions=assumption_rows,
                outcomes=outcome_rows,
            )
            session.add(decision)
            by_title[spec["title"]] = decision

            # --- ontology instances (deterministic ids merge shared nodes) ---
            outcome_nodes = [
                ontology.Outcome(
                    description=desc,
                    valence=valence,
                    observed_on=observed.isoformat(),
                    evidence_source=source,
                )
                for desc, valence, observed, source in spec["outcomes"]
            ]
            assumption_nodes = [
                ontology.Assumption(
                    statement=statement,
                    confidence=confidence,
                    invalidated_by=(
                        [outcome_nodes[invalidated_by]] if invalidated_by is not None else []
                    ),
                )
                for statement, confidence, invalidated_by in spec["assumptions"]
            ]
            graph_points.append(
                ontology.Decision(
                    title=spec["title"],
                    statement=spec["statement"],
                    decided_on=spec["decided_on"].isoformat(),
                    status=spec["status"],
                    reversibility=spec.get("reversibility", "two_way"),
                    made_by=person(people_cache, *spec["owner"]),
                    participant=[person(people_cache, p) for p in spec["participants"]],
                    concerns=[topic(topic_cache, spec["topic"])],
                    justified_by=ontology.Rationale(text=spec["rationale"]),
                    based_on=assumption_nodes,
                    resulted_in=outcome_nodes,
                )
            )

            if "supersedes" in spec:
                supersedes_edges.append(
                    (
                        ontology.decision_node_id(spec["title"]),
                        ontology.decision_node_id(spec["supersedes"]),
                        ontology.EDGE_SUPERSEDES,
                    )
                )

        await session.flush()  # assign ids before wiring FKs

        for assumption_row, outcome_row in pending_invalidations:
            assumption_row.invalidated_by_outcome_id = outcome_row.id
        for spec in SEED:
            if "supersedes" in spec:
                by_title[spec["title"]].supersedes_id = by_title[spec["supersedes"]].id

        await session.commit()

        for spec in SEED:
            decision = by_title[spec["title"]]
            documents.append(compose_decision_document(decision))
            for outcome in decision.outcomes:
                documents.append(compose_outcome_document(decision, outcome))

    print(f"Seeded {len(SEED)} decisions into SQLite.")

    # Staging documents via add() registers the cognee dataset (a search
    # precondition) and keeps them ready for a later cognify. No LLM involved.
    print(f"Staging {len(documents)} composed documents (no LLM)...")
    for doc in documents:
        await cognee_service.add_text(doc)

    print("Pushing ontology graph to cognee (embeddings only, no LLM)...")
    await cognee_service.push_data_points(graph_points)
    if supersedes_edges:
        await cognee_service.add_graph_edges(supersedes_edges)
    print(f"Graph pushed: {len(graph_points)} decisions + shared people/topics, "
          f"{len(supersedes_edges)} supersedes edge(s).")

    if with_documents:
        print("Cognifying staged documents (uses LLM quota)...")
        await cognee_service.cognify_dataset()
        print("Documents cognified.")

    print("\nSeed complete. Demo ideas:")
    print('  - Ask: "What did we try before on churn, and what actually happened?"')
    print('  - Ask: "Which of our past assumptions were proven wrong?"')
    print('  - Check proposal: "Let\'s build a referral program with rewards for invites"')


if __name__ == "__main__":
    asyncio.run(main())
