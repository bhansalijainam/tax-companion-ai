# Plan: Practice Workspace

**Source PRD**: `.claude/prds/ca-firm-practice.prd.md`
**Selected Milestone**: 1 — Practice workspace
**Capability contract**: `docs/product/capabilities/practice-workspace.md`
**Complexity**: Large

## Summary

Add firm accounts, a client list, and server-persisted case files with an append-only audit trail, so a firm can run many clients across many members. The current single-case, browser-only app becomes the "demo" storage adapter. Signed-in firms use an API-backed adapter. The engine, AI layer and views stay as they are; they already take a `CaseFile` and return one.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| HTTP handlers | `server/handlers.ts:94`, `:112`, `:133` | One `handleX(req: Request): Promise<Response>` per route, Web Fetch API, shared by `api/*.ts` (Vercel) and the Vite dev middleware |
| Request validation | `server/handlers.ts:126` | A zod schema per body, `.parse()` inside try, `ZodError` → 400 |
| Errors | `server/handlers.ts:83` | `errorResponse()` maps typed errors to status codes; clients get generic messages; detail goes to `console.error` only |
| Access control | `server/handlers.ts:66` | `guard(req)` runs first in each handler and returns a `Response` to short-circuit. Extend it to resolve the session → member → firm |
| State | `src/state/CaseContext.tsx:33`, `:62`, `:70` | Pure reducer of named actions; every action appends an `AuditEvent` |
| Persistence | `src/state/CaseContext.tsx:90`, `:92`, `:133` | Storage in try/catch, degrades silently. Becomes the `LocalCaseStore` adapter |
| Domain types | `src/domain/types.ts:46`, `:92`, `:99` | `Fact`, `AuditEvent`, `CaseFile` are the persisted shape; no new shape for the case body |
| Tests | `src/ai/agent/agent.test.ts:12` | vitest, `describe` per unit, co-located `*.test.ts`; server wiring proven by `scripts/smoke-live-mock.ts` with `node:assert` |
| Eval data | `evals/datasets/extraction.ts:18`, `evals/score.ts:27` | `ExtractionCase` + `scoreCase()`. M2 corrections must convert to this shape |

## Files to Change

| File | Action | Why |
|---|---|---|
| `server/db/schema.sql` | CREATE | Tables from the capability contract (firms, members, clients, cases, documents, audit_events) |
| `server/db/migrate.ts` | CREATE | Idempotent migration runner (`npm run db:migrate`) |
| `server/db/repo.ts` | CREATE | The only data-access module. Every function takes `firmId` as its first argument |
| `server/auth.ts` | CREATE | Verify session token → `{ memberId, firmId, role }`. Provider-specific code lives only here |
| `server/handlers.ts` | UPDATE | `guard()` resolves the member; LLM routes require it in hosted mode; keep `ACCESS_TOKEN` path for self-hosted demo |
| `server/routes/clients.ts`, `server/routes/cases.ts`, `server/routes/members.ts` | CREATE | Handlers for the new API, same shape as existing handlers |
| `api/clients.ts`, `api/cases/[id].ts`, `api/firm/members.ts` | CREATE | Vercel entry points (thin wrappers) |
| `vite.config.ts` | UPDATE | Dev middleware routes the new paths |
| `src/state/caseStore.ts` | CREATE | `CaseStore` interface; `LocalCaseStore` (demo) + `ApiCaseStore` (version-checked save, debounced) |
| `src/state/CaseContext.tsx` | UPDATE | Load/save through `CaseStore`; surface "saved / saving / conflict" status |
| `src/pages/Clients.tsx` | CREATE | Client list + create client + open case |
| `src/App.tsx` | UPDATE | Routes: `/` demo (unchanged), `/app` signed-in clients list, `/app/cases/:id` workspace |
| `server/db/repo.test.ts` | CREATE | Isolation and concurrency tests against a test database |
| `scripts/smoke-live-mock.ts` | UPDATE | Assert 401 without a session, 404 across firms, 409 on a stale version |
| `docs/fde/04-security-privacy.md`, `README.md`, `CHANGELOG.md` | UPDATE | New trust boundary, setup, env vars |

## Tasks

### Task 1: Provision database and auth (decision + setup)
- **Action**: Choose a Postgres provider and an auth provider from the Vercel Marketplace (capability open question 1). Provision both on the project; pull env vars locally. Record the choice in an ADR (`docs/adr/0001-db-and-auth.md`).
- **Mirror**: Keys stay server-side, as `ANTHROPIC_API_KEY` does today (`server/handlers.ts:20`).
- **Validate**: `npm run db:migrate` against the provisioned database succeeds twice in a row (idempotent).

### Task 2: Schema + repository with firm scoping (test-first)
- **Action**: Write `repo.test.ts` first. A member of firm A cannot read, list or update firm B's client or case. A case update with a stale version throws a conflict. Audit inserts succeed and no update/delete path exists. Then implement `schema.sql` and `repo.ts`.
- **Mirror**: Co-located vitest suites; explicit expected values (`src/engine/compute.test.ts` style).
- **Validate**: `npm test -- server/db` green; tests fail if the `firm_id` predicate is removed from any query.

### Task 3: Auth guard + session resolution
- **Action**: `server/auth.ts` verifies the provider token and maps it to a `members` row. Extend `guard()` to return `{ member }` or a 401. First sign-in with no firm creates a firm and makes that user its partner.
- **Mirror**: `guard()` short-circuit pattern; generic client errors (`server/handlers.ts:83`).
- **Validate**: Smoke test: 401 without a token; 200 with a valid test token.

### Task 4: Clients and cases API
- **Action**: Implement the routes from the capability contract. `PUT /api/cases/:id` takes `{ version, data }`, validates `data` against a zod `CaseFile` schema, and writes an audit event in the same transaction. Return 404 for another firm's resources and 409 on version mismatch.
- **Mirror**: zod body schemas (`server/handlers.ts:126`), `errorResponse()` mapping.
- **Validate**: Smoke-test assertions for 401/404/409. `npm run typecheck`.

### Task 5: CaseStore adapters
- **Action**: Extract persistence from `CaseContext` into `CaseStore`. `LocalCaseStore` reproduces today's behaviour exactly. `ApiCaseStore` loads by id and saves with debounce and version. On 409 it shows "Someone else changed this case" with reload, and never overwrites.
- **Mirror**: Reducer unchanged (`src/state/CaseContext.tsx:33`); try/catch storage (`:133`).
- **Validate**: Existing 61 tests still pass unchanged (demo path untouched). A new test covers the conflict branch with a fake store.

### Task 6: Client list + routing + roles
- **Action**: `/app` client list (search, status, FY, create client), `/app/cases/:id` reusing `Index.tsx` with the API store, and a sign-in screen. A "Mark final" action is visible to partners only and enforced on the server.
- **Mirror**: Existing view components and tokens (`src/components/common.tsx`); hash routing kept for the demo.
- **Validate**: Playwright run: sign in, create a client, open the case, edit a fact, reload, and the edit persists. A second browser context with another firm sees nothing.

### Task 7: Documents to private blob storage
- **Action**: Uploads go to private blob storage keyed by firm/case; the `documents` row stores the hash. Extraction reads from storage server-side, so binaries never travel through the case JSON again.
- **Mirror**: The upload/extract flow in `CaseContext.uploadFiles`; body-size limits in `server/handlers.ts`.
- **Validate**: Upload a PDF, reload, re-extract works; another firm's member gets 404 on the blob route.

### Task 8: Verification + docs
- **Action**: Run ECC `verification-loop` (build, types, lint, tests with coverage, security grep, diff review) and `security-review` on the tenant boundary. Update the security doc, README setup, env example and CHANGELOG.
- **Validate**: CI green; isolation tests and smoke assertions included in CI.

## Validation

```bash
npm run typecheck && npm run lint && npm test
```

```bash
npm run db:migrate && npm run smoke:live && npm run evals && npm run build
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A query forgets the firm scope | Medium | Single repo module with `firmId` as a required first argument; tests that fail when the predicate is removed; no raw queries in handlers |
| Auth provider SDK assumes Next.js | Medium | Keep provider code in `server/auth.ts` behind one function. The app is a Vite SPA plus Web-standard handlers, so choose a provider with a framework-agnostic token-verification API |
| Demo mode regresses | Low | `LocalCaseStore` reproduces today's behaviour; the existing 61 tests and the browser QA script run unchanged |
| Autosave races cause silent data loss | Medium | Version check on every save; conflicts shown to the user, never auto-merged |
| Scope creep into M2 (flywheel) | Medium | M1 only stores audit events; the `corrections` table and firm eval page belong to M2 |

## Acceptance

- [ ] Two firms in the same deployment cannot see each other's clients, cases, documents or audit events (automated test + manual check)
- [ ] A case edited by one member is visible to another member after reload; concurrent edits produce a conflict, not data loss
- [ ] Only partners can finalise; finalised cases are read-only until reopened (audited)
- [ ] Public demo at `/` works exactly as before with no sign-in
- [ ] All tasks complete; validation passes; patterns mirrored, not reinvented

**WAITING FOR CONFIRMATION**: proceed with this plan? (yes / modify / different approach)
