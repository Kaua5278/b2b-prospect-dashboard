-- =============================================================================
-- Seed: Usuário admin padrão para desenvolvimento
-- Execute no Supabase SQL Editor APÓS rodar supabase/schema.sql
-- Versão compatível com o auth atual do Supabase (coluna provider_id)
-- IMPORTANTE: raw_user_meta_data DEVE conter sub/email/email_verified/
-- phone_verified, senão o GoTrue retorna 500 "Database error querying schema"
-- =============================================================================

-- 1. Cria o usuário na auth (senha real: admin123; o frontend mapeia 'admin' → 'admin123')
WITH admin_user AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS instance_id,
    gen_random_uuid() AS id,
    'authenticated' AS aud,
    'authenticated' AS role,
    'shlia@b2b.com' AS email,
    crypt('admin123', gen_salt('bf')) AS encrypted_password,
    now() AS email_confirmed_at,
    now() AS created_at,
    now() AS updated_at,
    now() AS confirmation_sent_at,
    '{"provider": "email", "providers": ["email"]}'::jsonb AS raw_app_meta_data
)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, confirmation_sent_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous
)
SELECT
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, confirmation_sent_at,
  raw_app_meta_data,
  jsonb_build_object(
    'sub', id::text,
    'email', email,
    'email_verified', false,
    'phone_verified', false
  ),
  false, false, false
FROM admin_user
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'shlia@b2b.com'
);

-- 2. Identity para login com email (formato atual: provider_id + provider)
--    sub da metadata deve bater com o id do usuário
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', false, 'phone_verified', false),
  'email',
  id::text,
  now(),
  now(),
  now()
FROM auth.users
WHERE email = 'shlia@b2b.com'
ON CONFLICT (provider_id, provider) DO NOTHING;

-- 3. Confirmação
select email, created_at from auth.users;

-- =============================================================================
-- CREDENCIAIS PARA LOGIN:
-- Email:    shlia@b2b.com
-- Senha:    admin123
-- =============================================================================