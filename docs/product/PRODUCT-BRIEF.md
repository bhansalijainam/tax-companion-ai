# Product Brief: Tax Companion → CA-firm SaaS

*Produced with ECC `product-lens` (Founder Review + Feature Prioritization). Status: direction agreed, see PRD.*

## Decision

Build Tax Companion into a **B2B workspace for Indian CA firms**, not a self-filing app for taxpayers and not only a portfolio demo. The founder has direct access to practising CAs for validation.

**Go**, with one condition: validate the problem with at least 5 CA interviews before Milestone 2 scope is frozen (see PRD → Evidence).

## Founder review (current state, Nov 2026)

| Signal | Score | Evidence |
|---|---|---|
| Usage | 0/10 | Not deployed; no users |
| Retention | 0/10 | No accounts; state lives in one browser |
| Revenue | 0/10 | No pricing or billing |
| Moat | 5/10 | Verified citations, deterministic tested engine, firm-specific eval method. Hard to copy well, easy to copy badly |
| Engineering quality | 8/10 | 61 tests, evals, CI, security hardening, AA-accessible UI |
| **Overall PMF** | **2/10** | A strong demo of one case, not yet a product |

**What it is trying to be:** the working sheet a CA firm uses for every salaried client, where the AI does the transcription and reconciliation and the CA decides.

**The one thing that would 10x it:** a firm can run its whole season in it. That means many clients, many preparers, a partner who reviews, and work that persists. Every other feature is worth little until a firm can keep its data in the tool.

**Built but not mattering yet:** theme polish, dark mode, Figma screens, more assistant tools.

**Biggest risk the founder accepted:** the engine covers FY 2024-25 only. Returns being filed and revised now are for FY 2025-26 (AY 2026-27), which has different new-regime slabs and the ₹12L rebate. A pilot CA will hit this on day one. It is the first milestone after the MVP.

## Feature prioritization (ICE = impact × confidence ÷ effort, each 1–5)

| Feature | I | C | E | ICE | Decision |
|---|---|---|---|---|---|
| Live deploy + real Claude eval numbers | 5 | 5 | 1 | 25 | Do now (blocked on Vercel access + API key) |
| FY 2025-26 rules / multi-year engine | 4 | 5 | 2 | 10 | Milestone 3 (accepted risk) |
| AIS JSON import (deterministic) | 4 | 4 | 2 | 8 | Backlog, high |
| **Correction → eval flywheel** | 4 | 4 | 2 | 8 | **MVP (M2)** |
| Client tax-saving planner | 3 | 4 | 2 | 6 | Backlog |
| **Multi-client practice + accounts** | 5 | 4 | 4 | 5 | **MVP (M1)**: low ICE, but it is the dependency everything else needs |
| Bulk intake (queued extraction) | 4 | 3 | 3 | 4 | After pilot |
| Notice assistant (s.143(1)(a)) | 4 | 3 | 3 | 4 | After pilot |
| ITR JSON export | 5 | 3 | 4 | 3.8 | After pilot; needs schema validation per AY |
| Client document portal | 4 | 3 | 4 | 3 | After pilot |

Why the MVP is not simply the top ICE scores: multi-client practice scores low on ICE because it is large, but without it a firm cannot keep any data. The flywheel turns every pilot hour into a better eval set, so it compounds from day one.

## Anti-goals (next two quarters)

- Filing returns or talking to the e-filing portal on the client's behalf.
- A self-service app for taxpayers.
- Business or audit cases (books of account, 44AB).
- Replacing the firm's filing utility. We export to it.
