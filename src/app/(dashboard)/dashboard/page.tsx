'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, RefreshCw, AlertCircle, CheckCircle, Building2, Users, MapPin,
  Phone, MessageSquare, Zap, Loader2, MoreVertical, Edit2, Trash2, Calendar,
  ChevronDown, Download, XCircle, Check, BarChart3, Target, TrendingUp,
  PhoneCall, MessageCircle, Briefcase, Eye, EyeOff, LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ProspectFilters } from '@/components/dashboard/ProspectFilters';
import { LeadCard } from '@/components/dashboard/LeadCard';
import { PitchModal } from '@/components/dashboard/PitchModal';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { googleMapsUrl } from '@/lib/google-maps';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

type LeadStatus = 'new' | 'contacted' | 'replied' | 'negotiating' | 'closed_won' | 'closed_lost' | 'discarded';

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
  status: LeadStatus;
  notes: string;
  latitude?: number | null;
  longitude?: number | null;
  gps_coordinates?: { latitude?: number | null; longitude?: number | null } | null;
  // Qualificação (Google/IA)
  qualified?: boolean;
  match_score?: number;
  verification?: 'google' | 'ai' | 'osm';
  google_rating?: number | null;
  google_reviews?: number | null;
  google_category?: string | null;
  google_title?: string | null;
  ai_reason?: string;
  model_used?: string;
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

type ViewMode = 'prospect' | 'pipeline' | 'analytics';

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

const statusConfig: Record<LeadStatus, { label: string; color: string; icon: React.ComponentType<any> }> = {
  new: { label: 'Novos', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: MessageSquare },
  contacted: { label: 'Contatados', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Phone },
  replied: { label: 'Responderam', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  negotiating: { label: 'Em Negociação', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Users },
  closed_won: { label: 'Fechados', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  closed_lost: { label: 'Perdidos', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  discarded: { label: 'Descartados', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: Trash2 },
};

const phoneTypeLabels: Record<string, string> = {
  owner_direct: 'WhatsApp do Sócio',
  commercial_whatsapp: 'WhatsApp Comercial',
  landline_reception: 'Telefone Fixo/Recepção',
};

// Mensagem de qualificação para quando a busca encontra leads brutos mas nenhum aprovado
function qualificationMsg(data: any): string {
  if (data.discardedCount > 0) {
    return `${data.totalFound} leads brutos encontrados, ${data.discardedCount} descartadas por falta de confirmação do nicho.`;
  }
  return 'Nenhum lead encontrado com esses critérios. Tente expandir a busca.';
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  // ── State ──────────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>('prospect');
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

  // Prospect state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showPitchModal, setShowPitchModal] = useState(false);

  // Pipeline state
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [pipelineTab, setPipelineTab] = useState<LeadStatus | 'all'>('all');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [deletingLead, setDeletingLead] = useState<string | null>(null);

  // Clear database state
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const supabase = createClient();

  // ── Load leads from Supabase on mount ──────────────────────────────────
  useEffect(() => {
    loadPipelineLeads();
  }, []);

  const loadPipelineLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('contacted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        setLeads(data);
      }
    } catch (err) {
      // Silently fail - leads will come from prospect search
    }
  };

  // ── Prospect: Search ───────────────────────────────────────────────────
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
    // Cada nova pesquisa limpa os leads das pesquisas anteriores
    setLeads([]);

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
        // Substitui completamente os leads (sem mesclar com pesquisas antigas)
        setLeads(data.leads.map((l: Lead) => ({
          ...l,
          status: 'new' as LeadStatus,
          notes: '',
        })));
        const phoneInfo = data.withPhoneCount > 0
          ? `${data.withPhoneCount} com telefone`
          : '';
        const qualiInfo = data.verification === 'google'
          ? ` · confirmadas no Google`
          : data.verification === 'ai'
            ? ` · qualificadas por IA`
            : '';
        const totalInfo = ` (${data.leads.length}/${data.totalFound} do OSM)`;
        setSuccess(`${data.leads.length} leads encontradas — ${phoneInfo}${qualiInfo}${totalInfo}! ${view === 'pipeline' ? 'Acesse a aba Pipeline para gerenciar.' : ''}`);
      } else {
        const total = data.totalFound || 0;
        if (total > 0) {
          setSuccess(`${qualificationMsg(data)} Nenhuma lead sobreviveu aos filtros.`);
        } else {
          setSuccess('Nenhum lead encontrado com esses critérios. Tente expandir a busca.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }, [view]);

  const handleRetrySearch = () => {
    if (searchParams) handleSearch(searchParams);
  };

  // ── Auth: Logout ──────────────────────────────────────────────────────
  const handleLogout = async () => {
    document.cookie = 'sb-mock-auth=; path=/; max-age=0';
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    window.location.href = '/login';
  };

  // ── Prospect: Contact ──────────────────────────────────────────────────
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

      setLeads(prev => prev.map(l =>
        l.place_id === placeId
          ? { ...l, status: 'contacted' as LeadStatus, contacted_at: new Date().toISOString() }
          : l
      ));
      setSuccess('Lead marcado como contatado!');
    } catch (err) {
      setError('Erro ao marcar como contatado.');
    }
  };

  // ── Prospect: Pitch Modal ──────────────────────────────────────────────
  const handleGeneratePitch = (lead: any) => {
    setSelectedLead(lead as Lead);
    setShowPitchModal(true);
  };

  // ── Pipeline: Status Change ────────────────────────────────────────────
  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', leadId);

    if (!error) {
      setLeads(prev => prev.map(l =>
        l.id === leadId ? { ...l, status: newStatus, updated_at: new Date().toISOString() } : l
      ));
    }
  };

  // ── Pipeline: Notes ────────────────────────────────────────────────────
  const handleNotesSave = async () => {
    if (!editingLead) return;

    const { error } = await supabase
      .from('leads')
      .update({ notes: editNotes, updated_at: new Date().toISOString() })
      .eq('id', editingLead.id);

    if (!error) {
      setLeads(prev => prev.map(l =>
        l.id === editingLead.id ? { ...l, notes: editNotes } : l
      ));
      setEditingLead(null);
      setEditNotes('');
    }
  };

  // ── Pipeline: Delete ───────────────────────────────────────────────────
  const handleDelete = async (leadId: string) => {
    setDeletingLead(leadId);
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (!error) {
      setLeads(prev => prev.filter(l => l.id !== leadId));
    }
    setDeletingLead(null);
  };

  // ── Database: Clear all leads (plano gratuito Supabase) ────────────────
  const handleClearDatabase = async () => {
    setIsClearing(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/leads/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao limpar banco');
      }

      setLeads([]);
      setShowClearDialog(false);
      setSuccess(`Banco limpo! ${data.deleted} leads removidos.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao limpar banco');
    } finally {
      setIsClearing(false);
    }
  };

  // ── Pipeline: Filtered Leads ───────────────────────────────────────────
  const filteredPipelineLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesTab = pipelineTab === 'all' || lead.status === pipelineTab;
      const q = pipelineSearch.toLowerCase();
      const matchesSearch = !pipelineSearch ||
        lead.company_name.toLowerCase().includes(q) ||
        lead.trade_name?.toLowerCase().includes(q) ||
        lead.decision_maker_name?.toLowerCase().includes(q) ||
        (lead.city || '').toLowerCase().includes(q) ||
        (lead.niche || '').toLowerCase().includes(q) ||
        (lead.phone_number || '').includes(pipelineSearch.replace(/\D/g, ''));
      return matchesTab && matchesSearch;
    });
  }, [leads, pipelineTab, pipelineSearch]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    Object.keys(statusConfig).forEach(status => {
      counts[status] = leads.filter(l => l.status === status).length;
    });
    return counts;
  }, [leads]);

  // ── Analytics Stats ────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const total = leads.length;
    // Contatados = leads que passaram do estágio "novo" (prospecção ativa de fato)
    // Exclui descartados (nunca foram contatados)
    const contacted = leads.filter(l => ['contacted', 'replied', 'negotiating', 'closed_won', 'closed_lost'].includes(l.status)).length;
    const replied = leads.filter(l => ['replied', 'negotiating', 'closed_won'].includes(l.status)).length;
    const negotiating = leads.filter(l => l.status === 'negotiating').length;
    const closedWon = leads.filter(l => l.status === 'closed_won').length;
    const closedLost = leads.filter(l => l.status === 'closed_lost').length;
    const discarded = leads.filter(l => l.status === 'discarded').length;
    const withDecisionMaker = leads.filter(l => l.decision_maker_name).length;
    const withCNPJ = leads.filter(l => l.cnpj).length;

    const conversionRate = contacted > 0 ? ((closedWon / contacted) * 100).toFixed(1) : '0';
    const responseRate = contacted > 0 ? ((replied / contacted) * 100).toFixed(1) : '0';

    return {
      total, contacted, replied, negotiating, closedWon, closedLost, discarded,
      withDecisionMaker, withCNPJ, conversionRate, responseRate
    };
  }, [leads]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const getDisplayName = (lead: Lead): string => {
    return lead.trade_name && lead.trade_name !== lead.company_name ? lead.trade_name : lead.company_name;
  };

  const formatPhone = (phone: string): string => {
    if (!phone) return 'Sem telefone';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('55')) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    if (digits.length === 12 && digits.startsWith('55')) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.length === 9) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return phone;
  };

  const openWhatsApp = async (phone: string, lead?: Lead | null) => {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits || digits.length < 8) return;
    // Gera pitch automaticamente e abre a conversa com mensagem pronta
    const { openWhatsAppWithPitch } = await import('@/lib/pitch-utils');
    await openWhatsAppWithPitch(phone, lead || {});
  };

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-8">
      {/* ── Global Header ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Dashboard B2B
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Prospecção automatizada + Pipeline de vendas em um só lugar
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view === 'prospect' && searchParams && (
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
              <Button variant="outline" size="sm" onClick={handleRetrySearch} disabled={isLoading} className="gap-1">
                <RefreshCw className="h-4 w-4" />
                Repetir Busca
              </Button>
            </motion.div>
          )}
          {view === 'pipeline' && (
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
              <Button variant="outline" size="sm" onClick={loadPipelineLeads} disabled={isLoading} className="gap-1">
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
            </motion.div>
          )}
          {leads.length > 0 && (
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearDialog(true)}
                className="gap-1 text-red-400/80 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/30"
                title="Limpar todos os leads (libera espaço no plano gratuito)"
              >
                <Trash2 className="h-4 w-4" />
                Limpar Banco
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ── View Tabs (Lateral) ─────────────────────────────────────────
          Sidebar with function navigation on the left, content on right */}
      <Tabs orientation="vertical" value={view} onValueChange={(v) => setView(v as ViewMode)} className="w-full">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left: Function sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="w-full lg:w-48 shrink-0"
        >
          <TabsList className="grid w-full gap-1.5 h-auto bg-slate-900/40 border border-slate-800 p-1.5 grid-cols-3 lg:grid-cols-1">
              <TabsTrigger
                value="prospect"
                className="justify-start gap-2 px-3 py-2.5 text-sm font-medium data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-200 data-[state=active]:border-cyan-500/20 border border-transparent rounded-lg transition-all duration-200"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="truncate">Prospecção</span>
                {leads.filter(l => l.status === 'new').length > 0 && (
                  <Badge variant="outline" className="ml-auto text-xs border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
                    {leads.filter(l => l.status === 'new').length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="pipeline"
                className="justify-start gap-2 px-3 py-2.5 text-sm font-medium data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-200 data-[state=active]:border-emerald-500/20 border border-transparent rounded-lg transition-all duration-200"
              >
                <Briefcase className="h-4 w-4 shrink-0" />
                <span className="truncate">Pipeline</span>
                {leads.length > 0 && (
                  <Badge variant="outline" className="ml-auto text-xs border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    {leads.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="justify-start gap-2 px-3 py-2.5 text-sm font-medium data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-200 data-[state=active]:border-violet-500/20 border border-transparent rounded-lg transition-all duration-200"
              >
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span className="truncate">Métricas</span>
              </TabsTrigger>
            </TabsList>

          {/* Logout */}
          <motion.button
            onClick={handleLogout}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="mt-3 w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sair da conta
            <span className="ml-auto text-xs text-slate-600">logout</span>
          </motion.button>
        </motion.aside>

        {/* Right: Content */}
        <div className="flex-1 min-w-0 w-full">

      {/* ── Global Stats Bar ───────────────────────────────────────────── */}
      {leads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <StatCard icon={Building2} value={analytics.total} label="Total Leads" color="cyan" />
          <StatCard icon={PhoneCall} value={analytics.contacted} label="Contatados" color="emerald" />
          <StatCard icon={MessageCircle} value={analytics.replied} label="Responderam" color="blue" />
          <StatCard icon={TrendingUp} value={`${analytics.conversionRate}%`} label="Conversão" color="violet" />
        </motion.div>
      )}

      {/* ── Error/Success Messages ─────────────────────────────────────── */}
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

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* VIEW: PROSPECTION                                              */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <TabsContent value="prospect" className="space-y-6 mt-0">
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <ProspectFilters onSearch={handleSearch} isLoading={isLoading} />
        </motion.div>

        {/* Loading */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-16"
          >
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <span className="ml-3 text-slate-300">Minerando leads no OpenStreetMap...</span>
          </motion.div>
        )}

        {/* Results */}
        {!isLoading && leads.filter(l => l.status === 'new').length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between mb-5">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-slate-500" />
                Leads Novos
              </CardTitle>
              <div className="flex items-center gap-2">
                {leads.filter(l => l.status === 'new' && l.phone_number?.replace(/\D/g, '').length >= 8).length > 0 && (
                  <Badge variant="outline" className="border-slate-700 text-emerald-300/80 bg-slate-800/50">
                    <Phone className="h-3 w-3 mr-1" />
                    {leads.filter(l => l.status === 'new' && l.phone_number?.replace(/\D/g, '').length >= 8).length} com telefone
                  </Badge>
                )}
                <Badge variant="outline" className="border-slate-700 text-slate-400">
                  {leads.filter(l => l.status === 'new').length} leads
                </Badge>
              </div>
            </div>
            <div className="space-y-5">
              {leads.filter(l => l.status === 'new').map((lead, index) => (
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
        )}

        {/* Empty State */}
        {!isLoading && searchParams && leads.filter(l => l.status === 'new').length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Search className="h-10 w-10 mx-auto text-slate-600 mb-5" />
            <h3 className="text-xl font-semibold text-white mb-3">Nenhum lead novo encontrado</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-6">
              Tente ajustar os filtros ou expanda a busca para todo o estado.
            </p>
            <Button variant="outline" onClick={() => setSearchParams(null)} className="gap-2">
              <Filter className="h-4 w-4" />
              Ajustar Filtros
            </Button>
          </motion.div>
        )}

        {/* Initial State */}
        {!searchParams && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Target className="h-10 w-10 mx-auto text-slate-600 mb-5" />
            <h3 className="text-xl font-semibold text-white mb-3">Comece sua prospecção</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Configure os filtros acima e clique em "Iniciar Prospecção" para minerar leads de empresas sem site no OpenStreetMap.
            </p>
          </motion.div>
        )}
      </TabsContent>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* VIEW: PIPELINE                                                 */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <TabsContent value="pipeline" className="space-y-6 mt-0">
        {/* Pipeline Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="relative max-w-md"
        >
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Buscar por empresa, decisor, cidade, nicho..."
            value={pipelineSearch}
            onChange={(e) => setPipelineSearch(e.target.value)}
            className="pl-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500"
          />
        </motion.div>

        {/* Pipeline Status Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Tabs value={pipelineTab} onValueChange={(v) => setPipelineTab(v as LeadStatus | 'all')} className="w-full">
            <div className="overflow-x-auto -mx-1 px-1 pb-1">
              <TabsList className="inline-flex w-max min-w-full justify-start lg:grid lg:w-full lg:grid-cols-8 bg-slate-900/50 border border-slate-700/50">
                {(['all', 'new', 'contacted', 'replied', 'negotiating', 'closed_won', 'closed_lost', 'discarded'] as const).map((tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="py-2 px-3 text-xs font-medium data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/30 whitespace-nowrap"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="capitalize">{tab === 'all' ? 'Todos' : statusConfig[tab as LeadStatus]?.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800/50">
                        {tabCounts[tab]}
                      </span>
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        </motion.div>

        {/* Pipeline Table */}
        <AnimatePresence mode="wait">
          {filteredPipelineLeads.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-800/50 border border-slate-700 mb-4">
                <Briefcase className="h-10 w-10 text-slate-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {pipelineTab === 'all' ? 'Nenhum lead no pipeline' : `Nenhum lead com status "${statusConfig[pipelineTab as LeadStatus]?.label || pipelineTab}"`}
              </h3>
              <p className="text-slate-400">
                {pipelineSearch ? 'Tente limpar a busca.' : 'Vá para Prospecção e encontre novos leads!'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="overflow-x-auto"
            >
              <Card className="border-slate-700/50 bg-slate-800/50">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700/50 bg-slate-900/50">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresa</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Decisor</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Local</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Telefone</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Nicho</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Notas</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {filteredPipelineLeads.map((lead, index) => {
                          const StatusIcon = statusConfig[lead.status]?.icon || MessageSquare;
                          return (
                            <motion.tr
                              key={lead.id || lead.place_id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.03 }}
                              className="hover:bg-slate-800/50 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-white">{getDisplayName(lead)}</p>
                                  {lead.trade_name && lead.trade_name !== lead.company_name && (
                                    <p className="text-xs text-slate-500">{lead.company_name}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                {lead.decision_maker_name ? (
                                  <div className="flex items-center gap-1 text-slate-300">
                                    <Users className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="font-medium">{lead.decision_maker_name}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500 italic text-sm">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                <a
                                  href={googleMapsUrl(lead)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir perfil no Google Maps"
                                  className="text-slate-300 text-sm hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
                                >
                                  <MapPin className="h-3.5 w-3.5 text-cyan-400/70" />
                                  <span>{lead.neighborhood ? `${lead.neighborhood}, ` : ''}{lead.city}/{lead.state}</span>
                                </a>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {lead.phone_number?.replace(/\D/g, '') ? (
                                    <button
                                      onClick={() => openWhatsApp(lead.phone_number, lead)}
                                      title="Abrir WhatsApp com mensagem pronta"
                                      className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-mono text-sm bg-transparent border-0 p-0 cursor-pointer"
                                    >
                                      <Phone className="h-4 w-4" />
                                      {formatPhone(lead.phone_number)}
                                    </button>
                                  ) : (
                                    <span className="text-slate-500 italic text-sm">Sem telefone</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-xs">
                                  {lead.niche}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 gap-1">
                                      <Badge variant="outline" className={`text-xs cursor-pointer ${statusConfig[lead.status]?.color || ''}`}>
                                        <StatusIcon className="h-3 w-3 mr-1" />
                                        {statusConfig[lead.status]?.label || lead.status}
                                      </Badge>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="bg-slate-900 border-slate-800">
                                    <DropdownMenuLabel>Mudar Status</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {Object.entries(statusConfig).map(([key, config]) => {
                                      const Icon = config.icon;
                                      return (
                                        <DropdownMenuItem
                                          key={key}
                                          onClick={() => handleStatusChange(lead.id, key as LeadStatus)}
                                          disabled={lead.status === key}
                                          className="flex items-center gap-2"
                                        >
                                          <Icon className="h-4 w-4" />
                                          {config.label}
                                        </DropdownMenuItem>
                                      );
                                    })}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                              <td className="px-4 py-3 max-w-xs hidden md:table-cell">
                                {editingLead?.id === lead.id ? (
                                  <div className="flex gap-2">
                                    <Textarea
                                      value={editNotes}
                                      onChange={(e) => setEditNotes(e.target.value)}
                                      className="min-h-[60px] text-sm bg-slate-900 border-slate-600 focus:border-cyan-500"
                                      rows={2}
                                      placeholder="Notas..."
                                    />
                                    <div className="flex flex-col gap-1">
                                      <Button size="sm" variant="ghost" onClick={handleNotesSave} className="h-8 px-2">
                                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setEditingLead(null)} className="h-8 px-2">
                                        <XCircle className="h-3.5 w-3.5 text-slate-400" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : lead.notes ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-300 line-clamp-1 flex-1">{lead.notes}</span>
                                    <Button size="sm" variant="ghost" onClick={() => { setEditingLead(lead); setEditNotes(lead.notes || ''); }} className="h-8 px-2">
                                      <Edit2 className="h-3.5 w-3.5 text-slate-400 hover:text-white" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => { setEditingLead(lead); setEditNotes(''); }}
                                    className="h-8 px-2 text-slate-500 hover:text-slate-300"
                                  >
                                    <span className="text-xs">Adicionar nota</span>
                                    <Edit2 className="h-3.5 w-3.5 ml-1" />
                                  </Button>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800/50">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800">
                                    <DropdownMenuLabel className="font-medium">Ações</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {lead.phone_number?.replace(/\D/g, '') && (
                                      <DropdownMenuItem onClick={() => openWhatsApp(lead.phone_number, lead)} className="flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        Abrir WhatsApp
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => handleGeneratePitch(lead)}
                                      className="flex items-center gap-2"
                                    >
                                      <Zap className="h-4 w-4" />
                                      Gerar Pitch IA
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleStatusChange(lead.id, 'discarded')}
                                      disabled={lead.status === 'discarded'}
                                      className="flex items-center gap-2 text-red-400"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Descartar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </TabsContent>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* VIEW: ANALYTICS                                                */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <TabsContent value="analytics" className="space-y-6 mt-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {leads.length === 0 ? (
            <div className="text-center py-20">
              <BarChart3 className="h-10 w-10 mx-auto text-slate-600 mb-5" />
              <h3 className="text-xl font-semibold text-white mb-3">Sem dados ainda</h3>
              <p className="text-slate-500">Comece prospectando leads para ver suas métricas aqui.</p>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Funil */}
              <Card className="border-slate-800 bg-slate-900/40 md:col-span-2 lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                    <BarChart3 className="h-5 w-5 text-slate-500" />
                    Funil de Vendas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    {[
                      { label: 'Total de Leads', value: analytics.total, color: 'bg-slate-500', pct: 100 },
                      { label: 'Contatados', value: analytics.contacted, color: 'bg-cyan-500', pct: analytics.total > 0 ? (analytics.contacted / analytics.total) * 100 : 0 },
                      { label: 'Responderam', value: analytics.replied, color: 'bg-emerald-500', pct: analytics.total > 0 ? (analytics.replied / analytics.total) * 100 : 0 },
                      { label: 'Em Negociação', value: analytics.negotiating, color: 'bg-amber-500', pct: analytics.total > 0 ? (analytics.negotiating / analytics.total) * 100 : 0 },
                      { label: 'Fechados (Ganhos)', value: analytics.closedWon, color: 'bg-emerald-600', pct: analytics.total > 0 ? (analytics.closedWon / analytics.total) * 100 : 0 },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">{item.label}</span>
                          <span className="font-medium text-white">{item.value}</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.pct}%` }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            className={`h-full ${item.color} rounded-full`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* KPI Cards */}
              <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <TrendingUp className="h-5 w-5 text-emerald-400/70" />
                    <p className="text-sm text-slate-500">Conversão</p>
                  </div>
                  <p className="text-3xl font-semibold text-white tabular-nums">{analytics.conversionRate}%</p>
                </div>
              </motion.div>

              <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <MessageCircle className="h-5 w-5 text-cyan-400/70" />
                    <p className="text-sm text-slate-500">Resposta</p>
                  </div>
                  <p className="text-3xl font-semibold text-white tabular-nums">{analytics.responseRate}%</p>
                </div>
              </motion.div>

              <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Target className="h-5 w-5 text-violet-400/70" />
                    <p className="text-sm text-slate-500">Decisores</p>
                  </div>
                  <p className="text-3xl font-semibold text-white tabular-nums">{analytics.withDecisionMaker}</p>
                </div>
              </motion.div>
          </div>

          {/* Gráficos de evolução + meta mensal (#6) */}
          <AnalyticsCharts leads={leads} />
            </>
          )}
        </motion.div>
      </TabsContent>
        </div>{/* End Right: Content */}
      </div>{/* End flex layout */}
      </Tabs>

      {/* ── Pitch Modal ────────────────────────────────────────────────── */}
      <PitchModal
        isOpen={showPitchModal}
        onClose={() => {
          setShowPitchModal(false);
          setSelectedLead(null);
        }}
        lead={selectedLead}
      />

      {/* ── Clear Database Dialog ──────────────────────────────────────── */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 border border-red-500/30">
                <Trash2 className="h-4 w-4 text-red-400" />
              </span>
              Limpar Banco de Dados
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400 pt-2">
              Isso vai excluir <span className="font-medium text-white">{leads.length} leads</span> permanentemente
              do seu banco Supabase. Esta ação <span className="text-red-400 font-medium">não pode ser desfeita</span>.
              <br /><br />
              Útil no plano gratuito para liberar espaço de linhas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setShowClearDialog(false)} disabled={isClearing}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearDatabase}
              disabled={isClearing}
              className="gap-1.5"
            >
              {isClearing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Limpando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Sim, limpar tudo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function StatCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: React.ComponentType<any>;
  value: number | string;
  label: string;
  color: 'cyan' | 'emerald' | 'blue' | 'violet';
}) {
  const textColors = {
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    violet: 'text-violet-400',
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="group rounded-xl bg-slate-900/40 border border-slate-800 p-5 transition-colors duration-300 hover:border-slate-700">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-3xl font-semibold text-white tabular-nums leading-none">{value}</p>
            <p className="mt-2 text-sm text-slate-500">{label}</p>
          </div>
          <Icon className={`h-5 w-5 ${textColors[color]} opacity-80`} />
        </div>
      </div>
    </motion.div>
  );
}
