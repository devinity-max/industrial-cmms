-- Prepared for a future approved disposable database with the M1 synthetic fixtures.
-- Execute as one transaction with stop-on-error. Do not run against cmms-dev at M2-A.
begin;
insert into cmms.daily_obligations(id, asset_id, operational_date) values
  ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-11-28'),
  ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','2026-11-28');

-- Resolve the current synthetic identities before assuming the application role.
do $$
declare label text; identity_id uuid;
begin
  foreach label in array array['machine','admin','viewer','south'] loop
    select id into strict identity_id from auth.users where email = 'm1-' || label || '@example.invalid';
    perform set_config('test.' || label, identity_id::text, true);
  end loop;
  if has_function_privilege('anon', 'public.m2_submit_daily(uuid,integer,uuid,jsonb,text)', 'execute') or
     has_function_privilege('anon', 'public.m2_daily_obligation(uuid,text,text)', 'execute') or
     has_function_privilege('anon', 'public.m2_daily_revision(uuid,integer)', 'execute') then
    raise exception 'Anonymous ledger function grant';
  end if;
end $$;

set local role authenticated;
do $$
declare
  first_slot constant uuid := '50000000-0000-4000-8000-000000000001';
  second_slot constant uuid := '50000000-0000-4000-8000-000000000002';
  machine_id constant uuid := '20000000-0000-4000-8000-000000000001';
  entries constant jsonb := '[{"category":"Inspection","machineCondition":"Observed","observation":"Synthetic entry","action":null}]';
  request_id uuid := gen_random_uuid();
  first_receipt jsonb;
  corrected jsonb;
  daily jsonb;
  prior_events bigint;
  target text;
  privilege text;
begin
  foreach target in array array['cmms.daily_obligations','cmms.daily_revisions','cmms.history'] loop
    foreach privilege in array array['INSERT','UPDATE','DELETE','TRUNCATE'] loop
      if has_table_privilege(current_user, target, privilege) then raise exception 'Unexpected direct write grant'; end if;
    end loop;
  end loop;
  perform set_config('request.jwt.claim.sub', current_setting('test.machine'), true);
  select count(*) into prior_events from cmms.history where asset_id = machine_id;
  daily := public.m2_daily_obligation(machine_id, '2026-11-28', '')->'obligation';
  if daily->>'state' is distinct from 'open' or daily->>'version' is distinct from '0' then
    raise exception 'Expected open fixture';
  end if;
  if public.m2_daily_obligation(machine_id, '2026-11-29', '') is distinct from '{"obligation":null}'::jsonb then
    raise exception 'Unexpected obligation for unconfigured date';
  end if;
  begin
    perform public.m2_submit_daily(second_slot, 0, request_id, entries);
    raise exception 'Wrong machine accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.m2_submit_daily(first_slot, 0, request_id, '[]');
    raise exception 'Invalid submission accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.m2_submit_daily(first_slot, 0, request_id,
      jsonb_build_array((entries->0) || jsonb_build_object('submittedBy', current_setting('test.admin'))));
    raise exception 'Unexpected author input accepted';
  exception when invalid_parameter_value then null; end;
  first_receipt := public.m2_submit_daily(first_slot, 0, request_id, entries);
  if first_receipt->>'submittedBy' is distinct from current_setting('test.machine') or
     first_receipt->>'version' is distinct from '1' then raise exception 'Unexpected first receipt'; end if;
  begin
    perform public.m2_submit_daily(first_slot, 0, request_id, entries || entries);
    raise exception 'Changed retry accepted';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.m2_submit_daily(first_slot, 0, gen_random_uuid(), entries);
    raise exception 'Stale competing write accepted';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.m2_submit_daily(first_slot, 1, gen_random_uuid(), entries);
    raise exception 'Correction without reason accepted';
  exception when invalid_parameter_value then null; end;
  perform set_config('request.jwt.claim.sub', current_setting('test.admin'), true);
  corrected := public.m2_submit_daily(first_slot, 1, gen_random_uuid(), entries || entries, 'Added synthetic activity');
  if corrected->>'version' is distinct from '2' or corrected->>'submittedBy' is distinct from current_setting('test.admin') then
    raise exception 'Expected attributable plant-admin correction';
  end if;
  perform set_config('request.jwt.claim.sub', current_setting('test.machine'), true);
  if public.m2_submit_daily(first_slot, 0, request_id, entries) is distinct from first_receipt then
    raise exception 'Retry did not recover original receipt';
  end if;
  perform set_config('request.jwt.claim.sub', current_setting('test.viewer'), true);
  daily := public.m2_daily_obligation(machine_id, '2026-11-28', '')->'obligation';
  if daily->>'state' is distinct from 'submitted' or daily->'current'->>'id' is distinct from (corrected->>'id') or
     public.m2_daily_revision(first_slot, 1)->'activities' is distinct from entries or
     (select count(*) from cmms.daily_revisions where obligation_id = first_slot) <> 2 or
     (select count(*) from cmms.history where asset_id = machine_id) <> prior_events + 2 or
     (select count(*) from cmms.history where id in ((first_receipt->>'id')::uuid,(corrected->>'id')::uuid)
       and kind = 'daily_maintenance' and asset_id = machine_id) <> 2 then
    raise exception 'Expected current ledger, audit snapshots and machine history';
  end if;
  begin
    perform public.m2_submit_daily(first_slot, 2, gen_random_uuid(), entries, 'Viewer correction');
    raise exception 'Viewer write accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', current_setting('test.south'), true);
  begin
    perform public.m2_daily_obligation(machine_id, '2026-11-28', '');
    raise exception 'Cross-plant daily read accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.m2_daily_revision(first_slot, 1);
    raise exception 'Cross-plant revision read accepted';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
update cmms.profiles set enabled = false where user_id = current_setting('test.machine')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.machine'), true);
do $$
begin
  if exists(select from cmms.daily_revisions) then raise exception 'Disabled reader retained scope'; end if;
  begin
    perform public.m2_submit_daily('50000000-0000-4000-8000-000000000001', 2, gen_random_uuid(), '[]', 'Test');
    raise exception 'Disabled writer accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
