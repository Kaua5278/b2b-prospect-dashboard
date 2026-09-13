'use client';

import { useMemo, useState, useCallback } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Bar, BarChart, Cell } from 'recharts';
import { TrendingUp, Target, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getMonthlyGoal, setMonthlyGoal } from '@/lib/settings';
import { cn } from '@/lib/utils';

interface AnalyticsChartsProps {
  leads: any[];
}

const STATUS_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const GOAL_DEFAULT = 15;

/**
 * Gráficos de evolução do pipeline:
 *  - Área: leads adicionados por dia (últimos 30 dias)
 *  - Barras: leads por status (visão geral do funil)
 *  - Meta mensal: progresso de fechamentos no mês (editável)
 */
export function AnalyticsCharts({ leads }: AnalyticsChartsProps) {
  const [goal, setGoalState] = useState<number>(() => {
    if (typeof window !== 'undefined') return getMonthlyGoal();
    return GOAL_DEFAULT;
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');

  // Série diária — últimos 30 dias
  const daily = useMemo(() => {
    const days: Record<string, number> = {};
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days[format(d, 'yyyy-MM-dd')] = 0;
    }
    leads.forEach((l) => {
      if (!l.created_at) return;
      const key = format(new Date(l.created_at), 'yyyy-MM-dd');
      if (key in days) days[key] += 1;
    });
    return Object.entries(days).map(([date, count]) => ({
      date,
      label: format(new Date(date), 'dd/MM'),
      leads: count,
    }));
  }, [leads]);

  // Status
  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      map[l.status] = (map[l.status] || 0) + 1;
    });
    const labels: Record<string, string> = {
      new: 'Novos', contacted: 'Contatados', replied: 'Responderam',
      negotiating: 'Negociando', closed_won: 'Fechados', closed_lost: 'Perdidos', discarded: 'Descartados',
    };
    const order = ['new', 'contacted', 'replied', 'negotiating', 'closed_won', 'closed_lost', 'discarded'];
    return order
      .filter((s) => (map[s] ?? 0) > 0)
      .map((s, i) => ({ name: labels[s] || s, status: s, value: map[s] ?? 0, color: STATUS_COLORS[i % STATUS_COLORS.length] }));
  }, [leads]);

  // Meta mensal: fechados neste mês
  const thisMonthWon = useMemo(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return leads.filter((l) => {
      if (l.status !== 'closed_won') return false;
      const d = new Date(l.updated_at || l.created_at);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === key;
    }).length;
  }, [leads]);

  const goalPct = goal > 0 ? Math.min(100, Math.round((thisMonthWon / goal) * 100)) : 0;

  const handleGoalSubmit = useCallback(() => {
    const n = parseInt(goalDraft, 10);
    if (Number.isFinite(n) && n > 0) {
      setGoalState(n);
      setMonthlyGoal(n);
    }
    setEditingGoal(false);
  }, [goalDraft]);

  const totalLeads = leads.length;
  const totalWon = byStatus.find((s) => s.status === 'closed_won')?.value ?? 0;
  const convRate = totalLeads ? Math.round((totalWon / totalLeads) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Área: adição diária */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 lg:col-span-2"
      >
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Leads adicionados (últimos 30 dias)</h3>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: any) => [v, 'leads']}
              />
              <Area type="monotone" dataKey="leads" stroke="#06b6d4" strokeWidth={2} fill="url(#leadsFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Meta mensal */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Meta do mês</h3>
          </div>
          <button
            onClick={() => { setEditingGoal(true); setGoalDraft(String(goal)); }}
            className="text-xs text-slate-500 hover:text-cyan-300 transition-colors"
            title="Editar meta"
          >
            Editar
          </button>
        </div>

        {/* Anel de progresso */}
        <div className="relative mx-auto h-36 w-36">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="10" />
            <motion.circle
              cx="60" cy="60" r="52" fill="none"
              stroke={goalPct >= 100 ? '#10b981' : '#06b6d4'}
              strokeWidth="10" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52}
              initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - goalPct / 100) }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-white">{thisMonthWon}</span>
            <span className="text-[11px] text-slate-500">de {goal}</span>
          </div>
        </div>

        {editingGoal ? (
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              min={1}
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGoalSubmit()}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
              autoFocus
            />
            <button onClick={handleGoalSubmit} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700">OK</button>
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-slate-500">
            {goalPct >= 100
              ? '🎉 Meta batida! Excelente resultado.'
              : `${goalPct}% da meta alcançado — feche ${goal - thisMonthWon} venda(s) para bater.`}
          </p>
        )}
      </motion.div>

      {/* Barras por status + resumo */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 lg:col-span-3"
      >
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Distribuição do pipeline</h3>
          <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
            <span><b className="text-white">{totalLeads}</b> leads</span>
            <span><b className="text-emerald-400">{totalWon}</b> fechados</span>
            <span><b className="text-cyan-400">{convRate}%</b> conversão</span>
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byStatus} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
              <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                formatter={(v: any) => [v, 'leads']}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {byStatus.map((entry) => (
                  <Cell key={entry.status} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}