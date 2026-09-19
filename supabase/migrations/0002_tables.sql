-- Repetido de 0001: cada ficheiro de migração pode correr na sua própria
-- sessão, por isso este SET não pode depender de ter "sobrevivido" de um
-- ficheiro anterior. Precisa de estar aqui porque usamos os tipos
-- "geography" e "vector" mais abaixo.
set search_path = public, extensions;

-- ─────────────────────────────────────────────────────────────
-- UTILIZADORES
-- ─────────────────────────────────────────────────────────────
create table profiles (
  id              uuid primary key references auth.users on delete cascade,
  role            user_role not null,
  full_name       text,
  phone           text,
  phone_verified  boolean not null default false,
  email_verified  boolean not null default false,
  locale          text not null default 'pt-PT',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Auto-create a profile row when a new auth user signs up.
-- role/full_name come from the signup form via raw_user_meta_data.
create or replace function handle_new_auth_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'worker'),
    new.raw_user_meta_data->>'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ─────────────────────────────────────────────────────────────
-- TRABALHADOR
-- ─────────────────────────────────────────────────────────────
create table worker_profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references profiles(id) on delete cascade,

  display_alias         text not null,
  photo_url             text,

  headline              text,
  summary               text,
  years_experience      numeric(4,1) not null default 0,

  location_point        geography(point,4326) not null,
  location_label        text not null,
  max_commute_minutes   int not null default 45,
  commute_modes         text[] not null default '{"transit","car"}',

  salary_min            int not null,
  salary_ideal          int,
  accepted_contracts    contract_type[] not null,
  accepted_work_modes   work_mode[] not null,

  availability          availability not null default 'active',
  available_from        date,
  urgent                boolean not null default false,
  weekly_availability   jsonb not null,
  accepts_nights        boolean not null default false,
  accepts_weekends      boolean not null default false,

  skills                jsonb not null default '[]',
  languages              jsonb not null default '[]',
  licences               text[] not null default '{}',
  certifications         jsonb not null default '[]',
  work_authorisation     text not null,
  min_age_ok             boolean not null default true,

  blocked_company_ids    uuid[] not null default '{}',
  blocked_sectors        text[] not null default '{}',
  hard_nos                jsonb not null default '[]',

  verification_level     verification_lvl not null default 'none',
  response_rate          numeric(4,3),
  interview_show_rate     numeric(4,3),
  trust_score              numeric(4,3) not null default 0.5,

  embedding               vector(1024),

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  last_active_at           timestamptz not null default now()
);

create trigger worker_profiles_set_updated_at
  before update on worker_profiles
  for each row execute function set_updated_at();

create index on worker_profiles using ivfflat (embedding vector_cosine_ops) with (lists=100);
create index on worker_profiles using gist (location_point);
create index on worker_profiles (availability, salary_min);

-- ─────────────────────────────────────────────────────────────
-- EMPRESA
-- ─────────────────────────────────────────────────────────────
create table companies (
  id                    uuid primary key default gen_random_uuid(),
  owner_user_id         uuid not null references profiles(id),
  legal_name            text not null,
  trade_name            text not null,
  nipc                  text unique,
  sector                text not null,
  size_band             text,
  logo_url              text,
  description           text,
  website               text,

  verification_level    verification_lvl not null default 'none',
  nipc_verified          boolean not null default false,
  domain_verified        boolean not null default false,
  manually_reviewed       boolean not null default false,

  response_rate_48h      numeric(4,3),
  avg_response_hours      numeric(6,2),
  hire_rate               numeric(4,3),
  abandon_rate             numeric(4,3),
  total_hires              int not null default 0,
  ghost_flag                boolean not null default false,

  created_at                timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- VAGA
-- ─────────────────────────────────────────────────────────────
create table jobs (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  created_by            uuid not null references profiles(id),

  title                 text not null,
  description           text not null,
  sector                text not null,

  salary_min            int not null,
  salary_max            int not null,
  contract              contract_type not null,
  work_mode             work_mode not null,
  location_point        geography(point,4326) not null,
  location_label        text not null,
  weekly_schedule       jsonb not null,
  has_nights            boolean not null default false,
  has_weekends          boolean not null default false,

  required_skills       jsonb not null,
  min_years_experience  numeric(4,1) not null default 0,
  required_languages    jsonb not null default '[]',
  required_licences     text[] not null default '{}',
  required_certs        text[] not null default '{}',
  requires_work_auth    boolean not null default true,
  min_age                int,

  positions_count        int not null default 1,
  fill_by_date            date not null,
  intent_declared_at       timestamptz not null default now(),
  intent_signed_by         uuid not null references profiles(id),

  blocked_worker_ids       uuid[] not null default '{}',

  status                    job_status not null default 'draft',
  start_date                 date,

  embedding                   vector(1024),

  created_at                   timestamptz not null default now(),
  published_at                  timestamptz,
  last_activity_at                timestamptz not null default now(),
  check (salary_max >= salary_min)
);

create index on jobs using ivfflat (embedding vector_cosine_ops) with (lists=100);
create index on jobs using gist (location_point);
create index on jobs (status, published_at desc);
create index on jobs (company_id);

-- ─────────────────────────────────────────────────────────────
-- CICLOS DE MATCHING
-- ─────────────────────────────────────────────────────────────
create table match_cycles (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  workers_evaluated int,
  jobs_evaluated    int,
  pairs_scored      int,
  matches_created   int,
  engine_version    text not null,
  weights_version   text not null,
  notes             jsonb
);

-- ─────────────────────────────────────────────────────────────
-- MATCH — o objeto central
-- ─────────────────────────────────────────────────────────────
create table matches (
  id                    uuid primary key default gen_random_uuid(),
  worker_id             uuid not null references worker_profiles(id) on delete cascade,
  job_id                uuid not null references jobs(id) on delete cascade,
  cycle_id              uuid not null references match_cycles(id),

  fit_employer          numeric(5,4) not null,
  fit_worker            numeric(5,4) not null,
  harmonic_score        numeric(5,4) not null,
  priority_score        numeric(8,6) not null,

  score_breakdown       jsonb not null,
  engine_version        text not null,
  weights_version       text not null,

  explanation_worker    text not null,
  explanation_employer  text not null,

  status                match_status not null default 'pending',
  worker_responded_at   timestamptz,
  employer_responded_at timestamptz,
  worker_decline_reason decline_reason,
  employer_decline_reason decline_reason,
  decline_note          text,

  expires_at            timestamptz not null,
  confirmed_at           timestamptz,

  contested              boolean not null default false,
  contested_at            timestamptz,
  contest_note             text,
  human_reviewed_at         timestamptz,
  human_reviewer_id          uuid references profiles(id),

  created_at                  timestamptz not null default now(),

  unique (worker_id, job_id)
);

create index on matches (status, expires_at);
create index on matches (worker_id, created_at desc);
create index on matches (job_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- PÓS-MATCH
-- ─────────────────────────────────────────────────────────────
create table conversations (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null unique references matches(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_msg_at  timestamptz
);

create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender_id        uuid not null references profiles(id),
  body             text not null,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index on messages (conversation_id, created_at);

create table pipeline_events (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches(id) on delete cascade,
  stage       text not null,
  actor_id    uuid references profiles(id),
  note        text,
  occurred_at timestamptz not null default now()
);

create index on pipeline_events (match_id, occurred_at);

create table hires (
  id                   uuid primary key default gen_random_uuid(),
  match_id             uuid not null unique references matches(id),
  confirmed_by_worker  boolean not null default false,
  confirmed_by_employer boolean not null default false,
  start_date           date,
  agreed_salary        int,
  retained_30d         boolean,
  retained_90d         boolean,
  checked_30d_at       timestamptz,
  checked_90d_at       timestamptz,
  created_at           timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- FATURAÇÃO (só empregador)
-- ─────────────────────────────────────────────────────────────
create table billing_accounts (
  company_id            uuid primary key references companies(id) on delete cascade,
  stripe_customer_id    text unique,
  credits_balance       int not null default 0,
  created_at            timestamptz not null default now()
);

create table match_charges (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null unique references matches(id),
  company_id        uuid not null references companies(id),
  amount_cents      int not null,
  method            text not null,
  stripe_payment_id text,
  refunded_at       timestamptz,
  charged_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- AUDITORIA E CONFORMIDADE
-- ─────────────────────────────────────────────────────────────
create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references profiles(id),
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  payload     jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);

create table fairness_audits (
  id             uuid primary key default gen_random_uuid(),
  period_start   date not null,
  period_end     date not null,
  dimension      text not null,
  results        jsonb not null,
  adverse_impact boolean not null,
  action_taken   text,
  created_at     timestamptz not null default now()
);

create table weight_versions (
  version      text primary key,
  segment      text not null,
  weights      jsonb not null,
  active       boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid references profiles(id)
);
