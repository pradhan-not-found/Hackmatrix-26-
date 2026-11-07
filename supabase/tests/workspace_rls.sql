-- Transactional live RLS smoke test. All fixture users and reports are rolled back.
begin;
select set_config('wa_test.owner_a', gen_random_uuid()::text, true);
select set_config('wa_test.owner_b', gen_random_uuid()::text, true);
select set_config('wa_test.report_a', gen_random_uuid()::text, true);
select set_config('wa_test.report_b', gen_random_uuid()::text, true);
select set_config('wa_test.cross_report', gen_random_uuid()::text, true);
insert into auth.users (id, aud, role)
values (current_setting('wa_test.owner_a')::uuid, 'authenticated', 'authenticated'),
       (current_setting('wa_test.owner_b')::uuid, 'authenticated', 'authenticated');
insert into public.investigations (id, user_id, report)
values (current_setting('wa_test.report_b')::uuid, current_setting('wa_test.owner_b')::uuid,
        jsonb_build_object('id', current_setting('wa_test.report_b'), 'status', 'completed'));
do $$
begin
  if has_table_privilege('anon', 'public.investigations', 'SELECT') then
    raise exception 'Anonymous users must not have report read privileges';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('wa_test.owner_a'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('wa_test.owner_a'),'role','authenticated')::text, true);
insert into public.investigations (id, report)
values (current_setting('wa_test.report_a')::uuid,
        jsonb_build_object('id', current_setting('wa_test.report_a'), 'status', 'completed'));
do $$
declare affected integer;
begin
  if (select count(*) from public.investigations where id = current_setting('wa_test.report_a')::uuid) <> 1 then
    raise exception 'Owner cannot read their own report';
  end if;
  if exists (select 1 from public.investigations where id = current_setting('wa_test.report_b')::uuid) then
    raise exception 'Cross-account read leaked a report';
  end if;
  update public.investigations set report = jsonb_set(report, '{status}', '"updated"')
    where id = current_setting('wa_test.report_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner update failed'; end if;
  update public.investigations set report = jsonb_set(report, '{status}', '"changed"')
    where id = current_setting('wa_test.report_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-account update was allowed'; end if;
  delete from public.investigations where id = current_setting('wa_test.report_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-account delete was allowed'; end if;
  begin
    insert into public.investigations (id, user_id, report)
    values (current_setting('wa_test.cross_report')::uuid, current_setting('wa_test.owner_b')::uuid,
      jsonb_build_object('id', current_setting('wa_test.cross_report')));
    raise exception 'Cross-account insert was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.investigations set user_id = current_setting('wa_test.owner_b')::uuid
      where id = current_setting('wa_test.report_a')::uuid;
    raise exception 'Owner reassignment was allowed';
  exception when insufficient_privilege then null;
  end;
  update public.profiles set full_name = 'RLS fixture' where id = current_setting('wa_test.owner_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Own profile update or trigger failed'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('wa_test.owner_b'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('wa_test.owner_b'),'role','authenticated')::text, true);
do $$
begin
  if not exists (select 1 from public.investigations where id = current_setting('wa_test.report_b')::uuid) then
    raise exception 'Second owner cannot read their own report';
  end if;
  if exists (select 1 from public.investigations where id = current_setting('wa_test.report_a')::uuid) then
    raise exception 'Second owner can read the first owner report';
  end if;
end $$;
rollback;
select 'passed: own reads/writes, cross-account denial, profile triggers, anonymous denial; all fixtures rolled back' as result;
