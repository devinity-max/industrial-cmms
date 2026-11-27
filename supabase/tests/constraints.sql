-- Isolated fixture project only. Fail loudly if a constraint or policy is missing.
begin;
do $$
declare a cmms.assets;
begin
  select * into strict a from cmms.assets where machine_number = 'DEMO-ROB-001';
  begin
    insert into cmms.assets(plant_id,department_id,name,machine_number)
    values(a.plant_id,a.department_id,a.name,a.machine_number);
    raise exception 'Duplicate machine accepted';
  exception when unique_violation then null; end;
  begin
    insert into cmms.assets(plant_id,department_id,name,machine_number,qr_token)
    values(a.plant_id,a.department_id,a.name,'TEST-DUPLICATE',a.qr_token);
    raise exception 'Duplicate QR accepted';
  exception when unique_violation then null; end;
  begin
    update cmms.assets set qr_token = gen_random_uuid() where id = a.id;
  exception when raise_exception then
    if sqlerrm <> 'Asset identity is permanent' then raise; end if;
  end;
  if not exists(select from cmms.assets where id=a.id and qr_token=a.qr_token) then
    raise exception 'QR changed';
  end if;
end $$;

-- Put an equal-timestamp group across the page boundary. The smallest UUID
-- has the latest time so ordering only by UUID also fails this check.
insert into cmms.history(id,asset_id,kind,occurred_at,summary,actor_display,version)
select ('40000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  '20000000-0000-4000-8000-000000000001','test',
  case when n = 1 then timestamptz '2100-01-02 UTC' else timestamptz '2100-01-01 UTC' end,
  'Synthetic history ' || n,'Fixture',1
from generate_series(1,27) n;

select set_config('request.jwt.claim.sub', (select id::text from auth.users
  where email='m1-viewer@example.invalid'), true);
set local role authenticated;
do $$
declare
  asset constant uuid := '20000000-0000-4000-8000-000000000001';
  first_page jsonb := public.m1_history(asset);
  last_page jsonb := public.m1_history(asset, first_page->>'nextCursor');
  expected jsonb;
  actual jsonb;
begin
  select jsonb_agg(id order by occurred_at desc,id desc) into expected from cmms.history where asset_id=asset;
  select jsonb_agg(item->'id' order by pos) into actual from
    jsonb_array_elements((first_page->'items') || (last_page->'items')) with ordinality r(item,pos);
  if actual is distinct from expected or jsonb_array_length(first_page->'items') <> 25
     or first_page->>'nextCursor' is null or last_page->>'nextCursor' is not null then
    raise exception 'Chronological history continuation mismatch';
  end if;
end $$;
do $$
begin
  if (select count(*) from cmms.assets) <> 11 then raise exception 'Viewer scope mismatch'; end if;
  if exists (
    select from pg_catalog.pg_tables t
    cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) as p(privilege)
    where t.schemaname = 'cmms'
      and has_table_privilege(current_user, format('%I.%I',t.schemaname,t.tablename),p.privilege)
  ) then raise exception 'Unexpected application write grant'; end if;
  begin
    update cmms.assets set display_status='test';
    raise exception 'Viewer mutation allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update cmms.profiles set enabled=false where user_id=auth.uid();
set local role authenticated;
do $$
begin
  if exists(select from cmms.assets) or exists(select from cmms.history) then
    raise exception 'Disabled identity retained access';
  end if;
  begin
    perform public.m1_assets();
    raise exception 'Disabled identity accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
