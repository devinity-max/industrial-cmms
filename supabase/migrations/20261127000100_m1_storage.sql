-- Private schema must stay outside the Data API's exposed schemas.
create schema cmms;
revoke all on schema cmms from public, anon, authenticated;
grant usage on schema cmms to authenticated;

create table cmms.plants (
  id uuid primary key default gen_random_uuid(),
  name text not null
);
create table cmms.departments (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references cmms.plants,
  name text not null,
  unique (plant_id, id)
);
create table cmms.assets (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references cmms.plants,
  department_id uuid not null,
  machine_number text not null check (machine_number = btrim(machine_number) and machine_number <> ''),
  name text not null,
  qr_token uuid unique not null default gen_random_uuid(),
  page_nonce uuid not null default gen_random_uuid(),
  display_status text not null default 'unknown',
  foreign key (plant_id, department_id) references cmms.departments(plant_id, id),
  unique (plant_id, machine_number)
);
create table cmms.profiles (
  user_id uuid primary key references auth.users,
  enabled boolean not null default false
);
create table cmms.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references cmms.profiles,
  plant_id uuid references cmms.plants,
  asset_id uuid references cmms.assets,
  role text not null check (role in ('viewer','admin')),
  active boolean not null default true,
  check (num_nonnulls(plant_id, asset_id) = 1),
  unique (user_id, plant_id),
  unique (user_id, asset_id)
);
create table cmms.history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references cmms.assets,
  kind text not null,
  occurred_at timestamptz not null default now(),
  summary text not null,
  actor_display text not null,
  version integer not null check (version > 0),
  page_nonce uuid not null default gen_random_uuid()
);
create index on cmms.history(asset_id, id);

create function cmms.preserve_asset_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.id is distinct from old.id or new.qr_token is distinct from old.qr_token then
    raise exception 'Asset identity is permanent';
  end if;
  return new;
end $$;
create trigger preserve_identity before update or delete on cmms.assets
for each row execute function cmms.preserve_asset_identity();

alter table cmms.plants enable row level security;
alter table cmms.departments enable row level security;
alter table cmms.assets enable row level security;
alter table cmms.profiles enable row level security;
alter table cmms.memberships enable row level security;
alter table cmms.history enable row level security;
revoke all on all tables in schema cmms from public, anon, authenticated;
grant select on cmms.assets, cmms.departments, cmms.profiles, cmms.memberships, cmms.history to authenticated;
create policy own_active_profile on cmms.profiles for select to authenticated
using (user_id = (select auth.uid()) and enabled);
create policy own_active_membership on cmms.memberships for select to authenticated
using (user_id = (select auth.uid()) and active and exists (select from cmms.profiles));
create policy scoped_asset on cmms.assets for select to authenticated
using (exists (select from cmms.memberships m where m.asset_id = assets.id or m.plant_id = assets.plant_id));
create policy scoped_department on cmms.departments for select to authenticated
using (exists (select from cmms.assets a where a.department_id = departments.id));
create policy scoped_history on cmms.history for select to authenticated
using (exists (select from cmms.assets a where a.id = history.asset_id));

revoke all on function cmms.preserve_asset_identity() from public, anon, authenticated;
