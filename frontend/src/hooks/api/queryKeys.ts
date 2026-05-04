/**
 * queryKeys.ts — Registry centralizzato di tutte le chiavi React Query.
 * Mantiene la struttura gerarchica per invalidazioni granulari.
 * Pattern: ogni modulo ha un factory che produce array di chiavi.
 */

export const magazzinoKeys = {
  all:        () => ['magazzino'] as const,
  articoli:   () => [...magazzinoKeys.all(), 'articoli'] as const,
  ubicazioni: () => [...magazzinoKeys.all(), 'ubicazioni'] as const,
  giacenze:   () => [...magazzinoKeys.all(), 'giacenze'] as const,
  cantiere:   (id: number) => [...magazzinoKeys.all(), 'cantiere', id] as const,
};

export const cantierKeys = {
  all:    ()                => ['cantieri'] as const,
  list:   ()                => [...cantierKeys.all(), 'list'] as const,
  detail: (id: number)      => [...cantierKeys.all(), 'detail', id] as const,
  tasks:  (id: number)      => [...cantierKeys.all(), 'tasks', id] as const,
  docs:   (id: number)      => [...cantierKeys.all(), 'docs', id] as const,
  timeline: (id: number)    => [...cantierKeys.all(), 'timeline', id] as const,
  settings: (id: number)    => [...cantierKeys.all(), 'settings', id] as const,
};

export const hrKeys = {
  all:     ()               => ['hr'] as const,
  alerts:  ()               => [...hrKeys.all(), 'alerts'] as const,
  audit:   (filters?: object) => [...hrKeys.all(), 'audit', filters ?? {}] as const,
  pending: ()               => [...hrKeys.all(), 'pending'] as const,
};

export const employeeKeys = {
  all:    ()              => ['employees'] as const,
  list:   ()              => [...employeeKeys.all(), 'list'] as const,
  detail: (id: number)    => [...employeeKeys.all(), 'detail', id] as const,
  search: (query: string) => [...employeeKeys.all(), 'search', query] as const,
};

export const conversationKeys = {
  all:      ()              => ['conversations'] as const,
  list:     ()              => ['conversations'] as const,
  messages: (id: string)    => ['messages', id] as const,
};

export const telegramKeys = {
  all:  ()                  => ['telegram'] as const,
  logs: (filters?: object)  => [...telegramKeys.all(), 'logs', filters ?? {}] as const,
  audit: (filters?: object) => [...telegramKeys.all(), 'audit', filters ?? {}] as const,
};

export const dashboardKeys = {
  all: ()                   => ['dashboard'] as const,
  kpi: ()                   => [...dashboardKeys.all(), 'kpi'] as const,
};

export const wbsKeys = {
  all:  ()                  => ['wbs'] as const,
  tree: (cantiereId: number) => [...wbsKeys.all(), 'tree', cantiereId] as const,
};

export const taskKeys = {
  all:    ()                     => ['tasks'] as const,
  list:   (filters?: object)     => [...taskKeys.all(), 'list', filters ?? {}] as const,
  detail: (id: number)           => [...taskKeys.all(), 'detail', id] as const,
};
