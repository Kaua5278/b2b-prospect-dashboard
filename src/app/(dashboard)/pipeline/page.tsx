'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, MoreVertical, Edit2, Trash2, MessageSquare, Phone, User, MapPin, Calendar, ChevronDown, ChevronUp, Download, RefreshCw, Loader2, CheckCircle, Users, XCircle, Check } from 'lucide-react';
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
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<LeadStatus, { label: string; color: string; icon: React.ComponentType<any> }> = {
  new: { label: 'Novos', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: MessageSquare },
  contacted: { label: 'Contatados', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Phone },
  replied: { label: 'Responderam', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  negotiating: { label: 'Em Negociação', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Users },
  closed_won: { label: 'Fechados', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  closed_lost: { label: 'Perdidos', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  discarded: { label: 'Descartados', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: Trash2 },
};

const phoneTypeLabels = {
  owner_direct: 'WhatsApp do Sócio',
  commercial_whatsapp: 'WhatsApp Comercial',
  landline_reception: 'Telefone Fixo/Recepção',
};

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<LeadStatus | 'all'>('all');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [deletingLead, setDeletingLead] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('contacted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error('Error loading leads:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesTab = activeTab === 'all' || lead.status === activeTab;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        lead.company_name.toLowerCase().includes(q) ||
        lead.trade_name?.toLowerCase().includes(q) ||
        lead.decision_maker_name?.toLowerCase().includes(q) ||
        (lead.city || '').toLowerCase().includes(q) ||
        (lead.niche || '').toLowerCase().includes(q) ||
        (lead.phone_number || '').includes(searchQuery.replace(/\D/g, ''));
      return matchesTab && matchesSearch;
    });
  }, [leads, activeTab, searchQuery]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    Object.keys(statusConfig).forEach(status => {
      counts[status] = leads.filter(l => l.status === status).length;
    });
    return counts;
  }, [leads]);

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    const { error } = await supabase
      .from('leads')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId);

    if (!error) {
      setLeads(prev => prev.map(l => 
        l.id === leadId ? { ...l, status: newStatus, updated_at: new Date().toISOString() } : l
      ));
    }
  };

  const handleNotesSave = async () => {
    if (!editingLead) return;
    
    const { error } = await supabase
      .from('leads')
      .update({ 
        notes: editNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingLead.id);

    if (!error) {
      setLeads(prev => prev.map(l => 
        l.id === editingLead.id ? { ...l, notes: editNotes } : l
      ));
      setEditingLead(null);
      setEditNotes('');
    }
  };

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

  const openWhatsApp = async (phone: string, lead?: Lead | null) => {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits || digits.length < 8) return;
    // Gera pitch automaticamente e abre a conversa com mensagem pronta
    const { openWhatsAppWithPitch } = await import('@/lib/pitch-utils');
    await openWhatsAppWithPitch(phone, lead || {});
  };

  const getDisplayName = (lead: Lead): string => {
    return lead.trade_name && lead.trade_name !== lead.company_name
      ? lead.trade_name
      : lead.company_name;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Pipeline de Vendas
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Gerencie seus leads contatados e acompanhe o funil de vendas
          </p>
        </div>
        <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
          <Button variant="outline" onClick={loadLeads} disabled={isLoading} className="gap-1">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </motion.div>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative max-w-md"
      >
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Buscar por empresa, decisor, cidade, nicho, telefone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500"
        />
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LeadStatus | 'all')} className="w-full">
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
            <TabsList className="inline-flex w-max min-w-full justify-start lg:grid lg:w-full lg:grid-cols-8 bg-slate-900/50 border border-slate-700/50">
              {(['all', 'contacted', 'replied', 'negotiating', 'closed_won', 'closed_lost', 'discarded', 'new'] as const).map((tab) => (
                <TabsTrigger 
                  key={tab} 
                  value={tab} 
                  className="py-2 px-3 text-xs font-medium data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/30 whitespace-nowrap"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="capitalize">{tab === 'all' ? 'Todos' : statusConfig[tab as LeadStatus].label}</span>
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

      {/* Leads Table */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-16"
          >
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </motion.div>
        ) : filteredLeads.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Search className="h-10 w-10 mx-auto text-slate-600 mb-5" />
            <h3 className="text-xl font-semibold text-white mb-3">
              {activeTab === 'all' ? 'Nenhum lead encontrado' : `Nenhum lead com status "${statusConfig[activeTab as LeadStatus]?.label || activeTab}"`}
            </h3>
            <p className="text-slate-500">
              {searchQuery ? 'Tente limpar a busca ou alterar o filtro de status.' : 'Inicie uma prospecção na aba "Prospecção" para preencher seu pipeline.'}
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
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-slate-700/50 bg-slate-900/50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresa</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Decisor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Localização</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Telefone</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Nicho</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Contato</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Notas</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {filteredLeads.map((lead, index) => {
                        const StatusIcon = statusConfig[lead.status].icon;
                        return (
                          <motion.tr
                            key={lead.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.03 }}
                            className="hover:bg-slate-800/50 transition-colors"
                          >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div>
                              <p className="font-medium text-white">{getDisplayName(lead)}</p>
                              {lead.trade_name && lead.trade_name !== lead.company_name && (
                                <p className="text-xs text-slate-500">{lead.company_name}</p>
                              )}
                              {lead.cnpj && (
                                <p className="text-xs text-slate-500 font-mono">
                                  CNPJ: {lead.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                            {lead.decision_maker_name ? (
                              <div className="flex items-center gap-1 text-slate-300">
                                <User className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                <span className="font-medium">{lead.decision_maker_name}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Não identificado</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">
                            <div className="text-slate-300">
                              <p>{lead.neighborhood ? `${lead.neighborhood}, ` : ''}{lead.city}/{lead.state}</p>
                              {lead.address && <p className="text-xs text-slate-500 truncate max-w-[200px]">{lead.address}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openWhatsApp(lead.phone_number, lead)}
                                title="Abrir WhatsApp com mensagem pronta"
                                className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-mono text-sm bg-transparent border-0 p-0 cursor-pointer"
                              >
                                <Phone className="h-4 w-4 shrink-0" />
                                {formatPhone(lead.phone_number)}
                              </button>
                              <Badge 
                                variant="outline" 
                                className={`text-xs hidden xl:inline-flex ${getPhoneTypeBadgeColor(lead.phone_type)}`}
                              >
                                {phoneTypeLabels[lead.phone_type]}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                            <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
                              {lead.niche}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge 
                              variant="outline" 
                              className={statusConfig[lead.status].color}
                            >
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig[lead.status].label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {lead.contacted_at ? (
                              <span className="text-sm text-slate-300">
                                {format(new Date(lead.contacted_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500">
                                {format(new Date(lead.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-xs whitespace-nowrap hidden lg:table-cell">
                            {editingLead?.id === lead.id ? (
                              <div className="flex gap-2">
                                <Textarea
                                  value={editNotes}
                                  onChange={(e) => setEditNotes(e.target.value)}
                                  className="min-h-[60px] text-sm bg-slate-900 border-slate-600 focus:border-cyan-500"
                                  rows={2}
                                  placeholder="Adicionar notas..."
                                />
                                <div className="flex flex-col gap-1">
                                  <Button size="sm" variant="success" onClick={handleNotesSave} className="h-8 px-2">
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingLead(null)} className="h-8 px-2">
                                    <ChevronDown className="h-3.5 w-3.5" />
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
                                <DropdownMenuItem 
                                  onClick={() => openWhatsApp(lead.phone_number, lead)}
                                  className="flex items-center gap-2"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                  Abrir WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleStatusChange(lead.id, 'contacted')}
                                  disabled={lead.status === 'contacted'}
                                  className="flex items-center gap-2"
                                >
                                  <Phone className="h-4 w-4" />
                                  Marcar como Contatado
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleStatusChange(lead.id, 'replied')}
                                  disabled={lead.status === 'replied'}
                                  className="flex items-center gap-2"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Marcar como Respondeu
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleStatusChange(lead.id, 'negotiating')}
                                  disabled={lead.status === 'negotiating'}
                                  className="flex items-center gap-2"
                                >
                                  <Users className="h-4 w-4" />
                                  Em Negociação
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleStatusChange(lead.id, 'closed_won')}
                                  disabled={lead.status === 'closed_won'}
                                  className="flex items-center gap-2"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Marcar como Fechado
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
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(lead.id)}
                                  disabled={deletingLead === lead.id}
                                  className="flex items-center gap-2 text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir Permanentemente
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </motion.tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return phone || 'Sem telefone';
}

function getPhoneTypeBadgeColor(type: string): string {
  switch (type) {
    case 'owner_direct': return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
    case 'commercial_whatsapp': return 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10';
    case 'landline_reception': return 'border-slate-500/30 text-slate-400 bg-slate-500/10';
    default: return 'border-slate-500/30 text-slate-400 bg-slate-500/10';
  }
}