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

export const supplierKeys = {
  all:    () => ['suppliers'] as const,
  list:   (filters?: object) => [...supplierKeys.all(), 'list', filters ?? {}] as const,
  detail: (id: number) => [...supplierKeys.all(), 'detail', id] as const,
};

export const crmKeys = {
  all: () => ['crm'] as const,

  accounts: () => [...crmKeys.all(), 'accounts'] as const,
  accountList: (filters?: object) => [...crmKeys.accounts(), 'list', filters ?? {}] as const,
  accountDetail: (id: number) => [...crmKeys.accounts(), 'detail', id] as const,
  accountInteractions: (accountId: number, filters?: object) => [...crmKeys.accounts(), accountId, 'interactions', filters ?? {}] as const,
  accountDeals: (accountId: number, filters?: object) => [...crmKeys.accounts(), accountId, 'deals', filters ?? {}] as const,
  accountTickets: (accountId: number, filters?: object) => [...crmKeys.accounts(), accountId, 'tickets', filters ?? {}] as const,

  deals: () => [...crmKeys.all(), 'deals'] as const,
  dealList: (filters?: object) => [...crmKeys.deals(), 'list', filters ?? {}] as const,
  dealDetail: (id: number) => [...crmKeys.deals(), 'detail', id] as const,
  pipeline: () => [...crmKeys.deals(), 'pipeline'] as const,

  campaigns: () => [...crmKeys.all(), 'campaigns'] as const,
  campaignList: (filters?: object) => [...crmKeys.campaigns(), 'list', filters ?? {}] as const,
};

export const materialRequestKeys = {
  all:  () => ['material-requests'] as const,
  list: (filters?: object) => [...materialRequestKeys.all(), 'list', filters ?? {}] as const,
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

export const billingKeys = {
  all: () => ['billing'] as const,
  project: (cantiereId: number) => [...billingKeys.all(), cantiereId] as const,
};

export const accountingKeys = {
  all: () => ['accounting'] as const,
  payables: (filters?: object) => [...accountingKeys.all(), 'payables', filters ?? {}] as const,
  vatRegister: (filters?: object) => [...accountingKeys.all(), 'vat-register', filters ?? {}] as const,
  purchaseInvoice: (id: number) => [...accountingKeys.all(), 'purchase-invoices', id] as const,
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

export const timesheetKeys = {
  all: () => ['timesheets'] as const,
};

export const expenseKeys = {
  all: () => ['expenses'] as const,
};

export const userKeys = {
  all:              () => ['user'] as const,
  settings:         () => [...userKeys.all(), 'settings'] as const,
  materialMovements: () => [...userKeys.all(), 'material-movements'] as const,
  supportContact:   () => [...userKeys.all(), 'support-contact'] as const,
};

export const enterpriseKeys = {
  all:          () => ['enterprise'] as const,
  capabilities: () => [...enterpriseKeys.all(), 'capabilities'] as const,
  biOverview:   () => [...enterpriseKeys.all(), 'bi', 'overview'] as const,
  biJobCosting: (filters?: object) => [...enterpriseKeys.all(), 'bi', 'job-costing', filters ?? {}] as const,
  dataQuality:  () => [...enterpriseKeys.all(), 'bi', 'data-quality'] as const,
  outbox:       (filters?: object) => [...enterpriseKeys.all(), 'outbox', filters ?? {}] as const,
  auditLogs:    (filters?: object) => [...enterpriseKeys.all(), 'audit', filters ?? {}] as const,
  ledger:       () => [...enterpriseKeys.all(), 'ledger'] as const,
};
