-- ─────────────────────────────────────────────────────────────
-- Helpers
--
-- Every cross-table check used inside a policy's USING/WITH CHECK clause
-- MUST be wrapped in one of these SECURITY DEFINER functions rather than
-- written as a raw subquery. A raw subquery against another RLS-protected
-- table runs as the *calling* role, so it re-triggers that table's own
-- policies — and since several of these tables reference each other
-- (worker_profiles -> matches -> jobs -> matches -> ...), that produces
-- "infinite recursion detected in policy" at query time. A SECURITY
-- DEFINER function owned by the migration role runs as that owner, who
-- (absent FORCE ROW LEVEL SECURITY, which we never set) bypasses RLS
-- entirely for every table it touches — so nesting these functions is
-- safe no matter how many tables a check spans.
-- ─────────────────────────────────────────────────────────────
create or replace function is_admin()
returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql stable security definer set search_path = public;

create or replace function owns_company(target_company_id uuid)
returns boolean as $$
  select exists (
    select 1 from companies where id = target_company_id and owner_user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create or replace function owns_worker_profile(target_worker_id uuid)
returns boolean as $$
  select exists (
    select 1 from worker_profiles where id = target_worker_id and user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

-- Is there a CONFIRMED match connecting these two auth.users ids, on
-- either side (worker <-> company owner)? Used to reveal counterpart
-- profiles/companies once contacts are unlocked (P9).
create or replace function has_confirmed_match_between(user_a uuid, user_b uuid)
returns boolean as $$
  select exists (
    select 1 from matches m
    join worker_profiles wp on wp.id = m.worker_id
    join jobs j on j.id = m.job_id
    join companies c on c.id = j.company_id
    where m.status = 'confirmed'
      and (
        (wp.user_id = user_a and c.owner_user_id = user_b)
        or (wp.user_id = user_b and c.owner_user_id = user_a)
      )
  );
$$ language sql stable security definer set search_path = public;

-- Does the calling employer (auth.uid()) have a CONFIRMED match with this worker?
create or replace function employer_confirmed_with_worker(target_worker_id uuid)
returns boolean as $$
  select exists (
    select 1 from matches m
    join jobs j on j.id = m.job_id
    join companies c on c.id = j.company_id
    where m.worker_id = target_worker_id
      and m.status = 'confirmed'
      and c.owner_user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

-- Does the calling worker (auth.uid()) have a CONFIRMED match with this company?
create or replace function worker_confirmed_with_company(target_company_id uuid)
returns boolean as $$
  select exists (
    select 1 from matches m
    join jobs j on j.id = m.job_id
    join worker_profiles wp on wp.id = m.worker_id
    where j.company_id = target_company_id
      and m.status = 'confirmed'
      and wp.user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

-- Does the calling worker (auth.uid()) have ANY match (any status) for this job?
-- (P2: the only way a worker ever sees a job's fields at all.)
create or replace function worker_has_match_for_job(target_job_id uuid)
returns boolean as $$
  select exists (
    select 1 from matches m
    join worker_profiles wp on wp.id = m.worker_id
    where m.job_id = target_job_id and wp.user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

-- Does this job belong to a company the caller owns?
create or replace function job_belongs_to_caller(target_job_id uuid)
returns boolean as $$
  select exists (
    select 1 from jobs j where j.id = target_job_id and owns_company(j.company_id)
  );
$$ language sql stable security definer set search_path = public;

-- Is the caller (worker or employer) a participant of this CONFIRMED match?
create or replace function is_match_participant(target_match_id uuid)
returns boolean as $$
  select exists (
    select 1 from matches m
    join worker_profiles wp on wp.id = m.worker_id
    join jobs j on j.id = m.job_id
    join companies c on c.id = j.company_id
    where m.id = target_match_id
      and m.status = 'confirmed'
      and (wp.user_id = auth.uid() or c.owner_user_id = auth.uid())
  );
$$ language sql stable security definer set search_path = public;

-- Same, but starting from a conversation id.
create or replace function is_conversation_participant(target_conversation_id uuid)
returns boolean as $$
  select exists (
    select 1 from conversations c
    where c.id = target_conversation_id and is_match_participant(c.match_id)
  );
$$ language sql stable security definer set search_path = public;

-- ─────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────
alter table profiles enable row level security;

create policy "read own profile" on profiles for select
  using (id = auth.uid() or is_admin());

create policy "update own profile" on profiles for update
  using (id = auth.uid());

-- A profile linked to a confirmed match becomes visible to the other side
-- (needed to show name/contact once contacts are revealed).
create policy "read counterpart profile after confirmed match" on profiles for select
  using (has_confirmed_match_between(auth.uid(), profiles.id));

-- ─────────────────────────────────────────────────────────────
-- worker_profiles
-- ─────────────────────────────────────────────────────────────
alter table worker_profiles enable row level security;

create policy "worker manages own profile" on worker_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- P9: an employer only sees an identified worker row once a match is confirmed.
create policy "employer_sees_identified_worker_only_on_confirmed_match"
on worker_profiles for select
using (employer_confirmed_with_worker(worker_profiles.id));

create policy "admin reads worker profiles" on worker_profiles for select
  using (is_admin());

-- Column-limited anonymous projection, safe for any employer to browse
-- while deciding on a pending/accepted (unconfirmed) match. Runs as the
-- view owner (table owner bypasses RLS by default, since worker_profiles
-- is not under FORCE ROW LEVEL SECURITY), so it is not blocked by the
-- policies above — the safety guarantee here is that it exposes no PII.
create view worker_profiles_anonymous as
select
  id,
  display_alias,
  headline,
  years_experience,
  skills,
  languages,
  licences,
  split_part(location_label, ',', 2) as location_label, -- concelho only, never freguesia/street
  verification_level,
  availability
from worker_profiles;

grant select on worker_profiles_anonymous to authenticated;

-- ─────────────────────────────────────────────────────────────
-- companies
-- ─────────────────────────────────────────────────────────────
alter table companies enable row level security;

create policy "employer manages own company" on companies for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "worker sees company on confirmed match" on companies for select
  using (worker_confirmed_with_company(companies.id));

create policy "admin reads companies" on companies for select
  using (is_admin());

-- No trade_name / legal_name / website / logo_url / nipc before a match
-- confirms — only reputation and sector-level signal.
create view companies_public as
select
  id,
  sector,
  size_band,
  verification_level,
  response_rate_48h,
  avg_response_hours,
  hire_rate,
  total_hires,
  ghost_flag
from companies;

grant select on companies_public to authenticated;

-- ─────────────────────────────────────────────────────────────
-- jobs
-- ─────────────────────────────────────────────────────────────
alter table jobs enable row level security;

create policy "employer manages own jobs" on jobs for all
  using (owns_company(company_id))
  with check (owns_company(company_id));

-- A worker may read a job's fields only through an existing match —
-- there is no browse/search path (P2).
create policy "worker reads job via own match" on jobs for select
  using (worker_has_match_for_job(jobs.id));

create policy "admin reads jobs" on jobs for select
  using (is_admin());

-- ─────────────────────────────────────────────────────────────
-- match_cycles — internal/system only, no direct client access
-- ─────────────────────────────────────────────────────────────
alter table match_cycles enable row level security;

create policy "admin reads match cycles" on match_cycles for select
  using (is_admin());

-- ─────────────────────────────────────────────────────────────
-- matches — reads only for the client; writes go through API routes
-- using the service role, which enforces the accept/decline/charge
-- transaction and bypasses RLS entirely.
-- ─────────────────────────────────────────────────────────────
alter table matches enable row level security;

create policy "worker reads own matches" on matches for select
  using (owns_worker_profile(worker_id));

create policy "employer reads own job matches" on matches for select
  using (job_belongs_to_caller(matches.job_id));

create policy "admin reads matches" on matches for select
  using (is_admin());

-- ─────────────────────────────────────────────────────────────
-- conversations / messages — only reachable once a match is confirmed
-- ─────────────────────────────────────────────────────────────
alter table conversations enable row level security;

create policy "participants read own conversation" on conversations for select
  using (is_match_participant(conversations.match_id));

alter table messages enable row level security;

create policy "participants read conversation messages" on messages for select
  using (is_conversation_participant(messages.conversation_id));

create policy "participants send messages" on messages for insert
  with check (sender_id = auth.uid() and is_conversation_participant(messages.conversation_id));

-- ─────────────────────────────────────────────────────────────
-- pipeline_events / hires
-- ─────────────────────────────────────────────────────────────
alter table pipeline_events enable row level security;

create policy "participants read pipeline events" on pipeline_events for select
  using (is_match_participant(pipeline_events.match_id));

alter table hires enable row level security;

create policy "participants read hire record" on hires for select
  using (is_match_participant(hires.match_id));

-- ─────────────────────────────────────────────────────────────
-- billing_accounts / match_charges — employer side only
-- ─────────────────────────────────────────────────────────────
alter table billing_accounts enable row level security;

create policy "employer reads own billing account" on billing_accounts for select
  using (owns_company(company_id));

-- Created once, right after the company itself, from the employer's own
-- session (not the service role) — needs an explicit insert policy.
create policy "employer creates own billing account" on billing_accounts for insert
  with check (owns_company(company_id));

alter table match_charges enable row level security;

create policy "employer reads own charges" on match_charges for select
  using (owns_company(company_id));

-- ─────────────────────────────────────────────────────────────
-- audit_log / fairness_audits / weight_versions — admin only
-- ─────────────────────────────────────────────────────────────
alter table audit_log enable row level security;
create policy "admin reads audit log" on audit_log for select using (is_admin());

alter table fairness_audits enable row level security;
create policy "admin reads fairness audits" on fairness_audits for select using (is_admin());

alter table weight_versions enable row level security;
create policy "admin reads weight versions" on weight_versions for select using (is_admin());

-- ─────────────────────────────────────────────────────────────
-- Grants — RLS still filters rows; these grants only allow the
-- authenticated role to attempt the statement in the first place.
-- ─────────────────────────────────────────────────────────────
grant select, update on profiles to authenticated;
grant select, insert, update, delete on worker_profiles to authenticated;
grant select, insert, update, delete on companies to authenticated;
grant select, insert, update, delete on jobs to authenticated;
grant select on match_cycles to authenticated;
grant select on matches to authenticated;
grant select on conversations to authenticated;
grant select, insert on messages to authenticated;
grant select on pipeline_events to authenticated;
grant select on hires to authenticated;
grant select, insert on billing_accounts to authenticated;
grant select on match_charges to authenticated;
grant select on audit_log, fairness_audits, weight_versions to authenticated;
