# Changelog

## 0.3.0 — Practice workspace (PRD milestone 1)

### Added
- Firm accounts with sign-in (Better Auth, data in our own Postgres): firms, partner/preparer roles, invitation links.
- Client list at `/app` with search, status and masked PAN; a server-saved case per client and financial year.
- Case saves with optimistic concurrency: a stale save gets a conflict message and a reload button, never a silent overwrite.
- Append-only audit trail enforced by a database trigger; client-side audit entries are stored as server rows attributed to the signed-in member.
- Partner-only **Mark final** / **Reopen**; final cases are read-only on the server.
- Paid AI routes require a signed-in firm member when the workspace is configured; the public demo at `/` stays login-free and scripted.
- `npm run db:migrate` (idempotent); CI runs tenant-isolation tests against Postgres.
- ADR 0001 (database and sign-in), product brief, PRD, capability contract and M1 plan under `docs/` and `.claude/`.

### Changed
- TypeScript 5.9 and typescript-eslint 8.74 (required by Better Auth 1.7).
- Case persistence goes through a `CaseStore` interface: browser storage for the demo, the API for firms.

### Notes
- `npm audit --omit=dev` now lists vitest/vite/tinypool (dev tools) because Better Auth declares vitest as an optional peer. No runtime code imports them; the tracked vite/vitest upgrade clears them.

### Not yet
- Uploaded PDFs and images are not stored server-side yet (Vercel Blob is pending provisioning). Text documents and all facts are saved.

## 0.2.0

### Design
- New "Ledger & Saffron" theme (Theme Factory, custom): ink-indigo, saffron, warm paper; Fraunces headings, Inter body, tabular numbers. Spec in `docs/design/THEME.md`.
- Light/dark toggle (follows the system by default).
- Automated contrast audit in a real browser: every visible text node on all 9 views passes WCAG AA in both themes.

### Added
- Hybrid extractor (regex first, LLM on demand) with per-document-type coverage anchors; opt-in via `EXTRACTION_STRATEGY=hybrid`. Routing is measured on every eval run: 9/14 documents need no LLM call.
- `npm run evals -- --extractor hybrid` and a cost-routing section on the Evals page.
- Demo/live path parity test, so both extractors produce identical fact shapes.
- Per-IP rate limit on paid endpoints (`RATE_LIMIT_PER_MIN`), Dependabot config, test coverage report.

### Security
- Provider error details are logged server-side only; clients get generic messages.
- Constant-time `ACCESS_TOKEN` comparison.
- zod 3 → 4 (GHSA-mrhx-c7xc-m3w5, memory exhaustion validating oversized arrays on untrusted input); `npm audit fix` for transitive advisories. Production dependencies: 0 high/critical.
- Dev server binds to localhost by default.

## 0.1.0

Rebuilt the UI prototype into a working applied-AI system.

### Added
- Deterministic FY 2024-25 tax engine (old vs new regime) with a line-by-line trace and 23 hand-verified tests.
- Field catalogue and case-file domain model: facts with provenance, review status and audit trail.
- Deterministic reconciliation rules: AIS vs documents (deposit interest, savings interest, TDS), landlord PAN above ₹1L rent, cash deposits, 80C over cap, conflicts between documents.
- Provider-agnostic `LLMProvider` interface with a Claude adapter (official SDK, structured outputs, strict tools, adaptive thinking, server-side refusal fallback) and a scripted adapter for demo mode.
- LLM document extraction with verbatim-quote citations, verified in code (grounding check, confidence cap).
- Rules-based extractor used both for demo mode and as the eval baseline.
- Tool-using assistant (6 read-only tools, bounded loop, what-if overrides) with a figure-grounding check on every answer and a visible tool trace.
- Server handlers shared by Vercel functions and Vite dev middleware; the API key stays server-side.
- Eval harness: labelled extraction set (template / variant / adversarial), agent eval, results page.
- Live-mode smoke test against a mock Messages API; CI workflow.
- Views: Overview, Documents, Review facts, Flags (with client-email draft), Tax computation, Assistant, Working paper, Evals, How it works.
- Docs: design doc, architecture review, eval method, FDE engagement pack.

### Removed
- Hard-coded mock data and incorrect tax figures; keyword-matched fake chat; simulated upload progress; Lovable template scaffolding.
