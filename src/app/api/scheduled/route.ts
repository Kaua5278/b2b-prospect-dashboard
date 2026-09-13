import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * CRUD de prospecções agendadas — rodadas periodicamente pelo cron.
 * Tabela: scheduled_searches
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('scheduled_searches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ schedules: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const { name, niche, state, city, onlyWithoutWebsite, frequency } = body;

  if (!name?.trim() || !niche?.trim() || !state?.trim()) {
    return NextResponse.json({ error: 'Nome, nicho e estado são obrigatórios' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('scheduled_searches')
    .insert({
      user_id: user.id,
      name: name.trim().slice(0, 80),
      niche: niche.trim().slice(0, 80),
      state: state.trim().toUpperCase().slice(0, 2),
      city: city?.trim() || null,
      only_without_website: onlyWithoutWebsite !== false,
      frequency: frequency === 'weekly' ? 'weekly' : 'daily',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ schedule: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const { id, active, name, niche, city } = body;

  const { data, error } = await supabase
    .from('scheduled_searches')
    .update({
      ...(typeof active === 'boolean' ? { active } : {}),
      ...(name ? { name: name.trim().slice(0, 80) } : {}),
      ...(niche ? { niche: niche.trim().slice(0, 80) } : {}),
      ...(city !== undefined ? { city: city?.trim() || null } : {}),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ schedule: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  }

  const { error } = await supabase
    .from('scheduled_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}