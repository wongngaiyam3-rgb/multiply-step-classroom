begin;

create table if not exists sakura_math.multiples_beginner_progress (
  id uuid primary key,
  class text not null check (class in ('4A','4B','4C')),
  number int not null check (number between 1 and 25),
  question_count int not null check (question_count between 1 and 20)
);
alter table sakura_math.multiples_beginner_progress enable row level security;
revoke all on sakura_math.multiples_beginner_progress from public,anon,authenticated;

create or replace function public.sakura_beginner_save_progress(
  p_id uuid,p_class text,p_number int,p_count int
)
returns int language plpgsql security definer set search_path = '' as $$
declare
  saved_count int;
begin
  if p_id is null or p_class is null or p_class not in ('4A','4B','4C')
    or p_number is null or p_number not between 1 and 25
    or p_count is null or p_count not between 1 and 20 then
    raise exception 'Invalid practice progress';
  end if;

  insert into sakura_math.multiples_beginner_progress as p(id,class,number,question_count)
    values(p_id,p_class,p_number,p_count)
    on conflict (id) do update
      set question_count=greatest(p.question_count,excluded.question_count)
      where p.class=excluded.class and p.number=excluded.number
    returning p.question_count into saved_count;
  if not found then raise exception 'Practice round belongs to another student'; end if;

  if saved_count=20 then
    insert into sakura_math.multiples_beginner_completions(class,number)
      values(p_class,p_number) on conflict (class,number) do nothing;
  end if;
  return saved_count;
end $$;

create or replace function public.sakura_teacher_password_beginner(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform sakura_math.require_teacher_password_session(p_token);
  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.class,r.number)
    from (
      select class,number,p.question_count,c.completed
      from (
        select class,number,sum(question_count) as question_count
          from sakura_math.multiples_beginner_progress group by class,number
      ) p
      full join sakura_math.multiples_beginner_completions c using (class,number)
    ) r
  ),'[]'::jsonb);
end $$;

revoke all on function public.sakura_beginner_save_progress(uuid,text,int,int) from public,anon,authenticated;
grant execute on function public.sakura_beginner_save_progress(uuid,text,int,int) to anon,authenticated;

commit;
