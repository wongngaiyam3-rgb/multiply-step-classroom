begin;

create or replace function public.sakura_start_lists(p_pass uuid, p_id uuid, p_class text, p_number int, p_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player sakura_math.students;
  r sakura_math.rounds;
  questions jsonb := '[]';
  shown jsonb;
begin
  if p_pass is null or p_id is null or p_class is null or p_class not in ('4A','4B','4C')
    or p_number is null or p_number not between 1 and 25
    or p_mode is null or p_mode not in ('multiple','factor') then
    raise exception 'Invalid round';
  end if;
  insert into sakura_math.students(pass,class,number) values (p_pass,p_class,p_number) on conflict (pass) do nothing;
  select * into strict player from sakura_math.students where pass=p_pass;
  if player.class <> p_class or player.number <> p_number then raise exception 'Invalid student'; end if;

  select * into r from sakura_math.rounds where id=p_id and student=p_pass;
  if not found then
    if p_mode='multiple' then
      select jsonb_agg(jsonb_build_object(
        'entry','list','prompt','寫出 '||m.cap||' 以內 '||m.n||' 的所有正倍數。',
        'expected',(select jsonb_agg(v order by v) from generate_series(m.n,m.cap,m.n) v)))
      into questions
      from (
        select n,cap from generate_series(2,12) n
        cross join unnest(array[30,40,50,60,80,100]) cap
        where cap/n between 4 and 10 order by random() limit 10
      ) m;
    else
      select jsonb_agg(jsonb_build_object(
        'entry','list','prompt','寫出 '||f.n||' 的所有正因數。',
        'expected',(select jsonb_agg(v order by v) from generate_series(1,f.n) v where f.n%v=0)))
      into questions
      from (select n from generate_series(12,100) n order by random() limit 10) f;
    end if;
    insert into sakura_math.rounds(id,student,mode,questions) values(p_id,p_pass,p_mode,questions) on conflict (id) do nothing;
    select * into strict r from sakura_math.rounds where id=p_id and student=p_pass;
  end if;
  if r.mode <> p_mode or (r.questions->0->>'entry') is distinct from 'list' then
    raise exception 'Invalid round format';
  end if;
  select jsonb_agg(value-'expected' order by ordinality) into shown from jsonb_array_elements(r.questions) with ordinality;
  return jsonb_build_object('id',r.id,'questions',shown,'started',r.started,'alias',player.alias);
end $$;

create or replace function public.sakura_answer_list(p_pass uuid, p_id uuid, p_index int, p_values int[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r sakura_math.rounds;
  q jsonb;
  item jsonb;
  actual jsonb;
  elapsed int;
  at_time timestamptz;
begin
  if p_index is null or p_index not between 0 and 9 or p_values is null
    or array_ndims(p_values) is distinct from 1 or cardinality(p_values) not between 1 and 24
    or exists (select 1 from unnest(p_values) v where v is null or v not between 0 and 999)
    then raise exception 'Invalid answer'; end if;
  select * into strict r from sakura_math.rounds where id=p_id and student=p_pass for update;
  q := r.questions->p_index;
  if (q->>'entry') is distinct from 'list' then raise exception 'Invalid question format'; end if;
  if p_index < jsonb_array_length(r.answers) then
    item := r.answers->p_index;
    if (item->'answer') is distinct from to_jsonb(p_values) then raise exception 'Answer already saved'; end if;
    return item;
  end if;
  if p_index <> jsonb_array_length(r.answers) then raise exception 'Answer out of order'; end if;
  select jsonb_agg(v order by v) into actual from unnest(p_values) v;
  at_time := clock_timestamp();
  elapsed := greatest(0, floor(extract(epoch from (at_time-r.started)))::int);
  item := jsonb_build_object('prompt',q->'prompt','answer',p_values,'expected',q->'expected',
    'correct',actual=(q->'expected'),'elapsed',elapsed,
    'seconds',elapsed-coalesce(case when p_index>0 then (r.answers->(p_index-1)->>'elapsed')::int end,0));
  update sakura_math.rounds set answers=answers||item,
    score=score+case when (item->>'correct')::boolean then 1 else 0 end,
    finished=case when p_index=9 then at_time end where id=p_id;
  return item;
end $$;

revoke all on function public.sakura_start_lists(uuid,uuid,text,int,text),
  public.sakura_answer_list(uuid,uuid,int,int[]) from public,anon,authenticated;
grant execute on function public.sakura_start_lists(uuid,uuid,text,int,text),
  public.sakura_answer_list(uuid,uuid,int,int[]) to anon,authenticated;

commit;
