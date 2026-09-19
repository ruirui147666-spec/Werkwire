// Werkwire — seed de desenvolvimento (§15), versão Node/Admin API.
//
// Porquê isto e não supabase/seed.sql: o Supabase Auth real precisa de
// mais do que uma linha em auth.users para um login funcionar (nomeadamente
// uma entrada ligada em auth.identities, criada internamente pelo GoTrue).
// Inserir diretamente por SQL cria uma linha "órfã" que existe mas nunca
// autentica — daí o erro "Email ou palavra-passe incorretos." mesmo com a
// password certa. Este script usa a Admin API (supabase.auth.admin.createUser),
// o mesmo caminho que um signup real percorre, por isso fica tudo consistente.
//
// Uso:
//   pnpm seed
// (lê as credenciais de apps/web/.env.local automaticamente)

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", "apps", "web", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY em apps/web/.env.local"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PASSWORD = "werkwire-dev-2026";

const FIRST_NAMES = [
  "Ana", "Bruno", "Carla", "Diogo", "Eva", "Filipe", "Gabriela", "Hugo", "Inês", "João",
  "Katia", "Luís", "Mariana", "Nuno", "Olga", "Pedro", "Rita", "Sérgio", "Tânia", "Vasco",
  "Beatriz", "César", "Dália", "Eduardo", "Fátima", "Gonçalo", "Helena", "Ivo", "Joana", "Kevin",
  "Leonor", "Marco", "Natália", "Óscar", "Paula", "Quim", "Raquel", "Simão", "Teresa", "Ulisses",
];
const FREGUESIAS = ["Amadora, Lisboa", "Alvalade, Lisboa", "Benfica, Lisboa", "Odivelas, Lisboa", "Sintra, Lisboa"];

const emptyWeek = () => ({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] });
const point = (lng, lat) => `POINT(${lng} ${lat})`;
// Emails must be ASCII — strip accents (Inês -> ines, João -> joao) for the
// address only; display names elsewhere keep the accents.
const toEmailSlug = (name) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function createAuthUser(email, role, fullName) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return data.user.id;
}

async function insertOrThrow(table, rows) {
  const { error } = await admin.from(table).insert(rows);
  if (error) throw new Error(`insert into ${table}: ${error.message}`);
}

async function main() {
  const { count } = await admin.from("companies").select("id", { count: "exact", head: true });
  if (count && count > 0) {
    console.log(`Já existem ${count} empresa(s) na base de dados — a evitar duplicar o seed.`);
    console.log("Se queres repetir, limpa as tabelas (ou usa um projeto Supabase novo) e corre outra vez.");
    return;
  }

  console.log("A criar contas de empregador…");
  const ownerResto = await createAuthUser("gestor@lisboagrill.pt", "employer", "Rui Gestor");
  const ownerRetail = await createAuthUser("rh@mercadoamadora.pt", "employer", "Sofia RH");
  const ownerLogi = await createAuthUser("operacoes@logifast.pt", "employer", "Tiago Operações");

  await admin
    .from("profiles")
    .update({ phone_verified: true, email_verified: true })
    .in("id", [ownerResto, ownerRetail, ownerLogi]);

  console.log("A criar empresas…");
  const companies = [
    {
      owner_user_id: ownerResto,
      legal_name: "Lisboa Grill, Lda.",
      trade_name: "Lisboa Grill",
      nipc: "500123456",
      sector: "hospitality",
      size_band: "10-49",
      description: "Restaurante de grelhados em Alvalade.",
      verification_level: "full",
      nipc_verified: true,
      domain_verified: true,
      response_rate_48h: 0.86,
      avg_response_hours: 3.5,
      hire_rate: 0.22,
      abandon_rate: 0.05,
      total_hires: 11,
      ghost_flag: false,
    },
    {
      owner_user_id: ownerRetail,
      legal_name: "Mercado Amadora, S.A.",
      trade_name: "Mercado Amadora",
      nipc: "500234567",
      sector: "retail",
      size_band: "50-249",
      description: "Supermercado de bairro com 6 lojas na Amadora.",
      verification_level: "full",
      nipc_verified: true,
      domain_verified: true,
      response_rate_48h: 0.74,
      avg_response_hours: 6.2,
      hire_rate: 0.15,
      abandon_rate: 0.10,
      total_hires: 24,
      ghost_flag: false,
    },
    {
      owner_user_id: ownerLogi,
      legal_name: "LogiFast Transportes, Lda.",
      trade_name: "LogiFast",
      nipc: "500345678",
      sector: "logistics",
      size_band: "10-49",
      description: "Distribuição e armazém em Odivelas.",
      verification_level: "none",
      nipc_verified: false,
      domain_verified: false,
      response_rate_48h: 0.28,
      avg_response_hours: 41.0,
      hire_rate: 0.03,
      abandon_rate: 0.42,
      total_hires: 1,
      ghost_flag: true,
    },
  ];
  const { data: companyRows, error: companyErr } = await admin.from("companies").insert(companies).select("id, trade_name");
  if (companyErr) throw new Error(`insert companies: ${companyErr.message}`);
  const companyId = Object.fromEntries(companyRows.map((c) => [c.trade_name, c.id]));

  await insertOrThrow("billing_accounts", [
    { company_id: companyId["Lisboa Grill"], credits_balance: 10 },
    { company_id: companyId["Mercado Amadora"], credits_balance: 25 },
    { company_id: companyId["LogiFast"], credits_balance: 0 },
  ]);

  console.log("A publicar vagas…");
  const fillBy = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const publishedAt = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

  const jobs = [
    {
      company_id: companyId["Lisboa Grill"], created_by: ownerResto, intent_signed_by: ownerResto,
      title: "Empregado de mesa", description: "Sala e apoio ao balcão em restaurante de grelhados.",
      sector: "hospitality", salary_min: 1150, salary_max: 1300, contract: "permanent", work_mode: "onsite",
      location_point: point(-9.1393, 38.7489), location_label: "Alvalade, Lisboa",
      weekly_schedule: { mon: [{ from: "09:00", to: "17:00" }], tue: [{ from: "09:00", to: "17:00" }], wed: [], thu: [{ from: "14:00", to: "22:00" }], fri: [{ from: "09:00", to: "17:00" }], sat: [{ from: "12:00", to: "22:00" }], sun: [] },
      has_nights: false, has_weekends: true,
      required_skills: [{ slug: "customer_service", label: "Atendimento ao cliente", weight: "essential", min_years: 2 }, { slug: "pos_systems", label: "Sistemas POS", weight: "desirable", min_years: 0 }],
      min_years_experience: 2, required_languages: [], required_licences: [], required_certs: [], requires_work_auth: true,
      positions_count: 2, fill_by_date: fillBy(30), status: "active", published_at: publishedAt(3),
    },
    {
      company_id: companyId["Lisboa Grill"], created_by: ownerResto, intent_signed_by: ownerResto,
      title: "Cozinheiro de linha", description: "Preparação e confeção de pratos de grelhados.",
      sector: "hospitality", salary_min: 1200, salary_max: 1400, contract: "permanent", work_mode: "onsite",
      location_point: point(-9.1393, 38.7489), location_label: "Alvalade, Lisboa",
      weekly_schedule: { mon: [{ from: "11:00", to: "20:00" }], tue: [{ from: "11:00", to: "20:00" }], wed: [{ from: "11:00", to: "20:00" }], thu: [], fri: [{ from: "11:00", to: "20:00" }], sat: [{ from: "11:00", to: "20:00" }], sun: [] },
      has_nights: false, has_weekends: true,
      required_skills: [{ slug: "food_prep", label: "Preparação de alimentos", weight: "essential", min_years: 3 }, { slug: "haccp", label: "HACCP", weight: "desirable", min_years: 0 }],
      min_years_experience: 3, required_languages: [], required_licences: [], required_certs: ["haccp"], requires_work_auth: true,
      positions_count: 1, fill_by_date: fillBy(21), status: "active", published_at: publishedAt(5),
    },
    {
      company_id: companyId["Lisboa Grill"], created_by: ownerResto, intent_signed_by: ownerResto,
      title: "Empregado de balcão", description: "Take-away e apoio ao delivery.",
      sector: "hospitality", salary_min: 1000, salary_max: 1100, contract: "fixed_term", work_mode: "onsite",
      location_point: point(-9.1393, 38.7489), location_label: "Alvalade, Lisboa",
      weekly_schedule: { mon: [], tue: [{ from: "18:00", to: "23:00" }], wed: [{ from: "18:00", to: "23:00" }], thu: [{ from: "18:00", to: "23:00" }], fri: [{ from: "18:00", to: "23:00" }], sat: [{ from: "18:00", to: "23:00" }], sun: [] },
      has_nights: true, has_weekends: true,
      required_skills: [{ slug: "customer_service", label: "Atendimento ao cliente", weight: "essential", min_years: 0 }],
      min_years_experience: 0, required_languages: [], required_licences: [], required_certs: [], requires_work_auth: true,
      positions_count: 1, fill_by_date: fillBy(14), status: "active", published_at: publishedAt(1),
    },
    {
      company_id: companyId["Lisboa Grill"], created_by: ownerResto, intent_signed_by: ownerResto,
      title: "Ajudante de cozinha", description: "Apoio à cozinha e limpeza de sala.",
      sector: "hospitality", salary_min: 950, salary_max: 1050, contract: "temporary", work_mode: "onsite",
      location_point: point(-9.1393, 38.7489), location_label: "Alvalade, Lisboa",
      weekly_schedule: { mon: [{ from: "08:00", to: "16:00" }], tue: [{ from: "08:00", to: "16:00" }], wed: [{ from: "08:00", to: "16:00" }], thu: [{ from: "08:00", to: "16:00" }], fri: [{ from: "08:00", to: "16:00" }], sat: [], sun: [] },
      has_nights: false, has_weekends: false,
      required_skills: [{ slug: "food_prep", label: "Preparação de alimentos", weight: "desirable", min_years: 0 }],
      min_years_experience: 0, required_languages: [], required_licences: [], required_certs: [], requires_work_auth: true,
      positions_count: 1, fill_by_date: fillBy(10), status: "active", published_at: publishedAt(2),
    },
    {
      company_id: companyId["Mercado Amadora"], created_by: ownerRetail, intent_signed_by: ownerRetail,
      title: "Operador de caixa", description: "Caixa e apoio à loja em supermercado de bairro.",
      sector: "retail", salary_min: 1000, salary_max: 1100, contract: "permanent", work_mode: "onsite",
      location_point: point(-9.2245, 38.7538), location_label: "Amadora, Lisboa",
      weekly_schedule: { mon: [{ from: "08:00", to: "16:00" }], tue: [{ from: "08:00", to: "16:00" }], wed: [{ from: "08:00", to: "16:00" }], thu: [{ from: "08:00", to: "16:00" }], fri: [{ from: "08:00", to: "16:00" }], sat: [{ from: "08:00", to: "14:00" }], sun: [] },
      has_nights: false, has_weekends: true,
      required_skills: [{ slug: "pos_systems", label: "Sistemas POS", weight: "essential", min_years: 1 }, { slug: "customer_service", label: "Atendimento ao cliente", weight: "essential", min_years: 1 }],
      min_years_experience: 1, required_languages: [], required_licences: [], required_certs: [], requires_work_auth: true,
      positions_count: 3, fill_by_date: fillBy(25), status: "active", published_at: publishedAt(4),
    },
    {
      company_id: companyId["Mercado Amadora"], created_by: ownerRetail, intent_signed_by: ownerRetail,
      title: "Repositor", description: "Reposição de linear e apoio ao armazém da loja.",
      sector: "retail", salary_min: 950, salary_max: 1000, contract: "permanent", work_mode: "onsite",
      location_point: point(-9.2245, 38.7538), location_label: "Amadora, Lisboa",
      weekly_schedule: { mon: [{ from: "06:00", to: "14:00" }], tue: [{ from: "06:00", to: "14:00" }], wed: [{ from: "06:00", to: "14:00" }], thu: [{ from: "06:00", to: "14:00" }], fri: [{ from: "06:00", to: "14:00" }], sat: [], sun: [] },
      has_nights: false, has_weekends: false,
      required_skills: [{ slug: "warehouse_operator", label: "Operador de armazém", weight: "desirable", min_years: 0 }],
      min_years_experience: 0, required_languages: [], required_licences: [], required_certs: [], requires_work_auth: true,
      positions_count: 2, fill_by_date: fillBy(20), status: "active", published_at: publishedAt(6),
    },
    {
      company_id: companyId["Mercado Amadora"], created_by: ownerRetail, intent_signed_by: ownerRetail,
      title: "Chefe de loja adjunto", description: "Apoio à gestão diária de uma loja de bairro.",
      sector: "retail", salary_min: 1300, salary_max: 1600, contract: "permanent", work_mode: "onsite",
      location_point: point(-9.2245, 38.7538), location_label: "Amadora, Lisboa",
      weekly_schedule: { mon: [{ from: "09:00", to: "18:00" }], tue: [{ from: "09:00", to: "18:00" }], wed: [{ from: "09:00", to: "18:00" }], thu: [{ from: "09:00", to: "18:00" }], fri: [{ from: "09:00", to: "18:00" }], sat: [], sun: [] },
      has_nights: false, has_weekends: false,
      required_skills: [{ slug: "customer_service", label: "Atendimento ao cliente", weight: "essential", min_years: 3 }, { slug: "team_leadership", label: "Liderança de equipa", weight: "essential", min_years: 1 }],
      min_years_experience: 3, required_languages: [], required_licences: [], required_certs: [], requires_work_auth: true,
      positions_count: 1, fill_by_date: fillBy(35), status: "active", published_at: publishedAt(8),
    },
    {
      company_id: companyId["Mercado Amadora"], created_by: ownerRetail, intent_signed_by: ownerRetail,
      title: "Operador de caixa (fim de semana)", description: "Reforço de caixa aos fins de semana.",
      sector: "retail", salary_min: 900, salary_max: 950, contract: "temporary", work_mode: "onsite",
      location_point: point(-9.2245, 38.7538), location_label: "Amadora, Lisboa",
      weekly_schedule: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [{ from: "08:00", to: "20:00" }], sun: [{ from: "08:00", to: "20:00" }] },
      has_nights: false, has_weekends: true,
      required_skills: [{ slug: "pos_systems", label: "Sistemas POS", weight: "desirable", min_years: 0 }],
      min_years_experience: 0, required_languages: [], required_licences: [], required_certs: [], requires_work_auth: true,
      positions_count: 2, fill_by_date: fillBy(12), status: "active", published_at: publishedAt(1),
    },
    {
      company_id: companyId["LogiFast"], created_by: ownerLogi, intent_signed_by: ownerLogi,
      title: "Operador de armazém", description: "Picking e apoio à expedição em armazém logístico.",
      sector: "logistics", salary_min: 1050, salary_max: 1150, contract: "permanent", work_mode: "onsite",
      location_point: point(-9.1866, 38.7936), location_label: "Odivelas, Lisboa",
      weekly_schedule: { mon: [{ from: "07:00", to: "15:00" }], tue: [{ from: "07:00", to: "15:00" }], wed: [{ from: "07:00", to: "15:00" }], thu: [{ from: "07:00", to: "15:00" }], fri: [{ from: "07:00", to: "15:00" }], sat: [], sun: [] },
      has_nights: false, has_weekends: false,
      required_skills: [{ slug: "warehouse_operator", label: "Operador de armazém", weight: "essential", min_years: 1 }, { slug: "forklift", label: "Empilhador", weight: "desirable", min_years: 0 }],
      min_years_experience: 1, required_languages: [], required_licences: [], required_certs: [], requires_work_auth: true,
      positions_count: 2, fill_by_date: fillBy(18), status: "active", published_at: publishedAt(15),
    },
    {
      company_id: companyId["LogiFast"], created_by: ownerLogi, intent_signed_by: ownerLogi,
      title: "Motorista de distribuição", description: "Entregas locais em veículo ligeiro.",
      sector: "logistics", salary_min: 1150, salary_max: 1300, contract: "permanent", work_mode: "onsite",
      location_point: point(-9.1866, 38.7936), location_label: "Odivelas, Lisboa",
      weekly_schedule: { mon: [{ from: "08:00", to: "17:00" }], tue: [{ from: "08:00", to: "17:00" }], wed: [{ from: "08:00", to: "17:00" }], thu: [{ from: "08:00", to: "17:00" }], fri: [{ from: "08:00", to: "17:00" }], sat: [], sun: [] },
      has_nights: false, has_weekends: false,
      required_skills: [{ slug: "driving", label: "Condução profissional", weight: "essential", min_years: 1 }],
      min_years_experience: 1, required_languages: [], required_licences: ["driving_b"], required_certs: [], requires_work_auth: true,
      positions_count: 1, fill_by_date: fillBy(10), status: "active", published_at: publishedAt(20),
    },
    {
      company_id: companyId["LogiFast"], created_by: ownerLogi, intent_signed_by: ownerLogi,
      title: "Operador de empilhador", description: "Movimentação de carga paletizada em armazém.",
      sector: "logistics", salary_min: 1100, salary_max: 1250, contract: "permanent", work_mode: "onsite",
      location_point: point(-9.1866, 38.7936), location_label: "Odivelas, Lisboa",
      weekly_schedule: { mon: [{ from: "22:00", to: "23:59" }], tue: [{ from: "00:00", to: "06:00" }], wed: [{ from: "22:00", to: "23:59" }], thu: [{ from: "00:00", to: "06:00" }], fri: [{ from: "22:00", to: "23:59" }], sat: [], sun: [] },
      has_nights: true, has_weekends: false,
      required_skills: [{ slug: "forklift", label: "Empilhador", weight: "essential", min_years: 1 }],
      min_years_experience: 1, required_languages: [], required_licences: ["forklift"], required_certs: [], requires_work_auth: true,
      positions_count: 1, fill_by_date: fillBy(25), status: "active", published_at: publishedAt(10),
    },
    {
      company_id: companyId["LogiFast"], created_by: ownerLogi, intent_signed_by: ownerLogi,
      title: "Assistente de expedição", description: "Conferência e embalamento de encomendas.",
      sector: "logistics", salary_min: 980, salary_max: 1050, contract: "temporary", work_mode: "onsite",
      location_point: point(-9.1866, 38.7936), location_label: "Odivelas, Lisboa",
      weekly_schedule: { mon: [{ from: "09:00", to: "17:00" }], tue: [{ from: "09:00", to: "17:00" }], wed: [{ from: "09:00", to: "17:00" }], thu: [{ from: "09:00", to: "17:00" }], fri: [{ from: "09:00", to: "17:00" }], sat: [], sun: [] },
      has_nights: false, has_weekends: false,
      required_skills: [{ slug: "warehouse_operator", label: "Operador de armazém", weight: "desirable", min_years: 0 }],
      min_years_experience: 0, required_languages: [], required_licences: [], required_certs: [], requires_work_auth: true,
      positions_count: 2, fill_by_date: fillBy(8), status: "active", published_at: publishedAt(30),
    },
  ];
  await insertOrThrow("jobs", jobs);

  console.log("A criar 40 candidatos… (isto demora um bocado — uma chamada à Admin API por conta)");
  for (let i = 1; i <= 40; i++) {
    const email = `${toEmailSlug(FIRST_NAMES[i - 1])}${i}@exemplo.pt`;
    const workerUser = await createAuthUser(email, "worker", `${FIRST_NAMES[i - 1]} Candidato`);
    await admin.from("profiles").update({ phone_verified: true, email_verified: true }).eq("id", workerUser);

    let profile;
    if (i === 1) {
      // match perfeito com "Empregado de mesa"
      profile = {
        display_alias: "Candidato #A1", headline: "Empregado de mesa, 3 anos", years_experience: 3,
        location_point: point(-9.1420, 38.7460), location_label: "Alvalade, Lisboa", max_commute_minutes: 30,
        salary_min: 1000, salary_ideal: 1200, accepted_contracts: ["permanent", "fixed_term"], accepted_work_modes: ["onsite"],
        weekly_availability: { ...emptyWeek(), mon: [{ from: "08:00", to: "18:00" }], tue: [{ from: "08:00", to: "18:00" }], wed: [{ from: "08:00", to: "18:00" }], thu: [{ from: "08:00", to: "18:00" }], fri: [{ from: "08:00", to: "18:00" }], sat: [{ from: "10:00", to: "22:00" }] },
        accepts_nights: false, accepts_weekends: true,
        skills: [{ slug: "customer_service", label: "Atendimento ao cliente", years: 3, verified: true }, { slug: "pos_systems", label: "Sistemas POS", years: 2, verified: false }],
        languages: [{ code: "pt", level: "native" }], work_authorisation: "eu", verification_level: "full", trust_score: 0.8,
      };
    } else if (i === 2) {
      profile = {
        display_alias: "Candidato #A2", headline: "Cozinheiro, 4 anos", years_experience: 4,
        location_point: point(-9.1450, 38.7500), location_label: "Alvalade, Lisboa", max_commute_minutes: 30,
        salary_min: 1150, salary_ideal: 1350, accepted_contracts: ["permanent"], accepted_work_modes: ["onsite"],
        weekly_availability: { ...emptyWeek(), mon: [{ from: "11:00", to: "21:00" }], tue: [{ from: "11:00", to: "21:00" }], wed: [{ from: "11:00", to: "21:00" }], fri: [{ from: "11:00", to: "21:00" }], sat: [{ from: "11:00", to: "21:00" }] },
        accepts_nights: false, accepts_weekends: true,
        skills: [{ slug: "food_prep", label: "Preparação de alimentos", years: 4, verified: true }],
        languages: [{ code: "pt", level: "native" }], certifications: ["haccp"],
        work_authorisation: "eu", verification_level: "full", trust_score: 0.85,
      };
    } else if (i === 3) {
      profile = {
        display_alias: "Candidato #A3", headline: "Operadora de caixa, 2 anos", years_experience: 2,
        location_point: point(-9.2230, 38.7550), location_label: "Amadora, Lisboa", max_commute_minutes: 25,
        salary_min: 950, salary_ideal: 1050, accepted_contracts: ["permanent"], accepted_work_modes: ["onsite"],
        weekly_availability: { ...emptyWeek(), mon: [{ from: "08:00", to: "16:00" }], tue: [{ from: "08:00", to: "16:00" }], wed: [{ from: "08:00", to: "16:00" }], thu: [{ from: "08:00", to: "16:00" }], fri: [{ from: "08:00", to: "16:00" }], sat: [{ from: "08:00", to: "14:00" }] },
        accepts_nights: false, accepts_weekends: true,
        skills: [{ slug: "pos_systems", label: "Sistemas POS", years: 2, verified: true }, { slug: "customer_service", label: "Atendimento ao cliente", years: 2, verified: true }],
        languages: [{ code: "pt", level: "native" }], work_authorisation: "eu", verification_level: "identity", trust_score: 0.75,
      };
    } else if (i === 4) {
      profile = {
        display_alias: "Candidato #A4", headline: "Op. de armazém, 2 anos", years_experience: 2,
        location_point: point(-9.1880, 38.7900), location_label: "Odivelas, Lisboa", max_commute_minutes: 30,
        salary_min: 1000, salary_ideal: 1100, accepted_contracts: ["permanent"], accepted_work_modes: ["onsite"],
        weekly_availability: { ...emptyWeek(), mon: [{ from: "07:00", to: "15:00" }], tue: [{ from: "07:00", to: "15:00" }], wed: [{ from: "07:00", to: "15:00" }], thu: [{ from: "07:00", to: "15:00" }], fri: [{ from: "07:00", to: "15:00" }] },
        accepts_nights: false, accepts_weekends: false,
        skills: [{ slug: "warehouse_operator", label: "Operador de armazém", years: 2, verified: true }, { slug: "forklift", label: "Empilhador", years: 1, verified: false }],
        languages: [{ code: "pt", level: "native" }], licences: [],
        work_authorisation: "eu", verification_level: "phone", trust_score: 0.7,
      };
    } else if (i === 5) {
      profile = {
        display_alias: "Candidato #A5", headline: "Motorista, carta B, 5 anos", years_experience: 5,
        location_point: point(-9.1900, 38.7950), location_label: "Odivelas, Lisboa", max_commute_minutes: 30,
        salary_min: 1100, salary_ideal: 1250, accepted_contracts: ["permanent"], accepted_work_modes: ["onsite"],
        weekly_availability: { ...emptyWeek(), mon: [{ from: "08:00", to: "17:00" }], tue: [{ from: "08:00", to: "17:00" }], wed: [{ from: "08:00", to: "17:00" }], thu: [{ from: "08:00", to: "17:00" }], fri: [{ from: "08:00", to: "17:00" }] },
        accepts_nights: false, accepts_weekends: false,
        skills: [{ slug: "driving", label: "Condução profissional", years: 5, verified: true }],
        languages: [{ code: "pt", level: "native" }], licences: ["driving_b"],
        work_authorisation: "eu", verification_level: "full", trust_score: 0.9,
      };
    } else if (i >= 6 && i <= 10) {
      // Assimétricos: a empresa adoraria, mas exige salário muito acima do
      // que qualquer vaga paga — fit_employer alto, fit_worker baixo.
      profile = {
        display_alias: `Candidato #B${i}`, headline: "Perfil sénior, expectativa salarial elevada", years_experience: 8,
        location_point: point(-9.1400, 38.7480), location_label: "Alvalade, Lisboa", max_commute_minutes: 30,
        salary_min: 2200, salary_ideal: 2600, accepted_contracts: ["permanent"], accepted_work_modes: ["onsite"],
        weekly_availability: { ...emptyWeek(), mon: [{ from: "08:00", to: "18:00" }], tue: [{ from: "08:00", to: "18:00" }], wed: [{ from: "08:00", to: "18:00" }], thu: [{ from: "08:00", to: "18:00" }], fri: [{ from: "08:00", to: "18:00" }], sat: [{ from: "10:00", to: "22:00" }] },
        accepts_nights: false, accepts_weekends: true,
        skills: [{ slug: "customer_service", label: "Atendimento ao cliente", years: 8, verified: true }, { slug: "pos_systems", label: "Sistemas POS", years: 6, verified: true }],
        languages: [{ code: "pt", level: "native" }, { code: "en", level: "advanced" }],
        work_authorisation: "eu", verification_level: "full", trust_score: 0.9,
      };
    } else {
      const skillByMod = [
        { slug: "customer_service", label: "Atendimento ao cliente", years: 2, verified: false },
        { slug: "warehouse_operator", label: "Operador de armazém", years: 2, verified: false },
        { slug: "pos_systems", label: "Sistemas POS", years: 1, verified: false },
        { slug: "food_prep", label: "Preparação de alimentos", years: 2, verified: false },
      ][i % 4];
      profile = {
        display_alias: `Candidato #C${i}`, headline: `${FIRST_NAMES[i - 1]}, ${1 + (i % 6)} anos de experiência`,
        years_experience: 1 + (i % 6),
        location_point: point(-9.10 - (i % 5) * 0.03, 38.74 + (i % 5) * 0.01), location_label: FREGUESIAS[i % 5],
        max_commute_minutes: 30 + (i % 4) * 15, salary_min: 850 + (i % 6) * 60, salary_ideal: 950 + (i % 6) * 70,
        accepted_contracts: i % 3 === 0 ? ["permanent", "fixed_term"] : ["permanent"], accepted_work_modes: ["onsite"],
        weekly_availability: { ...emptyWeek(), mon: [{ from: "08:00", to: "17:00" }], tue: [{ from: "08:00", to: "17:00" }], wed: [{ from: "08:00", to: "17:00" }], thu: [{ from: "08:00", to: "17:00" }], fri: [{ from: "08:00", to: "17:00" }] },
        accepts_nights: i % 4 === 0, accepts_weekends: i % 2 === 0,
        skills: [skillByMod],
        languages: [{ code: "pt", level: "native" }], work_authorisation: "eu",
        verification_level: i % 5 === 0 ? "full" : i % 3 === 0 ? "identity" : "phone",
        trust_score: 0.4 + (i % 5) * 0.08,
        availability: i % 11 === 0 ? "passive" : "active",
      };
    }

    await insertOrThrow("worker_profiles", [{ user_id: workerUser, ...profile }]);
  }

  console.log("\nSeed concluído: 3 empresas, 12 vagas, 40 candidatos.");
  console.log('Password de todas as contas: "werkwire-dev-2026"');
}

main().catch((err) => {
  console.error("\nFalhou:", err.message);
  process.exit(1);
});
