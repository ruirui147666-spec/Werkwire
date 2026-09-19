-- Werkwire — extensões e tipos enumerados
--
-- Instaladas no schema "extensions" (a convenção do próprio Supabase — os
-- projetos hospedados já têm este schema no search_path de todas as
-- roles por omissão, por isso isto funciona sem qualificar cada
-- referência). `if not exists` torna isto seguro de repetir mesmo que o
-- projeto já as tenha pré-instaladas.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create extension if not exists postgis with schema extensions;

-- Garante, para esta sessão, que os tipos/operadores destas extensões
-- (vector, geography, ...) resolvem sem qualificar cada referência —
-- não confiar no search_path por omissão da role, que varia consoante
-- o ambiente (Supabase hospedado vs. Postgres local).
set search_path = public, extensions;

-- Nota: os IDs usam gen_random_uuid() (núcleo do Postgres desde a v13,
-- sem extensão nenhuma) em vez de uuid_generate_v4() (uuid-ossp) —
-- evita precisamente o erro "function uuid_generate_v4() does not
-- exist" que a extensão uuid-ossp costuma dar em projetos Supabase
-- quando o schema onde fica instalada não está no search_path da role
-- que corre a migração.

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
