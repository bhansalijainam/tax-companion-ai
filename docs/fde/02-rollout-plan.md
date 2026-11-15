# 02 · Pilot and rollout plan

## Goal

Within one filing season, show that a preparer plus Tax Companion completes a standard salaried return **at least 2× faster** with **no increase in errors**. Shadow mode first, then live.

## Phases

| Phase | Weeks | Scope | Exit criteria |
|---|---|---|---|
| 0. Firm eval set | 1–2 | Label 50 redacted past packs with the firm's staff; add to `evals/` as a private split | Claude extraction ≥90% recall, 0 forbidden hits, ≥98% citations verified on the firm set |
| 1. Shadow | 3–4 | 2 preparers run both the old process and the tool on 40 live clients; results compared, tool output not used for filing | Facts agree with the manual sheet on ≥97% of fields; every disagreement is root-caused |
| 2. Assisted | 5–8 | Tool is the working sheet for standard salaried clients; partner review unchanged | Median prep time ≤20 min; partner override rate <5% of facts |
| 3. Default | 9+ | All salaried clients; review checklist reduced for verified facts | No AIS-mismatch notices on pilot returns (checked at 143(1) intimation) |

## Metrics and how they're captured

| Metric | Source |
|---|---|
| Prep time per client | Audit trail timestamps: first upload → working paper finalised |
| Fact override rate | `fact.edited` + `fact.rejected` events / facts extracted |
| Citation-verified rate | Share of facts with `grounded = true` |
| Flags raised → resolved, time to resolve | `flag.*` events |
| Client follow-up rounds | Count of "Draft client email" uses per client |
| Notices | Manual: 143(1) intimations for pilot clients, compared with prior year |
| Cost per return | Provider usage (tokens) logged per request ÷ returns |

## Change management

- **Champions**: one CA and one senior article, trained first. They own the feedback channel.
- **Training**: 45 minutes, built around the demo case's six flags, since they cover every rule type.
- **Feedback loop**: every partner override is a candidate eval case. Weekly 30-minute triage: prompt fix, new rule, or new labelled example.
- **Rollback**: the old Excel sheet remains valid throughout. The tool exports the same figures, so any client can be completed manually.

## Production hardening before Phase 2 (engineering backlog)

1. Server-side case storage with firm/tenant isolation and role-based access (preparer, reviewer, partner). This replaces browser storage.
2. Firm SSO, and audit events written server-side and append-only.
3. OCR plus fuzzy grounding for scanned PDFs and photos, with the threshold tuned on the firm eval set.
4. Per-document retry and queue so peak-day uploads are rate-limit safe; batch extraction overnight for bulk packs.
5. Export to the firm's filing utility format (CSV/JSON mapping per schedule).
6. Usage dashboards: cost per return, latency p50/p95, override rate per document type.

## Risks

| Risk | Mitigation |
|---|---|
| Preparers over-trust and bulk-accept | Bulk accept limited to verified ≥90%; DRAFT watermark; partner spot-check sampling |
| New document format in peak season | Variant split grows weekly; unverifiable facts always need manual review |
| Rule changes (Budget, CBDT circulars) | Rules isolated in `engine/rules.ts` with tests; change requires a test per boundary |
| Provider outage on a deadline day | Demo/rules path still works for template documents; manual sheet fallback |
