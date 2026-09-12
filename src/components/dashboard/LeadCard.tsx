'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MessageSquare, User, MapPin, Building2, CheckCircle, XCircle, Loader2, ExternalLink, Map, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { googleMapsUrl } from '@/lib/google-maps';
import { useState } from 'react';
import { openWhatsAppWithPitch } from '@/lib/pitch-utils';

interface LeadCardProps {
  lead: {
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
    notes?: string;
    latitude?: number | null;
    longitude?: number | null;
    gps_coordinates?: { latitude?: number | null; longitude?: number | null } | null;
    qualified?: boolean;
    match_score?: number;
    verification?: 'google' | 'ai' | 'osm';
    google_rating?: number | null;
    google_reviews?: number | null;
    google_category?: string | null;
    google_title?: string | null;
    ai_reason?: string;
    model_used?: string;
    contacted_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  onContact: (placeId: string) => Promise<void>;
  onGeneratePitch: (lead: LeadCardProps['lead']) => void;
  index: number;
}

const phoneTypeLabels = {
  owner_direct: { label: 'WhatsApp do Sócio', color: 'success', icon: User },
  commercial_whatsapp: { label: 'WhatsApp Comercial', color: 'info', icon: MessageSquare },
  landline_reception: { label: 'Telefone Fixo/Recepção', color: 'secondary', icon: Phone },
};

const phoneTypeIcons = {
  owner_direct: User,
  commercial_whatsapp: MessageSquare,
  landline_reception: Phone,
};

export function LeadCard({ lead, onContact, onGeneratePitch, index }: LeadCardProps) {
  const [isContacting, setIsContacting] = useState(false);
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [isOpeningWhatsApp, setIsOpeningWhatsApp] = useState(false);

  const phoneTypeInfo = phoneTypeLabels[lead.phone_type] || phoneTypeLabels['landline_reception'];
  const PhoneIcon = phoneTypeIcons[lead.phone_type] || Phone;

  const phone = lead.phone_number?.replace(/\D/g, '') || '';
  const hasPhone = phone.length >= 8;
  const mapsUrl = googleMapsUrl(lead);

  const handleContact = async () => {
    setIsContacting(true);
    try {
      await onContact(lead.place_id);
    } finally {
      setIsContacting(false);
    }
  };

  const handleGeneratePitch = () => {
    setIsGeneratingPitch(true);
    onGeneratePitch(lead);
    setTimeout(() => setIsGeneratingPitch(false), 1000);
  };

  const handleOpenWhatsApp = async () => {
    if (!hasPhone) return;
    setIsOpeningWhatsApp(true);
    try {
      // Gera o pitch automaticamente e abre a conversa com a mensagem pronta
      await openWhatsAppWithPitch(lead.phone_number, lead);
    } finally {
      setIsOpeningWhatsApp(false);
    }
  };

  const displayName = lead.trade_name && lead.trade_name !== lead.company_name 
    ? lead.trade_name 
    : lead.company_name;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={lead.place_id}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: -300, scale: 0.9, transition: { duration: 0.3, ease: 'easeInOut' } }}
        transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="group overflow-hidden border-slate-700/50 bg-slate-800/50 backdrop-blur-sm transition-all hover:border-cyan-500/30 hover:shadow-[0_0_30px_rgba(6,182,212,0.1)]">
          <CardContent className="p-5">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              {/* Company Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30"
                  >
                    <Building2 className="h-5 w-5 text-cyan-400" />
                  </motion.div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate">{displayName}</h3>
                    {lead.trade_name && lead.trade_name !== lead.company_name && (
                      <p className="text-sm text-slate-400 truncate">{lead.company_name}</p>
                    )}
                  </div>
                </div>

                {/* Location & Niche */}
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 mb-3">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir perfil no Google Maps"
                    className="flex items-center gap-1 group/loc hover:text-cyan-300 transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {lead.neighborhood ? `${lead.neighborhood}, ` : ''}{lead.city} - {lead.state}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover/loc:opacity-100 transition-opacity ml-0.5" />
                  </a>
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
                    {lead.niche}
                  </Badge>
                  {lead.verification === 'google' ? (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10" title={`Confirmada no Google · score ${lead.match_score ?? '?'}/100`}>
                      <CheckCircle className="h-3 w-3 mr-1 text-emerald-400" />
                      {lead.google_rating != null ? `★ ${lead.google_rating}${lead.google_reviews ? ` (${lead.google_reviews})` : ''}` : 'Verificada no Google'}
                    </Badge>
                  ) : lead.verification === 'ai' ? (
                    <Badge variant="outline" className="border-violet-500/40 text-violet-400 bg-violet-500/10" title={`Qualificada por IA${lead.model_used ? ` (${lead.model_used})` : ''} · score ${lead.match_score ?? '?'}/100${lead.ai_reason ? `\nMotivo: ${lead.ai_reason}` : ''}`}>
                      <Bot className="h-3 w-3 mr-1 text-violet-400" />
                      {lead.ai_reason ? 'IA ✓' : 'IA'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10" title={`Qualificada por heurística · score ${lead.match_score ?? '?'}/100`}>
                      <CheckCircle className="h-3 w-3 mr-1 text-amber-400" />
                      Qualificada
                    </Badge>
                  )}
                  {lead.cnpj && (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                      CNPJ: {lead.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
                    </Badge>
                  )}
                </div>

                {/* Decision Maker */}
                {lead.decision_maker_name && (
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <User className="h-4 w-4 text-emerald-400" />
                    <span className="text-slate-300">
                      <span className="font-medium text-white">{lead.decision_maker_name}</span>{' '}
                      <span className="text-slate-500">(Sócio/Decisor identificado)</span>
                    </span>
                  </div>
                )}

                {/* Contact Info */}
                <div className="flex items-center gap-3">
                  <PhoneIcon className="h-5 w-5 text-slate-400" />
                  {hasPhone ? (
                    <button
                      onClick={handleOpenWhatsApp}
                      disabled={isOpeningWhatsApp}
                      title="Abrir WhatsApp com mensagem pronta"
                      className="text-lg font-mono text-cyan-300 hover:text-cyan-200 transition-colors truncate block bg-transparent border-0 p-0 cursor-pointer disabled:opacity-60"
                    >
                      {formatPhone(lead.phone_number)}
                    </button>
                  ) : (
                    <span className="text-lg text-slate-500 italic">Sem telefone disponível</span>
                  )}
                  <Badge variant={phoneTypeInfo.color as any} className="ml-auto whitespace-nowrap">
                    <phoneTypeInfo.icon className="h-3 w-3 mr-1" />
                    {phoneTypeInfo.label}
                  </Badge>
                </div>

                {lead.address && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir endereço no Google Maps"
                    className="mt-2 text-xs text-slate-500 truncate block hover:text-cyan-300 transition-colors"
                  >
                    {lead.address}
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:grid sm:grid-cols-2 xl:flex xl:flex-row gap-2 shrink-0 xl:w-auto w-full sm:w-auto">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full xl:w-auto"
                  title="Abrir perfil do Google e localização"
                >
                  <Button variant="outline" size="lg" className="w-full justify-center border-sky-500/30 text-sky-400 hover:bg-sky-500/10 group">
                    <Map className="h-4 w-4 mr-2" />
                    Ver no Google
                    <ExternalLink className="h-3.5 w-3.5 ml-1 opacity-70" />
                  </Button>
                </a>

                <Button
                  variant="cyan"
                  size="lg"
                  className="w-full group"
                  onClick={handleContact}
                  disabled={isContacting}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isContacting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Marcando...
                    </>
                  ) : (
                    'Marcar como Contatado'
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 group"
                  onClick={handleGeneratePitch}
                  disabled={isGeneratingPitch}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {isGeneratingPitch ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    'Gerar Pitch'
                  )}
                </Button>

                {hasPhone ? (
                  <Button
                    variant="success"
                    size="lg"
                    className="w-full xl:w-auto justify-center group"
                    onClick={handleOpenWhatsApp}
                    disabled={isOpeningWhatsApp}
                  >
                    {isOpeningWhatsApp ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4 mr-2" />
                    )}
                    {isOpeningWhatsApp ? 'Gerando pitch...' : 'Enviar Mensagem'}
                    {!isOpeningWhatsApp && (
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="ml-2"
                      >
                        →
                      </motion.span>
                    )}
                  </Button>
                ) : (
                  <Button variant="outline" size="lg" disabled className="w-full xl:w-auto opacity-50 cursor-not-allowed">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Sem WhatsApp
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

function formatPhone(phone: string): string {
  if (!phone) return 'Sem telefone';
  const digits = phone.replace(/\D/g, '');
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
  return phone;
}