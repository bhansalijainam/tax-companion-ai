/** Practice workspace schema (idempotent). Applied by migrate.ts. */
export const SCHEMA_SQL = `
-- Practice workspace schema. Idempotent: safe to run on every deploy.
-- Firms, users, sessions, members and invitations are Better Auth tables
-- (organization plugin); firm_id below is Better Auth's organization id.

create extension if not exists pgcrypto;

create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  firm_id     text not null,
  name        text not null check (length(name) between 1 and 200),
  pan         text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  created_by  text not null,
  created_at  timestamptz not null default now()
);
create index if not exists clients_firm_idx on clients (firm_id, created_at desc);

create table if not exists cases (
  id          uuid primary key default gen_random_uuid(),
  firm_id     text not null,
  client_id   uuid not null references clients(id) on delete cascade,
  fy          text not null check (fy ~ '^[0-9]{4}-[0-9]{2}$'),
  status      text not null default 'draft' check (status in ('draft', 'in_review', 'final')),
  version     integer not null default 1,
  data        jsonb not null,
  updated_by  text not null,
  updated_at  timestamptz not null default now(),
  unique (client_id, fy)
);
create index if not exists cases_firm_idx on cases (firm_id, updated_at desc);
-- Checklist summary (src/domain/checklist.ts), recomputed on every save so the
-- dashboard never loads full case documents. Null on rows saved before M2.
alter table cases add column if not exists summary jsonb;

create table if not exists audit_events (
  id             bigserial primary key,
  firm_id        text not null,
  case_id        uuid not null references cases(id) on delete cascade,
  actor_user_id  text,
  actor_kind     text not null check (actor_kind in ('ca', 'ai', 'system')),
  action         text not null,
  detail         text not null default '',
  at             timestamptz not null default now()
);
create index if not exists audit_case_idx on audit_events (case_id, id);

-- Append-only: the audit trail can be written but never rewritten.
-- (Rows still go away with their case on delete cascade, which is the
-- data-retention path; ordinary UPDATE/DELETE statements are refused.)
create or replace function audit_events_append_only() returns trigger as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old; -- cascade from deleting the case (retention / client deletion request)
  end if;
  raise exception 'audit_events is append-only';
end;
$$ language plpgsql;

drop trigger if exists audit_events_no_update on audit_events;
create trigger audit_events_no_update before update or delete on audit_events
  for each row execute function audit_events_append_only();
`;
