import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/leads/clear
 * Limpa leads do banco.
 *  - Escopo padrão: SOMENTE os leads do usuário autenticado (RLS).
 *  - Escopo 'all' (body.scope): TODOS os leads de todas as contas —
 *    exclusivo para admins (app_metadata.role === 'admin'). Não-admin recebe 403.
 * Útil no plano gratuito do Supabase (liberar espaço de linhas).
 * Requer confirmação explícita (confirm = true) para evitar exclusão acidental.
 *
 * Auth aceita DOIS caminhos:
 *  - Cookie de sessão (browser) — usado pelo botão do dashboard
 *  - Authorization: Bearer <token> — para clients externos
 */
export async function POST(request: NextRequest) {
  try {
    const bearer = request.headers.get('authorization')?.replace('Bearer ', '') || null;

    // ── 1. Tenta autenticar por COOKIE (browser) ─────────────────────────
    let supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value; },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set(name, value);
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set(name, '');
          },
        },
      }
    );

    let { data: { user }, error: authError } = await supabase.auth.getUser();

    // ── 2. Fallback: autentica por BEARER token ──────────────────────────
    if ((authError || !user) && bearer) {
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: { Authorization: `Bearer ${bearer}` },
          },
          cookies: {
            get(name: string) { return request.cookies.get(name)?.value; },
            set(name: string, value: string, options: CookieOptions) {
              request.cookies.set(name, value);
            },
            remove(name: string, options: CookieOptions) {
              request.cookies.set(name, '');
            },
          },
        }
      );
      const result = await supabase.auth.getUser();
      user = result.data.user;
      authError = result.error;
    }

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Confirmação explícita
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'Confirmação necessária' }, { status: 400 });
    }

    // Escopo: admins podem limpar o banco COMPLETO; não-admin, só os próprios dados
    const isAdmin = user.app_metadata?.role === 'admin';
    const scopeAll = body.scope === 'all';

    if (scopeAll && !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas admins podem limpar o banco completo' },
        { status: 403 }
      );
    }

    if (scopeAll) {
      // Admin: apaga TODOS os leads (service_role, sem RLS)
      const service = createServiceClient();
      const { data, error } = await service.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id');
      if (error) {
        console.error('[clear] Erro ao limpar banco completo:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const deleted = Array.isArray(data) ? data.length : 0;
      console.log(`[clear] ${user.email} (admin) limpou o banco completo: ${deleted} leads`);
      return NextResponse.json({ success: true, deleted, scope: 'all' });
    }

    // Deleta todos os leads do usuário (RLS garante que são só os dele)
    const { data, error } = await supabase
      .from('leads')
      .delete()
      .eq('user_id', user.id)
      .select('id');

    if (error) {
      console.error('[clear] Erro ao limpar leads:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const deleted = Array.isArray(data) ? data.length : 0;
    console.log(`[clear] ${user.email} limpou ${deleted} leads`);
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('[clear] Erro:', error);
    return NextResponse.json({ error: 'Erro interno ao limpar banco' }, { status: 500 });
  }
}