begin;

create table if not exists sakura_math.factor_practice_progress (
  id uuid primary key,
  mode text not null check (mode in ('writing','choice')),
  class text not null check (class in ('4A','4B','4C')),
  number int not null check (number between 1 and 25),
  question_count int not null check (question_count between 1 and 20),
  completed timestamptz
);
alter table sakura_math.factor_practice_progress enable row level security;
revoke all on sakura_math.factor_practice_progress from public,anon,authenticated;

create or replace function public.sakura_factor_save_progress(
  p_id uuid,p_mode text,p_class text,p_number int,p_count int
)
returns int language plpgsql security definer set search_path = '' as $$
declare saved_count int;
begin
  if p_id is null or p_mode is null or p_mode not in ('writing','choice')
    or p_class is null or p_class not in ('4A','4B','4C')
    or p_number is null or p_number not between 1 and 25
    or p_count is null or p_count not between 1 and 20 then
    raise exception 'Invalid practice progress';
  end if;
  insert into sakura_math.factor_practice_progress as p(id,mode,class,number,question_count,completed)
    values(p_id,p_mode,p_class,p_number,p_count,case when p_count=20 then clock_timestamp() end)
    on conflict (id) do update
      set question_count=greatest(p.question_count,excluded.question_count),
          completed=coalesce(p.completed,excluded.completed)
      where p.mode=excluded.mode and p.class=excluded.class and p.number=excluded.number
    returning p.question_count into saved_count;
  if not found then raise exception 'Practice round belongs to another student or activity'; end if;
  return saved_count;
end $$;

create or replace function public.sakura_teacher_password_factors(p_token uuid,p_mode text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform sakura_math.require_teacher_password_session(p_token);
  if p_mode is null or p_mode not in ('writing','choice') then raise exception 'Invalid factor activity'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.class,r.number)
    from (
      select class,number,sum(question_count) as question_count,min(completed) as completed
        from sakura_math.factor_practice_progress where mode=p_mode group by class,number
    ) r),'[]'::jsonb);
end $$;

revoke all on function public.sakura_factor_save_progress(uuid,text,text,int,int),
  public.sakura_teacher_password_factors(uuid,text) from public,anon,authenticated;
grant execute on function public.sakura_factor_save_progress(uuid,text,text,int,int),
  public.sakura_teacher_password_factors(uuid,text) to anon,authenticated;

commit;
