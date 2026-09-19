-- Keep conversations.last_msg_at fresh for inbox sorting.
create or replace function touch_conversation_last_message()
returns trigger as $$
begin
  update conversations set last_msg_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger messages_touch_conversation
  after insert on messages
  for each row execute function touch_conversation_last_message();

-- Candidate retrieval for the matching cycle (§6.2): cheap knockout
-- pre-filter + geography radius, called from the internal cycle-run
-- route with the service role (bypasses RLS by design — this is a
-- system job, not a user-facing query).
create or replace function candidate_workers_for_job(
  target_job_id uuid,
  radius_km numeric default 60
)
returns setof worker_profiles as $$
  select wp.*
  from worker_profiles wp
  join jobs j on j.id = target_job_id
  where wp.availability <> 'unavailable'
    and wp.last_active_at > now() - interval '60 days'
    and not (wp.id = any (j.blocked_worker_ids))
    and not (j.company_id = any (wp.blocked_company_ids))
    and not (j.sector = any (wp.blocked_sectors))
    and j.contract = any (wp.accepted_contracts)
    and j.work_mode = any (wp.accepted_work_modes)
    and ST_DWithin(wp.location_point, j.location_point, radius_km * 1000)
  order by wp.location_point <-> j.location_point
  limit 500;
$$ language sql stable security definer set search_path = public, extensions;

-- Top-N workers by embedding cosine similarity for a job (pgvector).
create or replace function similar_workers_for_job(
  target_job_id uuid,
  match_count int default 500
)
returns table (worker_id uuid, similarity numeric) as $$
  select wp.id, 1 - (wp.embedding <=> j.embedding) as similarity
  from worker_profiles wp
  join jobs j on j.id = target_job_id
  where wp.embedding is not null and j.embedding is not null
  order by wp.embedding <=> j.embedding
  limit match_count;
$$ language sql stable security definer set search_path = public, extensions;
