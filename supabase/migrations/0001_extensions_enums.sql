-- Werkwire — extensões e tipos enumerados
create extension if not exists "uuid-ossp";
create extension if not exists vector;
create extension if not exists postgis;

create type user_role        as enum ('worker','employer','admin');
create type availability     as enum ('active','passive','unavailable');
create type contract_type    as enum ('permanent','fixed_term','temporary','freelance','internship');
create type work_mode        as enum ('onsite','hybrid','remote');
create type match_status     as enum (
  'pending',
  'worker_accepted',
  'employer_accepted',
  'confirmed',
  'declined_worker',
  'declined_employer',
  'expired'
);
create type decline_reason   as enum (
  'salary','distance','schedule','skills','sector','contract_type','other'
);
create type job_status       as enum ('draft','active','paused','demoted','filled','closed');
create type verification_lvl as enum ('none','phone','email','identity','full');

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
