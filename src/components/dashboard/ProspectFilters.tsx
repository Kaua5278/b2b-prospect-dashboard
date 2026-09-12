'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Search, Filter, X, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getStates, getCitiesByState, SimpleState, SimpleCity } from '@/lib/ibge';

interface ProspectFiltersProps {
  onSearch: (filters: {
    niche: string;
    state: string;
    city: string;
    onlyWithoutWebsite: boolean;
  }) => void;
  isLoading: boolean;
}

export function ProspectFilters({ onSearch, isLoading }: ProspectFiltersProps) {
  const [niche, setNiche] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(true);
  const [states, setStates] = useState<SimpleState[]>([]);
  const [cities, setCities] = useState<SimpleCity[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    loadStates();
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
    if (state) {
      loadCities(state);
    }
  }, [state]);

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
  };

  const hasFilters = niche || state || city || !onlyWithoutWebsite;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className="hover-lift"
    >
      <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm shadow-lg shadow-black/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <motion.span
                whileHover={{ rotate: 10 }}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-500/30"
              >
                <Building2 className="h-4 w-4 text-cyan-400" />
              </motion.span>
              Filtros de Prospecção
            </CardTitle>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* State + City (2 colunas em telas médias+) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* State Select */}
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

              {/* City Select */}
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
                <p className="mt-1 text-xs text-slate-500">Opcional: deixe em branco para buscar em todo o estado</p>
              </div>
            </div>

            <Separator className="border-slate-700/50" />

            {/* Website Filter + Submit (mesma linha no desktop) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <Filter className="h-5 w-5 text-slate-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-300">Apenas sem site próprio</p>
                  <p className="text-xs text-slate-500">Exclui empresas com website próprio (mantém redes sociais)</p>
                </div>
                <Switch
                  id="onlyWithoutWebsite"
                  checked={onlyWithoutWebsite}
                  onCheckedChange={setOnlyWithoutWebsite}
                  className="data-[state=checked]:bg-cyan-500 shrink-0"
                />
              </div>

              {/* Submit Button */}
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
        </CardContent>
      </Card>
    </motion.div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}