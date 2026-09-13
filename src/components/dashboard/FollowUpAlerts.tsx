'use client';

import { useState, useEffect } from 'react';
import { Bell, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { needsFollowUp, followUpLabel } from '@/lib/followup';
import { motion, AnimatePresence } from 'framer-motion';

interface FollowUpAlertsProps {
  leads: any[];
  onGoToLead?: (lead: any) => void;
}

/**
 * Mostra um alerta destacando leads contatados que não responderam em +48h
 * e permite agendar notificações do navegador.
 */
export function FollowUpAlerts({ leads, onGoToLead }: FollowUpAlertsProps) {
  const [notifEnabled, setNotifEnabled] = useState(false);

  const due = leads.filter(l => needsFollowUp(l));
  // top 3 mais antigos (espera há mais tempo)
  const top = [...due]
    .sort((a, b) => {
      const ta = new Date(a.contacted_at || a.created_at).getTime();
      const tb = new Date(b.contacted_at || b.created_at).getTime();
      return ta - tb;
    })
    .slice(0, 3);

  useEffect(() => {
    if (due.length && notifEnabled && typeof window !== 'undefined' && 'Notification' in window) {
      // Notifica quando o alerta aparece
      try {
        new Notification(`🔔 ${due.length} lead(s) precisam de follow-up`, {
          body: `Arraste para o Kanban ou abra o pipeline para retomar o contato.`,
        });
      } catch { /* ignore */ }
    }
  }, [due.length, notifEnabled]);

  const enableNotifications = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === 'granted');
  };

  if (!due.length) {
    return notifEnabled ? (
      <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
        <Bell className="h-3.5 w-3.5" /> Nenhum follow-up pendente
      </div>
    ) : null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-amber-300">
          <Clock className="h-4 w-4 animate-pulse" />
          <span className="text-sm font-medium">
            {due.length} lead(s) contatado(s) há mais de 48h sem resposta
          </span>
        </div>

        {!('Notification' in window || notifEnabled) && (
          <Button size="sm" variant="ghost" onClick={enableNotifications} className="text-xs text-amber-300 hover:text-amber-200">
            <Bell className="h-3.5 w-3.5 mr-1" /> Ativar notificações
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {top.map((lead) => {
          const name = lead.trade_name && lead.trade_name !== lead.company_name
            ? lead.trade_name
            : lead.company_name;
          return (
            <button
              key={lead.id}
              onClick={() => onGoToLead?.(lead)}
              className="group inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:border-amber-500/60 hover:text-white transition-colors text-left"
            >
              <Bell className="h-3 w-3 text-amber-400 group-hover:animate-pulse" />
              <span className="font-medium truncate max-w-[160px]">{name}</span>
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 bg-amber-500/10">
                {followUpLabel(lead)}
              </Badge>
              <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-cyan-400" />
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}