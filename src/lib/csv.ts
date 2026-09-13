/**
 * Utilitários de CSV — exportar e importar leads
 */

/** Gera string CSV a partir de uma lista de leads */
export function leadsToCSV(leads: any[]): string {
  if (!leads.length) return '';
  const headers = [
    'empresa', 'nome_fantasia', 'cnpj', 'telefone', 'whatsapp', 'decisor',
    'cidade', 'estado', 'nicho', 'status', 'telefone_contato',
    'notas', 'site', 'tem_site', 'link_maps', 'criado_em',
  ];

  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = leads.map((l) => [
    l.company_name, l.trade_name, l.cnpj, l.phone_number,
    l.phone_number_whatsapp || l.phone_number,
    l.decision_maker_name, l.city, l.state, l.niche, l.status,
    l.phone_number, l.notes, l.website || '',
    l.has_website ? 'sim' : 'nao',
    l.google_maps_url || l.google_title ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.company_name + ' ' + (l.city || ''))}` : '',
    l.created_at,
  ]);

  const SEP = ';';
  return [headers, ...rows].map(r => r.map(esc).join(SEP)).join('\n');
}

/** Dispara download do arquivo CSV no navegador */
export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface CsvLeadRow {
  empresa: string;
  nome_fantasia?: string;
  cnpj?: string;
  telefone?: string;
  whatsapp?: string;
  decisor?: string;
  cidade?: string;
  estado?: string;
  nicho?: string;
  status?: string;
  notas?: string;
  site?: string;
  tem_site?: string;
}

/** Faz o parse de um CSV (sep ; ou ,) para objetos */
export function parseCSV(text: string): Record<string, string>[] {
  const clean = text.replace(/^\ufeff/, '');
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of clean) {
    if (ch === '"') inQuotes = !inQuotes;
    current += ch;
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      const l = current.replace(/\r/g, '').trim();
      if (l) lines.push(l);
      current = '';
    }
  }
  if (current.trim()) lines.push(current.replace(/\r/g, '').trim());

  if (!lines.length) return [];

  const detectSep = (line: string) => {
    const s = line.split(';').length;
    const c = line.split(',').length;
    return s > c ? ';' : ',';
  };
  const sep = detectSep(lines[0]);
  const splitLine = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; }
        else q = !q;
      } else if (ch === sep && !q) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/[^\w]/g, '_'));
  return lines.slice(1).map(line => {
    const cells = splitLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
    return obj;
  });
}

/** Mapeia linhas do CSV para o formato esperado de upsert de leads */
export function csvRowsToLeadInputs(rows: CsvLeadRow[], userId: string): any[] {
  return rows
    .filter(r => r.empresa && r.telefone)
    .map((r, i) => {
      const phone = (r.telefone || r.whatsapp || '').replace(/\D/g, '');
      const phoneFull = phone.startsWith('55') ? `+${phone}` : `+55${phone}`;
      const city = r.cidade || '';
      const state = (r.estado || '').toUpperCase().slice(0, 2);
      return {
        user_id: userId,
        place_id: `csv-${userId.slice(0, 8)}-${Date.now()}-${i}`,
        company_name: r.empresa.trim(),
        trade_name: r.nome_fantasia?.trim() || null,
        cnpj: r.cnpj ? r.cnpj.replace(/\D/g, '') || null : null,
        phone_number: phoneFull,
        phone_type: phone.length === 11 ? 'owner_direct' : 'commercial_whatsapp',
        decision_maker_name: r.decisor?.trim() || null,
        city: city || 'N/I',
        state: state || 'SP',
        niche: r.nicho?.trim() || 'manual',
        status: (r.status || 'new').toLowerCase().replace(/\s/g, '_') || 'new',
        notes: r.notas?.trim() || '',
        website: r.site?.trim() || null,
        has_website: r.tem_site === 'sim' ? true : (r.site ? true : false),
      };
    });
}