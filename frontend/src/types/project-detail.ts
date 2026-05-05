import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type ProjectPrimaryTabId =
  | 'overview'
  | 'operations'
  | 'resources'
  | 'finance'
  | 'documents'
  | 'settings';

export type ProjectDetailTabId =
  | ProjectPrimaryTabId
  | 'activities'
  | 'wbs'
  | 'messages'
  | 'telegram'
  | 'hours'
  | 'materiali'
  | 'warehouse'
  | 'job-costing'
  | 'billing'
  | 'invoices';

export interface ProjectTabDefinition {
  id: ProjectPrimaryTabId;
  label: string;
}

export interface ProjectShareItem {
  title?: string;
  name?: string;
  value?: string | number;
  description?: string | null;
}

export interface ProjectDocument {
  id: number;
  name: string;
  type: string;
  size: string;
  created_at: string;
  date?: string;
  uploader?: string;
  numero_fattura?: string | null;
  data_emissione?: string | null;
}

export interface ProjectSubTab {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  render: () => ReactNode;
}
