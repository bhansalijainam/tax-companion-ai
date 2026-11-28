# CA-Firm Practice Workspace

## Problem

A CA firm prepares hundreds of salaried-client returns in a six-week season. Preparers retype numbers from 6–12 documents per client, and partners re-check that transcription line by line. Tax Companion can already do the reading and checking for one client in one browser. A firm can't use it, because nothing persists, nobody signs in, and there is no client list. Separately, every correction a CA makes today is thrown away, though it is exactly the labelled data that would make extraction better for that firm.

## Evidence

- Founder has direct access to practising CAs (stated 2026-11-26).
- Problem size, prep-time figures and partner re-check behaviour: **Assumption — needs validation via 5 CA interviews + 2 shadowing sessions** (scripts in `docs/fde/01-discovery.md`).
- Willingness to trust AI-extracted figures if every number links to its source: **Assumption — validate in the same interviews by showing the demo**.

## Users

- **Primary**: preparer at a 5–50 person CA firm in India (CA or article assistant) handling salaried clients during June–July and revisions through December.
- **Secondary**: reviewing partner who signs off returns and owns the firm's notice risk.
- **Not for**: individual taxpayers filing their own return; firms whose clients are mainly businesses needing audit (44AB).

## Hypothesis

We believe **a shared, persistent workspace where AI drafts each client's facts with verified sources and every CA correction is kept as training and eval data** will **halve preparation time per salaried client and steadily reduce corrections** for **preparers and partners at small CA firms**.

We'll know we're right when **a pilot firm runs ≥30 real client cases through it in 4 weeks, with median prep time ≤20 minutes and the per-document correction rate falling week over week**.

## Success Metrics

| Metric | Target | How measured |
|---|---|---|
| Cases created by pilot firm | ≥30 in 4 weeks | Count of client cases per firm |
| Weekly active preparers | ≥3 at the pilot firm | Distinct users with an audited action per week |
| Median prep time per case | ≤20 min | Audit trail: first upload → working paper finalised |
| Correction rate per extracted fact | Falling week over week | Edits + rejects ÷ facts extracted, from the flywheel |
| Corrections captured as eval cases | ≥95% of CA edits/rejects | Flywheel store vs audit events |
| Firm eval set size | ≥50 labelled documents by week 4 | Flywheel store |
| Cross-firm data leaks | 0 | Tenant-isolation tests + audit |

## Scope

**MVP** — Firm accounts with sign-in and two roles (preparer, partner). A client list with server-persisted case files, so a firm can run many clients and any member can resume a case. Every fact edit, rejection or manual addition is captured as a labelled eval case private to that firm, and can be run with the existing eval harness.

**Out of scope**
- FY 2025-26 rules: next milestone, not MVP (accepted risk, see Risks).
- Billing and pricing: free pilot first; price once value is measured.
- ITR JSON export, AIS JSON import, client portal, bulk intake: post-pilot, ranked in `docs/product/PRODUCT-BRIEF.md`.
- Cross-firm model training: corrections never leave the firm in the MVP.
- Mobile app.

## Delivery Milestones

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Practice workspace | A firm signs in, sees its client list, opens or creates a case, and every change is saved on the server with an audit trail | in-progress (code complete; production provisioning + document storage pending) | `.claude/plans/practice-workspace.plan.md` |
| 2 | Correction → eval flywheel | Each CA edit/reject/add becomes a firm-private eval case; the firm sees its own extraction accuracy over time | pending | — |
| 3 | FY 2025-26 rules | Engine computes AY 2026-27 correctly with tests; each case picks its year | pending | — |
| 4 | Pilot with founder's CA contacts | One firm runs real clients in shadow mode, then assisted mode | pending | — |

## Open Questions

- [ ] Which Postgres and auth providers? Both should come from the Vercel Marketplace to keep billing and secrets in one place. Decide in Task 1 of the M1 plan.
- [ ] Must PAN be encrypted at field level, or is provider encryption at rest enough for the pilot? Check with the pilot firm's DPDP stance.
- [ ] Can preparers see all of a firm's clients, or only those assigned to them? Ask in interviews.
- [ ] Data retention after filing: how many months? This is firm policy and goes in the engagement letter.
- [ ] Can a firm opt in to sharing anonymised corrections to improve the product across firms? Not in the MVP. Revisit after the pilot.
- [ ] Does the public portfolio demo stay keyless and login-free? Proposed: yes, as a separate demo mode.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Pilot CA rejects the tool because it lacks FY 2025-26 rules | High | High | M3 directly after MVP; schedule the pilot after M3 or limit shadow mode to FY 2024-25 revisions |
| A tenant-isolation bug exposes one firm's client data to another | Low | Critical | Firm ID taken from the session only, never from the request body; isolation tests in CI; security review before pilot |
| Preparers bulk-accept facts, so corrections understate errors | Medium | Medium | Partner sampling; corrections compared against partner overrides |
| Client personal data handling breaches DPDP obligations | Medium | High | Processor agreements, retention policy, PAN handling decision, `docs/fde/04-security-privacy.md` checklist |
| Two preparers edit one case at once | Medium | Medium | Optimistic concurrency with version numbers and a clear conflict message |

---
*Status: DRAFT — requirements only. Milestone 1 plan: `.claude/plans/practice-workspace.plan.md`.*
