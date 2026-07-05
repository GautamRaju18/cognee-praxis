"""Seed Praxis with a demoable company memory.

Usage:
  .venv/Scripts/python.exe scripts/seed.py [--force] [--documents]

A two-year company history: 30 decisions across pricing/churn/growth/infra/
security/product/data/hiring/marketing/finance, outcomes on most, five
assumptions proven wrong (incl. the Q2 referral program killed by fraud — the
/check-proposal demo), and three supersedes chains (monthly→annual pricing,
in-house→managed auth, free tier→trial).

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
    # ── 2024 · finding product-market fit ──────────────────────────────────
    {
        "title": "Adopt a product-led growth motion",
        "statement": "Default to self-serve signup and in-product upgrades; sales only assists large deals.",
        "rationale": "Developers want to try before they talk to sales.",
        "owner": ("Dana Kim", "Head of Growth"),
        "participants": ["Leena Ahuja"],
        "topic": "growth",
        "status": "decided",
        "decided_on": D(2024, 1, 20),
        "assumptions": [("Self-serve signups convert to paid without a sales touch", "med", None)],
        "outcomes": [
            (
                "Self-serve accounts grew to 70% of new revenue by the end of 2024 with no "
                "dedicated sales team.",
                "positive",
                D(2024, 12, 15),
                "Board deck, Q4 2024",
            )
        ],
    },
    {
        "title": "Open-source the core SDK",
        "statement": "Release the client SDK under Apache 2.0 on GitHub.",
        "rationale": "Open source builds developer trust and top-of-funnel adoption.",
        "owner": ("Nadia Rahman", "Head of Product"),
        "participants": ["Jonas Weber"],
        "topic": "product",
        "status": "decided",
        "decided_on": D(2024, 2, 12),
        "assumptions": [("Open source drives qualified developer signups", "med", None)],
        "outcomes": [
            (
                "The SDK reached 4k GitHub stars and became the top signup source within two "
                "quarters.",
                "positive",
                D(2024, 9, 1),
                "GitHub analytics + attribution, Sep 2024",
            )
        ],
    },
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
        "title": "Build in-house authentication",
        "statement": "Build our own auth and session system rather than adopt a vendor.",
        "rationale": "Auth is core; owning it should avoid per-MAU vendor costs.",
        "owner": ("Priya Sharma", "Head of Infrastructure"),
        "participants": ["Lukas Meyer"],
        "topic": "security",
        "status": "superseded",
        "decided_on": D(2024, 4, 10),
        "assumptions": [("In-house auth will be cheaper than a vendor at our scale", "med", 0)],
        "outcomes": [
            (
                "In-house auth consumed roughly a third of infra time and caused two security "
                "near-misses; total cost exceeded a vendor's.",
                "negative",
                D(2024, 10, 20),
                "Security review, Oct 2024",
            )
        ],
    },
    {
        "title": "Launch a free tier with 10k monthly API calls",
        "statement": "Offer a perpetual free tier capped at 10,000 API calls per month.",
        "rationale": "A generous free tier seeds bottom-up developer adoption.",
        "owner": ("Marcus Lee", "PM, Monetization"),
        "participants": ["Dana Kim"],
        "topic": "pricing",
        "status": "superseded",
        "decided_on": D(2024, 5, 15),
        "assumptions": [("The free tier converts to paid above 3%", "low", None)],
        "outcomes": [
            (
                "Free-tier signups were strong but paid conversion sat near 1.5%, well below "
                "plan, and infra cost per free user was material.",
                "mixed",
                D(2025, 1, 10),
                "Monetization review, Jan 2025",
            )
        ],
    },
    {
        "title": "Hire a founding account executive",
        "statement": "Hire the first account executive to test a repeatable sales motion.",
        "rationale": "Inbound large deals stall without anyone to run them.",
        "owner": ("Leena Ahuja", "CEO & Co-founder"),
        "participants": ["Dana Kim"],
        "topic": "hiring",
        "status": "decided",
        "decided_on": D(2024, 6, 25),
        "assumptions": [("A single AE can prove a repeatable mid-market motion", "med", None)],
        "outcomes": [
            (
                "The first AE closed $180k ARR in two quarters and validated a repeatable "
                "mid-market motion.",
                "positive",
                D(2025, 1, 15),
                "RevOps review, Q1 2025",
            )
        ],
    },
    {
        "title": "Move enterprise support to Slack Connect",
        "statement": "Give enterprise accounts a shared Slack Connect channel for support.",
        "rationale": "High-touch, real-time support should lift retention.",
        "owner": ("Elena Petrova", "Head of Customer Success"),
        "participants": [],
        "topic": "churn",
        "status": "reversed",
        "decided_on": D(2024, 7, 8),
        "assumptions": [("High-touch Slack support scales with headcount", "med", 0)],
        "outcomes": [
            (
                "Slack support did not scale: response-time SLAs slipped as accounts grew and "
                "CS burned out; the team moved back to a ticketed model.",
                "negative",
                D(2025, 2, 20),
                "CS retro, Feb 2025",
            )
        ],
    },
    {
        "title": "Achieve SOC 2 Type II compliance",
        "statement": "Complete a SOC 2 Type II audit within two quarters.",
        "rationale": "Enterprise buyers require it to close.",
        "owner": ("Lukas Meyer", "Security Lead"),
        "participants": ["Priya Sharma"],
        "topic": "security",
        "status": "decided",
        "reversibility": "one_way",
        "decided_on": D(2024, 9, 10),
        "assumptions": [("SOC 2 will unblock stalled enterprise deals", "high", None)],
        "outcomes": [
            (
                "SOC 2 closed in March 2025 and directly unblocked three enterprise deals worth "
                "$420k ARR.",
                "positive",
                D(2025, 3, 25),
                "Sales pipeline review, Q1 2025",
            )
        ],
    },
    {
        "title": "Sunset the legacy v1 API",
        "statement": "Deprecate the v1 API and require migration to v2 within six months.",
        "rationale": "Maintaining two API versions doubles support and slows shipping.",
        "owner": ("Nadia Rahman", "Head of Product"),
        "participants": ["Raj Patel"],
        "topic": "product",
        "status": "decided",
        "reversibility": "one_way",
        "decided_on": D(2024, 10, 5),
        "assumptions": [("Customers migrate off v1 within six months", "med", None)],
        "outcomes": [
            (
                "Migration ran nine months, not six; a long tail of accounts needed hands-on "
                "help before v1 could be retired.",
                "mixed",
                D(2025, 7, 1),
                "API deprecation postmortem, July 2025",
            )
        ],
    },
    {
        "title": "Adopt managed auth and retire in-house auth",
        "statement": "Move authentication to a managed provider and deprecate the in-house system.",
        "rationale": "In-house auth cost more than a vendor and carried security risk.",
        "owner": ("Priya Sharma", "Head of Infrastructure"),
        "participants": ["Lukas Meyer"],
        "topic": "security",
        "status": "decided",
        "reversibility": "one_way",
        "decided_on": D(2024, 11, 12),
        "supersedes": "Build in-house authentication",
        "assumptions": [("A managed provider cuts auth maintenance to near zero", "high", None)],
        "outcomes": [
            (
                "Auth maintenance dropped to near zero and the migration shipped with no "
                "customer-facing downtime.",
                "positive",
                D(2025, 1, 30),
                "Infra review, Jan 2025",
            )
        ],
    },
    {
        "title": "Freeze headcount in Q4 to extend runway",
        "statement": "Pause all non-critical hiring through Q4 to protect runway.",
        "rationale": "Burn outpaced plan; runway needed to clear 24 months.",
        "owner": ("Leena Ahuja", "CEO & Co-founder"),
        "participants": ["Jonas Weber"],
        "topic": "finance",
        "status": "decided",
        "decided_on": D(2024, 11, 25),
        "assumptions": [("A freeze extends runway past 24 months without stalling roadmap", "med", None)],
        "outcomes": [
            (
                "Runway extended to 28 months and the roadmap slipped only about two weeks.",
                "positive",
                D(2025, 2, 28),
                "Finance review, Feb 2025",
            )
        ],
    },
    # ── 2025 · scaling & monetization ──────────────────────────────────────
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
        "title": "Adopt a feature-flag and experiment platform",
        "statement": "Roll out a feature-flag service and gate all releases behind flags.",
        "rationale": "Ad-hoc release management blocks safe, frequent shipping.",
        "owner": ("Jonas Weber", "VP Engineering"),
        "participants": ["Mia Chen"],
        "topic": "product",
        "status": "decided",
        "decided_on": D(2025, 2, 10),
        "assumptions": [("Flags let us ship to production daily without raising incidents", "med", None)],
        "outcomes": [
            (
                "Deploys went from weekly to daily with a lower change-failure rate.",
                "positive",
                D(2025, 6, 30),
                "Engineering metrics review, June 2025",
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
            ("Discounts address the real reason customers cancel", "med", 0),
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
        "title": "Ship a company design system",
        "statement": "Build a shared component library and design tokens for all product surfaces.",
        "rationale": "Inconsistent UI slows shipping and erodes trust.",
        "owner": ("Felix Chen", "Design Lead"),
        "participants": ["Nadia Rahman"],
        "topic": "product",
        "status": "decided",
        "decided_on": D(2025, 3, 18),
        "assumptions": [("A design system speeds feature delivery within a quarter", "med", None)],
        "outcomes": [
            (
                "Feature UI work sped up noticeably and design-QA bugs fell by half after "
                "adoption.",
                "positive",
                D(2025, 8, 5),
                "Product engineering review, Aug 2025",
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
        "title": "Launch customer referral program",
        "statement": "Pay existing users $30 for each successfully invited new customer.",
        "rationale": "Paid acquisition costs were rising; referrals should lower CAC.",
        "owner": ("Ana Lima", "Head of Marketing"),
        "participants": ["Tom Baker"],
        "topic": "growth",
        "status": "reversed",
        "decided_on": D(2025, 4, 7),
        "assumptions": [
            ("Referral rewards will attract genuine customers rather than fraudsters", "high", 0),
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
        "title": "Stand up a Snowflake and dbt data warehouse",
        "statement": "Centralize analytics in Snowflake with dbt models owned by the data team.",
        "rationale": "Metrics live in silos; decisions need one source of truth.",
        "owner": ("Grace Okafor", "Head of Data"),
        "participants": ["Raj Patel"],
        "topic": "data",
        "status": "decided",
        "reversibility": "one_way",
        "decided_on": D(2025, 4, 28),
        "assumptions": [("A warehouse pays for itself in faster, trusted reporting", "med", None)],
        "outcomes": [
            (
                "Company metrics consolidated into one warehouse; the weekly metrics review "
                "went from days of prep to minutes.",
                "positive",
                D(2025, 9, 12),
                "Data team review, Sep 2025",
            )
        ],
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
    {
        "title": "Test paid acquisition on Google and LinkedIn",
        "statement": "Run a one-quarter paid-ads test with a $60k budget across Google and LinkedIn.",
        "rationale": "Content-driven growth is slow; paid might accelerate pipeline.",
        "owner": ("Ana Lima", "Head of Marketing"),
        "participants": ["Tom Baker"],
        "topic": "marketing",
        "status": "decided",
        "decided_on": D(2025, 5, 28),
        "assumptions": [("Paid CAC will beat our content-driven CAC", "med", 0)],
        "outcomes": [
            (
                "Paid CAC came in 2.4x our content CAC with worse retention; the channel was "
                "cut after the test.",
                "negative",
                D(2025, 8, 30),
                "Marketing QBR, Q3 2025",
            )
        ],
    },
    {
        "title": "Adopt a sales-assist motion for 50+ seat deals",
        "statement": "Route accounts over 50 seats to a sales-assist flow with a solutions engineer.",
        "rationale": "Large deals stall in pure self-serve.",
        "owner": ("Dana Kim", "Head of Growth"),
        "participants": ["Leena Ahuja"],
        "topic": "growth",
        "status": "decided",
        "decided_on": D(2025, 6, 15),
        "assumptions": [("A light sales touch raises large-deal win rates", "med", None)],
        "outcomes": [
            (
                "Win rate on 50+ seat deals rose from 19% to 31% in the first two quarters of "
                "sales-assist.",
                "positive",
                D(2025, 11, 10),
                "RevOps review, Nov 2025",
            )
        ],
    },
    {
        "title": "Ship role-based access control (RBAC)",
        "statement": "Add org roles and granular permissions to the product.",
        "rationale": "Enterprise buyers require RBAC to pass security review.",
        "owner": ("Nadia Rahman", "Head of Product"),
        "participants": ["Lukas Meyer"],
        "topic": "product",
        "status": "decided",
        "decided_on": D(2025, 7, 2),
        "assumptions": [("RBAC is a top blocker in enterprise security reviews", "high", None)],
        "outcomes": [],
    },
    {
        "title": "Move analytics to a real-time event pipeline",
        "statement": "Replace nightly batch analytics with a streaming pipeline.",
        "rationale": "Product teams need same-day funnel data.",
        "owner": ("Grace Okafor", "Head of Data"),
        "participants": ["Raj Patel"],
        "topic": "data",
        "status": "decided",
        "reversibility": "one_way",
        "decided_on": D(2025, 7, 22),
        "assumptions": [("Streaming infra cost stays within the data budget", "low", None)],
        "outcomes": [
            (
                "Real-time funnels shipped, but streaming infra ran 40% over budget and needed "
                "a cost pass.",
                "mixed",
                D(2025, 10, 18),
                "Data infra review, Oct 2025",
            )
        ],
    },
    {
        "title": "Adopt a PagerDuty on-call rotation",
        "statement": "Move to a formal on-call rotation with PagerDuty and runbooks.",
        "rationale": "Ad-hoc incident response is burning out senior engineers.",
        "owner": ("Priya Sharma", "Head of Infrastructure"),
        "participants": ["Mia Chen"],
        "topic": "infra",
        "status": "decided",
        "decided_on": D(2025, 8, 10),
        "assumptions": [("A formal rotation lowers mean time to recovery", "high", None)],
        "outcomes": [
            (
                "MTTR dropped from 90 to 35 minutes and off-hours pages were shared evenly "
                "across the team.",
                "positive",
                D(2025, 11, 28),
                "Infra reliability review, Nov 2025",
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
        "title": "Launch usage alerts to prevent bill shock",
        "statement": "Notify accounts at 80% and 100% of expected usage before overage billing.",
        "rationale": "Surprise bills are a top churn and support driver.",
        "owner": ("Marcus Lee", "PM, Monetization"),
        "participants": ["Elena Petrova"],
        "topic": "product",
        "status": "decided",
        "decided_on": D(2025, 9, 30),
        "assumptions": [("Proactive alerts cut billing-related churn", "med", None)],
        "outcomes": [],
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
        "title": "Open a second engineering hub in Lisbon",
        "statement": "Establish a Lisbon engineering hub to widen the senior hiring pool.",
        "rationale": "Senior hiring in our home market has stalled.",
        "owner": ("Jonas Weber", "VP Engineering"),
        "participants": ["Leena Ahuja"],
        "topic": "hiring",
        "status": "proposed",
        "reversibility": "one_way",
        "decided_on": D(2025, 11, 20),
        "assumptions": [
            ("A second hub accelerates senior hiring without hurting velocity", "low", None)
        ],
        "outcomes": [],
    },
    {
        "title": "Replace the free tier with a 14-day trial",
        "statement": "Sunset the perpetual free tier in favor of a 14-day full-feature trial.",
        "rationale": "The free tier's paid conversion stayed near 1.5% while carrying real infra cost.",
        "owner": ("Marcus Lee", "PM, Monetization"),
        "participants": ["Dana Kim"],
        "topic": "pricing",
        "status": "proposed",
        "decided_on": D(2025, 12, 5),
        "supersedes": "Launch a free tier with 10k monthly API calls",
        "assumptions": [("A time-boxed trial converts better than a perpetual free tier", "med", None)],
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
