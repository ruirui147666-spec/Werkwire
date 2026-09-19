-- Repeated from 0001: this file may run in its own session, and ST_Y/ST_X
-- below need "extensions" (where postgis lives) resolvable at CREATE VIEW
-- time — a view's defining query is bound to specific function OIDs when
-- created, so this only has to be right once, right now.
set search_path = public, extensions;

-- Flattened, lat/lng-friendly projections of worker_profiles/jobs for the
-- matching cycle route (called with the service role — PostgREST can't
-- easily hand geography columns to supabase-js otherwise, and the cycle
-- route needs plain numbers to feed the pure TS engine).
create view worker_profiles_engine as
select
  wp.*,
  ST_Y(wp.location_point::geometry) as lat,
  ST_X(wp.location_point::geometry) as lng
from worker_profiles wp;

create view jobs_engine as
select
  j.*,
  ST_Y(j.location_point::geometry) as lat,
  ST_X(j.location_point::geometry) as lng,
  c.response_rate_48h as company_response_rate_48h,
  c.hire_rate as company_hire_rate,
  c.abandon_rate as company_abandon_rate,
  c.ghost_flag as company_ghost_flag,
  c.verification_level as company_verification_level
from jobs j
join companies c on c.id = j.company_id;

grant select on worker_profiles_engine, jobs_engine to service_role;
