'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Loader2, MessageSquare, Zap, Target, Users, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    company_name: string;
    trade_name?: string;
    decision_maker_name?: string;
    niche: string;
    city: string;
    state: string;
  } | null;
}

export function PitchModal({ isOpen, onClose, lead }: PitchModalProps) {
  const [pitch, setPitch] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email' | 'linkedin'>('whatsapp');

  useEffect(() => {
    if (isOpen && lead) {
      generatePitch();
    }
  }, [isOpen, lead]);

  const generatePitch = async () => {
    if (!lead) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: lead.trade_name || lead.company_name,
          trade_name: lead.trade_name,
          decision_maker_name: lead.decision_maker_name,
          niche: lead.niche,
          city: lead.city,
          state: lead.state,
          channel: activeTab,
        }),
      });
      const data = await response.json();
      if (data.success && data.data?.pitch) {
        setPitch(data.data.pitch);
      } else if (data.fallback) {
        setPitch(data.fallback);
      } else {
        setPitch(getFallbackPitch(lead, activeTab));
      }
    } catch (error) {
      console.error('Error generating pitch:', error);
      setPitch(getFallbackPitch(lead, activeTab));
    } finally {
      setIsGenerating(false);
    }
  };

  const getFallbackPitch = (lead: PitchModalProps['lead'], channel: string) => {
    if (!lead) return '';
    const name = lead.decision_maker_name ? `Olá, ${lead.decision_maker_name.split(' ')[0]}` : 'Olá';
    const company = lead.trade_name || lead.company_name;
    
    const pitches = {
      whatsapp: `${name}! Tudo bem? 👋

Vi que a ${company} atua no nicho de ${lead.niche} aqui em ${lead.city}/${lead.state} e notei que ainda não têm um site próprio.

Hoje, 9 em cada 10 clientes pesquisam no Google antes de contratar. Sem site, você perde credibilidade e deixa de aparecer para quem está procurando exatamente o que você oferece.

Ajudamos empresas como a sua a terem presença digital profissional em poucos dias, com site otimizado para receber contatos pelo WhatsApp.

Topa uma conversa rápida de 10 min para eu mostrar como funciona? Sem compromisso.

Abs!`,
      email: `Assunto: Site para ${company} - ${lead.niche} em ${lead.city}

${name},

Escrevo porque identifiquei a ${company} como uma excelente oportunidade no segmento de ${lead.niche} em ${lead.city}/${lead.state}.

Notei que a empresa ainda não possui um site próprio - apenas perfis em redes sociais. O problema: 90% dos clientes B2B pesquisam no Google antes de fechar negócio. Sem site, você fica invisível para quem tem intenção de compra.

Nós da [Sua Empresa] somos especialistas em criar sites de alta conversão para ${lead.niche}. Entregamos:
✅ Site profissional otimizado para SEO local
✅ Integração direta com WhatsApp Business
✅ Formulários de orçamento inteligentes
✅ Hospedagem segura e velocidade máxima

Gostaria de agendar 15 minutos para mostrar cases reais do seu nicho?

Melhores cumprimentos,
[Seu Nome]`,
      linkedin: `${name}, vi seu perfil e a atuação da ${company} em ${lead.niche} aqui em ${lead.city}. 

Notei que a empresa ainda não tem site próprio - apenas redes sociais. Para B2B, isso significa perder leads qualificados que buscam no Google.

Ajudo empresas do seu segmento a conquistarem presença digital que converte. Topa trocar uma ideia rápida?`
    };
    
    return pitches[channel as keyof typeof pitches] || pitches.whatsapp;
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(pitch);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayName = lead?.trade_name || lead?.company_name || '';

  if (!lead) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
            <DialogHeader className="pb-4 border-b border-slate-700/50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-cyan-400" />
                    Script de Abordagem Personalizado
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    IA gerou uma mensagem contextualizada para <span className="font-medium text-white">{displayName}</span>
                  </DialogDescription>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>
            </DialogHeader>

            <div className="flex h-[calc(100%-140px)] flex-col">
              {/* Lead Info Badges */}
              <div className="flex flex-wrap gap-2 mb-4 px-1">
                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
                  <Target className="h-3 w-3 mr-1" />
                  {lead.niche}
                </Badge>
                <Badge variant="outline" className="border-slate-500/30 text-slate-400">
                  <MapPin className="h-3 w-3 mr-1" />
                  {lead.city}/{lead.state}
                </Badge>
                {lead.decision_maker_name && (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    <Users className="h-3 w-3 mr-1" />
                    Decisor: {lead.decision_maker_name.split(' ')[0]}
                  </Badge>
                )}
              </div>

              {/* Channel Tabs */}
              <div className="flex gap-1 mb-4 px-1 bg-slate-900/50 rounded-lg p-1">
                {[
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                  { id: 'email', label: 'E-mail', icon: MessageSquare },
                  { id: 'linkedin', label: 'LinkedIn', icon: Users },
                ].map((tab) => (
                  <motion.button
                    key={tab.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      generatePitch();
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                      activeTab === tab.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </motion.button>
                ))}
              </div>

              {/* Pitch Content */}
              <div className="flex-1 overflow-hidden">
                <Card className="h-full border-slate-700/50 bg-slate-900/50">
                  <CardContent className="h-full p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">
                        Copie e personalize antes de enviar
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyToClipboard}
                        className="gap-1"
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4 text-emerald-400" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copiar
                          </>
                        )}
                      </Button>
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="h-[300px] overflow-y-auto"
                      >
                        <Textarea
                          value={pitch}
                          onChange={(e) => setPitch(e.target.value)}
                          placeholder={isGenerating ? 'Gerando script personalizado com IA...' : 'Seu script aparecerá aqui...'}
                          className="h-full bg-slate-950/50 border-slate-700 focus:border-cyan-500 text-white placeholder:text-slate-500 font-mono text-sm leading-relaxed resize-none"
                          rows={15}
                          disabled={isGenerating}
                        />
                      </motion.div>
                    </AnimatePresence>
                    {isGenerating && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                          <span className="text-slate-300">IA criando script personalizado...</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quick Tips */}
              <Card className="mt-4 border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-emerald-300 space-y-1">
                      <p className="font-medium">Dicas para aumentar a conversão:</p>
                      <ul className="list-disc list-inside space-y-1 text-emerald-200">
                        <li>Personalize com o nome do decisor (se identificado)</li>
                        <li>Mencione um case real do mesmo nicho</li>
                        <li>Use o WhatsApp Business API para métricas</li>
                        <li>Follow-up em 48h se não responder</li>
                        <li>Agende call de 15 min, não "reunião"</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}