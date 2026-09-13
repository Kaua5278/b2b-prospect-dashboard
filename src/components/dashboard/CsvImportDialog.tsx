'use client';

import { useState, useRef } from 'react';
import { FileUp, Loader2, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { parseCSV, csvRowsToLeadInputs } from '@/lib/csv';

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function CsvImportDialog({ open, onOpenChange, onImported }: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = (open: boolean) => {
    reset();
    onOpenChange(open);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setError(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) {
        setError('Nenhuma linha encontrada no CSV. Verifique o arquivo.');
        return;
      }

      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Falha ao importar leads.');
        return;
      }
      setResult(data);
      onImported();
    } catch (err: any) {
      setError(err?.message || 'Erro ao processar o arquivo.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
        <DialogHeader className="pb-4 border-b border-slate-700/50">
          <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
            <FileUp className="h-5 w-5 text-cyan-400" />
            Importar leads (CSV)
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Envie um CSV com colunas: <code className="text-cyan-400">empresa; telefone; cidade; estado; nicho</code> — demais colunas (nome_fantasia, decisor, whatsapp, site, status) são opcionais.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Button
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={isImporting}
            className="w-full h-24 flex-col gap-2 border-dashed bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white"
          >
            <FileUp className="h-6 w-6" />
            {file ? file.name : 'Selecionar arquivo .csv'}
            <span className="text-xs font-normal text-slate-500">
              Separe o arquivo com « ; » (Excel natural) ou « , »
            </span>
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,.txt"
            className="hidden"
            onChange={handleFileChange}
          />

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              {result.imported > 0 && (
                <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {result.imported} lead(s) importado(s) com sucesso!
                </div>
              )}
              {result.skipped > 0 && (
                <div className="text-xs text-slate-500">
                  {result.skipped} linha(s) ignorada(s) (sem empresa ou telefone)
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => (<div key={i}>{e}</div>))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-700/50 pt-4">
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={isImporting} className="text-slate-400">
            <X className="h-4 w-4 mr-1" /> Fechar
          </Button>
          <Button variant="success" onClick={handleImport} disabled={!file || isImporting} className="gap-1">
            {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isImporting ? 'Importando...' : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** CSV via api/leads/import (o parser roda no client) */