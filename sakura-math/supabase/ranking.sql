begin;
create table if not exists sakura_math.roster (
  class text not null check (class in ('4A','4B','4C')),
  number int not null check (number between 1 and 25),
  alias text not null unique default upper(left(replace(gen_random_uuid()::text,'-',''),10)),
  primary key(class,number)
);
alter table sakura_math.roster enable row level security;
insert into sakura_math.roster(class,number)
  select class,n from unnest(array['4A','4B','4C']) as c(class), generate_series(1,25) n
  on conflict (class,number) do nothing;

create or replace function public.sakura_board(p_mode text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by total desc,alias),'[]') from (
    select c.alias,sum(jsonb_array_length(r.answers)) as total from sakura_math.rounds r
    join sakura_math.students s on s.pass=r.student
    join sakura_math.roster c on c.class=s.class and c.number=s.number
    where jsonb_array_length(r.answers)>0 and (p_mode is null or r.mode=p_mode)
    group by c.alias order by total desc,c.alias limit 75
  ) x;
$$;
create or replace function public.sakura_alias(p_pass uuid)
returns text language sql stable security definer set search_path = '' as $$
  select c.alias from sakura_math.students s
    join sakura_math.roster c on c.class=s.class and c.number=s.number
    where s.pass=p_pass;
$$;
revoke all on function public.sakura_alias(uuid) from public, anon, authenticated;
grant execute on function public.sakura_alias(uuid) to anon, authenticated;
commit;
