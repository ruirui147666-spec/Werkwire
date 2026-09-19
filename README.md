# Werkwire

O marketplace de emprego sem candidaturas. Um motor de matching corre em
ciclos, emparelha candidatos e vagas segundo condições explícitas, e
notifica os dois lados ao mesmo tempo. Só quando ambos aceitam é que os
contactos são revelados. Ver `docs/WERKWIRE_SPEC.md` para a especificação
completa do produto.

Este repositório é o **MVP full-stack**: ciclo central (onboarding → motor
de matching → match → conversa → contratação) + painéis de trabalhador e
empregador + faturação (Stripe). Interface exclusivamente em **modo claro**
(sem dark mode), tipografia Inter, mobile-first e responsiva a desktop.

## O que está construído

- **`packages/matching-engine`** — o motor puro (TypeScript, zero I/O):
  knockouts eliminatórios, condições graduais, média harmónica, duplo
  limiar, afetação com quotas (Gale-Shapley), explicações determinísticas.
  **75 testes, 98% de cobertura de statements, 90% de branches.**
- **`supabase/migrations`** — esquema completo (§4 da spec), RLS que impõe
  o anonimato até ao match confirmado (P9) e a ausência de pesquisa de
  candidatos (P2), views anónimas, funções auxiliares para o ciclo.
  **Validado contra um Postgres 16 + PostGIS + pgvector real** (não é só
  SQL "à vista") — ver `supabase/tests/rls_smoke_test.sql`.
- **`supabase/seed.sql`** — um concelho de desenvolvimento (Lisboa/Amadora):
  3 empresas, 12 vagas, 40 trabalhadores, incluindo os 5 pares que têm de
  dar match e os 5 pares assimétricos que não podem (o teste do duplo
  limiar) — **verificados a correr o motor real contra estes dados**
  (`pnpm --filter @werkwire/matching-engine simulate`).
- **`apps/web`** — Next.js 15 (App Router): onboarding do trabalhador (9
  passos) e da vaga, ecrã de match (aceitar/recusar com motivo/contestar),
  conversa pós-match com pipeline e confirmação bilateral de contratação,
  painéis de ambos os lados, faturação com créditos + Stripe Checkout.

## O que está fora do alcance desta fase

Documentado aqui, não escondido. Cada item seria a fase seguinte lógica:

| Área | Estado nesta fase |
|---|---|
| Notificações (push/email/WhatsApp) | Não implementado — os matches ficam visíveis de imediato na app |
| Ciclo de matching agendado | `/api/internal/cycle/run` e `/expire` existem e funcionam; precisam de um agendador externo (Cloudflare Cron, Vercel Cron, etc.) — ver abaixo |
| Deslocação real (camadas 1/2 do §6.3) | Só a camada 3 (fallback haversine/velocidade média) está implementada |
| Embeddings semânticos reais | Fallback determinístico local (hash), não um modelo multilingue real — ver `lib/embeddings.ts` |
| Parsing de CV / estruturação de vagas por LLM | Implementado via Groq, mas com fallback funcional sem chave (nunca bloqueia o fluxo) |
| Consola de admin, simulador de pesos, fila de contestações, auditoria de equidade | Não construído — `/admin` é um placeholder |
| Onboarding por WhatsApp/voz | Não construído |
| Pagamento avulso por match sem créditos (48h de janela + reembolso automático) | Simplificado: sem créditos, a confirmação simplesmente não avança até o empregador comprar créditos em `/e/billing` |
| Despromoção com prioridade ×0.4 | Simplificado para exclusão do ciclo seguinte até a taxa de resposta recuperar (mesmo efeito prático, mecanismo mais simples) |

## Stack

Next.js 15 · React 19 · Tailwind CSS 3 · Supabase (Postgres + PostGIS +
pgvector + Auth + RLS) · Stripe · Groq (opcional) · Vitest · TypeScript em
todo o lado, monorepo pnpm.

## Estrutura

```
werkwire/
├─ apps/web/                 # Next.js — trabalhador, empregador, admin
├─ packages/
│  ├─ matching-engine/       # motor puro, testado, simulável via CLI
│  ├─ shared/                # tipos + schemas zod partilhados
├─ supabase/
│  ├─ migrations/            # esquema + RLS + funções
│  ├─ seed.mjs                # dados de demonstração (`pnpm seed`) — usar este
│  ├─ seed.sql                # equivalente em SQL puro, só para testar contra Postgres local
│  └─ tests/rls_smoke_test.sql
```

## A arrancar

### 1. Criar um projeto Supabase

Em [supabase.com](https://supabase.com), criar um novo projeto. Anotar o
URL do projeto e as chaves (`anon` e `service_role`) em
Project Settings → API.

### 2. Aplicar o esquema

Com o [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
instalado e associado ao projeto (`supabase link`):

```bash
supabase db push          # aplica supabase/migrations/*.sql
```

Ou, sem CLI: colar o conteúdo de cada ficheiro em `supabase/migrations/`
(por ordem numérica, 0001 a 0006) no SQL Editor do painel Supabase.

Os dados de demonstração aplicam-se à parte, no passo 5 — precisam de
`pnpm install` e das variáveis de ambiente configuradas primeiro.

> **Nota de ambiente:** este projeto foi construído numa sandbox sem
> acesso ao registo de imagens Docker necessário para correr
> `supabase start` localmente (política de rede do ambiente bloqueou
> `pkg-containers.githubusercontent.com`). As migrações e o RLS foram por
> isso validados diretamente contra um Postgres 16 + PostGIS + pgvector
> real (não gerido pelo Supabase CLI) — ver `supabase/tests/rls_smoke_test.sql`.
> Recomenda-se correr `supabase start` localmente antes de continuar o
> desenvolvimento, para validar a camada PostgREST/GoTrue (autenticação,
> geração de tipos) que não foi possível exercitar aqui.

### 3. Configurar variáveis de ambiente

```bash
cp .env.example apps/web/.env.local
```

Preencher pelo menos:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (do projeto Supabase)
- `CYCLE_TRIGGER_SECRET` (qualquer segredo à sua escolha — protege as
  rotas internas do ciclo de matching)

Opcionais (a app funciona sem eles, com fallbacks):
- `GROQ_API_KEY` — ativa parsing de CV/vagas por LLM
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — ativa pagamentos reais

### 4. Instalar

```bash
pnpm install
```

### 5. Popular com dados de demonstração

```bash
pnpm seed
```

Corre `supabase/seed.mjs`, que cria as contas através da Admin API do
Supabase (não por SQL direto — é o que garante que conseguem mesmo fazer
login; ver o aviso em `supabase/seed.sql` se precisares de saber porquê).
Lê as credenciais de `apps/web/.env.local` automaticamente. Demora um
bocado (cria 43 contas, uma chamada de cada vez).

Palavra-passe para todas as contas: `werkwire-dev-2026`

| Perfil | Email |
|---|---|
| Empregador — Lisboa Grill (hotelaria) | `gestor@lisboagrill.pt` |
| Empregador — Mercado Amadora (retalho) | `rh@mercadoamadora.pt` |
| Empregador — LogiFast (logística, ghost job) | `operacoes@logifast.pt` |
| Trabalhador exemplo | `ana1@exemplo.pt` … `ulisses40@exemplo.pt` |

### 6. Arrancar a app

```bash
pnpm dev              # apps/web em http://localhost:3000
```

### 7. Correr um ciclo de matching manualmente

```bash
curl -X POST http://localhost:3000/api/internal/cycle/run \
  -H "Authorization: Bearer $CYCLE_TRIGGER_SECRET"

curl -X POST http://localhost:3000/api/internal/cycle/expire \
  -H "Authorization: Bearer $CYCLE_TRIGGER_SECRET"
```

Em produção, agendar estas duas chamadas (08:00/18:00 Europe/Lisbon para
`run`, de hora a hora para `expire`) com Vercel Cron, Cloudflare Cron
Triggers, ou equivalente.

## Testes

```bash
pnpm --filter @werkwire/matching-engine test:coverage   # motor: 75 testes
pnpm --filter @werkwire/matching-engine simulate <fixture.json>   # Fase 0: correr o motor sobre fixtures reais

# RLS — contra uma base já migrada + com seed aplicado:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_smoke_test.sql
```

## Deploy

`apps/web` está pronto para a Vercel (`next build` já validado). Definir
as variáveis de ambiente do `.env.example` no painel da Vercel, apontar
`NEXT_PUBLIC_APP_URL` para o domínio final, e configurar o webhook do
Stripe (`/api/webhooks/stripe`) no painel do Stripe apontando para esse
domínio.
