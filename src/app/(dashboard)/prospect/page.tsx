'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Search, Filter, Trash2, Download, RefreshCw, AlertCircle, CheckCircle, Building2, Users, MapPin, Phone, MessageSquare, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ProspectFilters } from '@/components/dashboard/ProspectFilters';
import { LeadCard } from '@/components/dashboard/LeadCard';
import { PitchModal } from '@/components/dashboard/PitchModal';
import { createClient } from '@/lib/supabase/client';

interface Lead {
  id: string;
  place_id: string;
  company_name: string;
  trade_name?: string;
  cnpj?: string;
  phone_number: string;
  phone_type: 'owner_direct' | 'commercial_whatsapp' | 'landline_reception';
  decision_maker_name?: string;
  has_website: boolean;
  address?: string;
  neighborhood?: string;
  city: string;
  state: string;
  niche: string;
  status: string;
}

export default function ProspectPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchParams, setSearchParams] = useState<{
    niche: string;
    state: string;
    city: string;
    onlyWithoutWebsite: boolean;
  } | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showPitchModal, setShowPitchModal] = useState(false);

  const supabase = createClient();

  const handleSearch = useCallback(async (filters: {
    niche: string;
    state: string;
    city: string;
    onlyWithoutWebsite: boolean;
  }) => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    setSearchParams(filters);

    try {
      const response = await fetch('/api/prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar leads');
      }

      if (data.leads && data.leads.length > 0) {
        setLeads(data.leads);
        setSuccess(`${data.leads.length} leads encontrados e salvos!`);
      } else {
        setLeads([]);
        setSuccess('Nenhum lead encontrado com esses critérios. Tente expandir a busca.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleContact = async (placeId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          status: 'contacted', 
          contacted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('place_id', placeId);

      if (error) throw error;

      // Optimistic UI update - remove from list
      setLeads(prev => prev.filter(lead => lead.place_id !== placeId));
      setSuccess('Lead marcado como contatado e removido da lista!');
    } catch (err) {
      setError('Erro ao marcar como contatado. Tente novamente.');
    }
  };

  const handleGeneratePitch = (lead: Lead) => {
    setSelectedLead(lead);
    setShowPitchModal(true);
  };

  const handleRetrySearch = () => {
    if (searchParams) {
      handleSearch(searchParams);
    }
  };

  const stats = {
    total: leads.length,
    withDecisionMaker: leads.filter(l => l.decision_maker_name).length,
    withCNPJ: leads.filter(l => l.cnpj).length,
    phoneTypes: {
      owner_direct: leads.filter(l => l.phone_type === 'owner_direct').length,
      commercial_whatsapp: leads.filter(l => l.phone_type === 'commercial_whatsapp').length,
      landline_reception: leads.filter(l => l.phone_type === 'landline_reception').length,
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-[11px] font-medium uppercase tracking-widest text-emerald-400/80">Prospecção ativa</p>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
            Nova Prospecção
          </h1>
          <p className="mt-1 text-slate-400">
            Mine leads qualificados de empresas sem site próprio no Brasil
          </p>
        </div>
        <div className="flex items-center gap-2">
          {searchParams && (
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
              <Button variant="outline" size="sm" onClick={handleRetrySearch} disabled={isLoading} className="gap-1">
                <RefreshCw className="h-4 w-4" />
                Repetir Busca
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Stats Cards */}
      {leads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <StatCard
            icon={Building2}
            value={stats.total}
            label="Total de Leads"
            color="cyan"
          />
          <StatCard
            icon={Users}
            value={stats.withDecisionMaker}
            label="Com Decisor Identificado"
            color="emerald"
          />
          <StatCard
            icon={Phone}
            value={stats.phoneTypes.owner_direct}
            label="WhatsApp Direto do Sócio"
            color="emerald"
          />
          <StatCard
            icon={MessageSquare}
            value={stats.phoneTypes.commercial_whatsapp}
            label="WhatsApp Comercial"
            color="blue"
          />
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <ProspectFilters onSearch={handleSearch} isLoading={isLoading} />
      </motion.div>

      {/* Error/Success Messages */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30"
          >
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <p className="text-red-300">{error}</p>
          </motion.div>
        )}
        {success && !error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30"
          >
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="text-emerald-300">{success}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence mode="wait">
        {leads.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-cyan-400" />
                Resultados da Busca
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-slate-600 text-slate-400">
                  {leads.length} leads
                </Badge>
              </div>
            </div>
            <div className="space-y-4">
              {leads.map((lead, index) => (
                <LeadCard
                  key={lead.place_id}
                  lead={lead}
                  onContact={handleContact}
                  onGeneratePitch={handleGeneratePitch}
                  index={index}
                />
              ))}
            </div>
          </motion.div>
        ) : !isLoading && searchParams ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-800/50 border border-slate-700 mb-6">
              <Search className="h-10 w-10 text-slate-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Nenhum lead encontrado</h3>
            <p className="text-slate-400 max-w-md mx-auto mb-6">
              Tente ajustar os filtros: expanda a busca para todo o estado, remova o filtro de "sem site" ou tente outro nicho.
            </p>
            <Button variant="outline" onClick={() => setSearchParams(null)} className="gap-2">
              <Filter className="h-4 w-4" />
              Ajustar Filtros
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Pitch Modal */}
      <PitchModal
        isOpen={showPitchModal}
        onClose={() => {
          setShowPitchModal(false);
          setSelectedLead(null);
        }}
        lead={selectedLead}
      />
    </div>
  );
}

function StatCard({ icon: Icon, value, label, color }: { icon: React.ComponentType<any>; value: number; label: string; color: 'cyan' | 'emerald' | 'blue' }) {
  const colors = {
    cyan: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
    emerald: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
    blue: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
  };

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className={`${colors[color]} border glass-card overflow-hidden group`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
              <p className="text-sm text-slate-400 mt-1">{label}</p>
            </div>
            <motion.div
              whileHover={{ rotate: 8, scale: 1.08 }}
              className={`p-3 rounded-xl ${colors[color].replace('text-', 'bg-')}`}
            >
              <Icon className="h-6 w-6 text-white" />
            </motion.div>
          </div>
          <div className={`absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r ${color === 'cyan' ? 'from-cyan-400' : color === 'emerald' ? 'from-emerald-400' : 'from-blue-400'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
        </CardContent>
      </Card>
    </motion.div>
  );
}