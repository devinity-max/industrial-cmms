create function public.m1_user() returns uuid
language plpgsql stable security invoker set search_path = '' as $$
declare subject uuid;
begin
  select user_id into subject from cmms.profiles;
  if subject is null then raise sqlstate '42501' using message = 'Access denied'; end if;
  return subject;
end $$;

create function cmms.summary(a cmms.assets, department text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'qrToken', a.qr_token, 'machineNumber', a.machine_number, 'name', a.name,
    'department', department, 'displayStatus', a.display_status)
$$;

create function public.m1_asset(token uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare detail jsonb;
begin
  perform public.m1_user();
  select cmms.summary(a,d.name) || jsonb_build_object('capabilities',
    jsonb_build_object('canManageAsset', exists (select from cmms.memberships m
      where m.role = 'admin' and (m.asset_id = a.id or m.plant_id = a.plant_id))))
  into detail from cmms.assets a join cmms.departments d on d.id = a.department_id
  where a.qr_token = token;
  if detail is null then raise sqlstate '42501' using message = 'Access denied'; end if;
  return detail;
end $$;

-- Bind the opaque bookmark to a random row nonce plus caller and query.
create function cmms.bookmark(nonce uuid, subject uuid, query jsonb) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(jsonb_build_array(nonce,subject,query)::text,'UTF8')),'hex')
$$;

create function public.m1_assets(page_size integer default 25, filter text default '', bookmark text default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  subject uuid := public.m1_user();
  query jsonb := jsonb_build_array('assets',filter,page_size);
  after_id uuid;
  result jsonb;
begin
  if page_size is null or page_size not in (10,25,50) or filter is null or length(filter) > 128 then
    raise sqlstate '22023' using message = 'Invalid query';
  end if;
  if bookmark is not null and bookmark !~ '^[0-9a-f]{64}$' then
    raise sqlstate '22023' using message = 'Invalid cursor';
  end if;
  if bookmark is not null then
    select a.id into after_id from cmms.assets a join cmms.departments d on d.id = a.department_id where (strpos(lower(a.machine_number),lower(filter)) > 0 or strpos(lower(a.name),lower(filter)) > 0)
      and cmms.bookmark(a.page_nonce,subject,query) = bookmark;
    if after_id is null then raise sqlstate '22023' using message = 'Invalid cursor'; end if;
  end if;
  with page as (
    select a.id, cmms.summary(a,d.name) as item, cmms.bookmark(a.page_nonce,subject,query) as cursor
    from cmms.assets a join cmms.departments d on d.id = a.department_id where (strpos(lower(a.machine_number),lower(filter)) > 0 or strpos(lower(a.name),lower(filter)) > 0) and (after_id is null or a.id > after_id)
    order by a.id limit page_size + 1
  ), numbered as (select *, row_number() over (order by id) as n from page)
  select jsonb_build_object('items', coalesce(jsonb_agg(item order by id) filter (where n <= page_size), '[]'::jsonb),
    'nextCursor', case when count(*) > page_size then max(cursor) filter (where n = page_size) end)
  into result from numbered;
  return result;
end $$;

create function public.m1_history(asset uuid, bookmark text default null) returns jsonb
language plpgsql stable security invoker set search_path = '' set timezone = 'UTC' as $$
declare
  subject uuid := public.m1_user();
  query jsonb := jsonb_build_array('history',asset);
  after_id uuid;
  after_time timestamptz;
  result jsonb;
begin
  if not exists (select from cmms.assets where id = asset) then
    raise sqlstate '42501' using message = 'Access denied';
  end if;
  if bookmark is not null and bookmark !~ '^[0-9a-f]{64}$' then
    raise sqlstate '22023' using message = 'Invalid cursor';
  end if;
  if bookmark is not null then
    select a.occurred_at,a.id into after_time,after_id from cmms.history a where a.asset_id = asset
      and cmms.bookmark(a.page_nonce,subject,query) = bookmark;
    if after_id is null then raise sqlstate '22023' using message = 'Invalid cursor'; end if;
  end if;
  with page as (
    select a.occurred_at,a.id, jsonb_build_object('id',a.id,'assetId',a.asset_id,'kind',a.kind,'occurredAt',a.occurred_at,
      'summary',a.summary,'actorDisplay',a.actor_display,'version',a.version) as item, cmms.bookmark(a.page_nonce,subject,query) as cursor
    from cmms.history a where a.asset_id = asset and
      (after_id is null or (a.occurred_at,a.id) < (after_time,after_id))
    order by a.occurred_at desc,a.id desc limit 26
  ), numbered as (select *, row_number() over (order by occurred_at desc,id desc) as n from page)
  select jsonb_build_object('items', coalesce(jsonb_agg(item order by n) filter (where n <= 25), '[]'::jsonb),
    'nextCursor', case when count(*) > 25 then max(cursor) filter (where n = 25) end)
  into result from numbered;
  return result;
end $$;

revoke all on function cmms.summary(cmms.assets,text) from public, anon, authenticated;
grant execute on function cmms.summary(cmms.assets,text) to authenticated;

revoke all on function cmms.bookmark(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function cmms.bookmark(uuid,uuid,jsonb) to authenticated;

revoke all on function public.m1_user() from public, anon, authenticated;
grant execute on function public.m1_user() to authenticated;

revoke all on function public.m1_asset(uuid) from public, anon, authenticated;
grant execute on function public.m1_asset(uuid) to authenticated;

revoke all on function public.m1_assets(integer,text,text) from public, anon, authenticated;
grant execute on function public.m1_assets(integer,text,text) to authenticated;

revoke all on function public.m1_history(uuid,text) from public, anon, authenticated;
grant execute on function public.m1_history(uuid,text) to authenticated;
