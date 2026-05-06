import React, { useMemo, useState } from 'react';
import { motion, Reorder } from 'motion/react';
import { Activity, GripVertical, Plus, RotateCcw, X, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button, Dialog, Field, IconButton, Input, Textarea } from '../ui';

export type DashboardTabId = 'panoramica' | 'finanza' | 'magazzino' | 'hr' | 'operazioni';

export interface CustomDashboardKpi {
  id: string;
  tabId: DashboardTabId;
  title: string;
  value: string;
  description?: string;
}

export interface DashboardKpiDefinition {
  id: string;
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  icon: LucideIcon;
  tone: string;
  bg: string;
  custom?: boolean;
  trendType?: 'positive' | 'negative';
}

export interface DashboardTabKpiPrefs {
  order: string[];
  hidden: string[];
  custom: CustomDashboardKpi[];
}

export type DashboardKpiPrefs = Partial<Record<DashboardTabId, DashboardTabKpiPrefs>>;

export interface DashboardKpiSectionProps {
  isEditMode: boolean;
  prefs: DashboardTabKpiPrefs;
  customKpis: DashboardKpiDefinition[];
  onReorder: (orderedIds: string[]) => void;
  onRemove: (id: string) => void;
}

export const DASHBOARD_KPI_PREFS_KEY = 'fabrar.dashboard.kpiPrefs.v1';

export const DASHBOARD_TAB_LABELS: Record<DashboardTabId, string> = {
  panoramica: 'Panoramica',
  finanza: 'Finanza',
  magazzino: 'Magazzino',
  hr: 'HR',
  operazioni: 'Operazioni',
};

export const DASHBOARD_KPI_CATALOG: Record<DashboardTabId, { id: string; label: string }[]> = {
  panoramica: [
    { id: 'overview-workers', label: 'Operai Attivi' },
    { id: 'overview-projects', label: 'Cantieri Totali' },
    { id: 'overview-hours', label: 'Ore Questa Settimana' },
    { id: 'overview-pending', label: 'In Attesa Approv.' },
  ],
  finanza: [
    { id: 'finance-revenue', label: 'Ricavi Previsti Totali' },
    { id: 'finance-costs', label: 'Costi Totali Reali' },
    { id: 'finance-margin', label: 'Margine Netto' },
    { id: 'finance-margin-pct', label: 'Margine Netto %' },
  ],
  magazzino: [
    { id: 'warehouse-capital', label: 'Capitale Immobilizzato' },
    { id: 'warehouse-items', label: 'Articoli a Giacenza' },
    { id: 'warehouse-movements', label: 'Movimenti Totali' },
  ],
  hr: [
    { id: 'hr-hourly-cost', label: 'Costo Orario Medio' },
    { id: 'hr-month-hours', label: 'Ore Mese Corrente' },
    { id: 'hr-month-cost', label: 'Costo HR Mese' },
    { id: 'hr-rated-employees', label: 'Dipendenti con Tariffa' },
  ],
  operazioni: [
    { id: 'ops-approval-time', label: 'Tempo Medio Approvaz.' },
    { id: 'ops-rejection-rate', label: 'Tasso Rifiuto' },
    { id: 'ops-approved', label: 'Entry Approvate' },
    { id: 'ops-total', label: 'Entry Totali' },
  ],
};

export function createDefaultKpiPrefs(): DashboardTabKpiPrefs {
  return { order: [], hidden: [], custom: [] };
}

export function customKpiToDefinition(kpi: CustomDashboardKpi): DashboardKpiDefinition {
  return {
    id: kpi.id,
    label: kpi.title,
    value: kpi.value,
    sublabel: kpi.description || 'KPI personalizzata',
    icon: Activity,
    tone: 'text-accent',
    bg: 'bg-accent/10',
    custom: true,
  };
}

function normalizeIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

export function normalizeDashboardKpiPrefs(value: unknown): DashboardKpiPrefs {
  if (!value || typeof value !== 'object') return {};
  const input = value as Record<string, Partial<DashboardTabKpiPrefs>>;
  const result: DashboardKpiPrefs = {};

  (Object.keys(DASHBOARD_TAB_LABELS) as DashboardTabId[]).forEach((tabId) => {
    const tab = input[tabId];
    if (!tab || typeof tab !== 'object') return;

    result[tabId] = {
      order: Array.isArray(tab.order) ? normalizeIds(tab.order.map(String)) : [],
      hidden: Array.isArray(tab.hidden) ? normalizeIds(tab.hidden.map(String)) : [],
      custom: Array.isArray(tab.custom)
        ? tab.custom
            .filter((item): item is CustomDashboardKpi =>
              !!item &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              typeof item.title === 'string' &&
              typeof item.value === 'string'
            )
            .map((item) => ({
              id: item.id,
              tabId,
              title: item.title,
              value: item.value,
              description: typeof item.description === 'string' ? item.description : undefined,
            }))
        : [],
    };
  });

  return result;
}

export function DashboardKpiGrid({
  definitions,
  controls,
  className,
}: {
  definitions: DashboardKpiDefinition[];
  controls: DashboardKpiSectionProps;
  className?: string;
}) {
  const visibleDefinitions = useMemo(() => {
    const byId = new Map(definitions.map((definition) => [definition.id, definition]));
    const orderedIds = normalizeIds([
      ...controls.prefs.order,
      ...definitions.map((definition) => definition.id),
    ]);

    return orderedIds
      .map((id) => byId.get(id))
      .filter((definition): definition is DashboardKpiDefinition => !!definition)
      .filter((definition) => !controls.prefs.hidden.includes(definition.id));
  }, [controls.prefs.hidden, controls.prefs.order, definitions]);

  const renderCard = (definition: DashboardKpiDefinition, isDragging = false) => {
    const Icon = definition.icon;
    return (
      <div
        className={cn(
          'relative h-full rounded-2xl border border-border bg-card p-5 transition-colors',
          controls.isEditMode && 'cursor-grab active:cursor-grabbing',
          isDragging && 'shadow-xl'
        )}
      >
        {controls.isEditMode && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
              <GripVertical size={15} />
              Sposta
            </div>
            <IconButton
              label={definition.custom ? 'Rimuovi KPI custom' : 'Nascondi KPI'}
              size="sm"
              variant="ghost"
              onClick={() => controls.onRemove(definition.id)}
              className="text-danger-text hover:bg-danger-bg"
            >
              <X size={15} />
            </IconButton>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{definition.label}</p>
            <p className="break-words text-2xl font-bold text-text-primary">{definition.value}</p>
            {definition.sublabel && <p className="text-xs text-text-secondary">{definition.sublabel}</p>}
          </div>
          <div className={cn('shrink-0 rounded-xl p-2.5', definition.bg, definition.tone)}>
            <Icon size={18} />
          </div>
        </div>

        {definition.trendType && (
          <div className="mt-4">
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-1 text-xs font-bold',
                definition.trendType === 'negative'
                  ? 'border border-danger-border bg-danger-bg text-danger-text'
                  : 'border border-success-border bg-success-bg text-success-text'
              )}
            >
              {definition.trendType === 'negative' ? 'Attenzione' : 'Stabile'}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (visibleDefinitions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm font-semibold text-text-primary">Nessuna KPI visibile</p>
        <p className="mt-1 text-sm text-text-secondary">Usa il pulsante + per aggiungere una KPI a questa vista.</p>
      </div>
    );
  }

  if (!controls.isEditMode) {
    return (
      <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
        {visibleDefinitions.map((definition) => (
          <motion.div key={definition.id} whileHover={{ y: -2 }}>
            {renderCard(definition)}
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <Reorder.Group
      axis="y"
      values={visibleDefinitions}
      onReorder={(next) => controls.onReorder(next.map((definition) => definition.id))}
      className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}
    >
      {visibleDefinitions.map((definition) => (
        <Reorder.Item key={definition.id} value={definition} className="list-none">
          {renderCard(definition)}
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}

export function DashboardKpiAddDialog({
  open,
  tabLabel,
  availableBuiltIns,
  onClose,
  onRestoreBuiltIn,
  onCreateCustom,
}: {
  open: boolean;
  tabLabel: string;
  availableBuiltIns: { id: string; label: string }[];
  onClose: () => void;
  onRestoreBuiltIn: (id: string) => void;
  onCreateCustom: (payload: { title: string; value: string; description?: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');

  const reset = () => {
    setTitle('');
    setValue('');
    setDescription('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const createCustom = () => {
    const trimmedTitle = title.trim();
    const trimmedValue = value.trim();
    if (!trimmedTitle || !trimmedValue) return;

    onCreateCustom({
      title: trimmedTitle,
      value: trimmedValue,
      description: description.trim() || undefined,
    });
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Aggiungi KPI"
      description={`Vista ${tabLabel}`}
      icon={<Plus size={20} />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={close}>Annulla</Button>
          <Button onClick={createCustom} disabled={!title.trim() || !value.trim()}>Crea KPI custom</Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">Catalogo</h3>
            <p className="mt-1 text-sm text-text-secondary">Ripristina KPI nascoste in questa vista.</p>
          </div>

          {availableBuiltIns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-text-secondary">
              Tutte le KPI di catalogo sono gia visibili.
            </div>
          ) : (
            <div className="space-y-2">
              {availableBuiltIns.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onRestoreBuiltIn(item.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-card"
                >
                  <span className="text-sm font-semibold text-text-primary">{item.label}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-accent">
                    <RotateCcw size={13} />
                    Ripristina
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">KPI custom</h3>
            <p className="mt-1 text-sm text-text-secondary">Aggiungi un valore manuale alla vista corrente.</p>
          </div>
          <Field label="Titolo">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Es. Margine target" />
          </Field>
          <Field label="Valore">
            <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Es. 18%" />
          </Field>
          <Field label="Descrizione">
            <Textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Nota opzionale"
            />
          </Field>
        </section>
      </div>
    </Dialog>
  );
}
