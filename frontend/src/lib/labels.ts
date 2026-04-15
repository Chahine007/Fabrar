/**
 * labels.ts — Mapping centralizzato UI label ↔ API backend
 * Cambiare il nome UI richiede modificare solo questo file.
 */

export const UI_LABELS = {
  module: {
    dashboard:  { ui: 'Dashboard',      api: 'dashboard'  },
    projects:   { ui: 'Progetti',        api: 'cantieri'   },
    hr:         { ui: 'Risorse Umane',   api: 'hr'         },
    genya:      { ui: 'Importa Genya',   api: 'spese/bulk' },
    messages:   { ui: 'Messaggi',        api: null         },
    activities: { ui: 'Attività',        api: null         },
    documents:  { ui: 'Documenti',       api: null         },
    warehouse:  { ui: 'Magazzino',       api: null         },
    clients:    { ui: 'Clienti',         api: null         },
    invoices:   { ui: 'Fatture',         api: null         },
    reports:    { ui: 'Report',          api: null         },
    settings:   { ui: 'Impostazioni',    api: null         },
  },
  status: {
    pending:   'In Attesa',
    approved:  'Approvato',
    rejected:  'Rifiutato',
    active:    'Attivo',
    inactive:  'Inattivo',
  },
  roles: {
    ADMIN:  'Amministratore',
    HR:     'Risorse Umane',
    WORKER: 'Operaio',
  },
} as const;

/** Restituisce la label UI per un modulo */
export function moduleLabel(key: keyof typeof UI_LABELS.module): string {
  return UI_LABELS.module[key].ui;
}

/** Restituisce il path API per un modulo (null se non ancora implementato) */
export function moduleApi(key: keyof typeof UI_LABELS.module): string | null {
  return UI_LABELS.module[key].api;
}
