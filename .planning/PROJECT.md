# Forge

## What This Is

Forge is a personal web app for tracking strength workouts and body composition. Ankit logs each set live during gym sessions on his phone, sees how today's session compares against the prior identical session, and uploads monthly InBody scans (CSV) to track body composition trends alongside his progressive overload over time.

## Core Value

Live, frictionless workout logging that produces a meaningful "this session vs last session" comparison. If everything else fails, this one thing must work.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Live during-workout logging on phone (sets, reps, weight per set)
- [ ] Drop-set support (multiple weight tiers within one logical set)
- [ ] Exercise library with autocomplete from prior history
- [ ] Routine templates that prefill a session (Push / Pull / Legs / Saturday endurance), AND option to start from scratch
- [ ] End-of-session summary comparing against the most recent prior session of the same routine
- [ ] Strength progress charts per exercise over time
- [ ] Monthly InBody CSV upload, parsed automatically, stored as a body composition record
- [ ] Body composition trends over time (charts, deltas, segmental breakdowns)
- [ ] One-time import on day 1: 5 years of InBody history + current PPL routine + max lifts from existing markdown KB
- [ ] Responsive web UI that works equally well on phone (gym) and laptop (review/analysis)
- [ ] Cloud-hosted on a public URL — accessible from any device with the link

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Multi-user / accounts / auth — single-user app, explicit decision; saves complexity, hosting tradeoff is accepted
- Native iOS/Android apps — responsive web is sufficient and simpler to ship
- Offline support / PWA install / service worker queueing — gym mobile data is reliable; not worth the engineering cost
- AI-generated training summaries or coaching — defer until we know which patterns are actually worth surfacing

## Context

- **Existing manual system:** Ankit already maintains a structured health KB in markdown (OneDrive, `Areas/Health/`) with body composition history, workout plan, lab reports, sleep metrics from Zepp, and a health dashboard. Forge does not absorb the whole KB — only workouts and body composition. Sleep, labs, and diet remain in markdown for now and may be reconsidered later based on Forge's usage patterns.
- **Body composition history:** 18 InBody 270 scans spanning Sep 2021 → Apr 2026, monthly cadence in recent quarters. Tracked metrics: weight, SMM, body fat (kg + %), BMI, BMR, InBody score, TBW, protein, WHR, visceral fat level, plus segmental lean mass and segmental fat mass for arms / trunk / legs.
- **Current training plan:** Push / Pull / Legs split, twice per week, with a Saturday endurance circuit. Six days/week. Defined exercise list per day with current max weights (e.g., Incline Smith 40 kg, Barbell Squats 90 kg, Standing DB Shoulder Press 10 kg ea).
- **Workout flow:** Live logging during sessions. User adds an exercise as he starts it (or picks from history dropdown), logs each set (reps, weight) as he completes it, supports drop sets, sees an end-of-session comparison.
- **InBody data flow:** Monthly scan at gym → CSV from the InBody machine → manual upload to app → parsed and stored. No InBody API exists.
- **Why now:** Manual markdown tracking works for retrospective analysis but is not usable live during a workout, and cross-referencing strength progression against body comp changes requires manual joining of two separate documents.

## Constraints

- **Tech stack**: TBD — research phase will recommend; must support responsive web, simple cloud deploy, and a small structured data model for sets / sessions / scans
- **Hosting**: Cloud, public URL (e.g., Vercel / Fly.io / Railway / similar) — chosen over self-hosted + Tailscale to keep setup friction low
- **Auth**: None for v1 — accept the public-URL exposure tradeoff for low-sensitivity body comp + workout data; deliberately excluding labs/diet from app scope partly for this reason
- **Single-user**: Do not over-engineer for multi-tenancy, isolation, or shared workouts
- **Data sensitivity**: Body composition + workout history are low-medium sensitivity; lab reports (high sensitivity) are explicitly excluded from this app

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-user, no auth | Personal app; simplest path; saves significant complexity | — Pending |
| Cloud hosting on a public URL (no password) | Phone + laptop both need access; tunnel/VPN adds setup friction; body comp + workout data is low-sensitivity and the URL has low discoverability | — Pending |
| Responsive web (no native app, no required PWA install) | Simplest to build and deploy; works on phone and laptop from one codebase | — Pending |
| Online-only (no offline support) | Gym mobile data is reliable enough; offline-capable adds significant engineering cost (sync, conflicts) for marginal benefit | — Pending |
| InBody data via CSV upload | InBody machine outputs CSV; no API; clean, structured ingestion | — Pending |
| v1 floor = live logging + this-vs-last comparison | Smallest version that beats the existing markdown KB; everything else builds on top | — Pending |
| Day-1 import of existing 5 years of InBody data + PPL routine + max lifts | Trends and routines are immediately useful; avoids the cold-start problem | — Pending |
| Start simple on analysis (deltas + charts), defer correlations + AI insights | Avoid speculative features; observe real usage patterns first | — Pending |
| Sleep / labs / diet stay in markdown KB, not absorbed into Forge | Keep scope tight; revisit only if usage proves the case | — Pending |
| Project name: Forge | Short, evocative of building strength, easy to slug | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-10 after initialization*
