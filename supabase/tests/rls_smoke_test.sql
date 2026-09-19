-- ─────────────────────────────────────────────────────────────
-- RLS smoke tests — attacks the API surface directly (as PostgREST
-- would), not the UI. Per spec §12: "Empregador NÃO vê nome/telefone
-- antes de confirmed ← testar via API directa, não só UI" and
-- "Não existe nenhuma rota que devolva lista de candidatos ao
-- empregador".
--
-- Run against a freshly migrated + seeded database:
--   psql <connection> -v ON_ERROR_STOP=1 -f supabase/tests/rls_smoke_test.sql
--
-- Every check runs inside `SET ROLE authenticated` — the table owner
-- (the role that ran the migrations) bypasses RLS entirely, so without
-- that SET ROLE these tests would silently pass no matter what the
-- policies say. IDs are looked up dynamically from the seed data and
-- passed through custom GUCs (session variables), not psql's :'var'
-- substitution, which does not reliably interpolate inside dollar-quoted
-- plpgsql bodies.
-- ─────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

select set_config('myvars.worker_a1_user', wp.user_id::text, false),
       set_config('myvars.worker_a1_id', wp.id::text, false)
from worker_profiles wp where wp.display_alias = 'Candidato #A1';

select set_config('myvars.employer_resto_user', c.owner_user_id::text, false)
from companies c where c.trade_name = 'Lisboa Grill';

select set_config('myvars.employer_retail_user', c.owner_user_id::text, false)
from companies c where c.trade_name = 'Mercado Amadora';

select set_config('myvars.job_resto_1_id', j.id::text, false)
from jobs j where j.title = 'Empregado de mesa';

select set_config('myvars.worker_unrelated_user', wp2.user_id::text, false)
from worker_profiles wp2 where wp2.display_alias = 'Candidato #C11';

do $$ begin raise notice '── TEST 1: employer CANNOT read full worker_profiles before a confirmed match ──'; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('myvars.employer_resto_user'), false);
do $$
declare cnt int;
begin
  select count(*) into cnt from worker_profiles where id = current_setting('myvars.worker_a1_id')::uuid;
  if cnt <> 0 then
    raise exception 'FAIL: employer saw % row(s) of worker_profiles pre-match (P9 violated)', cnt;
  end if;
  raise notice 'PASS: 0 rows (as expected)';
end $$;
reset role;
reset request.jwt.claim.sub;

do $$ begin raise notice '── TEST 2: employer CAN read the anonymous projection (no PII) ──'; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('myvars.employer_resto_user'), false);
do $$
declare cnt int;
begin
  select count(*) into cnt from worker_profiles_anonymous where id = current_setting('myvars.worker_a1_id')::uuid;
  if cnt <> 1 then
    raise exception 'FAIL: expected 1 row from worker_profiles_anonymous, got %', cnt;
  end if;
  raise notice 'PASS: anonymous view readable, 1 row';
end $$;
do $$
declare pii_cols text;
begin
  select string_agg(column_name, ', ') into pii_cols
  from information_schema.columns
  where table_name = 'worker_profiles_anonymous'
    and column_name in ('phone', 'photo_url', 'user_id');
  if pii_cols is not null then
    raise exception 'FAIL: worker_profiles_anonymous exposes PII columns: %', pii_cols;
  end if;
  raise notice 'PASS: no PII columns on worker_profiles_anonymous';
end $$;
reset role;
reset request.jwt.claim.sub;

do $$ begin raise notice '── TEST 3: worker CAN read their own worker_profiles row ──'; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('myvars.worker_a1_user'), false);
do $$
declare cnt int;
begin
  select count(*) into cnt from worker_profiles where id = current_setting('myvars.worker_a1_id')::uuid;
  if cnt <> 1 then
    raise exception 'FAIL: worker could not read own profile, got % rows', cnt;
  end if;
  raise notice 'PASS: worker reads own profile';
end $$;
reset role;
reset request.jwt.claim.sub;

do $$ begin raise notice '── TEST 4: unrelated worker CANNOT browse jobs directly (P2 — no search) ──'; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('myvars.worker_unrelated_user'), false);
do $$
declare cnt int;
begin
  select count(*) into cnt from jobs;
  if cnt <> 0 then
    raise exception 'FAIL: unrelated worker saw % job row(s) with no existing match (P2 violated)', cnt;
  end if;
  raise notice 'PASS: 0 jobs visible without a match';
end $$;
reset role;
reset request.jwt.claim.sub;

do $$ begin raise notice '── TEST 5: unrelated employer CANNOT read another company''s job row ──'; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('myvars.employer_retail_user'), false);
do $$
declare cnt int;
begin
  select count(*) into cnt from jobs where id = current_setting('myvars.job_resto_1_id')::uuid;
  if cnt <> 0 then
    raise exception 'FAIL: employer B saw employer A''s job (RLS ownership check broken), got %', cnt;
  end if;
  raise notice 'PASS: cross-employer job access blocked';
end $$;
reset role;
reset request.jwt.claim.sub;

do $$ begin raise notice '── Creating a CONFIRMED match between worker A1 and job "Empregado de mesa" (as table owner, simulating the service role) ──'; end $$;
insert into match_cycles (id, kind, engine_version, weights_version)
values ('00000000-0000-0000-0000-0000000000c1', 'event', 'test', 'test')
on conflict (id) do nothing;

insert into matches (
  id, worker_id, job_id, cycle_id, fit_employer, fit_worker, harmonic_score, priority_score,
  score_breakdown, engine_version, weights_version, explanation_worker, explanation_employer,
  status, expires_at, confirmed_at
)
select
  '00000000-0000-0000-0000-00000000001a', current_setting('myvars.worker_a1_id')::uuid, current_setting('myvars.job_resto_1_id')::uuid,
  '00000000-0000-0000-0000-0000000000c1', 0.9, 0.9, 0.9, 0.5,
  '{}'::jsonb, 'test', 'test', 'explicação teste', 'explicação teste',
  'confirmed', now() + interval '48 hours', now()
on conflict (worker_id, job_id) do update set status = 'confirmed', confirmed_at = now();

do $$ begin raise notice '── TEST 6: employer CAN now read the full worker_profiles row (post-confirm reveal) ──'; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('myvars.employer_resto_user'), false);
do $$
declare cnt int;
begin
  select count(*) into cnt from worker_profiles where id = current_setting('myvars.worker_a1_id')::uuid;
  if cnt <> 1 then
    raise exception 'FAIL: expected employer to see the worker post-confirm, got % rows', cnt;
  end if;
  raise notice 'PASS: employer sees full profile after confirmation (contacts revealed, as intended)';
end $$;
reset role;
reset request.jwt.claim.sub;

do $$ begin raise notice '── TEST 7: worker CAN now read the employer''s full company row (post-confirm reveal) ──'; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('myvars.worker_a1_user'), false);
do $$
declare cnt int;
begin
  select count(*) into cnt from companies where owner_user_id = current_setting('myvars.employer_resto_user')::uuid;
  if cnt <> 1 then
    raise exception 'FAIL: expected worker to see the company post-confirm, got % rows', cnt;
  end if;
  raise notice 'PASS: worker sees full company (name/address) after confirmation';
end $$;
reset role;
reset request.jwt.claim.sub;

do $$ begin raise notice '── TEST 8: conversations/pipeline_events reachable only for confirmed participants ──'; end $$;
insert into conversations (id, match_id) values ('00000000-0000-0000-0000-00000000001b', '00000000-0000-0000-0000-00000000001a')
on conflict (match_id) do nothing;
insert into pipeline_events (match_id, stage) values ('00000000-0000-0000-0000-00000000001a', 'chat');

set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('myvars.worker_a1_user'), false);
do $$
declare cnt int;
begin
  select count(*) into cnt from conversations where match_id = '00000000-0000-0000-0000-00000000001a';
  if cnt <> 1 then
    raise exception 'FAIL: worker participant could not read own conversation, got % rows', cnt;
  end if;
  raise notice 'PASS: worker participant reads own conversation';

  select count(*) into cnt from pipeline_events where match_id = '00000000-0000-0000-0000-00000000001a';
  if cnt <> 1 then
    raise exception 'FAIL: worker participant could not read pipeline events, got % rows', cnt;
  end if;
  raise notice 'PASS: worker participant reads pipeline events';
end $$;
reset role;
reset request.jwt.claim.sub;

set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('myvars.worker_unrelated_user'), false);
do $$
declare cnt int;
begin
  select count(*) into cnt from conversations where match_id = '00000000-0000-0000-0000-00000000001a';
  if cnt <> 0 then
    raise exception 'FAIL: unrelated worker saw the conversation, got % rows', cnt;
  end if;
  raise notice 'PASS: unrelated worker blocked from conversation';
end $$;
reset role;
reset request.jwt.claim.sub;

-- Cleanup the synthetic confirmed match so it doesn't skew other checks.
delete from pipeline_events where match_id = '00000000-0000-0000-0000-00000000001a';
delete from conversations where match_id = '00000000-0000-0000-0000-00000000001a';
delete from matches where id = '00000000-0000-0000-0000-00000000001a';
delete from match_cycles where id = '00000000-0000-0000-0000-0000000000c1';

do $$ begin raise notice '── ALL RLS SMOKE TESTS PASSED ──'; end $$;
