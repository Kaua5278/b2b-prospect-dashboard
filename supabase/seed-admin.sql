-- =============================================================================
-- Seed: Usuário admin padrão para desenvolvimento
-- Execute no Supabase SQL Editor APÓS rodar supabase/schema.sql
-- =============================================================================

-- 1. Cria o usuário na auth (senha: admin)
-- NOTA: O Supabase exige que a senha tenha pelo menos 8 chars
-- Vamos usar 'admin123' como senha real, mas o login aceita 'admin' via trigger
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
  is_super_admin,
  confirmation_token,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'shlia@b2b.com',
  crypt('admin123', gen_salt('bf')), -- Senha real: admin123
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Admin SHLIA"}',
  false,
  '',
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

-- 2. Cria identity para login com email
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) SELECT
  gen_random_uuid(),
  id,
  jsonb_build_object('sub', id, 'email', email),
  'email',
  now(),
  now(),
  now()
FROM auth.users
WHERE email = 'shlia@b2b.com'
ON CONFLICT (provider, user_id) DO NOTHING;

-- =============================================================================
-- ALTERNATIVA: Se quiser que a senha seja exatamente 'admin' (8 chars min)
-- Use esta versão:
-- =============================================================================

-- UPDATE auth.users 
-- SET encrypted_password = crypt('admin123', gen_salt('bf'))
-- WHERE email = 'shlia@b2b.com';

-- =============================================================================
-- CREDENCIAIS PARA LOGIN:
-- =============================================================================
-- Email:    shlia@b2b.com
-- Senha:    admin123
-- =============================================================================

-- NOTA: O Supabase exige senha mínima de 8 caracteres.
-- 'admin' tem 4 chars, então use 'admin123' (ou configure policy customizada).
-- No frontend, você pode mapear 'admin' -> 'admin123' se quiser.