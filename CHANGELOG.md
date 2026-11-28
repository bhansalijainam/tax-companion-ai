# Changelog

## 0.5.0 — Client upload link (SaaS plan M3)

### Added
- **Private upload link per client.** The CA makes it from the client's checklist (or it is made automatically by **Send reminder**, which puts it in the WhatsApp message). The client opens it on their phone, sees who is asking, what's still needed and why, and uploads against each item. No login.
- **What the link can do:** add files to one case, nothing else. The client page shows no PAN, amounts or other documents, and cannot open or download files. Links last 14 days, can be turned off, and stop working once the case is filed. Unknown, expired and revoked links all look the same (410).
- **What the server stores:** only a SHA-256 of each link. Files are kept per firm and case in Postgres (`case_files`), served to firm members only as downloads (`nosniff`, sandboxed CSP).
- **Checks on every file:** type allowlist (PDF, JPEG, PNG, WebP, text, CSV), magic-byte check against the declared type, 4 MB per file, 40 files and 60 MB per link, file names cleaned.
- **On arrival:** text files are read by the rules baseline straight away. PDFs and photos are read by live AI when the CA opens the case, or downloaded and read by the CA.
- **Audit:** uploads are recorded as `client.uploaded` by a new `client` actor that only the server can write; a CA save that tries to add client events is refused. Removing a document deletes its stored file.
- **Demo:** each demo client gets a demo link (`/practice/:id/upload`) that opens the client's page in the browser, with "Use sample document" for presenting without real files.

### Changed
- Checklist says "Sent by the client, not read yet" instead of "Being read" for files waiting on live AI.
- Tests turn off Better Auth's rate limiter (`AUTH_RATE_LIMIT=off`, honoured only when `NODE_ENV=test`) because test files sign up users in parallel.

## 0.4.0 — Client roster and document checklist (SaaS plan M2)

### Added
- **Practice dashboard.** Every client on one screen, with a stage (not started → awaiting documents → needs review → ready → filed), a readiness bar, one dot per required document, and the next action. Filter by stage, search by name.
- **Document checklist per client.** The CA ticks what the client's year looks like (salary, employers, rent, loans, capital gains, business, 80C, health insurance, rental income). The required documents follow from that, each with a one-line reason the client can understand. Partial receipt counts, e.g. "Form 16: 1 of 2 received".
- **Reminders that list only what's missing.** One click writes the message and opens it in the CA's own WhatsApp (wa.me link, no API needed yet), or copies it. Reminders sent from a case are recorded in the audit trail.
- **Public demo practice at `/practice`.** Ten fictional clients at different stages, stored per client in the browser. "Client sends it" plays the client's side: a sample document arrives, is read, and the checklist, flags and tax update.
- Server: `cases.summary` holds the checklist summary, recomputed on every save, so the dashboard never loads full case documents. Older cases are backfilled on first list. Client profile and phone are validated on create and save.
- New document kinds: business P&L / books, property documents. Rules extraction reads net profit from a P&L.

### Notes
- Cases saved before 0.4.0 have no profile. It is inferred from their documents and the checklist says so until the CA confirms it.
- Automatic WhatsApp/email sending with client opt-in is M4; the client upload link is M3.

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
