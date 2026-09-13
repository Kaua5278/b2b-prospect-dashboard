import { createClient, createServiceClient } from '@/lib/supabase/server';
import { searchOSM } from '@/lib/osm';
import { qualifyLeads } from '@/lib/qualify';
import { NextRequest, NextResponse } from 'next/server';

/**
 * CRON job — roda prospecções agendadas periodicamente.
 * Chamado pelo Vercel cron (vercel.json) com header Authorization Bearer {CRON_SECRET}.
 * Também aceita chamadas manuais autenticadas via cookie (roda APENAS os daquele user).
 */
export async function GET(request: NextRequest) {
  // 1) Autenticação: só aceita com CRON_SECRET válido, ou requisição autenticada
  const authHeader = request.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET;
  const isCron = secret ? authHeader === `Bearer ${secret}` : false;

  // Se cron (sem sessão), usa service_role para ver TODOS os agendamentos ativos.
  // Se usuário autenticado, usa sessão (RLS) e roda só os próprios.
  const isCronRequest = isCron;
  const supabase = isCron ? createServiceClient() : createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const isUser = !authError && !!user;

  if (!isCron && !isUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  // 2) Busca prospecções ativas
  let query = supabase
    .from('scheduled_searches')
    .select('*')
    .eq('active', true);

  if (!isCronRequest) {
    query = query.eq('user_id', user!.id);
  }

  const { data: schedules, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!schedules?.length) {
    return NextResponse.json({ ok: true, ran: 0, message: 'Nenhuma prospecção agendada ativa' });
  }

  // 3) Roda cada prospecção
  const results: any[] = [];
  const now = new Date();

  for (const sched of schedules) {
    // Se for chamada de usuário (manual), roda tudo; se cron, respeita frequência
    const lastRun = sched.last_run_at ? new Date(sched.last_run_at).getTime() : 0;
    const isDue = !sched.last_run_at || (now.getTime() - lastRun) >= 24 * 60 * 60 * 1000;

    if (isCronRequest && !isDue) {
      results.push({ name: sched.name, skipped: 'not-due-yet' });
      continue;
    }

    try {
      const res = await runProspection(supabase, sched);
      results.push({ name: sched.name, ...res });

      // Atualiza last_run_at / next_run_at
      const next = new Date();
      next.setHours(next.getHours() + (sched.frequency === 'weekly' ? 24 * 7 : 24));
      await supabase
        .from('scheduled_searches')
        .update({ last_run_at: now.toISOString(), next_run_at: next.toISOString() })
        .eq('id', sched.id);
    } catch (err: any) {
      results.push({ name: sched.name, error: err?.message || 'erro' });
    }
  }

  return NextResponse.json({
    ok: true,
    ran: results.filter((r) => r.count || r.skipped === 'not-due-yet').length,
    results,
  });
}

/** Executa a prospecção para um agendamento (mesma lógica do /api/prospect) */
async function runProspection(supabase: any, sched: any) {
  const { niche, state, city, only_without_website, user_id } = sched;

  const osmLeads = await searchOSM({
    niche,
    city: city || '',
    state,
    country: 'Brazil',
  });

  const qualification = await qualifyLeads(osmLeads, {
    niche,
    city: city || '',
    state,
  });

  const allLeads = qualification.leads;

  const socialDomains = ['facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'wa.me', 'api.whatsapp.com', 'youtube.com', 'tiktok.com'];
  const phoneFilter = (lead: any) => {
    if (only_without_website === false) return true;
    if (!lead.website) return true;
    return socialDomains.some((d) => lead.website.includes(d));
  };
  const hasPhone = (lead: any) => {
    const digits = (lead.phone_number || '').replace(/\D/g, '');
    return digits.length >= 8;
  };

  const withPhone = allLeads
    .filter((l: any) => hasPhone(l))
    .filter(phoneFilter)
    .sort((a: any, b: any) => (b.match_score ?? 0) - (a.match_score ?? 0))
    .slice(0, 200);

  let saved = 0;
  if (withPhone.length > 0) {
    const { error: upsertError } = await supabase
      .from('leads')
      .upsert(
        withPhone.map((lead: any) => ({
          user_id,
          place_id: lead.place_id,
          company_name: lead.company_name,
          trade_name: lead.trade_name,
          cnpj: null,
          niche: lead.niche || niche,
          country_code: 'BR',
          state: lead.state,
          city: lead.city,
          address: lead.formatted_address,
          latitude: lead.gps_coordinates?.latitude ?? null,
          longitude: lead.gps_coordinates?.longitude ?? null,
          phone_number: lead.phone_number ? normalizePhoneBR(lead.phone_number) : '',
          phone_type: detectPhoneType(lead.phone_number),
          decision_maker_name: null,
          has_website: !!(lead.website && !isSocialWebsite(lead.website)),
          status: 'new',
        })),
        { onConflict: 'user_id,place_id', ignoreDuplicates: true }
      );
    if (upsertError) {
      throw new Error(`upsert: ${upsertError.message}`);
    }
    saved = withPhone.length;
  }

  return {
    count: saved,
    totalFound: osmLeads.length,
    withPhoneCount: withPhone.length,
  };
}

function normalizePhoneBR(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length === 8 || digits.length === 9) return `+5511${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function detectPhoneType(phone?: string): 'owner_direct' | 'commercial_whatsapp' | 'landline_reception' {
  if (!phone) return 'landline_reception';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    const afterDDD = digits.substring(4);
    if (afterDDD.length === 9 && afterDDD.startsWith('9')) return 'owner_direct';
  }
  if (phone.toLowerCase().includes('whatsapp') || phone.toLowerCase().includes('zap')) return 'commercial_whatsapp';
  return 'landline_reception';
}

function isSocialWebsite(url?: string): boolean {
  if (!url) return false;
  const socialDomains = ['facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'wa.me', 'api.whatsapp.com', 'youtube.com', 'tiktok.com', 'linktr.ee', 'linkin.bio', 'beacons.ai', 'carrd.co'];
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
    return socialDomains.some((d) => hostname.includes(d));
  } catch {
    return false;
  }
}