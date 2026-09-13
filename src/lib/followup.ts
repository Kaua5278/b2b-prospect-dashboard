/**
 * Lógica de follow-up — destaca leads contatados que não responderam
 */

export const FOLLOW_UP_HOURS = 48;

interface LeadLike {
  status?: string;
  contacted_at?: string | null;
  created_at?: string | null;
}

/** Contatou e não obteve resposta há mais de FOLLOW_UP_HOURS */
export function needsFollowUp(lead: LeadLike, now = Date.now()): boolean {
  if (!lead || lead.status !== 'contacted') return false;
  const ref = lead.contacted_at || lead.created_at;
  if (!ref) return false;
  const t = new Date(ref).getTime();
  return now - t > FOLLOW_UP_HOURS * 60 * 60 * 1000;
}

/** Horas desde o contato (0 se não aplicável) */
export function hoursSinceContact(lead: LeadLike, now = Date.now()): number {
  const ref = lead.contacted_at || lead.created_at;
  if (!ref) return 0;
  return Math.floor((now - new Date(ref).getTime()) / (60 * 60 * 1000));
}

/** Quantos leads precisam de follow-up agora */
export function followUpCount(leads: LeadLike[]): number {
  return leads.filter(l => needsFollowUp(l)).length;
}

/** Texto amigável descrevendo há quanto tempo espera resposta */
export function followUpLabel(lead: LeadLike): string {
  const h = hoursSinceContact(lead);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  const rest = h % 24;
  return rest > 0 ? `${d}d ${rest}h` : `${d}d`;
}