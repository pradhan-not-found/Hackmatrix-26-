-- Run once in the project's SQL editor, or apply with supabase db push.
begin;

create table if not exists public.investigations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  report jsonb not null check (jsonb_typeof(report) = 'object' and report ? 'id' and report->>'id' = id::text),
  created_at timestamptz not null default now(),
  submitted_url text generated always as (report->>'submitted_url') stored,
  normalized_url text generated always as (report->>'normalized_url') stored,
  risk_classification text generated always as (report->>'risk_classification') stored,
  status text generated always as (report->>'status') stored
);
create index if not exists investigations_owner_created_idx on public.investigations (user_id, created_at desc, id desc);
alter table public.investigations enable row level security;
revoke all on public.investigations from anon;
grant select, insert, update, delete on public.investigations to authenticated;
drop policy if exists investigations_select_own on public.investigations;
create policy investigations_select_own on public.investigations for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists investigations_insert_own on public.investigations;
create policy investigations_insert_own on public.investigations for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists investigations_update_own on public.investigations;
create policy investigations_update_own on public.investigations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists investigations_delete_own on public.investigations;
create policy investigations_delete_own on public.investigations for delete to authenticated using ((select auth.uid()) = user_id);

-- Profile pictures are public; only their owner may write their folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists avatars_read_own on storage.objects;
create policy avatars_read_own on storage.objects for select to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
