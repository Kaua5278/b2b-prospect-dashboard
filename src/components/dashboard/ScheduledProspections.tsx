'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, Plus, Trash2, Power, Loader2, Clock, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScheduledSearch {
  id: string;
  name: string;
  niche: string;
  state: string;
  city: string | null;
  only_without_website: boolean;
  frequency: 'daily' | 'weekly';
  active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

interface ScheduledProspectionsProps {
  currentFilters?: { niche: string; state: string; city: string; onlyWithoutWebsite: boolean };
}

/**
 * Gerencia prospecções agendadas (rodadas pelo cron /api/cron/prospect).
 */
export function ScheduledProspections({ currentFilters }: ScheduledProspectionsProps) {
  const [schedules, setSchedules] = useState<ScheduledSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(true);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');

  const load = async () => {
    try {
      const res = await fetch('/api/scheduled');
      if (!res.ok) throw new Error('erro');
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Preenche o formulário com os filtros atuais da prospecção
  useEffect(() => {
    if (currentFilters?.niche && currentFilters.state) {
      setNiche(currentFilters.niche);
      setState(currentFilters.state);
      setCity(currentFilters.city);
      setOnlyWithoutWebsite(currentFilters.onlyWithoutWebsite);
      if (!name) setName(`${currentFilters.niche} • ${currentFilters.state}`);
    }
  }, [currentFilters]);

  const handleSave = async () => {
    if (!name.trim() || !niche.trim() || !state) return;
    setSaving(true);
    try {
      const res = await fetch('/api/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, niche: niche.trim(), state, city, onlyWithoutWebsite, frequency }),
      });
      if (!res.ok) throw new Error('erro');
      await load();
      setShowForm(false);
      setName('');
    } catch (err) {
      console.error('Erro ao salvar agendamento:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (s: ScheduledSearch) => {
    const res = await fetch('/api/scheduled', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, active: !s.active }),
    });
    if (res.ok) await load();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/scheduled?id=${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  };

  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-6 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <CalendarClock className="h-5 w-5 text-cyan-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">Prospecção Agendada</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Roda automaticamente todos os dias (07:00) e adiciona novos leads ao pipeline
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)} className="gap-1 shrink-0">
          <Plus className="h-4 w-4" />
          Agendar
        </Button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-5 space-y-4 rounded-xl border border-cyan-500/30 bg-slate-900/60 p-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label className="mb-2 block text-sm font-medium text-slate-300">Nome do agendamento</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Rodízio de clínicas em SP"
                className="h-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500"
              />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-medium text-slate-300">Nicho <span className="text-cyan-400">*</span></Label>
              <Input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Ex: Oficinas mecânicas"
                className="h-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500"
              />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-medium text-slate-300">Estado <span className="text-cyan-400">*</span></Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="h-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'CE', 'GO', 'DF', 'ES', 'AM', 'PA', 'MT', 'MS', 'RN', 'PB', 'AL', 'SE', 'PI', 'MA', 'TO', 'RO', 'AC', 'AP', 'RR'].map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="mb-2 block text-sm font-medium text-slate-300">Cidade (opcional)</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Deixe em branco para todo o estado"
                className="h-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 pt-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={onlyWithoutWebsite}
                onCheckedChange={setOnlyWithoutWebsite}
                className="data-[state=checked]:bg-cyan-500"
              />
              <span className="text-xs text-slate-400">Só sem site próprio</span>
            </div>
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-slate-500" />
              <Select value={frequency} onValueChange={(v) => setFrequency(v as 'daily' | 'weekly')}>
                <SelectTrigger className="h-9 w-[130px] bg-slate-900/50 border-slate-700">
                  <SelectValue placeholder="Frequência" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="text-slate-400">Cancelar</Button>
              <Button variant="success" size="sm" onClick={handleSave} disabled={saving || !niche.trim() || !state} className="gap-1">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <Clock className="h-4 w-4" />
                Agendar
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-500">
          Nenhuma prospecção agendada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {schedules.map((s) => {
              const next = s.next_run_at ? format(new Date(s.next_run_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : 'primeira execução em breve';
              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    'flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors',
                    s.active ? 'border-slate-700 bg-slate-800/50' : 'border-slate-800 bg-slate-900/30 opacity-60'
                  )}
                >
                  <div className={cn('h-2 w-2 rounded-full shrink-0', s.active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600')} />
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium text-white">{s.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.niche} • {s.state}{s.city ? ` • ${s.city}` : ''} • {s.frequency === 'weekly' ? 'semanal' : 'diária'}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {s.last_run_at
                        ? `Última: ${format(new Date(s.last_run_at), 'dd/MM HH:mm', { locale: ptBR })}`
                        : 'Nunca executou'}
                      {' • '}próxima: {next}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn('h-8 w-8', s.active ? 'text-emerald-400' : 'text-slate-500')}
                      onClick={() => handleToggle(s)}
                      title={s.active ? 'Pausar' : 'Ativar'}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-400" onClick={() => handleDelete(s.id)} title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}