'use client';

import { useState } from 'react';
import { UserPlus, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

interface ManualLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const UF_LIST = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'CE', 'GO', 'DF', 'ES', 'AM', 'PA', 'MT', 'MS', 'RN', 'PB', 'AL', 'SE', 'PI', 'MA', 'TO', 'RO', 'AC', 'AP', 'RR'];

/**
 * Cadastra um lead manualmente (sem precisar de prospecção).
 * O upsert é feito direto no Supabase via client (RLS já filtra por user_id).
 */
export function ManualLeadDialog({ open, onOpenChange, onCreated }: ManualLeadDialogProps) {
  const [company, setCompany] = useState('');
  const [niche, setNiche] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('SP');
  const [decisionMaker, setDecisionMaker] = useState('');
  const [hasWebsite, setHasWebsite] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCompany(''); setNiche(''); setPhone(''); setCity('');
    setState('SP'); setDecisionMaker(''); setHasWebsite(true); setNotes('');
    setError(null); setDone(false);
  };

  const handleClose = (o: boolean) => {
    reset();
    onOpenChange(o);
  };

  const handleSubmit = async () => {
    if (!company.trim() || !phone.trim()) {
      setError('Empresa e telefone são obrigatórios.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const digits = phone.replace(/\D/g, '');
      const phoneFull = digits.startsWith('55') ? `+${digits}` : `+55${digits}`;

      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { error: err } = await supabase
        .from('leads')
        .upsert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          place_id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          company_name: company.trim(),
          trade_name: null,
          cnpj: null,
          phone_number: phoneFull,
          phone_type: digits.length === 11 ? 'owner_direct' : 'commercial_whatsapp',
          decision_maker_name: decisionMaker.trim() || null,
          city: city.trim() || 'N/I',
          state,
          niche: niche.trim() || 'manual',
          status: 'new',
          notes: notes.trim() || '',
          has_website: hasWebsite,
          website: null,
        }, { onConflict: 'user_id,place_id' });

      if (err) {
        setError(err.message);
      } else {
        setDone(true);
        onCreated();
        setTimeout(() => handleClose(false), 1500);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar lead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
        <DialogHeader className="pb-4 border-b border-slate-700/50">
          <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-cyan-400" />
            Cadastrar lead manualmente
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Adicione um contato direto ao seu funil sem iniciar uma prospecção.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{error}
            </div>
          )}
          {done && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Lead cadastrado com sucesso!
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label className="mb-2 block text-sm font-medium text-slate-300">Empresa <span className="text-cyan-400">*</span></Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nome da empresa" className="h-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500" />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-medium text-slate-300">Telefone / WhatsApp <span className="text-cyan-400">*</span></Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="h-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500 font-mono" />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-medium text-slate-300">Nicho</Label>
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex: Auto peças" className="h-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500" />
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <div>
                <Label className="mb-2 block text-sm font-medium text-slate-300">Cidade</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="h-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500" />
              </div>
              <div>
                <Label className="mb-2 block text-sm font-medium text-slate-300">UF</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger className="h-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                    {UF_LIST.map((uf) => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="md:col-span-2">
              <Label className="mb-2 block text-sm font-medium text-slate-300">Decisor (nome do sócio/contato)</Label>
              <Input value={decisionMaker} onChange={(e) => setDecisionMaker(e.target.value)} placeholder="Opcional" className="h-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500" />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <Switch checked={hasWebsite} onCheckedChange={setHasWebsite} className="data-[state=checked]:bg-cyan-500" />
              <div>
                <p className="text-sm text-slate-300">Empresa tem site próprio</p>
                <p className="text-xs text-slate-500">Útil para segmentar prospecções</p>
              </div>
            </div>
            <div className="md:col-span-2">
              <Label className="mb-2 block text-sm font-medium text-slate-300">Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações iniciais..." rows={2} className="bg-slate-900/50 border-slate-700 focus:border-cyan-500" />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-700/50 pt-4">
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={saving} className="text-slate-400">Cancelar</Button>
          <Button variant="success" onClick={handleSubmit} disabled={saving || !company.trim() || !phone.trim()} className="gap-1">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <UserPlus className="h-4 w-4" />
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}