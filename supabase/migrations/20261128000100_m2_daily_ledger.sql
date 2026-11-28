-- Proposed forward migration. Apply only after contract, SQL and target review.
-- Apply as one transaction. A trusted operator configures obligations separately.
create table cmms.daily_obligations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references cmms.assets,
  operational_date date not null check (isfinite(operational_date)),
  shift_key text not null default '' check (shift_key = btrim(shift_key) and length(shift_key) <= 64),
  due_at timestamptz check (isfinite(due_at)),
  unique (asset_id, operational_date, shift_key)
);

-- One immutable snapshot per accepted revision. Its ID links the corresponding
-- scoped machine-history event. Adjacent versions preserve before/after values.
create table cmms.daily_revisions (
  id uuid primary key references cmms.history,
  obligation_id uuid not null references cmms.daily_obligations,
  version integer not null check (version > 0),
  submitted_by uuid not null references cmms.profiles,
  submitted_at timestamptz not null,
  request_id uuid not null,
  activities jsonb not null check (jsonb_typeof(activities) = 'array' and jsonb_array_length(activities) between 1 and 32),
  reason text,
  check ((version = 1 and reason is null) or
         (version > 1 and reason is not null and length(btrim(reason)) between 1 and 1000)),
  unique (obligation_id, version),
  unique (obligation_id, submitted_by, request_id)
);

alter table cmms.daily_obligations enable row level security;
alter table cmms.daily_revisions enable row level security;
revoke all on cmms.daily_obligations, cmms.daily_revisions from public, anon, authenticated;
grant select on cmms.daily_obligations, cmms.daily_revisions to authenticated;
create policy read_daily_obligation on cmms.daily_obligations for select to authenticated
using (exists (select from cmms.assets a where a.id = daily_obligations.asset_id));
create policy read_daily_revision on cmms.daily_revisions for select to authenticated
using (exists (select from cmms.daily_obligations o where o.id = daily_revisions.obligation_id));

create function cmms.daily_receipt(r cmms.daily_revisions) returns jsonb
language sql stable security invoker set search_path = '' set timezone = 'UTC' as $$
  select jsonb_build_object('id', r.id, 'obligationId', r.obligation_id, 'version', r.version,
    'status', 'submitted', 'submittedAt', r.submitted_at, 'submittedBy', r.submitted_by)
$$;

create function public.m2_daily_revision(obligation uuid, revision integer) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  perform public.m1_user();
  if revision is null or revision < 1 then raise sqlstate '22023' using message = 'Invalid version'; end if;
  select cmms.daily_receipt(r) || jsonb_build_object('activities', r.activities, 'reason', r.reason)
    into result from cmms.daily_revisions r where r.obligation_id = obligation and r.version = revision;
  if result is null then raise sqlstate '42501' using message = 'Record unavailable'; end if;
  return result;
end $$;

create function public.m2_daily_obligation(asset uuid, day_key text, shift_key text) returns jsonb
language plpgsql stable security invoker set search_path = '' set timezone = 'UTC' as $$
declare result jsonb; selected_date date;
begin
  perform public.m1_user();
  if not exists (select from cmms.assets a where a.id = asset) then
    raise sqlstate '42501' using message = 'Record unavailable';
  end if;
  if day_key is null or day_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or shift_key is null or
     length(shift_key) > 64 or shift_key <> btrim(shift_key) then
    raise sqlstate '22023' using message = 'Invalid ledger query';
  end if;
  selected_date := day_key::date;
  select jsonb_build_object('id', o.id, 'assetId', asset, 'operationalDate', o.operational_date,
    'shiftKey', nullif(o.shift_key, ''), 'dueAt', o.due_at, 'version', coalesce(r.version, 0),
    'state', case when r.version is null then 'open' else 'submitted' end,
    'current', case when r.version is not null then public.m2_daily_revision(o.id, r.version) end)
    into result from cmms.daily_obligations o left join lateral
    (select v.version from cmms.daily_revisions v where v.obligation_id = o.id
     order by v.version desc limit 1) r on true
    where o.asset_id = asset and o.operational_date = selected_date and o.shift_key = $3;
  return jsonb_build_object('obligation', result);
end $$;

-- This is the sole elevated application write path. The owner can bypass RLS;
-- authenticate and authorize explicitly before reading a prior receipt or writing.
create function public.m2_submit_daily(obligation uuid, expected_version integer, request_key uuid,
  entries jsonb, correction_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  machine uuid;
  previous cmms.daily_revisions;
  entry jsonb;
  field text;
  latest integer;
  event_id uuid;
  recorded_at timestamptz;
begin
  -- Hold scope and enabled-state rows against concurrent changes. Serialize
  -- submissions on one obligation, including the race to create version one.
  select o.asset_id into machine
    from cmms.daily_obligations o join cmms.assets a on a.id = o.asset_id
    join cmms.memberships m on m.user_id = actor and m.active and m.role = 'admin'
      and (m.asset_id = a.id or m.plant_id = a.plant_id)
    join cmms.profiles p on p.user_id = actor and p.enabled
    where o.id = obligation order by m.id limit 1
    for update of o for share of a, m, p;
  if machine is null then raise sqlstate '42501' using message = 'Record unavailable'; end if;

  if request_key is null or expected_version is null or expected_version not between 0 and 2147483646
     or jsonb_typeof(entries) is distinct from 'array' then
    raise sqlstate '22023' using message = 'Invalid submission';
  end if;
  if jsonb_array_length(entries) not between 1 and 32 or octet_length(entries::text) > 131072
     or (expected_version = 0 and correction_reason is not null)
     or (expected_version > 0 and (correction_reason is null or correction_reason !~ '[^[:space:]]'
                                   or length(correction_reason) > 1000)) then
    raise sqlstate '22023' using message = 'Invalid submission';
  end if;
  for entry in select value from jsonb_array_elements(entries) loop
    if jsonb_typeof(entry) <> 'object' then raise sqlstate '22023' using message = 'Invalid activity'; end if;
    if not (entry ?& array['category','machineCondition','observation','action'])
       or entry - array['category','machineCondition','observation','action'] <> '{}'::jsonb
       or jsonb_typeof(entry->'category') <> 'string' or (entry->>'category') !~ '[^[:space:]]'
       or length(entry->>'category') > 64 then
      raise sqlstate '22023' using message = 'Invalid activity';
    end if;
    foreach field in array array['machineCondition','observation','action'] loop
      if jsonb_typeof(entry->field) not in ('null','string') or length(entry->>field) > 2000 then
        raise sqlstate '22023' using message = 'Invalid activity text';
      end if;
    end loop;
  end loop;

  select * into previous from cmms.daily_revisions r
    where r.obligation_id = obligation and r.submitted_by = actor and r.request_id = request_key;
  if found then
    if previous.version = expected_version + 1 and previous.activities = entries
       and previous.reason is not distinct from correction_reason then
      return cmms.daily_receipt(previous);
    end if;
    raise sqlstate 'PT409' using message = 'Conflicting retry';
  end if;
  select coalesce(max(r.version), 0) into latest from cmms.daily_revisions r where r.obligation_id = obligation;
  if latest <> expected_version then raise sqlstate 'PT409' using message = 'Version conflict'; end if;

  recorded_at := clock_timestamp();
  insert into cmms.history(asset_id, kind, occurred_at, summary, actor_display, version)
    values(machine, 'daily_maintenance', recorded_at,
      case when latest = 0 then 'Daily maintenance submitted' else 'Daily maintenance corrected' end,
      'Maintenance admin', latest + 1) returning id into event_id;
  insert into cmms.daily_revisions(id, obligation_id, version, submitted_by, submitted_at, request_id, activities, reason)
    values(event_id, obligation, latest + 1, actor, recorded_at, request_key, entries, correction_reason)
    returning * into previous;
  return cmms.daily_receipt(previous);
end $$;

revoke all on function cmms.daily_receipt(cmms.daily_revisions),
  public.m2_daily_revision(uuid,integer), public.m2_daily_obligation(uuid,text,text),
  public.m2_submit_daily(uuid,integer,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function cmms.daily_receipt(cmms.daily_revisions),
  public.m2_daily_revision(uuid,integer), public.m2_daily_obligation(uuid,text,text),
  public.m2_submit_daily(uuid,integer,uuid,jsonb,text) to authenticated;
