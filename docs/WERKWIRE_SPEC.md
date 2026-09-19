# Werkwire — Especificação Técnica Completa

> **Documento de construção.** Destinatário: Claude Code.
> Objetivo: construir a app Werkwire de raiz, do zero ao MVP funcional com receita.
> Versão: 1.0 — 2026-09-19
> Língua do produto: **português de Portugal** (pt-PT). Código, nomes de tabelas e variáveis em **inglês**.

---

## 0. TL;DR para quem constrói

Werkwire é um marketplace de emprego **sem candidaturas**. Não existe botão "candidatar-se". Não existe pesquisa de candidatos pelo recrutador. Um motor de matching corre em ciclos, emparelha perfis com vagas segundo um conjunto de condições explícitas, e **notifica os dois lados ao mesmo tempo**. Só quando ambos aceitam é que os contactos são revelados e abre um canal de conversa.

Três invariantes que definem o produto. Se o código as violar, o produto deixa de ser Werkwire:

1. **Nenhum utilizador inicia contacto.** Só o motor emparelha.
2. **Um match só existe se servir bem aos DOIS lados** (duplo limiar + média harmónica).
3. **Há quota.** Máximo 3 matches/dia por candidato, 5 matches/ciclo por vaga. Escassez é feature, não bug.

---

## 1. Contexto de mercado (porquê estas decisões)

Dados que justificam as escolhas de design abaixo. Não apagar — são a razão de ser de cada invariante.

- O LinkedIn recebe ~11.000 candidaturas/minuto (+45% num ano). A Greenhouse tem média de 254 candidatos por vaga. → **Invariante 1: eliminar candidaturas.**
- Recrutadores estão deliberadamente a *adicionar* fricção às candidaturas, revertendo uma década de "1-click apply". → **Invariante 3: quota.**
- 18–22% das vagas publicadas são "ghost jobs". 61% dos candidatos são ignorados após entrevista. → **SLA de 48h + score público de empregador.**
- Gartner: até 2028, 25% dos candidatos serão falsos. → **Verificação em camadas.**
- AI Act, Anexo III: matching, ranking e pontuação de candidatos são **alto risco**. Regime adiado para 2027-12-02, mas as obrigações não mudaram. → **Auditabilidade desde o primeiro commit.**

---

## 2. Princípios invioláveis (regras de arquitetura)

| # | Regra | Consequência no código |
|---|---|---|
| P1 | Não existe endpoint de candidatura | Nenhuma rota `POST /applications`. O único caminho para contacto é `match.status = 'confirmed'` |
| P2 | Não existe pesquisa de candidatos pelo empregador | Nenhuma rota de busca em `worker_profiles` a partir da consola do empregador |
| P3 | Duplo limiar | `fit_employer >= 0.62 AND fit_worker >= 0.62`, ambos, sempre |
| P4 | Média harmónica, nunca aritmética | `H = 2ab/(a+b)` |
| P5 | Todo o match é explicável em texto | `match.explanation_worker` e `match.explanation_employer` são NOT NULL |
| P6 | Todo o match é auditável | `match.score_breakdown` (JSONB) guarda o valor de **cada** condição + `engine_version` + `weights_version` |
| P7 | A decisão final é sempre humana | O motor emparelha. Nunca rejeita definitivamente, nunca contrata |
| P8 | O candidato nunca paga | Nenhum fluxo Stripe no lado do trabalhador |
| P9 | Anonimato até ao match confirmado | Nome, foto, email, telefone e empresa exata só são servidos após `status = 'confirmed'` — imposto por RLS, não por UI |
| P10 | Motor isolado | `packages/matching-engine` é puro TypeScript, sem imports de Supabase, Next.js ou rede. Testável offline |

---

## 3. Stack

| Camada | Tecnologia | Notas |
|---|---|---|
| Frontend + API | Next.js 15 (App Router) / Vercel | PWA. Sem app nativa na v1 |
| Base de dados | Supabase Postgres + **pgvector** | `create extension vector;` obrigatório |
| Auth / RLS / Realtime / Storage | Supabase | RLS é a linha de defesa de P9 |
| LLM (parsing + explicações) | Groq (Llama 3.3 70B ou equivalente) | Só parsing e redação. **Nunca decide matches** |
| Embeddings | Modelo multilingue com bom pt-PT | 768 ou 1024 dims. Testar em pt-PT antes de fixar |
| Ciclo em lote | Cloudflare Workers + Cron Triggers | 08:00 e 18:00 Europe/Lisbon |
| Filas | Supabase `pgmq` | Fan-out de notificações |
| Pagamentos | Stripe Checkout + Billing | Só lado empregador |
| WhatsApp | Meta Cloud API | Onboarding de voz/texto para quem não tem CV |
| Email | Resend | Transacional |
| Push | Web Push (VAPID) | PWA |
| Analytics | PostHog | Funis desde o dia 1 |
| Testes | Vitest (unit) + Playwright (e2e) | O motor tem de ter cobertura >90% |

### Estrutura de pastas (monorepo pnpm)

```
werkwire/
├─ apps/
│  ├─ web/                      # Next.js 15 — worker + employer + admin
│  │  ├─ app/
│  │  │  ├─ (marketing)/
│  │  │  ├─ (worker)/w/         # área do trabalhador
│  │  │  ├─ (employer)/e/       # área do empregador
│  │  │  ├─ (admin)/admin/
│  │  │  └─ api/
│  │  ├─ components/
│  │  └─ lib/
│  └─ cron/                     # Cloudflare Worker — ciclo de matching
├─ packages/
│  ├─ matching-engine/          # PURO. Zero I/O. O coração do produto
│  │  ├─ src/
│  │  │  ├─ knockout.ts
│  │  │  ├─ soft/               # uma função por condição
│  │  │  ├─ reciprocal.ts
│  │  │  ├─ allocate.ts         # deferred acceptance + quotas
│  │  │  ├─ explain.ts
│  │  │  ├─ weights/            # pesos por segmento (JSON versionado)
│  │  │  └─ index.ts
│  │  └─ test/                  # fixtures de casos reais
│  ├─ db/                       # migrations SQL + tipos gerados
│  ├─ shared/                   # tipos e zod schemas partilhados
│  └─ notifications/
└─ supabase/
   ├─ migrations/
   └─ seed.sql
```

---

## 4. Modelo de dados

SQL completo para a migração inicial. Todos os timestamps em `timestamptz`.

```sql
create extension if not exists "uuid-ossp";
create extension if not exists vector;
create extension if not exists postgis;   -- para cálculo de distância

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────
create type user_role        as enum ('worker','employer','admin');
create type availability     as enum ('active','passive','unavailable');
create type contract_type    as enum ('permanent','fixed_term','temporary','freelance','internship');
create type work_mode        as enum ('onsite','hybrid','remote');
create type match_status     as enum (
  'pending',            -- notificado, ninguém respondeu
  'worker_accepted',
  'employer_accepted',
  'confirmed',          -- ambos aceitaram → contactos revelados
  'declined_worker',
  'declined_employer',
  'expired'
);
create type decline_reason   as enum (
  'salary','distance','schedule','skills','sector','contract_type','other'
);
create type job_status       as enum ('draft','active','paused','demoted','filled','closed');
create type verification_lvl as enum ('none','phone','email','identity','full');

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

-- ─────────────────────────────────────────────────────────────
-- TRABALHADOR
-- ─────────────────────────────────────────────────────────────
create table worker_profiles (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null unique references profiles(id) on delete cascade,

  -- identidade (NUNCA servida antes de match confirmado — ver RLS)
  display_alias         text not null,            -- ex.: "Candidato #A7F2"
  photo_url             text,

  -- essencial
  headline              text,                     -- "Empregado de mesa, 4 anos"
  summary               text,
  years_experience      numeric(4,1) not null default 0,

  -- localização
  location_point        geography(point,4326) not null,
  location_label        text not null,            -- "Amadora, Lisboa"
  max_commute_minutes   int not null default 45,  -- TEMPO, não km
  commute_modes         text[] not null default '{"transit","car"}',

  -- condições económicas
  salary_min            int not null,             -- EUR/mês bruto
  salary_ideal          int,
  accepted_contracts    contract_type[] not null,
  accepted_work_modes   work_mode[] not null,

  -- disponibilidade
  availability          availability not null default 'active',
  available_from        date,
  urgent                boolean not null default false,  -- "preciso esta semana"
  weekly_availability   jsonb not null,           -- ver §4.1
  accepts_nights        boolean not null default false,
  accepts_weekends      boolean not null default false,

  -- competências e credenciais
  skills                jsonb not null default '[]',  -- ver §4.2
  languages             jsonb not null default '[]',  -- [{code:'pt',level:'native'}]
  licences              text[] not null default '{}', -- ['driving_b','forklift','haccp']
  certifications        jsonb not null default '[]',
  work_authorisation    text not null,            -- 'eu','residence_permit','pending','none'
  min_age_ok            boolean not null default true,

  -- DEALBREAKERS (o sinal mais barato e mais preditivo)
  blocked_company_ids   uuid[] not null default '{}',
  blocked_sectors       text[] not null default '{}',
  hard_nos              jsonb not null default '[]', -- ver §4.3

  -- sinais de plataforma
  verification_level    verification_lvl not null default 'none',
  response_rate         numeric(4,3),             -- histórico, null se <5 matches
  interview_show_rate   numeric(4,3),
  trust_score           numeric(4,3) not null default 0.5,

  -- vetor
  embedding             vector(1024),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  last_active_at        timestamptz not null default now()
);

create index on worker_profiles using ivfflat (embedding vector_cosine_ops) with (lists=100);
create index on worker_profiles using gist (location_point);
create index on worker_profiles (availability, salary_min);

-- ─────────────────────────────────────────────────────────────
-- EMPRESA
-- ─────────────────────────────────────────────────────────────
create table companies (
  id                    uuid primary key default uuid_generate_v4(),
  owner_user_id         uuid not null references profiles(id),
  legal_name            text not null,
  trade_name            text not null,
  nipc                  text unique,              -- validado contra base pública
  sector                text not null,
  size_band             text,                     -- '1-9','10-49','50-249','250+'
  logo_url              text,
  description           text,
  website               text,

  verification_level    verification_lvl not null default 'none',
  nipc_verified         boolean not null default false,
  domain_verified       boolean not null default false,
  manually_reviewed     boolean not null default false,

  -- SCORE PÚBLICO (visível ao candidato ANTES de aceitar)
  response_rate_48h     numeric(4,3),
  avg_response_hours    numeric(6,2),
  hire_rate             numeric(4,3),
  abandon_rate          numeric(4,3),
  total_hires           int not null default 0,
  ghost_flag            boolean not null default false,

  created_at            timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- VAGA
-- ─────────────────────────────────────────────────────────────
create table jobs (
  id                    uuid primary key default uuid_generate_v4(),
  company_id            uuid not null references companies(id) on delete cascade,
  created_by            uuid not null references profiles(id),

  title                 text not null,
  description           text not null,
  sector                text not null,

  -- OBRIGATÓRIOS. Sem estes não publica. Decisão de produto, não técnica.
  salary_min            int not null,
  salary_max            int not null,
  contract              contract_type not null,
  work_mode             work_mode not null,
  location_point        geography(point,4326) not null,
  location_label        text not null,
  weekly_schedule       jsonb not null,           -- mesma forma que weekly_availability
  has_nights            boolean not null default false,
  has_weekends          boolean not null default false,

  -- requisitos
  required_skills       jsonb not null,           -- ver §4.2, cada uma com weight
  min_years_experience  numeric(4,1) not null default 0,
  required_languages    jsonb not null default '[]',
  required_licences     text[] not null default '{}',
  required_certs        text[] not null default '{}',
  requires_work_auth    boolean not null default true,
  min_age               int,

  -- intenção real (anti-ghost-job)
  positions_count       int not null default 1,
  fill_by_date          date not null,
  intent_declared_at    timestamptz not null default now(),
  intent_signed_by      uuid not null references profiles(id),

  -- vetos do empregador
  blocked_worker_ids    uuid[] not null default '{}',

  status                job_status not null default 'draft',
  start_date            date,

  embedding             vector(1024),

  created_at            timestamptz not null default now(),
  published_at          timestamptz,
  last_activity_at      timestamptz not null default now()
);

create index on jobs using ivfflat (embedding vector_cosine_ops) with (lists=100);
create index on jobs using gist (location_point);
create index on jobs (status, published_at desc);

-- ─────────────────────────────────────────────────────────────
-- MATCH — o objeto central
-- ─────────────────────────────────────────────────────────────
create table matches (
  id                    uuid primary key default uuid_generate_v4(),
  worker_id             uuid not null references worker_profiles(id) on delete cascade,
  job_id                uuid not null references jobs(id) on delete cascade,
  cycle_id              uuid not null references match_cycles(id),

  -- scores
  fit_employer          numeric(5,4) not null,    -- quanto o candidato serve a vaga
  fit_worker            numeric(5,4) not null,    -- quanto a vaga serve o candidato
  harmonic_score        numeric(5,4) not null,    -- 2ab/(a+b)
  priority_score        numeric(8,6) not null,    -- após P(resp), P(acc), congestão

  -- AUDITORIA (P6) — obrigatório para AI Act
  score_breakdown       jsonb not null,           -- ver §4.4
  engine_version        text not null,
  weights_version       text not null,

  -- EXPLICAÇÃO (P5)
  explanation_worker    text not null,
  explanation_employer  text not null,

  status                match_status not null default 'pending',
  worker_responded_at   timestamptz,
  employer_responded_at timestamptz,
  worker_decline_reason decline_reason,
  employer_decline_reason decline_reason,
  decline_note          text,

  expires_at            timestamptz not null,     -- created_at + 48h
  confirmed_at          timestamptz,

  -- contestação (AI Act, direito de revisão)
  contested             boolean not null default false,
  contested_at          timestamptz,
  contest_note          text,
  human_reviewed_at     timestamptz,
  human_reviewer_id     uuid references profiles(id),

  created_at            timestamptz not null default now(),

  unique (worker_id, job_id)                      -- nunca emparelhar duas vezes o mesmo par
);

create index on matches (status, expires_at);
create index on matches (worker_id, created_at desc);
create index on matches (job_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- CICLOS DE MATCHING (rastreio + reprodutibilidade)
-- ─────────────────────────────────────────────────────────────
create table match_cycles (
  id                uuid primary key default uuid_generate_v4(),
  kind              text not null,                -- 'batch' | 'event'
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
-- PÓS-MATCH
-- ─────────────────────────────────────────────────────────────
create table conversations (
  id           uuid primary key default uuid_generate_v4(),
  match_id     uuid not null unique references matches(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_msg_at  timestamptz
);

create table messages (
  id               uuid primary key default uuid_generate_v4(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender_id        uuid not null references profiles(id),
  body             text not null,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

create table pipeline_events (
  id          uuid primary key default uuid_generate_v4(),
  match_id    uuid not null references matches(id) on delete cascade,
  stage       text not null,   -- 'chat','interview_scheduled','interview_done','offer','hired','dropped'
  actor_id    uuid references profiles(id),
  note        text,
  occurred_at timestamptz not null default now()
);

create table hires (
  id                   uuid primary key default uuid_generate_v4(),
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
  id                uuid primary key default uuid_generate_v4(),
  match_id          uuid not null unique references matches(id),
  company_id        uuid not null references companies(id),
  amount_cents      int not null,
  method            text not null,   -- 'credit' | 'stripe'
  stripe_payment_id text,
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
  id             uuid primary key default uuid_generate_v4(),
  period_start   date not null,
  period_end     date not null,
  dimension      text not null,       -- 'age_band','gender','nationality_group'
  results        jsonb not null,      -- taxas de match por grupo + rácio de impacto adverso
  adverse_impact boolean not null,
  action_taken   text,
  created_at     timestamptz not null default now()
);

create table weight_versions (
  version      text primary key,
  segment      text not null,        -- 'default','hospitality','retail','logistics','care','construction'
  weights      jsonb not null,
  active       boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid references profiles(id)
);
```

### 4.1 — Forma de `weekly_availability` / `weekly_schedule`

```json
{
  "mon": [{"from": "08:00", "to": "17:00"}],
  "tue": [{"from": "08:00", "to": "17:00"}],
  "wed": [],
  "thu": [{"from": "14:00", "to": "22:00"}],
  "fri": [{"from": "08:00", "to": "17:00"}],
  "sat": [],
  "sun": []
}
```

### 4.2 — Forma de `skills` / `required_skills`

```json
// worker_profiles.skills
[
  {"slug": "customer_service", "label": "Atendimento ao cliente", "years": 4, "verified": false},
  {"slug": "pos_systems",      "label": "Sistemas POS",           "years": 3, "verified": true}
]

// jobs.required_skills
[
  {"slug": "customer_service", "label": "Atendimento ao cliente", "weight": "essential", "min_years": 2},
  {"slug": "pos_systems",      "label": "Sistemas POS",           "weight": "desirable", "min_years": 0}
]
```

`weight` ∈ `{essential, desirable}`. **Essencial em falta não é knockout** — reduz fortemente o score. Só o Tipo 1 (§5.1) é knockout.

### 4.3 — Forma de `hard_nos`

```json
[
  {"type": "no_sundays"},
  {"type": "no_freelance"},
  {"type": "no_night_shifts"},
  {"type": "no_sector", "value": "telemarketing"},
  {"type": "min_contract_months", "value": 6}
]
```

### 4.4 — Forma de `score_breakdown` (auditoria)

```json
{
  "knockouts": {
    "work_authorisation": true,
    "required_licences": true,
    "max_commute": true,
    "hard_nos": true,
    "blocked": true,
    "min_age": true
  },
  "soft_employer": {
    "skills":     {"raw": 0.92, "weight": 0.30, "contribution": 0.276},
    "experience": {"raw": 0.90, "weight": 0.15, "contribution": 0.135},
    "languages":  {"raw": 1.00, "weight": 0.10, "contribution": 0.100},
    "schedule":   {"raw": 0.85, "weight": 0.15, "contribution": 0.128},
    "commute":    {"raw": 0.78, "weight": 0.15, "contribution": 0.117},
    "semantic":   {"raw": 0.71, "weight": 0.15, "contribution": 0.107}
  },
  "soft_worker": {
    "salary":     {"raw": 0.80, "weight": 0.30, "contribution": 0.240},
    "commute":    {"raw": 0.78, "weight": 0.20, "contribution": 0.156},
    "schedule":   {"raw": 0.85, "weight": 0.20, "contribution": 0.170},
    "contract":   {"raw": 1.00, "weight": 0.15, "contribution": 0.150},
    "work_mode":  {"raw": 1.00, "weight": 0.10, "contribution": 0.100},
    "employer_reputation": {"raw": 0.66, "weight": 0.05, "contribution": 0.033}
  },
  "fit_employer": 0.863,
  "fit_worker":   0.849,
  "harmonic":     0.856,
  "context": {
    "p_employer_responds": 0.82,
    "p_worker_accepts":    0.61,
    "congestion_divisor":  1.4,
    "freshness":           0.95
  },
  "priority": 0.306,
  "commute_minutes": 18,
  "engine_version": "1.0.0",
  "weights_version": "hospitality-v1"
}
```

---

## 5. O motor de matching

Package `packages/matching-engine`. **Puro.** Recebe objetos simples, devolve objetos simples. Zero I/O.

### 5.1 — Tipo 1: Condições eliminatórias (knockout)

Binárias. Uma falha → o par não existe. Baratas, corram primeiro.

```ts
export interface KnockoutResult {
  passed: boolean;
  failed: string[];   // ['required_licences','max_commute']
}

export function evaluateKnockouts(
  worker: WorkerProfile,
  job: Job,
  ctx: { commuteMinutes: number }
): KnockoutResult;
```

Verificações, por esta ordem (mais barata primeiro):

1. `job.blocked_worker_ids` não contém `worker.id`
2. `worker.blocked_company_ids` não contém `job.company_id`
3. `worker.blocked_sectors` não contém `job.sector`
4. `worker.availability !== 'unavailable'`
5. `job.status === 'active'`
6. `job.requires_work_auth` → `worker.work_authorisation ∈ {'eu','residence_permit'}`
7. `job.min_age` → `worker.min_age_ok`
8. Todas as `job.required_licences` ⊆ `worker.licences`
9. Todas as `job.required_certs` ⊆ certificações do worker
10. `job.has_nights && !worker.accepts_nights` → falha
11. `job.has_weekends && !worker.accepts_weekends` → falha
12. `ctx.commuteMinutes <= worker.max_commute_minutes`
13. `job.work_mode ∈ worker.accepted_work_modes`
14. `job.contract ∈ worker.accepted_contracts`
15. Cada `hard_no` do worker é avaliado contra a vaga
16. Língua: nível mínimo exigido está satisfeito

### 5.2 — Tipo 2: Condições graduais (soft)

Cada função devolve `number` em `[0,1]`. **Determinística. Testável. Explicável numa frase.** Um ficheiro por condição em `src/soft/`.

#### salary.ts — sobreposição de intervalos

```ts
export function scoreSalary(
  workerMin: number, workerIdeal: number | null,
  jobMin: number, jobMax: number
): number;
```

Regras:
- Se `jobMax < workerMin` → **0** (a vaga não paga o mínimo da pessoa)
- Sobreposição = `max(0, min(jobMax, workerIdeal ?? jobMax) - max(jobMin, workerMin))`
- Amplitude de referência = `workerIdeal ? workerIdeal - workerMin : jobMax - jobMin`
- `score = clamp(overlap / max(range, 1), 0, 1)`
- Bónus: se `jobMin >= workerIdeal` → **1.0**

#### skills.ts — cobertura ponderada + adjacência

```ts
export function scoreSkills(
  workerSkills: WorkerSkill[],
  requiredSkills: RequiredSkill[],
  adjacency: AdjacencyMap        // tabela de competências adjacentes, injetada
): number;
```

- Essencial: peso 3. Desejável: peso 1.
- Match exato de `slug` → 1.0
- Match por adjacência (ex.: `warehouse_operator` ↔ `forklift`) → valor da tabela (0.4–0.8)
- Sem match → 0
- Se a competência tem `min_years`, multiplica por `clamp(workerYears / min_years, 0, 1)`
- Competência com `verified: true` → ×1.1 (teto 1.0)
- `score = Σ(peso × valor) / Σ(peso)`

#### experience.ts — curva suave, nunca degrau

```ts
export function scoreExperience(workerYears: number, minYears: number): number;
```

- `minYears === 0` → 1.0
- `ratio = workerYears / minYears`
- `ratio >= 1` → 1.0
- `ratio >= 0.7` → `0.75 + (ratio - 0.7) * 0.833`
- `ratio >= 0.4` → `0.40 + (ratio - 0.4) * 1.167`
- caso contrário → `ratio`
- **Nunca devolver 0 por 4 anos numa vaga de 5.**

#### commute.ts — tempo real porta-a-porta

```ts
export function scoreCommute(
  minutes: number,
  maxMinutes: number
): number;
```

- `score = 1 - (minutes / maxMinutes)^1.5`
- Decai devagar no início, rápido perto do limite.
- **O cálculo de `minutes` é externo ao motor** (ver §6.3). O motor recebe o número já calculado.

#### schedule.ts — sobreposição de calendários

```ts
export function scoreSchedule(
  workerAvailability: WeeklySchedule,
  jobSchedule: WeeklySchedule
): number;
```

- Para cada dia, calcula minutos da vaga cobertos pela disponibilidade do worker
- `score = minutos_cobertos / minutos_totais_da_vaga`
- `< 0.6` é praticamente eliminatório na prática (o peso trata disso)

#### languages.ts, contract.ts, workMode.ts, sector.ts

Todas triviais. Match exato ou nível ≥ exigido → 1.0; parcial → escala definida; sem match → 0.

#### semantic.ts — similaridade vetorial

```ts
export function scoreSemantic(cosineSimilarity: number): number;
```

- Similaridade cosseno (calculada pelo pgvector, injetada no motor)
- Normalizar: `clamp((cos - 0.5) / 0.4, 0, 1)` — abaixo de 0.5 não é sinal
- **Peso nunca superior a 0.15.** O embedding apanha nuance, não decide.

#### employerReputation.ts

```ts
export function scoreEmployerReputation(c: {
  response_rate_48h: number | null;
  hire_rate: number | null;
  abandon_rate: number | null;
  ghost_flag: boolean;
  verification_level: VerificationLevel;
}): number;
```

- Empresa nova (sem histórico) → **0.6** (neutro-positivo, para não a matar à nascença)
- `ghost_flag` → ×0.3
- `verification_level = 'full'` → +0.1

### 5.3 — Tipo 3: Reciprocidade (a diferenciação central)

```ts
export function computeFit(
  worker: WorkerProfile,
  job: Job,
  ctx: ScoringContext,
  weights: SegmentWeights
): { fitEmployer: number; fitWorker: number; breakdown: ScoreBreakdown };

export function harmonic(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  return (2 * a * b) / (a + b);
}

export const THRESHOLD = 0.62;   // configurável por segmento

export function isMatch(fitEmployer: number, fitWorker: number): boolean {
  return fitEmployer >= THRESHOLD
      && fitWorker   >= THRESHOLD
      && harmonic(fitEmployer, fitWorker) >= THRESHOLD;
}
```

**Pesos por omissão** (segmento `default`; sobrepor por sector em `weight_versions`):

```json
{
  "employer": {
    "skills": 0.30, "experience": 0.15, "languages": 0.10,
    "schedule": 0.15, "commute": 0.15, "semantic": 0.15
  },
  "worker": {
    "salary": 0.30, "commute": 0.20, "schedule": 0.20,
    "contract": 0.15, "work_mode": 0.10, "employer_reputation": 0.05
  },
  "threshold": 0.62
}
```

Cada bloco tem de somar 1.0. **Teste unitário que falha se não somar.**

### 5.4 — Tipo 4: Contexto e prioridade

```ts
export function computePriority(
  harmonicScore: number,
  ctx: {
    pEmployerResponds: number;   // histórico; default 0.6 se novo
    pWorkerAccepts: number;      // histórico; default 0.5 se novo
    congestionDivisor: number;   // 1 + (matches_ativos_da_vaga / 3)
    freshness: number;           // decaimento por idade da vaga e do perfil
  }
): number;
```

```
priority = harmonic × pEmployerResponds × pWorkerAccepts × freshness / congestionDivisor
```

**`freshness`**: `exp(-diasDesdePublicacao / 30)`, com chão em 0.3.
**`congestionDivisor`**: impede que as 10 vagas mais apetecíveis absorvam toda a atenção. Sem isto, o marketplace colapsa — é o erro clássico dos sistemas de recomendação recíproca.

### 5.5 — Tipo 5: Afectação com quotas (deferred acceptance)

A parte que nenhuma app concorrente faz.

```ts
export interface AllocationInput {
  candidatePairs: ScoredPair[];             // todos os pares acima do limiar
  workerQuotas: Map<string, number>;        // default 3/dia
  jobQuotas: Map<string, number>;           // default 5/ciclo
}

export function allocate(input: AllocationInput): ScoredPair[];
```

Algoritmo — Gale-Shapley com quotas dos dois lados:

1. Agrupar pares por worker; ordenar por `priority` desc
2. Cada worker "propõe" às suas melhores vagas até esgotar a quota
3. Cada vaga mantém tentativamente as melhores propostas até à sua quota
4. Vaga cheia que recebe proposta melhor → rejeita a pior, esse worker volta à fila
5. Repetir até estabilizar (garantido a convergir)
6. Devolver as afectações estáveis

**Nota de escala:** ingénuo é O(n·m). Para >10k workers × >1k vagas, aplicar mini-batch por região geográfica + sector. Na v1 (um concelho, um sector) o ingénuo chega e sobra.

### 5.6 — Explicações

```ts
export function explainForWorker(pair: ScoredPair, job: Job): string;
export function explainForEmployer(pair: ScoredPair, worker: WorkerProfile): string;
```

Geradas por **template determinístico**, a partir das 3 condições de maior contribuição. O LLM só pode refinar a redação — nunca inventar razões.

Exemplos obrigatórios de output:

> **Para o trabalhador:** "Match porque: 92% das competências pedidas, 18 minutos de sua casa em transporte público, e o salário (1150–1300€) cobre o que pediu. A empresa responde em média em 4 horas."

> **Para o empregador:** "Match porque: 4 anos de experiência (pede 3), tem todas as competências essenciais, vive a 18 minutos, e está disponível para o horário completo da vaga."

Também é preciso a **explicação negativa**, no painel do trabalhador:

> "Não teve matches esta semana porque o seu salário mínimo está 15% acima da mediana da sua zona para esta função. Se descer para 1120€, aparecem 7 vagas compatíveis."

### 5.7 — Assinatura de topo

```ts
export function runMatching(input: {
  workers: WorkerProfile[];
  jobs: Job[];
  commuteMatrix: Map<string, number>;       // "workerId:jobId" → minutos
  similarityMatrix: Map<string, number>;    // "workerId:jobId" → cosseno
  weights: Record<string, SegmentWeights>;
  existingPairs: Set<string>;               // nunca repetir par
  quotas: { workerDaily: number; jobPerCycle: number };
}): {
  matches: MatchCandidate[];
  stats: CycleStats;
};
```

---

## 6. Ciclo de matching

### 6.1 — Disparo

- **Lote:** Cloudflare Cron, 08:00 e 18:00 `Europe/Lisbon`
- **Evento:** vaga publicada, perfil criado, perfil alterado materialmente → entra na fila, corre em ≤15 min
- Ambos escrevem uma linha em `match_cycles`

### 6.2 — Pipeline

```
1. RECOLHER
   workers: availability != 'unavailable' AND last_active_at > now() - 60 days
   jobs:    status = 'active'

2. RECUPERAR (reduzir o universo)
   Para cada vaga:
     a) SQL com filtros knockout baratos (work_auth, licenças, contrato, modo)
     b) ST_DWithin no location_point (raio generoso, 60 km — o filtro fino é por tempo)
     c) pgvector: top 500 por similaridade cosseno
   → resultado: ~200–500 candidatos plausíveis por vaga

3. ENRIQUECER
   Calcular commuteMinutes para cada par sobrevivente (§6.3)

4. PONTUAR
   runMatching() do motor puro

5. AFECTAR
   allocate() com quotas

6. PERSISTIR
   INSERT em matches com score_breakdown completo, expires_at = now() + 48h

7. NOTIFICAR
   Enfileirar push + email + (opt-in) WhatsApp para AMBOS os lados, em simultâneo

8. FECHAR CICLO
   UPDATE match_cycles SET finished_at, stats
```

### 6.3 — Cálculo de tempo de deslocação

Diferenciador real. Estratégia em camadas, para custo ~0:

1. **Camada 1 (grátis):** matriz pré-calculada de tempos entre freguesias, construída uma vez com dados abertos de transportes + OSRM self-host. Guardar em `commute_cache`.
2. **Camada 2:** cache por par (`worker_freguesia`, `job_freguesia`, `mode`) com TTL de 90 dias.
3. **Camada 3 (fallback):** `distância_haversine / velocidade_média_do_modo` (carro 28 km/h urbano, transporte 16 km/h). Marcar `estimated: true` no breakdown.

**Nunca chamar API paga por par no ciclo em lote.** Seria centenas de milhares de chamadas.

### 6.4 — Expiração e SLA

Job de hora a hora:

- `matches` com `expires_at < now()` e `status = 'pending'` → `expired`
- Um lado aceitou e o outro não respondeu → `expired`, **sem penalizar quem respondeu**
- Empresa com `response_rate_48h < 0.5` em ≥5 matches → `jobs.status = 'demoted'` (prioridade ×0.4)
- Empresa `demoted` que não melhora em 14 dias → `paused` + email a explicar
- Recalcular `companies.response_rate_48h`, `avg_response_hours`, `hire_rate`, `abandon_rate` diariamente

---

## 7. Fluxos de interface

### 7.1 — Onboarding do trabalhador (meta: 90 segundos)

Formato conversacional, um passo por ecrã, barra de progresso. **Nunca um formulário de 40 campos.**

| Passo | Pergunta | Campo |
|---|---|---|
| 1 | "O que sabe fazer?" (chips + texto livre) | `skills`, `headline` |
| 2 | "Onde mora?" (autocomplete freguesia) | `location_point`, `location_label` |
| 3 | "Até quanto tempo aceita viajar?" (15/30/45/60+ min) | `max_commute_minutes`, `commute_modes` |
| 4 | "Quanto precisa de ganhar, no mínimo?" (slider €) | `salary_min`, `salary_ideal` |
| 5 | "Quando pode trabalhar?" (grelha semanal tocável) | `weekly_availability`, `accepts_nights`, `accepts_weekends` |
| 6 | "Que tipo de contrato aceita?" (multi-escolha) | `accepted_contracts`, `accepted_work_modes` |
| 7 | **"O que NUNCA aceita?"** (chips: domingos, recibos verdes, turnos noturnos, telemarketing…) | `hard_nos`, `blocked_sectors` |
| 8 | "Tem alguma carta ou certificado?" (chips) | `licences`, `certifications` |
| 9 | Verificação por SMS | `phone_verified` |

**Atalhos:**
- **Upload de CV** (opcional): PDF/imagem → Groq extrai → pré-preenche os passos 1–8 → a pessoa **confirma cada campo**. Nunca aceitar output do LLM sem confirmação humana.
- **WhatsApp/voz:** o mesmo fluxo por mensagem. Essencial para o mercado de baixa qualificação — é onde estão os utilizadores que nenhum concorrente serve.

**Após o onboarding:** ecrã de espera útil — "O seu perfil está activo. O próximo ciclo de matching é às 18:00. Em média, o primeiro match chega em 19 horas."

### 7.2 — Onboarding da vaga (meta: 3 minutos)

| Passo | Campo |
|---|---|
| 1 | Descrever a vaga em texto livre **ou** colar um anúncio existente → Groq estrutura → confirmar |
| 2 | **Salário obrigatório** (min/max). Sem isto não avança. Mostrar a mediana da zona para a função |
| 3 | Horário (grelha semanal), local, tipo de contrato, modalidade |
| 4 | Competências: arrastar cada uma para **Essencial** ou **Desejável**. A UI força esta distinção |
| 5 | Requisitos eliminatórios: cartas, certificados, línguas, autorização de trabalho |
| 6 | **Declaração de intenção:** "Preciso de N pessoas até [data]" + assinatura. Fica público no perfil da empresa |
| 7 | Verificação da empresa: NIPC + email de domínio |

**Bloqueios de publicação:**
- Sem intervalo salarial → não publica
- Sem horário → não publica
- Sem `fill_by_date` → não publica
- Empresa sem verificação de NIPC → só 1 vaga activa até verificar

### 7.3 — Ecrã de match (o mais importante da app)

Idêntico nos dois lados, com conteúdo espelhado.

```
┌──────────────────────────────────────────────┐
│  ✦ NOVO MATCH                      86%       │
│                                              │
│  Empregado de mesa · Restaurante (Alvalade)  │
│  1150 – 1300 € · Efetivo · Presencial        │
│                                              │
│  ─ Porquê este match ─────────────────────   │
│  ✓ 92% das competências que pedem            │
│  ✓ 18 min de sua casa (transporte público)   │
│  ✓ O salário cobre o seu mínimo              │
│  ✓ Horário compatível com a sua disponib.    │
│                                              │
│  ─ Sobre este empregador ─────────────────   │
│  Responde em média em 4h · 82% de resposta   │
│  11 contratações pela Werkwire · Verificado  │
│                                              │
│  ⏱  Faltam 41 horas para responder           │
│                                              │
│  [  RECUSAR  ]        [    ACEITAR    ]      │
│                                              │
│  · Porque vejo isto? · Contestar             │
└──────────────────────────────────────────────┘
```

Regras:
- O nome do candidato, foto e contactos **não aparecem** do lado do empregador antes de `confirmed`. Aparece `display_alias` + dados profissionais
- Ao recusar: modal com os 6 motivos em 1 toque + nota opcional. **O motivo é obrigatório** — é o combustível do modelo
- "Porque vejo isto?" abre o `score_breakdown` em linguagem simples
- "Contestar" marca `contested = true` e entra em fila de revisão humana (obrigação AI Act)

### 7.4 — Pós-match confirmado

1. Revelação mútua: nome, foto, contacto, nome exato da empresa e morada
2. Abre `conversations` + notificação aos dois
3. Barra de fases: Conversa → Entrevista → Proposta → Contratado / Não avançou
4. Agendamento de entrevista com lembrete 24h e 1h antes
5. **Confirmação bilateral de contratação** — os dois carregam. Só assim conta
6. Follow-up automático aos 30 e 90 dias: "ainda está lá?" → `hires.retained_30d/90d`

### 7.5 — Painel do trabalhador

- Estado do perfil: activo / passivo / indisponível + snooze
- Matches: pendentes / aceites / confirmados / histórico
- **Explicação negativa** quando há 0 matches há mais de 7 dias (§5.6)
- "Melhorar o perfil": 3 sugestões concretas com impacto estimado ("adicionar carta B → +14 vagas compatíveis")

### 7.6 — Painel do empregador

- Vagas: estado, matches recebidos, tempo médio de resposta próprio
- **Aviso de SLA:** "Tem 3 matches por responder. Faltam 11h antes de esta vaga ser despromovida."
- Pipeline por vaga
- Faturação: créditos, histórico de cobranças
- **Sem pesquisa de candidatos.** P2. Se alguém pedir, a resposta é não — é o produto

### 7.7 — Consola de administração

- Moderação de empresas (verificar NIPC, aprovar) e vagas
- Saúde do marketplace: liquidez por concelho × sector, congestão, filas, taxa de aceitação
- **Simulador de pesos:** "se mudar `commute` de 0.15 para 0.22, que matches do último ciclo mudam?" Corre contra dados históricos, mostra o delta. **Nunca publicar pesos sem passar aqui.**
- Fila de contestações → revisão humana
- Relatórios de equidade (§9)

---

## 8. Rotas da API

```
# Trabalhador
POST   /api/worker/onboarding              cria/atualiza perfil, gera embedding
POST   /api/worker/cv-parse                upload CV → Groq → campos sugeridos (NÃO grava)
GET    /api/worker/matches                 lista (respeita RLS)
POST   /api/worker/matches/:id/accept
POST   /api/worker/matches/:id/decline     body: { reason, note? }
POST   /api/worker/matches/:id/contest     body: { note }
PATCH  /api/worker/availability
GET    /api/worker/insights                explicação negativa + sugestões

# Empregador
POST   /api/employer/company
POST   /api/employer/company/verify-nipc
POST   /api/employer/jobs                  valida campos obrigatórios; gera embedding
POST   /api/employer/jobs/:id/publish      bloqueia se faltar salário/horário/intenção
PATCH  /api/employer/jobs/:id
GET    /api/employer/matches
POST   /api/employer/matches/:id/accept    → se worker já aceitou: confirma + COBRA
POST   /api/employer/matches/:id/decline
GET    /api/employer/billing
POST   /api/employer/billing/checkout      Stripe

# Partilhado (só com match confirmado — imposto por RLS)
GET    /api/conversations/:id
POST   /api/conversations/:id/messages
POST   /api/matches/:id/pipeline           regista fase
POST   /api/matches/:id/hire-confirm

# Sistema
POST   /api/internal/cycle/run             protegido por segredo; chamado pelo Cron Worker
POST   /api/internal/cycle/expire          horário
POST   /api/internal/scores/recompute      diário
POST   /api/webhooks/stripe
POST   /api/webhooks/whatsapp

# Admin
GET    /api/admin/health
POST   /api/admin/weights/simulate         body: { weights, cycleId } → delta
POST   /api/admin/weights/publish
GET    /api/admin/contests
POST   /api/admin/fairness-audit
```

### Regra de segurança central (RLS)

```sql
-- Um empregador só vê dados identificáveis de um trabalhador
-- quando existe um match CONFIRMADO entre eles.
create policy "employer_sees_identified_worker_only_on_confirmed_match"
on worker_profiles for select
using (
  exists (
    select 1 from matches m
    join jobs j on j.id = m.job_id
    join companies c on c.id = j.company_id
    where m.worker_id = worker_profiles.id
      and m.status = 'confirmed'
      and c.owner_user_id = auth.uid()
  )
);
```

Antes de `confirmed`, o empregador acede a uma **view** `worker_profiles_anonymous` que expõe apenas: `display_alias`, `headline`, `years_experience`, `skills`, `languages`, `licences`, `location_label` (só concelho), `verification_level`. Nunca `full_name`, `photo_url`, `phone`, `email`, morada exata.

---

## 9. Conformidade legal (AI Act + RGPD)

Não é opcional e não é para deixar para depois. Custa pouco agora, custa uma fortuna a acrescentar.

### O enquadramento

O Anexo III, ponto 4, do AI Act classifica como **alto risco** os sistemas de IA para pontuação, matching e ranking de candidatos e para colocação direccionada de anúncios de emprego. O Regulamento (UE) 2026/1744, em vigor desde 2026-07-27, adiou esse regime de 2026-08-02 para **2027-12-02** — mas **não reduziu as obrigações**, e não tocou no Artigo 50 (transparência), já aplicável desde 2026-08-02. O RGPD Art. 22 (decisões automatizadas) aplica-se **já e em paralelo**.

### Obrigatório no código, desde o primeiro commit

| Requisito | Implementação |
|---|---|
| Registo de logs | `matches.score_breakdown` + `engine_version` + `weights_version` + `audit_log`. Retenção 5 anos |
| Transparência | `explanation_worker` / `explanation_employer` NOT NULL, servidas na UI |
| Supervisão humana com significado | O empregador humano decide sempre. Fila de contestação com revisor identificado e poder de anular. **Carimbar automaticamente não cumpre o requisito** |
| Governação de dados | Esquema versionado, origem de cada campo documentada, `weight_versions` imutável após publicação |
| Teste de impacto adverso | Job trimestral → `fairness_audits`. Rácio <0.8 entre grupos dispara alerta e revisão de pesos |
| Robustez | Cobertura de testes >90% no motor; ciclo reproduzível a partir de `cycle_id` |
| Direito de contestação | Botão no ecrã de match → revisão humana em ≤5 dias úteis |
| RGPD | Consentimento explícito e granular; minimização; retenção (perfil inativo 24 meses → anonimizado); exportação; apagamento em 1 clique |
| Proibições em vigor desde 2025-02 | **Nunca** reconhecimento de emoções. **Nunca** inferir características protegidas. Não recolher género/etnia para matching — só, opcionalmente e em separado, para a auditoria de equidade |

### Transformar em argumento comercial

Slogan B2B: *"O único job board europeu que consegue explicar, por escrito, porque emparelhou — ou não emparelhou — cada pessoa."* Nenhum incumbente consegue dizer isto.

---

## 10. Monetização (Stripe)

| Quem | Quando | Quanto |
|---|---|---|
| Trabalhador | nunca | **0 €** — P8 |
| Empregador — publicar vaga | nunca | **0 €** |
| Empregador — **match confirmado** | no momento em que ambos aceitam e o canal abre | **19–49 €**, consoante o sector |
| Pacotes de créditos | pré-pago | 10 / 25 / 50 matches, com desconto crescente |

**Porquê cobrar no match e não na contratação:** cobrar na contratação faz as pessoas fugirem para o WhatsApp para não pagar (desintermediação — mata a maioria dos marketplaces de trabalho). Cobrar no momento exacto em que o valor é entregue (o contacto mútuo qualificado) é imune a isso.

**Implementação:**
- `POST /api/employer/matches/:id/accept` → se o worker já aceitou, dentro de **uma transação**: `status = 'confirmed'` + debitar crédito ou cobrar via Stripe + criar `conversation` + `match_charges`
- Sem créditos e sem cartão → o match fica em `worker_accepted` e o empregador vê um ecrã de pagamento com 48h. Expirado sem pagar → `expired` e o worker **não é penalizado**
- **Reembolso automático** se o empregador não responder ao chat em 7 dias (protege a reputação do produto)

---

## 11. Variáveis de ambiente

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Groq
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

# Embeddings
EMBEDDING_PROVIDER=            # 'groq' | 'self_hosted'
EMBEDDING_MODEL=
EMBEDDING_DIMS=1024

# Motor
MATCH_THRESHOLD=0.62
WORKER_DAILY_QUOTA=3
JOB_CYCLE_QUOTA=5
MATCH_EXPIRY_HOURS=48
ENGINE_VERSION=1.0.0

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Notificações
RESEND_API_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=

# Interno
CYCLE_TRIGGER_SECRET=
NEXT_PUBLIC_APP_URL=
POSTHOG_KEY=
```

---

## 12. Testes e critérios de aceitação

### Testes unitários do motor (bloqueadores de merge)

```
✓ scoreSalary: sem sobreposição → 0
✓ scoreSalary: oferta acima do ideal → 1.0
✓ scoreExperience: 4 anos numa vaga de 5 → >= 0.85  (NUNCA 0)
✓ scoreCommute: minutos == máximo → 0
✓ scoreSchedule: sobreposição parcial → proporcional exato
✓ harmonic(0.95, 0.35) < 0.55           ← mata matches assimétricos
✓ harmonic(0.80, 0.80) == 0.80
✓ isMatch(0.95, 0.40) === false          ← o duplo limiar funciona
✓ evaluateKnockouts: licença em falta → passed: false
✓ evaluateKnockouts: hard_no 'no_sundays' vs vaga com domingos → false
✓ allocate: nenhum worker recebe > quota diária
✓ allocate: nenhuma vaga recebe > quota do ciclo
✓ allocate: a afectação é estável (nenhum par se prefere mutuamente fora dela)
✓ soma dos pesos de cada bloco == 1.0 para TODOS os segmentos
✓ score_breakdown reproduz exactamente fit_employer e fit_worker
```

### Testes end-to-end (Playwright)

```
✓ Onboarding do trabalhador completo em < 20 interações
✓ Vaga sem salário NÃO publica
✓ Ciclo cria matches e ambos os lados recebem notificação
✓ Empregador NÃO vê nome/telefone antes de confirmed  ← testar via API directa, não só UI
✓ Aceitar dos dois lados → conversa abre + cobrança registada
✓ Recusar exige motivo
✓ Match expira às 48h
✓ Empresa com <50% de resposta é despromovida automaticamente
✓ Não existe nenhuma rota que devolva lista de candidatos ao empregador
```

### Critérios de aceitação do produto

| Métrica | Alvo | Significado |
|---|---|---|
| Aceitação bilateral | **>40%** | O único teste real do motor |
| Tempo até ao 1.º match | **<24h** | É a promessa do produto |
| Match → conversa | >70% | A explicação convence |
| Match → contratação | **>8%** | Um job board normal anda em <1% |
| Retenção a 90 dias | **>75%** | Qualidade, não volume |
| Resposta do empregador em 48h | >80% | Abaixo disto, a confiança colapsa |
| Índice de congestão | <3× | Se as 10 melhores vagas levam tudo, o resto morre |
| Rácios activos/vaga | 8–20 | <5 não há mercado; >50 há desperdício |

---

## 13. Ordem de construção

Construir por esta ordem. **Não saltar fases** — cada uma valida a seguinte.

### Fase 0 — Validar o motor sem app (antes de qualquer UI)
1. `packages/matching-engine` completo, com testes
2. Script CLI que lê fixtures JSON (30 candidatos, 20 vagas reais de uma zona) e imprime os matches com explicações
3. **Portão de qualidade:** mostrar os matches a pessoas reais dos dois lados. Se a aceitação for <40%, **corrigir os pesos antes de escrever uma linha de UI**

### Fase 1 — Fundação
4. Migrações Supabase + RLS + views anónimas
5. Auth + papéis + guardas de rota
6. Testes de RLS a atacar directamente a API (não só a UI)

### Fase 2 — Entrada de dados
7. Onboarding do trabalhador (9 passos) + geração de embedding
8. Parsing de CV com Groq → confirmação humana obrigatória
9. Criação e publicação de vaga + validações bloqueantes
10. Verificação de NIPC e de telemóvel

### Fase 3 — O ciclo
11. Cache e matriz de tempos de deslocação (§6.3)
12. Camada de recuperação (SQL + pgvector)
13. Cloudflare Worker + Cron + `POST /api/internal/cycle/run`
14. Persistência de matches com breakdown completo
15. Notificações (push + email) simultâneas

### Fase 4 — O ciclo humano
16. Ecrã de match + aceitar/recusar com motivo
17. Confirmação → revelação + conversa
18. Expiração + SLA + despromoção automática
19. Scores de empresa recalculados diariamente

### Fase 5 — Receita
20. Stripe: créditos + cobrança na confirmação (transacional)
21. Painel de faturação + reembolso automático por não-resposta

### Fase 6 — Ciclo fechado e conformidade
22. Pipeline + confirmação bilateral de contratação
23. Follow-up a 30 e 90 dias
24. Consola de admin + simulador de pesos
25. Fila de contestações + revisão humana
26. Job de auditoria de equidade
27. Onboarding por WhatsApp/voz

---

## 14. Anti-requisitos — o que NÃO construir

Tão importante como a lista do que fazer. Cada um destes destrói o produto:

| Não fazer | Porquê |
|---|---|
| Botão "candidatar-se" | Viola P1. É a app inteira |
| Pesquisa de candidatos pelo empregador | Viola P2. Transforma-te num LinkedIn pior |
| Feed infinito de vagas | Volume é o problema que estás a resolver |
| Swipe | O Switch fez isso e morreu. Continua a ser trabalho manual, par a par |
| Deixar o LLM decidir matches | Não auditável → ilegal sob o AI Act, e impossível de afinar |
| Cobrar ao candidato | Mata o lado da oferta, que é o produto |
| Perfis destacados / matches patrocinados | Corrompe o sinal. É como a concorrência falhou |
| Publicar vagas sem salário | Destrói a confiança, que é o único fosso que tens no início |
| Lançar em vários sectores e distritos ao mesmo tempo | Liquidez espalhada = zero liquidez |
| App nativa antes de provar liquidez | 3 meses perdidos em lojas |
| Guardar género/etnia no perfil de matching | Proibido inferir; usar só, em separado e opcional, para auditoria |

---

## 15. Seed de desenvolvimento

`supabase/seed.sql` deve criar um cenário realista de um concelho:

- 3 empresas verificadas (restauração, retalho, logística) com histórico de scores variado
- 12 vagas activas, com salários, horários e requisitos realistas de Lisboa/Amadora
- 40 perfis de trabalhador com distribuição realista de competências, salários mínimos e localizações
- 5 pares que **devem** dar match (verificados à mão)
- 5 pares que **não podem** dar match (assimétricos: empresa adora, pessoa odeia) — o teste do duplo limiar
- 1 empresa com `ghost_flag` e resposta baixa, para testar a despromoção

---

## 16. Notas finais para quem constrói

1. **O motor é o produto.** Se `packages/matching-engine` estiver enterrado dentro de uma rota Next.js, o projeto falhou — não o consegues testar, nem afinar, nem auditar perante um regulador. Mantém-no puro.
2. **Regras antes de ML.** Começa com pesos definidos à mão por sector. Só passa a pesos aprendidos com ≥500 ciclos de aceitar/recusar. Se o modelo de regras não funciona, o de ML também não vai funcionar — vai só esconder o problema.
3. **Os motivos de recusa são o activo mais valioso.** São o único sinal supervisionado de qualidade que existe. Obrigatórios, sempre, em 1 toque.
4. **A retenção a 90 dias é o fosso.** Ninguém mede se o match *durou*. É impossível de copiar sem anos de histórico.
5. **A escassez é feature.** Toda a gente optimiza "mostrar mais". Este produto optimiza o contrário. Quando alguém pedir "mais matches", a resposta é melhorar o perfil, não levantar a quota.
