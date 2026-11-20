begin;
create schema if not exists sakura_math;
revoke all on schema sakura_math from public, anon, authenticated;
create table if not exists sakura_math.students (
  pass uuid primary key,
  class text not null check (class in ('4A','4B','4C')),
  number integer not null check (number between 1 and 25),
  alias text not null unique default upper(left(replace(gen_random_uuid()::text,'-',''),10))
);
create table if not exists sakura_math.rounds (
  id uuid primary key,
  student uuid not null references sakura_math.students(pass),
  mode text not null check (mode in ('mul','div','multiple','factor')),
  started timestamptz not null default clock_timestamp(),
  finished timestamptz,
  questions jsonb not null,
  answers jsonb not null default '[]',
  score integer not null default 0
);
create index if not exists sakura_rounds_student_time on sakura_math.rounds(student, started desc);
create table if not exists sakura_math.teachers (user_id uuid primary key references auth.users(id) on delete cascade);
alter table sakura_math.students enable row level security;
alter table sakura_math.rounds enable row level security;
alter table sakura_math.teachers enable row level security;

create or replace function public.sakura_start(p_pass uuid, p_id uuid, p_class text, p_number integer, p_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  student sakura_math.students;
  r sakura_math.rounds;
  qs jsonb := '[]';
  shown jsonb;
  choices jsonb;
  a int; b int; k int; expected int; n int;
  prompt text;
  signature text;
  seen text[] := '{}';
  first_small boolean := random() < 0.5;
begin
  if p_pass is null or p_id is null or p_class is null or p_class not in ('4A','4B','4C')
    or p_number is null or p_number not between 1 and 25 or p_mode is null
    or p_mode not in ('mul','div','multiple','factor') then raise exception 'Invalid round'; end if;
  insert into sakura_math.students(pass,class,number) values (p_pass,p_class,p_number) on conflict (pass) do nothing;
  select * into student from sakura_math.students where pass=p_pass;
  if student.class <> p_class or student.number <> p_number then raise exception 'Invalid student'; end if;
  select * into r from sakura_math.rounds where id=p_id and rounds.student=p_pass;
  if not found then
    for n in 1..10 loop
      loop
        b := 10+floor(random()*90)::int;
        choices := null;
        case p_mode
          when 'mul' then
            if (n % 2 = 1) = first_small then a := 10+floor(random()*90)::int;
            else a := 100+floor(random()*900)::int; end if;
            expected := a*b;
            prompt := a || ' × ' || b;
            signature := least(a,b) || ':' || greatest(a,b);
          when 'div' then
            b := 10+floor(random()*21)::int;
            a := 3+floor(random()*28)::int;
            expected := a;
            prompt := (a*b) || ' ÷ ' || b;
            signature := prompt;
          when 'multiple' then
            b := 2+floor(random()*11)::int;
            k := 3+floor(random()*9)::int;
            expected := b*k;
            prompt := '哪一個數是 ' || b || ' 的倍數？';
            signature := prompt;
            select jsonb_agg(v order by random()) into choices
              from unnest(case when b=2 then array[expected,expected-3,expected-1,expected+1]
                else array[expected,expected-1,expected+1,expected+2] end) as t(v);
          when 'factor' then
            b := 2+floor(random()*9)::int;
            k := 3+floor(random()*9)::int;
            a := b*k;
            expected := b;
            prompt := '哪一個數是 ' || a || ' 的因數？';
            signature := prompt;
            select jsonb_agg(v order by random()) into choices from (
              select expected as v union all
              select v from (select v from generate_series(2,least(a-1,15)) as t(v)
                where a%v<>0 order by random() limit 3) distractors
            ) options;
        end case;
        exit when not(signature=any(seen)) and (choices is null or jsonb_array_length(choices)=4);
      end loop;
      seen := array_append(seen,signature);
      qs := qs || jsonb_build_object('prompt',prompt,'expected',expected,'choices',choices);
    end loop;
    insert into sakura_math.rounds(id,student,mode,questions) values(p_id,p_pass,p_mode,qs) on conflict (id) do nothing;
    select * into strict r from sakura_math.rounds where id=p_id and rounds.student=p_pass;
  end if;
  select jsonb_agg(value-'expected' order by ordinality) into shown from jsonb_array_elements(r.questions) with ordinality;
  return jsonb_build_object('id',r.id,'questions',shown,'started',r.started,'alias',student.alias);
end $$;

create or replace function public.sakura_answer(p_pass uuid, p_id uuid, p_index int, p_value int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r sakura_math.rounds; q jsonb; item jsonb; elapsed int; at_time timestamptz;
begin
  if p_index is null or p_index not between 0 and 9 or p_value is null or p_value not between 0 and 999999 then
    raise exception 'Invalid answer';
  end if;
  select * into strict r from sakura_math.rounds where id=p_id and student=p_pass for update;
  if p_index < jsonb_array_length(r.answers) then
    item := r.answers->p_index;
    if (item->>'answer')::int <> p_value then raise exception 'Answer already saved'; end if;
    return item;
  end if;
  if p_index <> jsonb_array_length(r.answers) then raise exception 'Answer out of order'; end if;
  q := r.questions->p_index;
  if jsonb_typeof(q->'choices')='array' and not ((q->'choices') @> jsonb_build_array(p_value)) then
    raise exception 'Invalid choice';
  end if;
  at_time := clock_timestamp();
  elapsed := greatest(0, floor(extract(epoch from (at_time-r.started)))::int);
  item := jsonb_build_object('prompt',q->'prompt','answer',p_value,'expected',q->'expected',
    'correct',p_value=(q->>'expected')::int,'elapsed',elapsed,
    'seconds',elapsed-coalesce(case when p_index>0 then (r.answers->(p_index-1)->>'elapsed')::int end,0));
  update sakura_math.rounds set answers=answers||item,
    score=score+case when (item->>'correct')::boolean then 1 else 0 end,
    finished=case when p_index=9 then at_time end where id=p_id;
  return item;
end $$;

create or replace function public.sakura_history(p_pass uuid, p_offset int default 0)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by started desc,id desc),'[]') from (
    select id,mode,started,finished,score,answers from sakura_math.rounds
    where student=p_pass and jsonb_array_length(answers)>0
    order by started desc,id desc limit 20 offset greatest(p_offset,0)
  ) x;
$$;

create or replace function public.sakura_board(p_mode text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by total desc,alias),'[]') from (
    select s.alias, count(*)*10 as total from sakura_math.rounds r
    join sakura_math.students s on s.pass=r.student
    where r.finished is not null and (p_mode is null or r.mode=p_mode)
    group by s.alias order by total desc, s.alias limit 30
  ) x;
$$;

create or replace function public.sakura_teacher(p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from sakura_math.teachers t where t.user_id=auth.uid()) then
    raise exception 'Teacher access required' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by started desc,id desc) from (
    select r.id,s.class,s.number,r.mode,r.started,r.finished,r.score,r.answers
    from sakura_math.rounds r join sakura_math.students s on s.pass=r.student
    where jsonb_array_length(r.answers)>0
    order by r.started desc,r.id desc limit 100 offset greatest(p_offset,0)
  ) x),'[]');
end $$;

revoke all on function public.sakura_start(uuid,uuid,text,int,text),public.sakura_answer(uuid,uuid,int,int),
  public.sakura_history(uuid,int),public.sakura_board(text),public.sakura_teacher(int) from public, anon, authenticated;
grant execute on function public.sakura_start(uuid,uuid,text,int,text),public.sakura_answer(uuid,uuid,int,int),
  public.sakura_history(uuid,int),public.sakura_board(text) to anon, authenticated;
grant execute on function public.sakura_teacher(int) to authenticated;
commit;
