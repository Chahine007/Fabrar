import {
  Activity,
  Briefcase,
  ClipboardList,
  Euro,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Package,
  Truck,
  Users,
} from 'lucide-react';
import type { ElementType } from 'react';

export interface NavNode {
  icon?: ElementType;
  label: string;
  path?: string;
  id: string;
  roles?: string[];
  capability?: string;
  children?: NavNode[];
  hidden?: boolean;
}

export const ALL_AUTH_ROLES = ['ADMIN', 'HR', 'PROJECT_MANAGER', 'WAREHOUSEMAN', 'WORKER'];
export const WAREHOUSE_ROLES = ['ADMIN', 'HR', 'PROJECT_MANAGER', 'WAREHOUSEMAN'];
export const PROJECT_ROLES = ['ADMIN', 'HR', 'PROJECT_MANAGER'];

export const NAV_TREE: NavNode[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    roles: ['ADMIN'],
    capability: 'dashboard:read',
  },
  {
    id: 'operations-section',
    label: 'Operatività',
    icon: Briefcase,
    children: [
      { icon: Inbox, label: 'Raccolta Dati', path: '/data-entry', id: 'data-entry', roles: ALL_AUTH_ROLES, capability: 'data_entry:read' },
      { icon: Briefcase, label: 'Progetti', path: '/projects', id: 'projects', roles: PROJECT_ROLES, capability: 'projects:read' },
      { icon: Activity, label: 'Attività', path: '/activities', id: 'activities', capability: 'tasks:read' },
      { icon: MessageSquare, label: 'Messaggi', path: '/messages', id: 'messages', capability: 'messages:read' },
    ],
  },
  {
    id: 'hr-section',
    label: 'Risorse Umane',
    icon: Users,
    children: [
      { icon: Users, label: 'Gestione Personale', path: '/hr', id: 'hr', roles: ['ADMIN', 'HR'], capability: 'hr:read' },
      { icon: ClipboardList, label: 'Tabulati', path: '/hr/tabulati', id: 'hr-tabulati', roles: ['ADMIN', 'HR'], capability: 'audit:approve' },
      { icon: MessageSquare, label: 'Audit Telegram', path: '/hr/telegram-audit', id: 'telegram-audit', roles: ['ADMIN', 'HR'], capability: 'audit:approve' },
      { icon: ClipboardList, label: 'Le Mie Ore / Spese', path: '/timesheets', id: 'my-timesheets', roles: ['WORKER'], capability: 'timesheets:self:write' },
    ],
  },
  {
    id: 'logistics-section',
    label: 'Logistica',
    icon: Package,
    children: [
      { icon: Package, label: 'Magazzino', path: '/warehouse', id: 'warehouse', roles: WAREHOUSE_ROLES, capability: 'warehouse:read' },
      { icon: Truck, label: 'Fornitori', path: '/suppliers', id: 'suppliers', roles: WAREHOUSE_ROLES, capability: 'suppliers:read' },
      { icon: ClipboardList, label: 'Richieste Materiali', path: '/material-requests', id: 'material-requests', roles: ALL_AUTH_ROLES, capability: 'material_requests:read' },
    ],
  },
  {
    id: 'administration-section',
    label: 'Amministrazione',
    icon: Euro,
    children: [
      { icon: Euro, label: 'Finanza', path: '/finance', id: 'finance', roles: ['ADMIN'], capability: 'dashboard:read' },
    ],
  },
];
