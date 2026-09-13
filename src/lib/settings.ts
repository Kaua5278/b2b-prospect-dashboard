'use client';

/**
 * Preferências locais persistidas no navegador (localStorage).
 * Tudo é client-only — cada getter trata ausência/erros silenciosamente.
 */

const KEYS = {
  theme: 'b2b.theme', // 'dark' | 'light'
  pitchTemplate: 'b2b.pitchTemplate',
  whatsappTemplate: 'b2b.whatsappTemplate',
  monthlyGoal: 'b2b.monthlyGoal',
  savedFilters: 'b2b.savedFilters',
};

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function safeRemove(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ── Tema ────────────────────────────────────────────────────────────────
export function getTheme(): 'dark' | 'light' {
  const saved = safeGet(KEYS.theme);
  if (saved === 'light' || saved === 'dark') return saved;
  // fallback: prefere o que o sistema pede
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false)
    ? 'light'
    : 'dark';
}
export function setTheme(t: 'dark' | 'light') {
  safeSet(KEYS.theme, t);
  applyTheme(t);
}
export function applyTheme(t: 'dark' | 'light') {
  const root = document.documentElement;
  root.classList.toggle('dark', t === 'dark');
  root.style.colorScheme = t;
}

// ── Template de pitch (IA) / WhatsApp ──────────────────────────────────
export function getPitchTemplate(): string | null {
  return safeGet(KEYS.pitchTemplate);
}
export function setPitchTemplate(p: string) {
  if (!p.trim()) safeRemove(KEYS.pitchTemplate);
  else safeSet(KEYS.pitchTemplate, p.trim());
}

export function getWhatsAppTemplate(): string | null {
  return safeGet(KEYS.whatsappTemplate);
}
export function setWhatsAppTemplate(p: string) {
  if (!p.trim()) safeRemove(KEYS.whatsappTemplate);
  else safeSet(KEYS.whatsappTemplate, p.trim());
}

// ── Meta mensal (conversão) ─────────────────────────────────────────────
export function getMonthlyGoal(): number {
  const raw = safeGet(KEYS.monthlyGoal);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 15; // default 15 vendas/mês
}
export function setMonthlyGoal(goal: number) {
  safeSet(KEYS.monthlyGoal, String(goal));
}

// ── Filtros salvos ──────────────────────────────────────────────────────
export interface SavedFilter {
  id: string;
  name: string;
  niche: string;
  state: string;
  city: string;
  onlyWithoutWebsite: boolean;
  createdAt: number;
}

export function getSavedFilters(): SavedFilter[] {
  const raw = safeGet(KEYS.savedFilters);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}
export function saveFilter(filter: Omit<SavedFilter, 'id' | 'createdAt'>): SavedFilter[] {
  const current = getSavedFilters();
  const item: SavedFilter = { ...filter, id: `f-${Date.now()}`, createdAt: Date.now() };
  const next = [item, ...current].slice(0, 20); // máx 20
  safeSet(KEYS.savedFilters, JSON.stringify(next));
  return next;
}
export function removeSavedFilter(id: string): SavedFilter[] {
  const next = getSavedFilters().filter(f => f.id !== id);
  safeSet(KEYS.savedFilters, JSON.stringify(next));
  return next;
}