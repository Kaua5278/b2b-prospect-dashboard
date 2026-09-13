'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Search, X, Bookmark, BookmarkCheck, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getStates, getCitiesByState, SimpleState, SimpleCity } from '@/lib/ibge';
import { getSavedFilters, saveFilter, removeSavedFilter, SavedFilter } from '@/lib/settings';

export interface ProspectFiltersState {
  niche: string;
  state: string;
  city: string;
  onlyWithoutWebsite: boolean;
}

interface ProspectFiltersProps {
  onSearch: (filters: ProspectFiltersState) => void;
  isLoading: boolean;
  /** Chamado sempre que os filtros mudam (p/ o pai poder ler) */
  onFiltersChange?: (filters: ProspectFiltersState) => void;
}

export function ProspectFilters({ onSearch, isLoading, onFiltersChange }: ProspectFiltersProps) {
  const [niche, setNiche] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(true);
  const [states, setStates] = useState<SimpleState[]>([]);
  const [cities, setCities] = useState<SimpleCity[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [appliedSavedId, setAppliedSavedId] = useState<string | null>(null);

  useEffect(() => {
    loadStates();
    setSavedFilters(getSavedFilters());
  }, []);

  const loadStates = async () => {
    setLoadingStates(true);
    const data = await getStates();
    setStates(data);
    setLoadingStates(false);
  };

  const loadCities = async (uf: string) => {
    setLoadingCities(true);
    setCities([]);
    setCity('');
    const data = await getCitiesByState(uf);
    setCities(data);
    setLoadingCities(false);
  };

  useEffect(() => {
    if (state) loadCities(state);
  }, [state]);

  // Notifica o pai a cada mudança (para poder aplicar filtros salvos externamente)
  useEffect(() => {
    onFiltersChange?.({ niche, state, city, onlyWithoutWebsite });
  }, [niche, state, city, onlyWithoutWebsite, onFiltersChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !state) return;
    onSearch({ niche: niche.trim(), state, city, onlyWithoutWebsite });
  };

  const handleReset = () => {
    setNiche('');
    setState('');
    setCity('');
    setOnlyWithoutWebsite(true);
    setAppliedSavedId(null);
  };

  const applySaved = (f: SavedFilter) => {
    setNiche(f.niche);
    setState(f.state);
    setCity(f.city);
    setOnlyWithoutWebsite(f.onlyWithoutWebsite);
    setAppliedSavedId(f.id);
    onSearch({
      niche: f.niche,
      state: f.state,
      city: f.city,
      onlyWithoutWebsite: f.onlyWithoutWebsite,
    });
  };

  const handleSaveCurrent = useCallback(() => {
    const name = saveName.trim() || `${niche} • ${state}`;
    const found = savedFilters.find((f) => f.id === appliedSavedId);
    const next = saveFilter({
      name: found?.name || name,
      niche: niche.trim(),
      state,
      city,
      onlyWithoutWebsite,
    });
    setSavedFilters(next);
    setSaveName('');
    setShowSave(false);
    setAppliedSavedId(next[0]?.id ?? null);
  }, [saveName, niche, state, city, onlyWithoutWebsite, savedFilters, appliedSavedId]);

  const handleDeleteSaved = (id: string) => {
    setSavedFilters(removeSavedFilter(id));
    if (appliedSavedId === id) setAppliedSavedId(null);
  };

  const hasFilters = !!niche || !!state || !!city || !onlyWithoutWebsite;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className="hover-lift"
    >
      <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-6 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
          <h3 className="text-lg font-semibold text-white">
            Filtros de Prospecção
          </h3>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowSave(v => !v); setSaveName(''); }}
                  className="text-slate-400 hover:text-cyan-300"
                  title="Salvar filtros atuais"
                >
                  {showSave ? <X className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-400 hover:text-white">
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filtros salvos */}
        {savedFilters.length > 0 && (
          <div className="mb-6">
            <Label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
              Filtros salvos
            </Label>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence>
                {savedFilters.map((f) => (
                  <motion.div
                    key={f.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={cn(
                      'group inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors',
                      appliedSavedId === f.id
                        ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                    )}
                  >
                    <button onClick={() => applySaved(f)} className="flex items-center gap-1.5">
                      {appliedSavedId === f.id
                        ? <BookmarkCheck className="h-3 w-3 text-cyan-400" />
                        : <Bookmark className="h-3 w-3" />}
                      <span className="max-w-[140px] truncate">{f.name}</span>
                      <span className="text-slate-500 uppercase">{f.state}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(f.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
                      title="Excluir filtro salvo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {showSave && (
          <div className="mb-5 flex gap-2">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Nome do filtro (ex: Clínicas SP capital)"
              className="h-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500"
              autoFocus
            />
            <Button size="sm" variant="success" onClick={handleSaveCurrent} className="h-10 shrink-0">
              <BookmarkCheck className="h-4 w-4 mr-1" /> Guardar
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Niche Input */}
          <div>
            <Label htmlFor="niche" className="mb-2 block text-sm font-medium text-slate-300">
              Nicho de Mercado <span className="text-cyan-400">*</span>
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="niche"
                placeholder="Ex: Oficinas Mecânicas, Clínicas de Estética, Restaurantes..."
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="pl-10 h-11 bg-slate-900/50 border-slate-700 focus:border-cyan-500 transition-all"
                required
              />
            </div>
          </div>

          {/* State + City */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="state" className="mb-2 block text-sm font-medium text-slate-300">
                Estado <span className="text-cyan-400">*</span>
              </Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="h-11 bg-slate-900/50 border-slate-700 focus:border-cyan-500 transition-all" disabled={loadingStates}>
                  <SelectValue placeholder={loadingStates ? 'Carregando estados...' : 'Selecione um estado'} />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {states.map((s) => (
                    <SelectItem key={s.sigla} value={s.sigla}>
                      {s.nome} ({s.sigla})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="city" className="mb-2 block text-sm font-medium text-slate-300">
                Cidade
              </Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="h-11 bg-slate-900/50 border-slate-700 focus:border-cyan-500 transition-all" disabled={loadingCities || !state}>
                  <SelectValue placeholder={loadingCities ? 'Carregando cidades...' : state ? 'Selecione uma cidade (opcional)' : 'Primeiro selecione um estado'} />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                  {cities.map((c) => (
                    <SelectItem key={c.id} value={c.nome}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-slate-500">Opcional: deixe em branco para buscar em todo o estado</p>
            </div>
          </div>

          <Separator className="border-slate-800" />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-medium text-slate-300">Apenas sem site próprio</p>
                <p className="text-xs text-slate-500 mt-0.5">Exclui empresas com website próprio (mantém redes sociais)</p>
              </div>
              <Switch
                id="onlyWithoutWebsite"
                checked={onlyWithoutWebsite}
                onCheckedChange={setOnlyWithoutWebsite}
                className="data-[state=checked]:bg-cyan-500 shrink-0"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading || !niche.trim() || !state}
              className={cn(
                'btn-shine sm:w-auto w-full py-3 px-8 rounded-xl font-medium text-base transition-all shrink-0',
                'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-lg shadow-cyan-500/25',
                'hover:from-cyan-600 hover:to-emerald-600 hover:shadow-cyan-500/40',
                'focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-900',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Buscando leads...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Search className="h-5 w-5" />
                  Iniciar Prospecção
                </span>
              )}
            </motion.button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}