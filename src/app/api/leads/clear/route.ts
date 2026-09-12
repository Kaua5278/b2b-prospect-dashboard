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
    // Auth via cookie de sessão (browser) OU Bearer token (client externo)
    let supabase = createClient();
    let { data: { user }, error: authError } = await supabase.auth.getUser();

    // Fallback: autentica via Bearer token e seta a sessão no client
    const bearer = request.headers.get('authorization')?.replace('Bearer ', '');
    if ((authError || !user) && bearer) {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: bearer,
          refresh_token: '',
        });
        if (!sessionError && sessionData?.user) {
          user = sessionData.user;
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