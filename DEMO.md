# Praxis — 3-Minute Demo Script

The one-line pitch: **"Praxis is your company's decision memory — it links every
decision to the outcome that proved it right or wrong, so you stop repeating mistakes."**

---

## Pre-flight (before recording)

1. `.\start.ps1` — clears locks, starts Ollama + API + web, health-checks all three.
2. Open **http://localhost:5173** in Brave, full-screen (F11), 1080p.
3. Confirm the sidebar dot says **"cognee online"** and the graph renders on **Company Brain**.
4. Everything runs **fully local** (llama3.2 + nomic embeddings) — no network/quota needed.
   The scripted `/query` and `/check-proposal` answers are **cached → instant & identical every take**.
5. Do one dry run of the click-path below so the graph camera is where you want it.

---

## The script (≈ 3:00)

### 0:00 — Cold open · Overview  *(20s)*
Land on **Overview**. Let the stat cards count up (30 decisions · 5 disproven · 138 nodes).
> "This is a company's brain — two years of decisions. But the interesting part isn't the
> decisions. It's this —"

Point at **Latest Reckoning**: the **DISPROVEN** assumption struck through, threaded to the
**▼ negative +Nd** outcome.
> "— every decision wired to what actually happened. A bet, the assumption behind it, and the
> outcome that proved it wrong, months later."

### 0:20 — Ask Praxis · the graph-grounded answer  *(35s)*
Click **Ask Praxis** → click the chip **"What did we try before on churn, and what actually happened?"**
Answer types in instantly.
> "I can ask it in plain English. It doesn't search documents — watch."

Scroll to **GRAPH PATH · HOW PRAXIS REACHED THIS**.
> "This is the actual path through the knowledge graph — save-offers *resulted in* a negative
> outcome, the assumption behind it was *invalidated by* that outcome. A vector-search chatbot
> can't produce this. This is Cognee's graph doing the reasoning."

### 0:55 — Company Brain · the 3D graph  *(30s)*
Click **Company Brain**. Let it rotate — glowing nodes, flowing particle threads.
> "This is the whole memory as a graph — 138 nodes, 177 relationships. Decisions, the people
> who made them, their outcomes."

Hover/click a decision node → its path highlights, the rest dims. The **red pulsing** nodes are
proven-wrong assumptions.
> "The red ones pulsing are the assumptions reality overturned."

### 1:25 — Check a Proposal · the killer feature  *(35s)*
Click **Check Proposal** → **use example** (referral program) → **Check against memory**.
Verdict card: **REPEATS PRIOR HISTORY** + the fraud warning.
> "Now the payoff. Before we pitch a new idea, Praxis checks it against everything we've done.
> I propose a referral program — and it stops me: we already ran one, it was shut down after
> six weeks because fraud rings claimed 80% of the rewards. It even links the original decision."

*(Optional: show the same guard firing live while typing on **Log Decision**.)*

### 2:00 — Insights · the self-awareness  *(25s)*
Click **Insights**. Charts animate in.
> "It also knows how the team performs — 59% of outcomes went well, five backfired. And this —
> assumption batting average by confidence — tells us whether the team is calibrated."

*(Optional detour: **Decision-makers** — per-person hit rates.)*

### 2:25 — Live beat · watch the graph grow  *(25s)*
Click **Log Decision** → fill a quick decision (or have it pre-typed) → **Log decision** →
click **"⬡ watch it appear in the brain →"**. The Company Brain opens focused on the new node.
> "And it's live memory. I log a new decision — and it's instantly in the graph, wired to its
> owner, topic, and assumptions. No batch job. That's Cognee."

### 2:50 — Close  *(10s)*
> "Praxis — the institutional memory that remembers what you decided, why, and what happened.
> So your company stops making the same mistake twice."

---

## Wow-moments to make sure land
1. **GRAPH PATH panel** — the proof it's real graph reasoning, not a chatbot.
2. **Check-proposal catching the referral** — the "stops you repeating a mistake" moment.
3. **The 3D brain** rotating with pulsing disproven nodes.
4. **Live-log → node appears** — proves it's live Cognee memory.

## Safety notes
- Cached answers are deterministic — the churn answer and referral verdict are identical every take.
- If a page ever misbehaves, ⌘K → jump anywhere; every page also works from the sidebar.
- The 3D graph needs a real GPU (Brave is fine); don't record it through a remote/VM.
- Keep the whole thing local — no live API calls to fail on camera.
