import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * POST /api/account/delete
 * A conta autenticada apaga A PRÓPRIA conta: leads, agendamentos e o usuário auth.
 * Requer confirmação explícita (confirm = true).
 *
 * Auth aceita DOIS caminhos: cookie de sessão (browser) ou Bearer token.
 */
export async function POST(request: NextRequest) {
  try {
    const bearer = request.headers.get('authorization')?.replace('Bearer ', '') || null;

    let supabase = createClient();
    let { data: { user }, error: authError } = await supabase.auth.getUser();

    if ((authError || !user) && bearer) {
      const viaBearer = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${bearer}` } },
          cookies: {
            get(name: string) { return request.cookies.get(name)?.value; },
            set(name: string, value: string, options: CookieOptions) { request.cookies.set(name, value); },
            remove(name: string, options: CookieOptions) { request.cookies.set(name, ''); },
          },
        }
      );
      const result = await viaBearer.auth.getUser();
      user = result.data.user;
      authError = result.error;
    }

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'Confirmação necessária' }, { status: 400 });
    }

    const service = createServiceClient();

    // 1. Remove leads e agendamentos da conta
    const { error: leadsError } = await service.from('leads').delete().eq('user_id', user.id);
    if (leadsError) {
      console.error('[account/delete] Erro ao remover leads:', leadsError.message);
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }
    await service.from('scheduled_searches').delete().eq('user_id', user.id);

    // 2. Remove o usuário auth
    const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('[account/delete] Erro ao deletar usuário:', deleteError.message);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log(`[account/delete] Conta apagada: ${user.email}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[account/delete] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao apagar conta' }, { status: 500 });
  }
}
