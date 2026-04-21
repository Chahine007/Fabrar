/**
 * queryKeys.ts — Registry centralizzato di tutte le chiavi React Query.
 * Mantiene la struttura gerarchica per invalidazioni granulari.
 * Pattern: ogni modulo ha un factory che produce array di chiavi.
 */

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
  all:  ()                  => ['employees'] as const,
  list: ()                   => [...employeeKeys.all(), 'list'] as const,
};

export const conversationKeys = {
  all:      ()              => ['conversations'] as const,
  list:     ()              => [...conversationKeys.all(), 'list'] as const,
  messages: (id: string)    => [...conversationKeys.all(), 'messages', id] as const,
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
