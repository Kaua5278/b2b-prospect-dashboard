/**
 * Utilitário: gerar pitch automaticamente e abrir WhatsApp com a mensagem
 * já preenchida na conversa (via wa.me/?text=...).
 */

interface PitchLead {
  company_name?: string;
  trade_name?: string;
  decision_maker_name?: string;
  niche?: string;
  city?: string;
  state?: string;
}

/** Gera pitch para WhatsApp (IA se disponível, senão template local rápido) */
export async function generatePitchForLead(lead: PitchLead, channel: 'whatsapp' = 'whatsapp'): Promise<string> {
  // Sempre tenta a IA primeiro (rápida, tem fallback local no endpoint)
  try {
    const response = await fetch('/api/ai/pitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: lead.trade_name || lead.company_name || '',
        trade_name: lead.trade_name,
        decision_maker_name: lead.decision_maker_name,
        niche: lead.niche || '',
        city: lead.city || '',
        state: lead.state || '',
        channel,
      }),
    });
    const data = await response.json();
    if (data.success && data.data?.pitch) return data.data.pitch;
    if (data.fallback) return data.fallback;
  } catch { /* fallback local */ }

  return localWhatsAppPitch(lead);
}

/** Template local de pitch para WhatsApp (funciona sem IA/API) */
export function localWhatsAppPitch(lead: PitchLead): string {
  const name = lead.decision_maker_name ? `Olá, ${lead.decision_maker_name.split(' ')[0]}` : 'Olá';
  const company = lead.trade_name || lead.company_name || 'sua empresa';
  const niche = lead.niche || 'seu nicho';
  const location = lead.city ? ` aqui em ${lead.city}/${lead.state || ''}` : '';

  return `${name}! Tudo bem? 👋

Vi que a ${company} atua no nicho de ${niche}${location} e notei que ainda não têm um site próprio.

Hoje, 9 em cada 10 clientes pesquisam no Google antes de contratar. Sem site, você perde credibilidade e deixa de aparecer para quem está procurando exatamente o que você oferece.

Ajudamos empresas como a sua a terem presença digital profissional em poucos dias, com site otimizado para receber contatos pelo WhatsApp.

Topa uma conversa rápida de 10 min para eu mostrar como funciona? Sem compromisso.

Abs!`;
}

/** Monta a URL do WhatsApp com o texto pré-preenchido */
export function buildWhatsAppUrl(phone: string, text: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Abre WhatsApp com o pitch pré-preenchido na conversa */
export async function openWhatsAppWithPitch(phone: string, lead: PitchLead): Promise<void> {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits || digits.length < 8) return;

  // Abre a URL COMPLETA (wa.me + texto local) imediatamente, no gesto do clique.
  // Isso evita o popup blocker: navegação assíncrona de about:blank para wa.me
  // é bloqueada pelo Chrome, então usamos o pitch local (síncrono) na abertura.
  const initialUrl = buildWhatsAppUrl(digits, localWhatsAppPitch(lead));
  const win = window.open(initialUrl, '_blank');

  if (!win) {
    // Popup bloqueado: navega na própria aba (fallback)
    window.location.href = initialUrl;
    return;
  }

  // Se a IA gerar um pitch melhor (assíncrono), atualiza a MESMA aba já aberta.
  try {
    const pitch = await generatePitchForLead(lead);
    win.location.href = buildWhatsAppUrl(digits, pitch);
  } catch {
    /* mantém o pitch local já aberto */
  }
}