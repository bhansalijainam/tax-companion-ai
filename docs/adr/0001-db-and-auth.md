# ADR 0001: Database and sign-in for the practice workspace

**Status:** Accepted (code complete; production provisioning pending Vercel team access)
**Date:** 2026-11-26
**Context:** PRD milestone 1, `.claude/prds/ca-firm-practice.prd.md`; capability contract `docs/product/capabilities/practice-workspace.md`

## Decision

- **Database: Postgres, provisioned as Neon through the Vercel Marketplace.** This is the preferred storage path for Vercel projects: provisioning sets `DATABASE_URL` on the project. The code uses the standard `pg` driver and plain SQL, so nothing is tied to Neon. Local development and CI use stock Postgres 16.
- **Sign-in: Better Auth**, self-hosted in our own handlers, with users, sessions, firms (organizations), members and invitations in the same Postgres. Its organization plugin provides firms, roles and invitations.
- **Documents: Vercel Blob (private)**, deferred until the store can be provisioned (see the M1 plan, Task 7).

## Why not the alternatives

| Option | Why not (for now) |
|---|---|
| Clerk (native Marketplace) | Its SDKs and examples are centred on Next.js, while this app is a Vite SPA with Web-standard handlers. It would also put client-firm identities with another processor, which adds a party to the DPDP review. A good choice if the app moves to Next.js. |
| Supabase (DB + auth) | Couples storage and auth to one vendor's client. Our repo layer and isolation tests would need its row-level-security model instead of one audited module. |
| Hand-written auth | Password hashing, sessions, CSRF and invitations are solved problems. Writing them ourselves would be the riskiest code in the product. |

## Consequences

- One trust boundary is easy to audit: `server/auth.ts` resolves session → member → firm, and `server/db/repo.ts` is the only module that queries workspace tables, with the firm as a required first argument.
- Tenant isolation, version conflicts, the append-only audit trail and role rules are tested against real Postgres in CI (`server/**/*.test.ts`).
- Required production env: `DATABASE_URL` (from the Neon integration), `BETTER_AUTH_SECRET` (32+ characters; the app refuses to start auth without it in production), and `BETTER_AUTH_URL` (production domain only; leave unset on previews).
- Session cookie caching is off, so the active firm is read fresh each request. Revisit for performance once the pilot shows real load.
- Invitations are shared as links. No email provider is integrated yet; adding one is a Marketplace `messaging` integration.
