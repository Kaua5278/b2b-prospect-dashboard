'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { MessageSquare, Phone, CheckCircle, Users, XCircle, Trash2, GripVertical, Clock, MapPin, Phone as PhoneIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { needsFollowUp, followUpLabel } from '@/lib/followup';

export type LeadStatus = 'new' | 'contacted' | 'replied' | 'negotiating' | 'closed_won' | 'closed_lost' | 'discarded';

export interface KanbanLead {
  id: string;
  company_name: string;
  trade_name?: string;
  decision_maker_name?: string;
  phone_number: string;
  city: string;
  state: string;
  niche: string;
  status: LeadStatus;
  contacted_at: string | null;
  created_at: string;
}

export const statusConfig: Record<LeadStatus, { label: string; color: string; icon: React.ComponentType<any> }> = {
  new: { label: 'Novos', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: MessageSquare },
  contacted: { label: 'Contatados', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Phone },
  replied: { label: 'Responderam', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  negotiating: { label: 'Em Negociação', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Users },
  closed_won: { label: 'Fechados', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  closed_lost: { label: 'Perdidos', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  discarded: { label: 'Descartados', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: Trash2 },
};

export const STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'replied', 'negotiating', 'closed_won', 'closed_lost', 'discarded'];

interface KanbanBoardProps {
  leads: KanbanLead[];
  onStatusChange: (id: string, status: LeadStatus) => Promise<void> | void;
  onOpenLead?: (lead: KanbanLead) => void;
}

export function KanbanBoard({ leads, onStatusChange, onOpenLead }: KanbanBoardProps) {
  const reduceMotion = useReducedMotion();
  const [dragging, setDragging] = useState<{ id: string; from: LeadStatus } | null>(null);
  const [overCol, setOverCol] = useState<LeadStatus | null>(null);

  // Agrupa leads por coluna, em ordem cronológica (mais recente primeiro)
  const columns = useMemo(() => {
    const grouped: Record<LeadStatus, KanbanLead[]> = {
      new: [], contacted: [], replied: [], negotiating: [],
      closed_won: [], closed_lost: [], discarded: [],
    };
    leads.forEach((l) => {
      grouped[l.status]?.push(l);
    });
    Object.keys(grouped).forEach((k) => {
      grouped[k as LeadStatus].sort((a, b) => {
        const ta = new Date(a.contacted_at || a.created_at).getTime();
        const tb = new Date(b.contacted_at || b.created_at).getTime();
        return tb - ta;
      });
    });
    return grouped;
  }, [leads]);

  const handleDrop = (status: LeadStatus) => {
    if (dragging) {
      onStatusChange(dragging.id, status);
    }
    setDragging(null);
    setOverCol(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-4 xl:grid-cols-7">
      {STATUS_ORDER.map((status) => {
        const conf = statusConfig[status];
        const Icon = conf.icon;
        const col = columns[status];
        const isOver = overCol === status;
        return (
          <div
            key={status}
            className={cn(
              'flex flex-col rounded-2xl border transition-all min-h-[300px] lg:min-h-[500px]',
              isOver ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-800 bg-slate-900/40'
            )}
            onDragOver={(e) => { e.preventDefault(); setOverCol(status); }}
            onDragLeave={() => setOverCol((c) => c === status ? null : c)}
            onDrop={(e) => { e.preventDefault(); handleDrop(status); }}
          >
            {/* Header da coluna */}
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className={cn('h-3.5 w-3.5 shrink-0', conf.color.split(' ')[1])} />
                <span className="text-sm font-medium text-slate-200 truncate">{conf.label}</span>
              </div>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800/50 text-slate-400 shrink-0">
                {col.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
              <AnimatePresence>
                {col.map((lead, i) => {
                  const fu = needsFollowUp(lead);
                  const display = lead.trade_name && lead.trade_name !== lead.company_name ? lead.trade_name : lead.company_name;
                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragging({ id: lead.id, from: status }); }}
                      onDragEnd={() => { setDragging(null); setOverCol(null); }}
                      onClick={() => onOpenLead?.(lead)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <motion.div
                        layout={!reduceMotion}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.18, delay: reduceMotion ? 0 : Math.min(i * 0.02, 0.3) }}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          'group rounded-xl border p-3 transition-colors select-none',
                          'bg-slate-800/60 border-slate-700/60 hover:border-cyan-500/40',
                          dragging?.id === lead.id && 'opacity-40'
                        )}
                      >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white leading-snug truncate">{display}</p>
                        </div>
                        <GripVertical className="h-4 w-4 text-slate-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      {lead.decision_maker_name && (
                        <p className="mt-1 text-xs text-slate-400 truncate">
                          <span className="text-emerald-400">●</span> {lead.decision_maker_name}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{lead.city || '—'}{lead.state ? `/${lead.state}` : ''}</span>
                      </div>

                      {lead.phone_number && (
                        <div className="mt-1 flex items-center gap-1 text-xs font-mono text-cyan-300/90">
                          <PhoneIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{lead.phone_number}</span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {lead.niche && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
                            {lead.niche}
                          </Badge>
                        )}
                        {fu && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-400 bg-amber-500/10 animate-pulse">
                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                            Follow-up {followUpLabel(lead)}
                          </Badge>
                        )}
                      </div>
                      </motion.div>
                    </div>
                  );
                })}
              </AnimatePresence>

              {col.length === 0 && (
                <div className="flex items-center justify-center h-24 rounded-xl border border-dashed border-slate-700/50 text-xs text-slate-600">
                  Arraste leads aqui
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KanbanLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
      <span>💡 Arraste os cards entre colunas para mudar o status</span>
    </div>
  );
}

/** Botão de mudar status rápido no card (para touch) */
export function StatusQuickButtons({
  lead,
  onStatusChange,
}: {
  lead: KanbanLead;
  onStatusChange: (id: string, status: LeadStatus) => void;
}) {
  return (
    <div className="flex gap-1 mt-2">
      {STATUS_ORDER.filter(s => s !== lead.status && s !== 'closed_lost' && s !== 'discarded').map(s => (
        <Button
          key={s}
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px] text-slate-400 hover:text-white"
          onClick={(e) => { e.stopPropagation(); onStatusChange(lead.id, s); }}
        >
          {statusConfig[s].label}
        </Button>
      ))}
    </div>
  );
}