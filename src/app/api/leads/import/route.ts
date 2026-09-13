import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Importa leads a partir de linhas CSV enviadas pelo client.
 * O parser roda no browser (src/lib/csv.ts) — aqui apenas validamos
 * e fazemos o upsert.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth via cookie (client usa sessão do browser)
    let supabase: any = null;
    let user: any = null;
    try {
      supabase = createClient();
      const { data: { user: u }, error } = await supabase.auth.getUser();
      if (!error && u) user = u;
    } catch { /* offline */ }
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { rows } = body;
    if (!Array.isArray(rows) || !rows.length) {
      return NextResponse.json({ error: 'Nenhuma linha para importar' }, { status: 400 });
    }

    const imported: any[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const row of rows) {
      const company = (row.empresa || '').trim();
      const phone = String(row.telefone || row.whatsapp || '').replace(/\D/g, '');
      if (!company || phone.length < 8) {
        skipped.push(company || 'linha sem dados');
        continue;
      }

      const phoneFull = phone.startsWith('55') ? `+${phone}` : `+55${phone}`;
      const state = (row.estado || '').toUpperCase().slice(0, 2) || 'SP';

      let placeId = row.place_id;
      if (!placeId) {
        placeId = `csv-${user.id.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      }

      try {
        const { error: upErr } = await supabase
          .from('leads')
          .upsert({
            user_id: user.id,
            place_id: placeId,
            company_name: company,
            trade_name: row.nome_fantasia?.trim() || null,
            cnpj: row.cnpj ? String(row.cnpj).replace(/\D/g, '') || null : null,
            phone_number: phoneFull,
            phone_type: phone.length === 11 ? 'owner_direct' : 'commercial_whatsapp',
            decision_maker_name: row.decisor?.trim() || null,
            city: row.cidade?.trim() || 'N/I',
            state,
            neighborhood: null,
            address: null,
            niche: row.nicho?.trim() || 'manual',
            status: 'new',
            notes: row.notas?.trim() || '',
            website: row.site?.trim() || null,
            has_website: row.tem_site === 'sim' ? true : !!(row.site || '').trim(),
          }, { onConflict: 'user_id,place_id' });

        if (upErr) {
          errors.push(`${company}: ${upErr.message}`);
        } else {
          imported.push({ company, place_id: placeId });
        }
      } catch (err: any) {
        errors.push(`${company}: ${err?.message || 'erro'}`);
      }
    }

    return NextResponse.json({
      imported: imported.length,
      skipped: skipped.length,
      errors,
    });
  } catch (error: any) {
    console.error('[leads/import] error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}