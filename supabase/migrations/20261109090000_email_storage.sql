-- Run once in the project's SQL editor, or apply with supabase db push.
-- Stores email history and Gmail connections for deployments without a durable disk.
begin;

create table if not exists public.email_analyses (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  report jsonb not null check (jsonb_typeof(report) = 'object' and report ? 'id' and report->>'id' = id::text),
  created_at timestamptz not null default now()
);
create index if not exists email_analyses_owner_created_idx on public.email_analyses (user_id, created_at desc, id desc);
alter table public.email_analyses enable row level security;
revoke all on public.email_analyses from anon;
grant select, insert, delete on public.email_analyses to authenticated;
drop policy if exists email_analyses_select_own on public.email_analyses;
create policy email_analyses_select_own on public.email_analyses for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists email_analyses_insert_own on public.email_analyses;
create policy email_analyses_insert_own on public.email_analyses for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists email_analyses_delete_own on public.email_analyses;
create policy email_analyses_delete_own on public.email_analyses for delete to authenticated using ((select auth.uid()) = user_id);

-- Tokens are encrypted by the backend before they reach this table.
create table if not exists public.gmail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  email text not null,
  tokens text not null,
  connected_at timestamptz not null default now()
);
alter table public.gmail_connections enable row level security;
revoke all on public.gmail_connections from anon;
grant select, insert, update, delete on public.gmail_connections to authenticated;
drop policy if exists gmail_connections_select_own on public.gmail_connections;
create policy gmail_connections_select_own on public.gmail_connections for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists gmail_connections_insert_own on public.gmail_connections;
create policy gmail_connections_insert_own on public.gmail_connections for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists gmail_connections_update_own on public.gmail_connections;
create policy gmail_connections_update_own on public.gmail_connections for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists gmail_connections_delete_own on public.gmail_connections;
create policy gmail_connections_delete_own on public.gmail_connections for delete to authenticated using ((select auth.uid()) = user_id);

commit;
