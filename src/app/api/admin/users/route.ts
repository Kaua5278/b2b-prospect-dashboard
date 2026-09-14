import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Gerenciamento de contas (SOMENTE admins — app_metadata.role === 'admin').
 *
 * GET    /api/admin/users           → lista contas + atividade (leads, último acesso)
 * POST   /api/admin/users           → cria nova conta { email, password, name }
 * DELETE /api/admin/users?userId=   → deleta conta + leads dela (não pode a si mesma)
 *
 * A role vive em app_metadata (inacessível para edição pelo próprio usuário —
 * só a service_role pode alterar), então a verificação é confiável.
 */

async function getAuthedUser(request: NextRequest) {
  const bearer = request.headers.get('authorization')?.replace('Bearer ', '') || null;
  const supabase = createClient();
  let { data: { user }, error } = await supabase.auth.getUser();

  if ((error || !user) && bearer) {
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
    error = result.error;
  }

  return { user, error };
}

function isAdmin(user: { app_metadata?: Record<string, unknown> } | null): boolean {
  return user?.app_metadata?.role === 'admin';
}

// ── GET: lista contas com atividade ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getAuthedUser(request);
    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Acesso restrito a admins' }, { status: 403 });
    }

    const service = createServiceClient();
    const { data: listData, error: listError } = await service.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    // Atividade por usuário: leads (contagem + última atualização)
    const { data: leadRows, error: leadsError } = await service
      .from('leads')
      .select('user_id, created_at, updated_at');
    const leadsByUser = new Map<string, { count: number; lastActivity: string | null }>();
    if (!leadsError && leadRows) {
      for (const row of leadRows) {
        const uid = row.user_id as string;
        const stamp = (row.updated_at as string) || (row.created_at as string) || null;
        const current = leadsByUser.get(uid) || { count: 0, lastActivity: null };
        current.count += 1;
        if (stamp && (!current.lastActivity || stamp > current.lastActivity)) {
          current.lastActivity = stamp;
        }
        leadsByUser.set(uid, current);
      }
    }

    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    const accounts = listData.users.map((u) => {
      const activity = leadsByUser.get(u.id) || { count: 0, lastActivity: null };
      const lastSignIn = u.last_sign_in_at || null;
      const lastActive = [activity.lastActivity, lastSignIn].filter(Boolean).sort().pop() || null;
      const activeWithin30d = lastActive ? now - new Date(lastActive).getTime() < THIRTY_DAYS : false;
      return {
        id: u.id,
        email: u.email,
        name: (u.user_metadata?.name as string) || null,
        role: (u.app_metadata?.role as string) || 'member',
        leadsCount: activity.count,
        lastActivityAt: activity.lastActivity,
        lastSignInAt: lastSignIn,
        createdAt: u.created_at,
        working: activeWithin30d && activity.count > 0,
      };
    });

    // Admins primeiro, depois por atividade
    accounts.sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (b.role === 'admin' && a.role !== 'admin') return 1;
      return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
    });

    return NextResponse.json({ accounts });
  } catch (err) {
    console.error('[admin/users GET]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// ── POST: cria nova conta ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthedUser(request);
    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Acesso restrito a admins' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();
    const makeAdmin = body.role === 'admin';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha precisa de no mínimo 6 caracteres' }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || email.split('@')[0], email },
      app_metadata: { role: makeAdmin ? 'admin' : 'member' },
    });

    if (createError) {
      const msg = createError.message.includes('already been registered')
        ? 'Já existe uma conta com esse e-mail'
        : createError.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      account: {
        id: created.user?.id,
        email: created.user?.email,
        name,
        role: makeAdmin ? 'admin' : 'member',
      },
    });
  } catch (err) {
    console.error('[admin/users POST]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// ── DELETE: deleta conta (não pode a si mesma) ──────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await getAuthedUser(request);
    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Acesso restrito a admins' }, { status: 403 });
    }

    const userId = new URL(request.url).searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 });
    }
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Use "Apagar minha conta" para deletar a sua própria conta' },
        { status: 400 }
      );
    }

    const service = createServiceClient();

    // Remove os leads da conta antes de apagá-la
    await service.from('leads').delete().eq('user_id', userId);
    await service.from('scheduled_searches').delete().eq('user_id', userId);

    const { error: deleteError } = await service.auth.admin.deleteUser(userId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/users DELETE]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
