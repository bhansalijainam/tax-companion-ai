# ADR 0002: Where client-uploaded files live

Status: accepted (M3, v0.5.0)

## Context
Clients upload Form 16s, statements and certificates through a private link. The files must stay with one firm and one client, never mix, be deletable on request (DPDP), and work on the current deployment without new vendors. Vercel functions accept at most 4.5 MB per request.

## Options
1. **Postgres `bytea`** in the database we already run, scoped by `firm_id` and `case_id` like every other row.
2. **Vercel Blob (private)**: cheaper per GB, but a new store to provision and secure. In v0.3 `@vercel/blob` pulled in audit findings, so it was removed.
3. **Client's or firm's Google Drive**: familiar to CAs, but tokens per firm, weaker auditing, and isolation would depend on folder permissions we don't control.

## Decision
Option 1 for now. Files are capped at 4 MB, 40 per link and 60 MB per link. They live in `case_files`, are read only through the firm-scoped repo, and are deleted with their document or case.

## Consequences
- One security boundary: the same firm filter and the same isolation tests cover files.
- Database size grows with files. At about 20 files × 1 MB per client, 100 clients is about 2 GB, fine for Neon and Supabase paid tiers. Move to private Blob (option 2) behind the same repo methods when a firm passes that. The `case_files` row keeps its metadata and gets a `blob_key` instead of `content`.
- Google Drive becomes an export, not the system of record.
