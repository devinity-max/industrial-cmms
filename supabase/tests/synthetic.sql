-- Run once in a separately approved synthetic test project after Auth provisioning.
begin;
insert into cmms.plants (id,name) values
 ('10000000-0000-4000-8000-000000000001','Synthetic North'),
 ('10000000-0000-4000-8000-000000000002','Synthetic South');
insert into cmms.departments (id,plant_id,name)
select id,id,'Synthetic maintenance' from cmms.plants where name in ('Synthetic North','Synthetic South');
insert into cmms.assets (id,qr_token,plant_id,department_id,machine_number,name)
select ('20000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       ('30000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       p.id,p.id,case when n <= 2 then 'DEMO-ROB-00' || n else 'TEST-' || n end,
       case when n <= 2 then 'Synthetic robot ' || n else 'Pagination fixture ' || n end
from generate_series(1,12) n join cmms.plants p
on p.id = case when n = 12 then '10000000-0000-4000-8000-000000000002'::uuid
else '10000000-0000-4000-8000-000000000001'::uuid end;
insert into cmms.history(asset_id,kind,summary,actor_display,version)
select id,'registered','Synthetic fixture registered','Synthetic setup',1 from cmms.assets
where id::text like '20000000-0000-4000-8000-%';

do $$
declare
  label text;
  subject uuid;
begin
  foreach label in array array['viewer','admin','machine','south'] loop
    select id into strict subject from auth.users where email = 'm1-' || label || '@example.invalid';
    insert into cmms.profiles values(subject,true);
    if label = 'machine' then
      insert into cmms.memberships(user_id,asset_id,role) values
      (subject,'20000000-0000-4000-8000-000000000001','admin');
    else
      insert into cmms.memberships(user_id,plant_id,role) values
      (subject,case when label = 'south' then '10000000-0000-4000-8000-000000000002'::uuid
       else '10000000-0000-4000-8000-000000000001'::uuid end,
       case when label = 'admin' then 'admin' else 'viewer' end);
    end if;
  end loop;
end $$;
commit;
