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

/** Abre WhatsApp com o pitch pré-preenchido na conversa */
export async function openWhatsAppWithPitch(phone: string, lead: PitchLead): Promise<void> {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits || digits.length < 8) return;

  // Abre a janela IMEDIATAMENTE (no gesto do usuário) para não ser bloqueada
  // como popup. Depois preenchemos a URL com o pitch quando estiver pronto.
  const win = window.open('about:blank', '_blank', 'noopener,noreferrer');
  if (!win) {
    // Popup bloqueado: abre direto mesmo assim
    const pitch = await generatePitchForLead(lead);
    window.location.href = `https://wa.me/${digits}?text=${encodeURIComponent(pitch)}`;
    return;
  }
  win.document.title = 'Gerando mensagem...';
  win.document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#555"><p>Gerando mensagem para WhatsApp...</p></div>';

  const pitch = await generatePitchForLead(lead);
  const text = encodeURIComponent(pitch);
  win.location.href = `https://wa.me/${digits}?text=${text}`;
}