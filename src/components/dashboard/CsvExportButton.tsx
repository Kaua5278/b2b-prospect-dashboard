'use client';

import { useState } from 'react';
import { FileDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { leadsToCSV, downloadCSV } from '@/lib/csv';
import { motion } from 'framer-motion';

interface CsvExportButtonProps {
  leads: any[];
  disabled?: boolean;
}

export function CsvExportButton({ leads, disabled }: CsvExportButtonProps) {
  const [done, setDone] = useState(false);

  const handleExport = () => {
    if (!leads.length) return;
    const csv = leadsToCSV(leads);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`leads-${stamp}.csv`, csv);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };

  return (
    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
      <Button
        variant="outline"
        onClick={handleExport}
        disabled={disabled || !leads.length}
        title="Exportar leads em CSV"
        className="gap-1.5"
      >
        {done ? <Check className="h-4 w-4 text-emerald-400" /> : <FileDown className="h-4 w-4" />}
        {done ? 'Exportado' : 'CSV'}
      </Button>
    </motion.div>
  );
}