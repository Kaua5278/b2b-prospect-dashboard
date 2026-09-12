import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/leads/clear
 * Limpa TODOS os leads do usuário autenticado.
 * Útil no plano gratuito do Supabase (liberar espaço de linhas).
 * Requer confirmação explícita (confirm = true) para evitar exclusão acidental.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check — aceita cookie de sessão (browser) OU Bearer token (client externo)
    const supabase = createClient();
    let { data: { user }, error: authError } = await supabase.auth.getUser();

    // Fallback: tenta autenticar via Authorization header (Bearer)
    if ((authError || !user) && request.headers.get('authorization')) {
      try {
        const token = request.headers.get('authorization')!.replace('Bearer ', '');
        const { data: userData, error: tokenError } = await supabase.auth.getUser(token);
        if (!tokenError && userData?.user) {
          user = userData.user;
          authError = null;
        }
      } catch { /* token inválido */ }
    }

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