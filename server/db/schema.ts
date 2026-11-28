/** Practice workspace schema (idempotent). Applied by migrate.ts. */
export const SCHEMA_SQL = `
-- Practice workspace schema. Idempotent: safe to run on every deploy.
-- Firms, users, sessions, members and invitations are Better Auth tables
-- (organization plugin); firm_id below is Better Auth's organization id.

create extension if not exists pgcrypto;

-- Every statement below checks the catalog before changing anything, so re-running
-- this on a live database (each deploy) takes no locks that block reads or writes.
-- "create index if not exists" and "alter table ... if not exists" lock the table
-- even when there is nothing to do, which deadlocked with concurrent saves.
create or replace function pg_temp.ensure_index(name text, ddl text) returns void as $$
begin
  if to_regclass(name) is null then execute ddl; end if;
end;
$$ language plpgsql;

create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  firm_id     text not null,
  name        text not null check (length(name) between 1 and 200),
  pan         text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  created_by  text not null,
  created_at  timestamptz not null default now()
);
select pg_temp.ensure_index('clients_firm_idx', $ddl$create index clients_firm_idx on clients (firm_id, created_at desc)$ddl$);

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
select pg_temp.ensure_index('cases_firm_idx', $ddl$create index cases_firm_idx on cases (firm_id, updated_at desc)$ddl$);
-- Checklist summary (src/domain/checklist.ts), recomputed on every save so the
-- dashboard never loads full case documents. Null on rows saved before M2.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'cases' and column_name = 'summary') then
    alter table cases add column summary jsonb;
  end if;
end $$;

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
select pg_temp.ensure_index('audit_case_idx', $ddl$create index audit_case_idx on audit_events (case_id, id)$ddl$);
-- 'client' (M3): uploads through a client link
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'audit_events_actor_kind_check'
                  and conrelid = 'audit_events'::regclass
                  and pg_get_constraintdef(oid) like '%client%') then
    alter table audit_events drop constraint if exists audit_events_actor_kind_check;
    alter table audit_events add constraint audit_events_actor_kind_check check (actor_kind in ('ca', 'ai', 'system', 'client'));
  end if;
end $$;

-- Client upload links (M3). Only a SHA-256 of the token is stored, so a database
-- read can't be turned into working links. A link writes to exactly one case.
create table if not exists upload_links (
  id          uuid primary key default gen_random_uuid(),
  firm_id     text not null,
  case_id     uuid not null references cases(id) on delete cascade,
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by  text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  file_count  integer not null default 0,
  byte_count  bigint not null default 0
);
select pg_temp.ensure_index('upload_links_case_idx', $ddl$create index upload_links_case_idx on upload_links (case_id, created_at desc)$ddl$);

-- Files clients upload, kept per firm and case. The case document holds only metadata.
create table if not exists case_files (
  id              uuid primary key default gen_random_uuid(),
  firm_id         text not null,
  case_id         uuid not null references cases(id) on delete cascade,
  doc_id          text not null,
  name            text not null check (length(name) between 1 and 300),
  mime_type       text not null,
  size            integer not null check (size > 0 and size <= 4000000),
  sha256          text not null,
  content         bytea not null,
  upload_link_id  uuid references upload_links(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (case_id, doc_id)
);
select pg_temp.ensure_index('case_files_case_idx', $ddl$create index case_files_case_idx on case_files (firm_id, case_id)$ddl$);

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

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'audit_events_no_update' and tgrelid = 'audit_events'::regclass) then
    create trigger audit_events_no_update before update or delete on audit_events
      for each row execute function audit_events_append_only();
  end if;
end $$;
`;
