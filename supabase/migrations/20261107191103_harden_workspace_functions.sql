-- These trigger functions are invoked by existing triggers, not by REST clients.
alter function public.set_updated_at() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Evaluate the current identity once per statement without changing ownership rules.
alter policy profiles_select_own on public.profiles using (id = (select auth.uid()));
alter policy profiles_update_own on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
