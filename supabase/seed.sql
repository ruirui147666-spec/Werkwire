-- ─────────────────────────────────────────────────────────────
-- Werkwire — seed de desenvolvimento (§15)
-- Um concelho (Lisboa/Amadora). 3 empresas, 12 vagas, 40 trabalhadores.
-- Inclui 5 pares que TÊM de dar match e 5 pares assimétricos que NÃO
-- podem dar match (o teste do duplo limiar), mais uma empresa "ghost".
--
-- Password de todas as contas semente: "werkwire-dev-2026"
-- ─────────────────────────────────────────────────────────────

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ST_GeogFromText (postgis) is used unqualified below — needs
-- "extensions" resolvable for this session, same reasoning as the
-- migrations (see 0001_extensions_enums.sql).
set search_path = public, extensions;

do $$
declare
  seed_password text := extensions.crypt('werkwire-dev-2026', extensions.gen_salt('bf'));

  -- company owners
  owner_resto uuid := gen_random_uuid();
  owner_retail uuid := gen_random_uuid();
  owner_logi uuid := gen_random_uuid();

  company_resto uuid := gen_random_uuid();
  company_retail uuid := gen_random_uuid();
  company_logi uuid := gen_random_uuid();

  job_ids uuid[12];
  i int;
  worker_user uuid;
  worker_profile uuid;

  -- pseudo-random but deterministic pools
  first_names text[] := array['Ana','Bruno','Carla','Diogo','Eva','Filipe','Gabriela','Hugo','Inês','João',
                               'Katia','Luís','Mariana','Nuno','Olga','Pedro','Rita','Sérgio','Tânia','Vasco',
                               'Beatriz','César','Dália','Eduardo','Fátima','Gonçalo','Helena','Ivo','Joana','Kevin',
                               'Leonor','Marco','Natália','Óscar','Paula','Quim','Raquel','Simão','Teresa','Ulisses'];
  sectors text[] := array['hospitality','retail','logistics'];
  freguesias text[] := array['Amadora, Lisboa','Alvalade, Lisboa','Benfica, Lisboa','Odivelas, Lisboa','Sintra, Lisboa'];
begin
  -- ── Auth users + profiles for the 3 employers ──────────────
  -- confirmation_token/recovery_token/email_change* must be '' rather than
  -- NULL — GoTrue's Go string scan chokes on a null there (known gotcha
  -- when seeding auth.users by hand instead of through the Auth API).
  insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role,
    confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current)
  values
    (owner_resto, '00000000-0000-0000-0000-000000000000', 'gestor@lisboagrill.pt', seed_password, now(), '{"role":"employer","full_name":"Rui Gestor"}', 'authenticated', 'authenticated', '', '', '', '', ''),
    (owner_retail, '00000000-0000-0000-0000-000000000000', 'rh@mercadoamadora.pt', seed_password, now(), '{"role":"employer","full_name":"Sofia RH"}', 'authenticated', 'authenticated', '', '', '', '', ''),
    (owner_logi, '00000000-0000-0000-0000-000000000000', 'operacoes@logifast.pt', seed_password, now(), '{"role":"employer","full_name":"Tiago Operações"}', 'authenticated', 'authenticated', '', '', '', '', '');

  update profiles set phone_verified = true, email_verified = true where id in (owner_resto, owner_retail, owner_logi);

  -- ── Companies ────────────────────────────────────────────
  insert into companies (id, owner_user_id, legal_name, trade_name, nipc, sector, size_band, description,
    verification_level, nipc_verified, domain_verified, response_rate_48h, avg_response_hours, hire_rate,
    abandon_rate, total_hires, ghost_flag)
  values
    (company_resto, owner_resto, 'Lisboa Grill, Lda.', 'Lisboa Grill', '500123456', 'hospitality', '10-49',
     'Restaurante de grelhados em Alvalade.', 'full', true, true, 0.86, 3.5, 0.22, 0.05, 11, false),
    (company_retail, owner_retail, 'Mercado Amadora, S.A.', 'Mercado Amadora', '500234567', 'retail', '50-249',
     'Supermercado de bairro com 6 lojas na Amadora.', 'full', true, true, 0.74, 6.2, 0.15, 0.10, 24, false),
    (company_logi, owner_logi, 'LogiFast Transportes, Lda.', 'LogiFast', '500345678', 'logistics', '10-49',
     'Distribuição e armazém em Odivelas.', 'none', false, false, 0.28, 41.0, 0.03, 0.42, 1, true);

  insert into billing_accounts (company_id, credits_balance) values
    (company_resto, 10), (company_retail, 25), (company_logi, 0);

  -- ── Jobs (12, across the 3 companies) ───────────────────────
  job_ids := array[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];

  insert into jobs (id, company_id, created_by, title, description, sector, salary_min, salary_max, contract,
    work_mode, location_point, location_label, weekly_schedule, has_nights, has_weekends, required_skills,
    min_years_experience, required_languages, required_licences, required_certs, requires_work_auth,
    positions_count, fill_by_date, intent_signed_by, status, published_at)
  values
    (job_ids[1], company_resto, owner_resto, 'Empregado de mesa', 'Sala e apoio ao balcão em restaurante de grelhados.',
     'hospitality', 1150, 1300, 'permanent', 'onsite', ST_GeogFromText('POINT(-9.1393 38.7489)'), 'Alvalade, Lisboa',
     '{"mon":[{"from":"09:00","to":"17:00"}],"tue":[{"from":"09:00","to":"17:00"}],"wed":[],"thu":[{"from":"14:00","to":"22:00"}],"fri":[{"from":"09:00","to":"17:00"}],"sat":[{"from":"12:00","to":"22:00"}],"sun":[]}',
     false, true,
     '[{"slug":"customer_service","label":"Atendimento ao cliente","weight":"essential","min_years":2},{"slug":"pos_systems","label":"Sistemas POS","weight":"desirable","min_years":0}]',
     2, '[]', '{}', '{}', true, 2, current_date + interval '30 days', owner_resto, 'active', now() - interval '3 days'),

    (job_ids[2], company_resto, owner_resto, 'Cozinheiro de linha', 'Preparação e confeção de pratos de grelhados.',
     'hospitality', 1200, 1400, 'permanent', 'onsite', ST_GeogFromText('POINT(-9.1393 38.7489)'), 'Alvalade, Lisboa',
     '{"mon":[{"from":"11:00","to":"20:00"}],"tue":[{"from":"11:00","to":"20:00"}],"wed":[{"from":"11:00","to":"20:00"}],"thu":[],"fri":[{"from":"11:00","to":"20:00"}],"sat":[{"from":"11:00","to":"20:00"}],"sun":[]}',
     false, true,
     '[{"slug":"food_prep","label":"Preparação de alimentos","weight":"essential","min_years":3},{"slug":"haccp","label":"HACCP","weight":"desirable","min_years":0}]',
     3, '[]', '{}', '{"haccp"}', true, 1, current_date + interval '21 days', owner_resto, 'active', now() - interval '5 days'),

    (job_ids[3], company_resto, owner_resto, 'Empregado de balcão', 'Take-away e apoio ao delivery.',
     'hospitality', 1000, 1100, 'fixed_term', 'onsite', ST_GeogFromText('POINT(-9.1393 38.7489)'), 'Alvalade, Lisboa',
     '{"mon":[],"tue":[{"from":"18:00","to":"23:00"}],"wed":[{"from":"18:00","to":"23:00"}],"thu":[{"from":"18:00","to":"23:00"}],"fri":[{"from":"18:00","to":"23:00"}],"sat":[{"from":"18:00","to":"23:00"}],"sun":[]}',
     true, true,
     '[{"slug":"customer_service","label":"Atendimento ao cliente","weight":"essential","min_years":0}]',
     0, '[]', '{}', '{}', true, 1, current_date + interval '14 days', owner_resto, 'active', now() - interval '1 day'),

    (job_ids[4], company_resto, owner_resto, 'Ajudante de cozinha', 'Apoio à cozinha e limpeza de sala.',
     'hospitality', 950, 1050, 'temporary', 'onsite', ST_GeogFromText('POINT(-9.1393 38.7489)'), 'Alvalade, Lisboa',
     '{"mon":[{"from":"08:00","to":"16:00"}],"tue":[{"from":"08:00","to":"16:00"}],"wed":[{"from":"08:00","to":"16:00"}],"thu":[{"from":"08:00","to":"16:00"}],"fri":[{"from":"08:00","to":"16:00"}],"sat":[],"sun":[]}',
     false, false,
     '[{"slug":"food_prep","label":"Preparação de alimentos","weight":"desirable","min_years":0}]',
     0, '[]', '{}', '{}', true, 1, current_date + interval '10 days', owner_resto, 'active', now() - interval '2 days'),

    (job_ids[5], company_retail, owner_retail, 'Operador de caixa', 'Caixa e apoio à loja em supermercado de bairro.',
     'retail', 1000, 1100, 'permanent', 'onsite', ST_GeogFromText('POINT(-9.2245 38.7538)'), 'Amadora, Lisboa',
     '{"mon":[{"from":"08:00","to":"16:00"}],"tue":[{"from":"08:00","to":"16:00"}],"wed":[{"from":"08:00","to":"16:00"}],"thu":[{"from":"08:00","to":"16:00"}],"fri":[{"from":"08:00","to":"16:00"}],"sat":[{"from":"08:00","to":"14:00"}],"sun":[]}',
     false, true,
     '[{"slug":"pos_systems","label":"Sistemas POS","weight":"essential","min_years":1},{"slug":"customer_service","label":"Atendimento ao cliente","weight":"essential","min_years":1}]',
     1, '[]', '{}', '{}', true, 3, current_date + interval '25 days', owner_retail, 'active', now() - interval '4 days'),

    (job_ids[6], company_retail, owner_retail, 'Repositor', 'Reposição de linear e apoio ao armazém da loja.',
     'retail', 950, 1000, 'permanent', 'onsite', ST_GeogFromText('POINT(-9.2245 38.7538)'), 'Amadora, Lisboa',
     '{"mon":[{"from":"06:00","to":"14:00"}],"tue":[{"from":"06:00","to":"14:00"}],"wed":[{"from":"06:00","to":"14:00"}],"thu":[{"from":"06:00","to":"14:00"}],"fri":[{"from":"06:00","to":"14:00"}],"sat":[],"sun":[]}',
     false, false,
     '[{"slug":"warehouse_operator","label":"Operador de armazém","weight":"desirable","min_years":0}]',
     0, '[]', '{}', '{}', true, 2, current_date + interval '20 days', owner_retail, 'active', now() - interval '6 days'),

    (job_ids[7], company_retail, owner_retail, 'Chefe de loja adjunto', 'Apoio à gestão diária de uma loja de bairro.',
     'retail', 1300, 1600, 'permanent', 'onsite', ST_GeogFromText('POINT(-9.2245 38.7538)'), 'Amadora, Lisboa',
     '{"mon":[{"from":"09:00","to":"18:00"}],"tue":[{"from":"09:00","to":"18:00"}],"wed":[{"from":"09:00","to":"18:00"}],"thu":[{"from":"09:00","to":"18:00"}],"fri":[{"from":"09:00","to":"18:00"}],"sat":[],"sun":[]}',
     false, false,
     '[{"slug":"customer_service","label":"Atendimento ao cliente","weight":"essential","min_years":3},{"slug":"team_leadership","label":"Liderança de equipa","weight":"essential","min_years":1}]',
     3, '[]', '{}', '{}', true, 1, current_date + interval '35 days', owner_retail, 'active', now() - interval '8 days'),

    (job_ids[8], company_retail, owner_retail, 'Operador de caixa (fim de semana)', 'Reforço de caixa aos fins de semana.',
     'retail', 900, 950, 'temporary', 'onsite', ST_GeogFromText('POINT(-9.2245 38.7538)'), 'Amadora, Lisboa',
     '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[{"from":"08:00","to":"20:00"}],"sun":[{"from":"08:00","to":"20:00"}]}',
     false, true,
     '[{"slug":"pos_systems","label":"Sistemas POS","weight":"desirable","min_years":0}]',
     0, '[]', '{}', '{}', true, 2, current_date + interval '12 days', owner_retail, 'active', now() - interval '1 day'),

    (job_ids[9], company_logi, owner_logi, 'Operador de armazém', 'Picking e apoio à expedição em armazém logístico.',
     'logistics', 1050, 1150, 'permanent', 'onsite', ST_GeogFromText('POINT(-9.1866 38.7936)'), 'Odivelas, Lisboa',
     '{"mon":[{"from":"07:00","to":"15:00"}],"tue":[{"from":"07:00","to":"15:00"}],"wed":[{"from":"07:00","to":"15:00"}],"thu":[{"from":"07:00","to":"15:00"}],"fri":[{"from":"07:00","to":"15:00"}],"sat":[],"sun":[]}',
     false, false,
     '[{"slug":"warehouse_operator","label":"Operador de armazém","weight":"essential","min_years":1},{"slug":"forklift","label":"Empilhador","weight":"desirable","min_years":0}]',
     1, '[]', '{}', '{}', true, 2, current_date + interval '18 days', owner_logi, 'active', now() - interval '15 days'),

    (job_ids[10], company_logi, owner_logi, 'Motorista de distribuição', 'Entregas locais em veículo ligeiro.',
     'logistics', 1150, 1300, 'permanent', 'onsite', ST_GeogFromText('POINT(-9.1866 38.7936)'), 'Odivelas, Lisboa',
     '{"mon":[{"from":"08:00","to":"17:00"}],"tue":[{"from":"08:00","to":"17:00"}],"wed":[{"from":"08:00","to":"17:00"}],"thu":[{"from":"08:00","to":"17:00"}],"fri":[{"from":"08:00","to":"17:00"}],"sat":[],"sun":[]}',
     false, false,
     '[{"slug":"driving","label":"Condução profissional","weight":"essential","min_years":1}]',
     1, '[]', '{"driving_b"}', '{}', true, 1, current_date + interval '10 days', owner_logi, 'active', now() - interval '20 days'),

    (job_ids[11], company_logi, owner_logi, 'Operador de empilhador', 'Movimentação de carga paletizada em armazém.',
     'logistics', 1100, 1250, 'permanent', 'onsite', ST_GeogFromText('POINT(-9.1866 38.7936)'), 'Odivelas, Lisboa',
     '{"mon":[{"from":"22:00","to":"23:59"}],"tue":[{"from":"00:00","to":"06:00"}],"wed":[{"from":"22:00","to":"23:59"}],"thu":[{"from":"00:00","to":"06:00"}],"fri":[{"from":"22:00","to":"23:59"}],"sat":[],"sun":[]}',
     true, false,
     '[{"slug":"forklift","label":"Empilhador","weight":"essential","min_years":1}]',
     1, '[]', '{"forklift"}', '{}', true, 1, current_date + interval '25 days', owner_logi, 'active', now() - interval '10 days'),

    (job_ids[12], company_logi, owner_logi, 'Assistente de expedição', 'Conferência e embalamento de encomendas.',
     'logistics', 980, 1050, 'temporary', 'onsite', ST_GeogFromText('POINT(-9.1866 38.7936)'), 'Odivelas, Lisboa',
     '{"mon":[{"from":"09:00","to":"17:00"}],"tue":[{"from":"09:00","to":"17:00"}],"wed":[{"from":"09:00","to":"17:00"}],"thu":[{"from":"09:00","to":"17:00"}],"fri":[{"from":"09:00","to":"17:00"}],"sat":[],"sun":[]}',
     false, false,
     '[{"slug":"warehouse_operator","label":"Operador de armazém","weight":"desirable","min_years":0}]',
     0, '[]', '{}', '{}', true, 2, current_date + interval '8 days', owner_logi, 'active', now() - interval '30 days');

  -- ── 40 trabalhadores ─────────────────────────────────────────
  -- Índices 1–5: perfis desenhados para dar match nas vagas 1–5.
  -- Índices 6–10: perfis assimétricos (empresa adora, pessoa odeia) —
  -- não podem dar match, mesmo tendo boa afinidade de competências.
  -- Índices 11–40: preenchimento realista, gerado por padrão.
  for i in 1..40 loop
    worker_user := gen_random_uuid();
    worker_profile := gen_random_uuid();

    insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role,
      confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current)
    values (worker_user, '00000000-0000-0000-0000-000000000000',
            lower(first_names[i]) || i || '@exemplo.pt', seed_password, now(),
            jsonb_build_object('role','worker','full_name', first_names[i] || ' Candidato'),
            'authenticated', 'authenticated', '', '', '', '', '');

    update profiles set phone_verified = true, email_verified = true where id = worker_user;

    if i = 1 then
      -- match perfeito com job 1 (Empregado de mesa)
      insert into worker_profiles (id, user_id, display_alias, headline, years_experience, location_point,
        location_label, max_commute_minutes, salary_min, salary_ideal, accepted_contracts, accepted_work_modes,
        weekly_availability, accepts_nights, accepts_weekends, skills, languages, work_authorisation,
        verification_level, trust_score)
      values (worker_profile, worker_user, 'Candidato #A1', 'Empregado de mesa, 3 anos', 3,
        ST_GeogFromText('POINT(-9.1420 38.7460)'), 'Alvalade, Lisboa', 30, 1000, 1200,
        '{permanent,fixed_term}', '{onsite}',
        '{"mon":[{"from":"08:00","to":"18:00"}],"tue":[{"from":"08:00","to":"18:00"}],"wed":[{"from":"08:00","to":"18:00"}],"thu":[{"from":"08:00","to":"18:00"}],"fri":[{"from":"08:00","to":"18:00"}],"sat":[{"from":"10:00","to":"22:00"}],"sun":[]}',
        false, true,
        '[{"slug":"customer_service","label":"Atendimento ao cliente","years":3,"verified":true},{"slug":"pos_systems","label":"Sistemas POS","years":2,"verified":false}]',
        '[{"code":"pt","level":"native"}]', 'eu', 'full', 0.8);

    elsif i = 2 then
      -- match perfeito com job 2 (Cozinheiro de linha)
      insert into worker_profiles (id, user_id, display_alias, headline, years_experience, location_point,
        location_label, max_commute_minutes, salary_min, salary_ideal, accepted_contracts, accepted_work_modes,
        weekly_availability, accepts_nights, accepts_weekends, skills, languages, certifications, work_authorisation,
        verification_level, trust_score)
      values (worker_profile, worker_user, 'Candidato #A2', 'Cozinheiro, 4 anos', 4,
        ST_GeogFromText('POINT(-9.1450 38.7500)'), 'Alvalade, Lisboa', 30, 1150, 1350,
        '{permanent}', '{onsite}',
        '{"mon":[{"from":"11:00","to":"21:00"}],"tue":[{"from":"11:00","to":"21:00"}],"wed":[{"from":"11:00","to":"21:00"}],"thu":[],"fri":[{"from":"11:00","to":"21:00"}],"sat":[{"from":"11:00","to":"21:00"}],"sun":[]}',
        false, true,
        '[{"slug":"food_prep","label":"Preparação de alimentos","years":4,"verified":true}]',
        '[{"code":"pt","level":"native"}]', '["haccp"]', 'eu', 'full', 0.85);

    elsif i = 3 then
      -- match perfeito com job 5 (Operador de caixa, Mercado Amadora)
      insert into worker_profiles (id, user_id, display_alias, headline, years_experience, location_point,
        location_label, max_commute_minutes, salary_min, salary_ideal, accepted_contracts, accepted_work_modes,
        weekly_availability, accepts_nights, accepts_weekends, skills, languages, work_authorisation,
        verification_level, trust_score)
      values (worker_profile, worker_user, 'Candidato #A3', 'Operadora de caixa, 2 anos', 2,
        ST_GeogFromText('POINT(-9.2230 38.7550)'), 'Amadora, Lisboa', 25, 950, 1050,
        '{permanent}', '{onsite}',
        '{"mon":[{"from":"08:00","to":"16:00"}],"tue":[{"from":"08:00","to":"16:00"}],"wed":[{"from":"08:00","to":"16:00"}],"thu":[{"from":"08:00","to":"16:00"}],"fri":[{"from":"08:00","to":"16:00"}],"sat":[{"from":"08:00","to":"14:00"}],"sun":[]}',
        false, true,
        '[{"slug":"pos_systems","label":"Sistemas POS","years":2,"verified":true},{"slug":"customer_service","label":"Atendimento ao cliente","years":2,"verified":true}]',
        '[{"code":"pt","level":"native"}]', 'eu', 'identity', 0.75);

    elsif i = 4 then
      -- match perfeito com job 9 (Operador de armazém, LogiFast)
      insert into worker_profiles (id, user_id, display_alias, headline, years_experience, location_point,
        location_label, max_commute_minutes, salary_min, salary_ideal, accepted_contracts, accepted_work_modes,
        weekly_availability, accepts_nights, accepts_weekends, skills, languages, licences, work_authorisation,
        verification_level, trust_score)
      values (worker_profile, worker_user, 'Candidato #A4', 'Op. de armazém, 2 anos', 2,
        ST_GeogFromText('POINT(-9.1880 38.7900)'), 'Odivelas, Lisboa', 30, 1000, 1100,
        '{permanent}', '{onsite}',
        '{"mon":[{"from":"07:00","to":"15:00"}],"tue":[{"from":"07:00","to":"15:00"}],"wed":[{"from":"07:00","to":"15:00"}],"thu":[{"from":"07:00","to":"15:00"}],"fri":[{"from":"07:00","to":"15:00"}],"sat":[],"sun":[]}',
        false, false,
        '[{"slug":"warehouse_operator","label":"Operador de armazém","years":2,"verified":true},{"slug":"forklift","label":"Empilhador","years":1,"verified":false}]',
        '[{"code":"pt","level":"native"}]', '{}', 'eu', 'phone', 0.7);

    elsif i = 5 then
      -- match perfeito com job 10 (Motorista de distribuição)
      insert into worker_profiles (id, user_id, display_alias, headline, years_experience, location_point,
        location_label, max_commute_minutes, salary_min, salary_ideal, accepted_contracts, accepted_work_modes,
        weekly_availability, accepts_nights, accepts_weekends, skills, languages, licences, work_authorisation,
        verification_level, trust_score)
      values (worker_profile, worker_user, 'Candidato #A5', 'Motorista, carta B, 5 anos', 5,
        ST_GeogFromText('POINT(-9.1900 38.7950)'), 'Odivelas, Lisboa', 30, 1100, 1250,
        '{permanent}', '{onsite}',
        '{"mon":[{"from":"08:00","to":"17:00"}],"tue":[{"from":"08:00","to":"17:00"}],"wed":[{"from":"08:00","to":"17:00"}],"thu":[{"from":"08:00","to":"17:00"}],"fri":[{"from":"08:00","to":"17:00"}],"sat":[],"sun":[]}',
        false, false,
        '[{"slug":"driving","label":"Condução profissional","years":5,"verified":true}]',
        '[{"code":"pt","level":"native"}]', '{driving_b}', 'eu', 'full', 0.9);

    elsif i between 6 and 10 then
      -- Assimétricos: a empresa adoraria (competências fortes e locais),
      -- mas o candidato exige um salário muito acima do que a vaga paga —
      -- fit_employer alto, fit_worker baixo, isMatch() tem de recusar.
      insert into worker_profiles (id, user_id, display_alias, headline, years_experience, location_point,
        location_label, max_commute_minutes, salary_min, salary_ideal, accepted_contracts, accepted_work_modes,
        weekly_availability, accepts_nights, accepts_weekends, skills, languages, work_authorisation,
        verification_level, trust_score)
      values (worker_profile, worker_user, 'Candidato #B' || i, 'Perfil sénior, expectativa salarial elevada', 8,
        ST_GeogFromText('POINT(-9.1400 38.7480)'), 'Alvalade, Lisboa', 30, 2200, 2600,
        '{permanent}', '{onsite}',
        '{"mon":[{"from":"08:00","to":"18:00"}],"tue":[{"from":"08:00","to":"18:00"}],"wed":[{"from":"08:00","to":"18:00"}],"thu":[{"from":"08:00","to":"18:00"}],"fri":[{"from":"08:00","to":"18:00"}],"sat":[{"from":"10:00","to":"22:00"}],"sun":[]}',
        false, true,
        '[{"slug":"customer_service","label":"Atendimento ao cliente","years":8,"verified":true},{"slug":"pos_systems","label":"Sistemas POS","years":6,"verified":true}]',
        '[{"code":"pt","level":"native"},{"code":"en","level":"advanced"}]', 'eu', 'full', 0.9);

    else
      -- preenchimento (11–40): variado, plausível, nem sempre elegível
      insert into worker_profiles (id, user_id, display_alias, headline, years_experience, location_point,
        location_label, max_commute_minutes, salary_min, salary_ideal, accepted_contracts, accepted_work_modes,
        weekly_availability, accepts_nights, accepts_weekends, skills, languages, work_authorisation,
        verification_level, trust_score, availability)
      values (
        worker_profile, worker_user, 'Candidato #C' || i,
        first_names[i] || ', ' || (1 + (i % 6))::text || ' anos de experiência',
        (1 + (i % 6))::numeric,
        ST_GeogFromText('POINT(' || (-9.10 - (i % 5) * 0.03) || ' ' || (38.74 + (i % 5) * 0.01) || ')'),
        freguesias[1 + (i % 5)],
        30 + (i % 4) * 15,
        850 + (i % 6) * 60,
        950 + (i % 6) * 70,
        case when i % 3 = 0 then array['permanent','fixed_term']::contract_type[] else array['permanent']::contract_type[] end,
        '{onsite}',
        '{"mon":[{"from":"08:00","to":"17:00"}],"tue":[{"from":"08:00","to":"17:00"}],"wed":[{"from":"08:00","to":"17:00"}],"thu":[{"from":"08:00","to":"17:00"}],"fri":[{"from":"08:00","to":"17:00"}],"sat":[],"sun":[]}',
        i % 4 = 0,
        i % 2 = 0,
        case (i % 4)
          when 0 then '[{"slug":"customer_service","label":"Atendimento ao cliente","years":2,"verified":false}]'
          when 1 then '[{"slug":"warehouse_operator","label":"Operador de armazém","years":2,"verified":false}]'
          when 2 then '[{"slug":"pos_systems","label":"Sistemas POS","years":1,"verified":false}]'
          else '[{"slug":"food_prep","label":"Preparação de alimentos","years":2,"verified":false}]'
        end::jsonb,
        '[{"code":"pt","level":"native"}]', 'eu',
        (case when i % 5 = 0 then 'full' when i % 3 = 0 then 'identity' else 'phone' end)::verification_lvl,
        0.4 + (i % 5) * 0.08,
        (case when i % 11 = 0 then 'passive' else 'active' end)::availability
      );
    end if;
  end loop;
end $$;
