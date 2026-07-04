"""Curated, grounded answers for the scripted demo — instant and deterministic.

Every answer here is derived from the seeded company memory (see scripts/seed.py):
real decisions, real owners, real outcomes. The cache exists so a 3-minute demo
never stalls on local-model latency or bad structured output. Non-scripted queries
still fall through to the live LLM path (query_service). Toggle with
PRAXIS_DEMO_CACHE=false.

Matching is keyword-based (all `must` terms present, case/punctuation-insensitive)
so light rewording of a scripted question still hits.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", text.lower())


@dataclass
class CachedAnswer:
    must: list[str]  # every term must appear (normalized substring)
    answer: str
    cited_titles: list[str] = field(default_factory=list)


# ── /query ─────────────────────────────────────────────────────────────────
QUERY_ANSWERS: list[CachedAnswer] = [
    CachedAnswer(
        must=["churn"],
        answer=(
            "On churn, the team ran two opposite plays. First, the cancellation "
            "save-offers flow (Feb 2025, Sara Novak) showed a 30% discount to anyone "
            "clicking cancel. It failed: save offers only delayed cancellations by about "
            "a month, six-month churn was unchanged, and discounted accounts churned at "
            "the same rate. Then the onboarding concierge for new accounts (Elena Petrova) "
            "took the opposite bet — fix activation early instead of buying back the exit — "
            "and it worked, cutting early churn. The lesson on record: discounting the exit "
            "doesn't address why customers leave; earlier activation does."
        ),
        cited_titles=[
            "Add cancellation save-offers flow",
            "Launch onboarding concierge for new accounts",
        ],
    ),
    CachedAnswer(
        must=["pricing"],
        answer=(
            "Pricing has moved through three decisions. The team started monthly-first "
            "(Dana Kim) to lower the barrier to entry, then superseded it by switching to "
            "annual-only pricing — also Dana Kim — to reduce churn and pull cash forward. "
            "That one paid off: churn dropped and upfront cash improved. A usage-based "
            "pricing tier is currently proposed but not yet decided. The throughline across "
            "all three: reduce churn and improve cash flow, with annual commitment as the lever."
        ),
        cited_titles=[
            "Switch to annual-only pricing",
            "Monthly-first pricing strategy",
            "Introduce usage-based pricing tier",
        ],
    ),
    CachedAnswer(
        must=["assumption"],
        answer=(
            "Two assumptions are on record as proven wrong. On churn, 'discounts address "
            "the real reason customers cancel' — the bet behind the save-offers flow — was "
            "invalidated when the outcome showed discounts only delayed cancellations. On "
            "growth, 'referral rewards will attract genuine customers rather than fraudsters' "
            "— behind the referral program — was disproven when coordinated fraud rings "
            "claimed over 80% of rewards and the program was shut down. Both were "
            "mid-confidence bets that a later outcome overturned."
        ),
        cited_titles=[
            "Add cancellation save-offers flow",
            "Launch customer referral program",
        ],
    ),
    CachedAnswer(
        must=["referral"],
        answer=(
            "The team launched a customer referral program in Q2 (Ana Lima): existing users "
            "earned rewards for inviting friends. It was reversed after six weeks — "
            "coordinated fraud rings claimed over 80% of rewards using fake accounts. The "
            "assumption that referral rewards attract genuine customers was proven wrong."
        ),
        cited_titles=["Launch customer referral program"],
    ),
    CachedAnswer(
        must=["infra"],
        answer=(
            "On infrastructure, two decisions stand. The team adopted Kubernetes for all "
            "services to standardize deployment, and migrated the primary database to managed "
            "Postgres to cut operational load — the Postgres move landed with a mixed outcome: "
            "less ops overhead, but a migration that ran longer than planned."
        ),
        cited_titles=["Adopt Kubernetes for all services", "Migrate primary database to managed Postgres"],
    ),
]


# ── /check-proposal ────────────────────────────────────────────────────────
@dataclass
class CachedVerdict:
    must: list[str]
    repeats_prior: bool
    contradicts_titles: list[str]
    warning: str
    relevant_titles: list[str] = field(default_factory=list)


PROPOSAL_VERDICTS: list[CachedVerdict] = [
    CachedVerdict(
        must=["referral"],
        repeats_prior=True,
        contradicts_titles=["Launch customer referral program"],
        warning=(
            "Your team already ran a referral program in Q2 (Ana Lima), and it was shut down "
            "after six weeks: coordinated fraud rings claimed over 80% of rewards using fake "
            "accounts. The assumption that referral rewards attract genuine customers was "
            "proven wrong. If you revisit this, lead with fraud controls and verified signups — "
            "otherwise you're repeating a known failure."
        ),
        relevant_titles=["Launch customer referral program"],
    ),
    CachedVerdict(
        must=["discount", "cancel"],
        repeats_prior=True,
        contradicts_titles=["Add cancellation save-offers flow"],
        warning=(
            "This repeats the cancellation save-offers flow (Feb 2025). The outcome on record: "
            "discounts only delayed cancellations by about a month and six-month churn was "
            "unchanged. The onboarding concierge — fixing activation earlier — is what actually "
            "reduced churn."
        ),
        relevant_titles=["Add cancellation save-offers flow", "Launch onboarding concierge for new accounts"],
    ),
]


def match_query(question: str) -> CachedAnswer | None:
    q = _norm(question)
    best: CachedAnswer | None = None
    best_score = 0
    for entry in QUERY_ANSWERS:
        if all(term in q for term in entry.must):
            score = sum(len(t) for t in entry.must)
            if score > best_score:
                best, best_score = entry, score
    return best


def match_proposal(proposal_text: str, topic: str | None) -> CachedVerdict | None:
    p = _norm(f"{proposal_text} {topic or ''}")
    best: CachedVerdict | None = None
    best_score = 0
    for entry in PROPOSAL_VERDICTS:
        if all(term in p for term in entry.must):
            score = sum(len(t) for t in entry.must)
            if score > best_score:
                best, best_score = entry, score
    return best
