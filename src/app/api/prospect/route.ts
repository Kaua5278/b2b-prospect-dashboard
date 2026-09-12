import { createClient } from '@/lib/supabase/server';
import { searchOSM, OSMPlace } from '@/lib/osm';
import { qualifyLeads } from '@/lib/qualify';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Auth check: try Supabase first, then mock cookie, then allow if Supabase offline
    let user: any = null;
    let supabase: any = null;
    
    // 1. Try Supabase auth
    try {
      supabase = createClient();
      const { data: { user: supaUser }, error: authError } = await supabase.auth.getUser();
      if (!authError && supaUser) user = supaUser;
    } catch { /* Supabase offline */ }

    // 2. Try mock cookie
    if (!user) {
      const allCookies = request.cookies;
      const mockAuth = allCookies.get('sb-mock-auth');
      if (mockAuth?.value) {
        try {
          const mockData = JSON.parse(atob(mockAuth.value));
          user = { email: mockData.email };
        } catch { /* invalid */ }
      }
    }

    // 3. In dev mode with no Supabase, allow unauthenticated access
    if (!user) {
      user = { email: 'dev@b2b.com' };
    }

    const body = await request.json();
    const { niche, state, city, onlyWithoutWebsite } = body;

    // Validate required fields
    if (!niche || !state) {
      return NextResponse.json({ 
        error: 'Nicho e estado são obrigatórios' 
      }, { status: 400 });
    }

    // Search leads via OpenStreetMap (gratuito, sem limite)
    const osmLeads = await searchOSM({
      niche,
      city: city || '',
      state,
      country: 'Brazil',
    });

    // ── QUALIFICAÇÃO: confere o nicho de cada lead ──────────────────────
    // (heurística local sem chave; Google/IA se houver chave). Agora a
    // qualificação é apenas INFORMATIVA (badge nos cards), NÃO filtra.
    const qualification = await qualifyLeads(osmLeads, {
      niche,
      city: city || '',
      state,
    });

    // ── PRIORIZAÇÃO: só leads com número de telefone ──────────────────────
    // O foco é ter leads contactáveis por WhatsApp/telefone. Leads sem
    // telefone são descartadas (sem número, sem prospecção).
    const allLeads = qualification.leads;

    const phoneFilter = (lead: OSMPlace & { qualified?: boolean; match_score?: number }) => {
      if (onlyWithoutWebsite === false) return true;
      if (!lead.website) return true;
      const socialDomains = ['facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'wa.me', 'api.whatsapp.com', 'youtube.com', 'tiktok.com'];
      const isSocial = socialDomains.some(d => lead.website!.includes(d));
      return isSocial;
    };

    const hasPhone = (lead: OSMPlace) => {
      const digits = (lead.phone_number || '').replace(/\D/g, '');
      return digits.length >= 8;
    };

    // Mantém SÓ leads com telefone, aplica filtro de site, e ordena por score
    const withPhone = allLeads
      .filter(l => hasPhone(l))
      .filter(phoneFilter)
      .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));

    const prioritizedLeads = withPhone.slice(0, 200);

    // Save to database (skip if Supabase offline)
    if (prioritizedLeads.length > 0 && supabase) {
      try {
        await supabase
        .from('leads')
        .upsert(
          prioritizedLeads.map(lead => ({
            user_id: user.id,
            place_id: lead.place_id,
            company_name: lead.company_name,
            trade_name: lead.trade_name,
            cnpj: null, // OSM não tem CNPJ
            niche: lead.niche || niche,
            country_code: 'BR',
            state: lead.state,
            city: lead.city,
            address: lead.formatted_address,
            latitude: lead.gps_coordinates?.latitude ?? null,
            longitude: lead.gps_coordinates?.longitude ?? null,
            phone_number: lead.phone_number ? normalizePhoneBR(lead.phone_number) : '',
            phone_type: detectPhoneType(lead.phone_number),
            decision_maker_name: null, // OSM não tem sócios
            has_website: !!(lead.website && !isSocialWebsite(lead.website)),
            status: 'new',
          })),
          { onConflict: 'user_id,place_id', ignoreDuplicates: true }
        );
      } catch { /* Supabase save failed, continue */ }
    }

    return NextResponse.json({ 
      leads: prioritizedLeads,
      count: prioritizedLeads.length,
      totalFound: osmLeads.length,
      qualifiedCount: qualification.qualified.length,
      discardedCount: qualification.discarded.length,
      verification: qualification.verification,
      ai_model: qualification.ai_model,
      withPhoneCount: withPhone.length,
    });
  } catch (error) {
    console.error('Prospect API error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    }, { status: 500 });
  }
}

// Helpers inline para não depender de places.ts
function normalizePhoneBR(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length === 8 || digits.length === 9) return `+5511${digits}`; // fallback SP
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
    return socialDomains.some(d => hostname.includes(d));
  } catch {
    return false;
  }
}