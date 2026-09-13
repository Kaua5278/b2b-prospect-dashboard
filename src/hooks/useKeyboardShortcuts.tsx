'use client';

import { useEffect } from 'react';

interface ShortcutOptions {
  onDashboard?: () => void;
  onProspect?: () => void;
  onPipeline?: () => void;
  onFocusSearch?: () => void;
  onStatusChange?: (index: number) => void; // 1-7 para status
  enabled?: boolean;
}

/**
 * Atalhos de teclado globais do dashboard:
 *   G → Dashboard | P → Pipeline | N → Prospecção | / → busca
 *   1..7 → mudar status do lead selecionado (se onStatusChange fornecido)
 * Ignora input/textarea/contentEditable (exceto Esc e barra "/").
 */
export function useKeyboardShortcuts({
  onDashboard,
  onProspect,
  onPipeline,
  onFocusSearch,
  onStatusChange,
  enabled = true,
}: ShortcutOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;

      // Barra "/" funciona mesmo em inputs para focar a busca
      if ((e.key === '/' || e.key === ';') && (onFocusSearch)) {
        e.preventDefault();
        onFocusSearch();
        return;
      }

      if (isTyping) return;

      switch (e.key.toLowerCase()) {
        case 'g':
          if (onDashboard) { e.preventDefault(); onDashboard(); }
          break;
        case 'p':
          if (onPipeline) { e.preventDefault(); onPipeline(); }
          break;
        case 'n':
          if (onProspect) { e.preventDefault(); onProspect(); }
          break;
        default:
          if (onStatusChange && /^[1-7]$/.test(e.key)) {
            e.preventDefault();
            onStatusChange(parseInt(e.key, 10) - 1);
          }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onDashboard, onProspect, onPipeline, onFocusSearch, onStatusChange]);
}