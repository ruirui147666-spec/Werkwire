// Catálogo estático para o MVP (um concelho, poucos setores — spec §14:
// "lançar em vários sectores e distritos ao mesmo tempo" é um anti-requisito).

export const FREGUESIAS = [
  { label: "Amadora, Lisboa", lat: 38.7538, lng: -9.2245 },
  { label: "Alvalade, Lisboa", lat: 38.7489, lng: -9.1393 },
  { label: "Benfica, Lisboa", lat: 38.7531, lng: -9.2062 },
  { label: "Odivelas, Lisboa", lat: 38.7936, lng: -9.1866 },
  { label: "Sintra, Lisboa", lat: 38.7999, lng: -9.3906 },
  { label: "Areeiro, Lisboa", lat: 38.7423, lng: -9.1306 },
  { label: "Campolide, Lisboa", lat: 38.7328, lng: -9.1636 },
  { label: "Damaia, Lisboa", lat: 38.7457, lng: -9.2119 },
] as const;

export const SECTORS = [
  { slug: "hospitality", label: "Restauração e hotelaria" },
  { slug: "retail", label: "Retalho e comércio" },
  { slug: "logistics", label: "Logística e armazém" },
] as const;

export const SIZE_BANDS = ["1-9", "10-49", "50-249", "250+"] as const;

// Referência estática para orientar o empregador no passo do salário
// (§7.2, passo 2: "Mostrar a mediana da zona para a função"). Num sistema
// em produção isto viria de uma agregação sobre `jobs` publicadas; aqui é
// um valor de referência fixo por setor para o MVP.
export const MEDIAN_SALARY_BY_SECTOR: Record<string, number> = {
  hospitality: 1100,
  retail: 1050,
  logistics: 1120,
};

export const SKILLS_CATALOG = [
  { slug: "customer_service", label: "Atendimento ao cliente" },
  { slug: "pos_systems", label: "Sistemas POS / caixa" },
  { slug: "food_prep", label: "Preparação de alimentos" },
  { slug: "warehouse_operator", label: "Operador de armazém" },
  { slug: "forklift", label: "Condução de empilhador" },
  { slug: "driving", label: "Condução profissional" },
  { slug: "team_leadership", label: "Liderança de equipa" },
  { slug: "cleaning", label: "Limpeza e manutenção" },
  { slug: "stock_management", label: "Gestão de stock" },
  { slug: "delivery", label: "Entregas / estafeta" },
] as const;

export const LICENCES_CATALOG = [
  { slug: "driving_b", label: "Carta de condução B" },
  { slug: "forklift", label: "Carta de empilhador" },
  { slug: "haccp", label: "Certificado HACCP" },
  { slug: "first_aid", label: "Primeiros socorros" },
] as const;

export const HARD_NO_OPTIONS = [
  { type: "no_sundays" as const, label: "Não trabalho ao domingo" },
  { type: "no_freelance" as const, label: "Não aceito recibos verdes" },
  { type: "no_night_shifts" as const, label: "Não aceito turnos noturnos" },
];

export const LANGUAGES_CATALOG = [
  { code: "pt", label: "Português" },
  { code: "en", label: "Inglês" },
  { code: "es", label: "Espanhol" },
  { code: "fr", label: "Francês" },
] as const;

export const CONTRACT_LABELS: Record<string, string> = {
  permanent: "Efetivo",
  fixed_term: "Termo certo",
  temporary: "Temporário",
  freelance: "Recibos verdes",
  internship: "Estágio",
};

export const WORK_MODE_LABELS: Record<string, string> = {
  onsite: "Presencial",
  hybrid: "Híbrido",
  remote: "Remoto",
};

export const DAY_LABELS: Record<string, string> = {
  mon: "Seg",
  tue: "Ter",
  wed: "Qua",
  thu: "Qui",
  fri: "Sex",
  sat: "Sáb",
  sun: "Dom",
};

export const DAY_PERIODS = [
  { key: "morning", label: "Manhã", from: "08:00", to: "12:00" },
  { key: "afternoon", label: "Tarde", from: "12:00", to: "18:00" },
  { key: "night", label: "Noite", from: "18:00", to: "23:00" },
] as const;
