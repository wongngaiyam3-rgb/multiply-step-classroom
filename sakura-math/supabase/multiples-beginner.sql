begin;

create table if not exists sakura_math.multiples_beginner_completions (
  class text not null check (class in ('4A','4B','4C')),
  number int not null check (number between 1 and 25),
  completed timestamptz not null default clock_timestamp(),
  primary key(class,number)
);
alter table sakura_math.multiples_beginner_completions enable row level security;

create or replace function public.sakura_beginner_complete(p_class text, p_number int)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_class is null or p_class not in ('4A','4B','4C')
    or p_number is null or p_number not between 1 and 25 then
    raise exception 'Invalid student';
  end if;

  insert into sakura_math.multiples_beginner_completions(class,number)
  values(p_class,p_number) on conflict (class,number) do nothing;
  return true;
end $$;

create or replace function public.sakura_beginner_teacher()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from sakura_math.teachers t where t.user_id=auth.uid()) then
    raise exception 'Teacher access required' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.class,c.number)
    from sakura_math.multiples_beginner_completions c),'[]'::jsonb);
end $$;

revoke all on function public.sakura_beginner_complete(text,int),public.sakura_beginner_teacher()
  from public,anon,authenticated;
grant execute on function public.sakura_beginner_complete(text,int) to anon,authenticated;
grant execute on function public.sakura_beginner_teacher() to authenticated;

commit;
