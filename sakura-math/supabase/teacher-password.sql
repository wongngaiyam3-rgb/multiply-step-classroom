begin;

create table if not exists sakura_math.teacher_password (
  singleton boolean primary key default true check (singleton),
  password_hash text not null,
  failed_attempts int not null default 0,
  attempt_window timestamptz
);
create table if not exists sakura_math.teacher_password_sessions (
  token_hash bytea primary key,
  expires timestamptz not null
);
alter table sakura_math.teacher_password enable row level security;
alter table sakura_math.teacher_password_sessions enable row level security;
revoke all on sakura_math.teacher_password,sakura_math.teacher_password_sessions
  from public,anon,authenticated;

create or replace function public.sakura_teacher_password_login(p_password text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  credential sakura_math.teacher_password;
  token uuid;
  checked_at timestamptz := clock_timestamp();
begin
  if p_password is null or octet_length(p_password) not between 1 and 72 then return null; end if;
  select * into credential from sakura_math.teacher_password where singleton for update;
  if not found then return null; end if;
  if credential.attempt_window is null or checked_at >= credential.attempt_window + interval '5 minutes' then
    credential.failed_attempts := 0;
    credential.attempt_window := checked_at;
  end if;
  if credential.failed_attempts >= 20 then return null; end if;
  if extensions.crypt(p_password,credential.password_hash) is distinct from credential.password_hash then
    update sakura_math.teacher_password set failed_attempts=credential.failed_attempts+1,
      attempt_window=credential.attempt_window where singleton;
    return null;
  end if;

  update sakura_math.teacher_password set failed_attempts=0,attempt_window=null where singleton;
  delete from sakura_math.teacher_password_sessions where expires<=checked_at;
  token:=gen_random_uuid();
  insert into sakura_math.teacher_password_sessions(token_hash,expires)
  values(extensions.digest(token::text,'sha256'),checked_at+interval '2 hours');
  return token;
end $$;

create or replace function sakura_math.require_teacher_password_session(p_token uuid)
returns void language plpgsql stable set search_path = '' as $$
begin
  if not exists (select 1 from sakura_math.teacher_password_sessions
    where token_hash=extensions.digest(p_token::text,'sha256') and expires>statement_timestamp()) then
    raise exception 'Teacher access required' using errcode='42501';
  end if;
end $$;
revoke all on function sakura_math.require_teacher_password_session(uuid) from public,anon,authenticated;

create or replace function public.sakura_teacher_password_records(p_token uuid,p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform sakura_math.require_teacher_password_session(p_token);
  return coalesce((select jsonb_agg(to_jsonb(x) order by started desc,id desc) from (
    select r.id,s.class,s.number,r.mode,r.started,r.finished,r.score,r.answers
      from sakura_math.rounds r join sakura_math.students s on s.pass=r.student
      where jsonb_array_length(r.answers)>0
      order by r.started desc,r.id desc limit 100 offset greatest(p_offset,0)
  ) x),'[]'::jsonb);
end $$;

create or replace function public.sakura_teacher_password_beginner(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform sakura_math.require_teacher_password_session(p_token);
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.class,c.number)
    from sakura_math.multiples_beginner_completions c),'[]'::jsonb);
end $$;

create or replace function public.sakura_teacher_password_logout(p_token uuid)
returns boolean language sql security definer set search_path = '' as $$
  delete from sakura_math.teacher_password_sessions where token_hash=extensions.digest(p_token::text,'sha256');
  select true;
$$;

revoke all on function public.sakura_teacher_password_login(text),
  public.sakura_teacher_password_records(uuid,int),public.sakura_teacher_password_beginner(uuid),
  public.sakura_teacher_password_logout(uuid) from public,anon,authenticated;
grant execute on function public.sakura_teacher_password_login(text),
  public.sakura_teacher_password_records(uuid,int),public.sakura_teacher_password_beginner(uuid),
  public.sakura_teacher_password_logout(uuid) to anon,authenticated;

commit;
