# Capability: Practice Workspace + Correction Flywheel

*ECC `product-capability` output for PRD milestones 1–2 (`.claude/prds/ca-firm-practice.prd.md`).*

## CAPABILITY

Members of a CA firm sign in and work from a shared client list. Each client has a case file per financial year, stored on the server and opened by any member with access. Every change is recorded in an append-only audit trail. When a member edits, rejects or adds an extracted fact, that correction is stored as a labelled example that belongs to the firm. The firm's own eval set therefore grows with use, and the existing eval harness can score extraction against it. The public demo keeps working without an account.

## CONSTRAINTS

**Fixed rules (policy)**
- Every read and write is scoped to one firm. The firm comes from the signed-in session, never from the request body or URL.
- Two roles. *Preparer*: create cases, edit facts, resolve flags. *Partner*: everything a preparer can do, plus finalising the working paper and managing members.
- Only a partner can mark a case **Final**. A Final case is read-only until a partner reopens it, and the reopen is audited.
- Corrections are firm-private. They never leave the firm or appear in another firm's evals.
- The demo mode (no sign-in, sample case, rules + scripted assistant) stays public and reads no server data.
- No client personal data appears in logs. Uploaded documents are stored privately.

**Invariants**
- The audit trail is append-only. No API updates or deletes an audit event.
- A case save that started from version *n* succeeds only if the stored version is still *n*. Otherwise it returns a conflict and nothing is overwritten.
- Tax figures still come only from the deterministic engine, computed from stored facts. They are never stored as trusted values.
- Each correction records: the extractor that produced the original value, the original value, the corrected value or "rejected", the document's content hash, the field, who corrected it, and when.

**Trust boundaries**
- Browser ↔ API: an authenticated session is required for every `/api/*` route except `/api/health`. Live LLM routes require a signed-in member in hosted mode, which replaces the shared `ACCESS_TOKEN`.
- API ↔ database: one data-access module applies the firm scope; route handlers never write raw queries.
- API ↔ LLM provider: unchanged (one document per call; binaries stripped from chat).

**Data ownership:** the firm owns clients, cases, documents and corrections. The product owns the engine, prompts and the public eval set.

## IMPLEMENTATION CONTRACT

**Actors:** preparer, partner, public visitor (demo), system (extractor, rule engine).

**Surfaces**
- Sign-in / sign-up / accept invite.
- Client list (search, filter by status and FY; create client).
- Case workspace: today's views, loaded from and saved to the server.
- Firm settings: members, roles, invites (partner only).
- Firm accuracy page: the flywheel's eval results for this firm (M2).

**Case states:** `draft` → `in_review` (all facts reviewed) → `final` (partner signs off) → `reopened` (partner only) → `in_review`.

**Data model** (columns for anything queried, constrained or updated on its own; JSON for the case document read and written whole)
- `firms(id, name, created_at)`
- `members(id, firm_id, auth_subject, email, role, created_at)`
- `clients(id, firm_id, name, pan, created_at)`: PAN handling per open question
- `cases(id, firm_id, client_id, fy, status, version, data jsonb, updated_by, updated_at)`: `data` is today's `CaseFile` minus binaries
- `documents(id, firm_id, case_id, name, kind, blob_key, sha256, size, created_at)`: files in private blob storage
- `audit_events(id, firm_id, case_id, actor_member_id, actor_kind, action, detail, at)`: insert-only
- `corrections(id, firm_id, case_id, document_id, sha256, field, extractor, original_value, corrected_value, action, quote, member_id, at)`: M2

**API (new):** `GET/POST /api/clients`, `GET/PUT /api/cases/:id` (PUT carries `version`), `POST /api/cases/:id/documents` (upload), `GET /api/cases/:id/audit`, `GET/POST /api/firm/members`, and for M2 `GET /api/firm/evals`. All of them return 401 without a session, 404 (not 403) for another firm's resources, and 409 on a version conflict.

**Client state:** `CaseContext` keeps its reducer. Persistence moves from `localStorage` to the API behind a storage adapter, with `localStorage` remaining the adapter for demo mode.

## NON-GOALS

- Billing, plans, usage limits.
- Cross-firm learning or shared eval sets.
- Real-time co-editing (version conflicts are enough for the pilot).
- SSO / SAML (email or OAuth sign-in only).
- Changes to tax rules (that is PRD M3).

## OPEN QUESTIONS

1. Database and auth providers (Vercel Marketplace). Blocks M1 Task 1.
2. PAN field-level encryption vs encryption at rest. Blocks the `clients` schema finalisation.
3. Preparer visibility: all firm clients, or only assigned ones? Affects every query. Default proposal: all clients, which is simpler, revisited after interviews.
4. Retention period and the delete-on-request flow (DPDP). Needed before the pilot, not before coding.

## HANDOFF

**Needs architecture review first** on open questions 1–2, then ready for implementation via `.claude/plans/practice-workspace.plan.md` (ECC `tdd-workflow` → `verification-loop` → `/pr`).
