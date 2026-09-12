import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/leads/clear
 * Limpa TODOS os leads do usuário autenticado.
 * Útil no plano gratuito do Supabase (liberar espaço de linhas).
 * Requer confirmação explícita (confirm = true) para evitar exclusão acidental.
 */
export async function POST(request: NextRequest) {
  try {
    const bearer = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!bearer) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Cria um client autenticado com o token (via header global, funciona no server)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${bearer}` },
        },
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value; },
          set(name: string, value: string, options: CookieOptions) { request.cookies.set(name, value); },
          remove(name: string, options: CookieOptions) { request.cookies.set(name, ''); },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Confirmação explícita
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'Confirmação necessária' }, { status: 400 });
    }

    // Deleta todos os leads do usuário
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