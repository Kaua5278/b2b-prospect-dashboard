-- =============================================================================
-- Seed: Usuário admin padrão para desenvolvimento
-- Execute no Supabase SQL Editor APÓS rodar supabase/schema.sql
-- Versão compatível com o auth atual do Supabase (coluna provider_id)
-- =============================================================================

-- 1. Cria o usuário na auth (senha real: admin123; o frontend mapeia 'admin' → 'admin123')
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'shlia@b2b.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Admin SHLIA"}',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'shlia@b2b.com'
);

-- 2. Identity para login com email (formato atual: provider_id + provider)
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
  jsonb_build_object('sub', id, 'email', email, 'email_verified', false, 'phone_verified', false),
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