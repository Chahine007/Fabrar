import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis
} from 'recharts';
import {
  ChevronRight, Settings2, X, Briefcase, CheckCircle2,
  Clock, AlertCircle, Euro, Package, Users, Activity,
  Plus, ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useDashboardRadar } from '../hooks/api/useDashboard';
import { useCantieri } from '../hooks/api/useCantieri';
import { useAudit } from '../hooks/api/useHr';
import { Button, IconButton } from '../components/ui';
import {
  DASHBOARD_KPI_CATALOG,
  DASHBOARD_KPI_PREFS_KEY,
  DASHBOARD_TAB_LABELS,
  DashboardKpiAddDialog,
  DashboardKpiGrid,
  createDefaultKpiPrefs,
  customKpiToDefinition,
  normalizeDashboardKpiPrefs,
  type CustomDashboardKpi,
  type DashboardKpiDefinition,
  type DashboardKpiSectionProps,
  type DashboardKpiPrefs,
  type DashboardTabId,
  type DashboardTabKpiPrefs,
} from '../components/dashboard/DashboardKpiGrid';

// BI Tab Components
import FinanceTab from '../components/dashboard/FinanceTab';
import WarehouseTab from '../components/dashboard/WarehouseTab';
import HrTab from '../components/dashboard/HrTab';
import OperationsTab from '../components/dashboard/OperationsTab';
import GovernanceTab from '../components/dashboard/GovernanceTab';

// ─── Types ───────────────────────────────────────────────────────────────────

const TABS: { id: DashboardTabId; label: string; icon: typeof Euro }[] = [
  { id: 'panoramica', label: 'Panoramica',  icon: Activity },
  { id: 'finanza',    label: 'Finanza',      icon: Euro },
  { id: 'magazzino',  label: 'Magazzino',    icon: Package },
  { id: 'hr',         label: 'HR',           icon: Users },
  { id: 'operazioni', label: 'Operazioni',   icon: CheckCircle2 },
  { id: 'governance', label: 'Governance',   icon: ShieldCheck },
];

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    'Completato':  'bg-success-bg text-success-text border border-success-border',
    'In Revisione': 'bg-warning-bg text-warning-text border border-warning-border',
    'In Corso':    'bg-info-bg text-info-text border border-info-border',
    'Rifiutato':   'bg-danger-bg text-danger-text border border-danger-border',
  };
  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-300", styles[status] || 'bg-background text-text-secondary border border-border')}>
      {status}
    </span>
  );
};

// Badge colore budget cantiere (verde / ambra / rosso / grigio)
function budgetStatusColor(status: string): string {
  if (status === 'green') return 'bg-success-text';
  if (status === 'amber') return 'bg-amber-500';
  if (status === 'red')   return 'bg-danger-text';
  return 'bg-border';
}

function loadDashboardKpiPrefs(): DashboardKpiPrefs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DASHBOARD_KPI_PREFS_KEY);
    return raw ? normalizeDashboardKpiPrefs(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function getTabPrefs(prefs: DashboardKpiPrefs, tabId: DashboardTabId): DashboardTabKpiPrefs {
  return prefs[tabId] ?? createDefaultKpiPrefs();
}

function normalizeIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isEditMode, setIsEditMode] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [kpiPrefs, setKpiPrefs] = useState<DashboardKpiPrefs>(() => loadDashboardKpiPrefs());
  const requestedTab = searchParams.get('tab');
  const initialTab = TABS.some((tab) => tab.id === requestedTab) ? requestedTab as DashboardTabId : 'panoramica';
  const [activeTab, setActiveTab] = useState<DashboardTabId>(initialTab);

  // ── React Query hooks ──────────────────────────
  const { data: radar,    isLoading: loadingRadar }    = useDashboardRadar();
  const { data: cantieri, isLoading: loadingCantieri } = useCantieri();
  const { data: audit,    isLoading: loadingAudit }    = useAudit({});

  const cantieriList = useMemo(() => cantieri ?? [], [cantieri]);

  const recentActivity = useMemo(() => {
    if (!audit) return [];
    return [...audit]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
      .map(r => ({
        id:     r.id,
        name:   `${r.nome ?? ''} ${r.cognome ?? ''}`.trim() || `Dipendente #${r.employee_id}`,
        task:   r.note ?? (r.type === 'ore' ? `${r.value}h lavorate` : `Spesa €${r.value}`),
        time:   r.date,
        status: r.status === 'verified' ? 'Completato'
              : r.status === 'rejected' ? 'Rifiutato'
              : 'In Revisione',
      }));
  }, [audit]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DASHBOARD_KPI_PREFS_KEY, JSON.stringify(kpiPrefs));
    } catch {
      // Local storage can be unavailable in locked-down browser contexts.
    }
  }, [kpiPrefs]);

  const updateTabPrefs = useCallback((tabId: DashboardTabId, updater: (current: DashboardTabKpiPrefs) => DashboardTabKpiPrefs) => {
    setKpiPrefs((current) => ({
      ...current,
      [tabId]: updater(getTabPrefs(current, tabId)),
    }));
  }, []);

  const handleRemoveKpi = useCallback((tabId: DashboardTabId, id: string) => {
    updateTabPrefs(tabId, (current) => {
      const isCustom = current.custom.some((item) => item.id === id);
      return {
        ...current,
        hidden: isCustom ? current.hidden.filter((itemId) => itemId !== id) : normalizeIds([...current.hidden, id]),
        custom: isCustom ? current.custom.filter((item) => item.id !== id) : current.custom,
      };
    });
  }, [updateTabPrefs]);

  const handleRestoreBuiltIn = useCallback((tabId: DashboardTabId, id: string) => {
    updateTabPrefs(tabId, (current) => ({
      ...current,
      hidden: current.hidden.filter((itemId) => itemId !== id),
    }));
  }, [updateTabPrefs]);

  const handleCreateCustomKpi = useCallback((tabId: DashboardTabId, payload: { title: string; value: string; description?: string }) => {
    const id = `custom-${tabId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const custom: CustomDashboardKpi = { id, tabId, ...payload };
    updateTabPrefs(tabId, (current) => ({
      ...current,
      custom: [...current.custom, custom],
    }));
  }, [updateTabPrefs]);

  const getKpiControls = useCallback((tabId: DashboardTabId): DashboardKpiSectionProps => {
    const prefs = getTabPrefs(kpiPrefs, tabId);
    return {
      isEditMode,
      prefs,
      customKpis: prefs.custom.map(customKpiToDefinition),
      onRemove: (id) => handleRemoveKpi(tabId, id),
    };
  }, [handleRemoveKpi, isEditMode, kpiPrefs]);

  const activeTabPrefs = getTabPrefs(kpiPrefs, activeTab);
  const availableBuiltIns = DASHBOARD_KPI_CATALOG[activeTab].filter((item) => activeTabPrefs.hidden.includes(item.id));

  const overviewKpiDefinitions = useMemo<DashboardKpiDefinition[]>(() => [
    {
      id: 'overview-workers',
      label: 'Operai Attivi',
      value: loadingRadar ? '…' : String(radar?.operaiAttivi ?? 0),
      icon: Users,
      tone: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      id: 'overview-projects',
      label: 'Cantieri Totali',
      value: loadingCantieri ? '…' : String(cantieriList.length),
      icon: Briefcase,
      tone: 'text-indigo-500',
      bg: 'bg-indigo-500/10',
    },
    {
      id: 'overview-hours',
      label: 'Ore Questa Settimana',
      value: loadingRadar ? '…' : `${(radar?.oreSettimana?.corrente ?? 0).toFixed(1)}h`,
      icon: Clock,
      tone: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      id: 'overview-pending',
      label: 'In Attesa Approv.',
      value: loadingRadar ? '…' : String((radar?.pending?.reports ?? 0) + (radar?.pending?.spese ?? 0)),
      icon: AlertCircle,
      tone: 'text-rose-500',
      bg: 'bg-rose-500/10',
      trendType: 'negative',
    },
  ], [cantieriList.length, loadingCantieri, loadingRadar, radar]);

  const projectStatusData = useMemo(() => {
    const radarCantieri = radar?.cantieri ?? [];
    const green  = radarCantieri.filter(c => c.status === 'green').length;
    const amber  = radarCantieri.filter(c => c.status === 'amber').length;
    const red    = radarCantieri.filter(c => c.status === 'red').length;
    return [
      { name: 'In Budget',    value: green, color: '#10b981' },
      { name: 'Attenzione',   value: amber, color: '#f59e0b' },
      { name: 'Over Budget',  value: red,   color: '#f87171' },
    ].filter(d => d.value > 0);
  }, [radar]);

  return (
    <div className="p-8 space-y-8">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-primary">{DASHBOARD_TAB_LABELS[activeTab]}</h2>
        <div className="flex items-center gap-2">
          <IconButton
            label="Aggiungi KPI"
            variant="secondary"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus size={17} />
          </IconButton>
          <Button
            onClick={() => setIsEditMode(!isEditMode)}
            variant={isEditMode ? 'primary' : 'secondary'}
            icon={isEditMode ? <X size={16} /> : <Settings2 size={16} />}
          >
            {isEditMode ? 'Fine Modifica' : 'Modifica KPI'}
          </Button>
        </div>
      </div>

      {/* BI Tab Navigation */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 w-fit overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setIsEditMode(false); }}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap',
              activeTab === tab.id ? 'bg-background text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary')}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ BI TAB CONTENT ═══ */}
      {activeTab === 'finanza'    && <FinanceTab kpiControls={getKpiControls('finanza')} />}
      {activeTab === 'magazzino'  && <WarehouseTab kpiControls={getKpiControls('magazzino')} />}
      {activeTab === 'hr'         && <HrTab kpiControls={getKpiControls('hr')} />}
      {activeTab === 'operazioni' && <OperationsTab kpiControls={getKpiControls('operazioni')} />}
      {activeTab === 'governance' && <GovernanceTab kpiControls={getKpiControls('governance')} />}

      {/* ═══ PANORAMICA (tab default) ═══ */}
      {activeTab === 'panoramica' && (
        <>
          {/* KPI Widgets Area */}
          <DashboardKpiGrid
            definitions={[...overviewKpiDefinitions, ...getKpiControls('panoramica').customKpis]}
            controls={getKpiControls('panoramica')}
          />

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/projects?new=1')}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all"
            >
              <Briefcase size={18} /> Nuovo Progetto
            </button>
            <button
              onClick={() => navigate('/activities')}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-text-primary rounded-xl font-bold hover:bg-background transition-all"
            >
              <CheckCircle2 size={18} /> Attività
            </button>
            <button
              onClick={() => navigate('/hr')}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-text-primary rounded-xl font-bold hover:bg-background transition-all"
            >
              <Clock size={18} /> Risorse Umane
            </button>
          </div>

          {/* Main Dashboard Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-4 space-y-8">

              {/* Alert: Pending approvazioni */}
              {!loadingRadar && ((radar?.pending?.reports ?? 0) + (radar?.pending?.spese ?? 0)) > 0 && (
                <div className="bg-card p-6 rounded-3xl shadow-sm border border-border transition-colors duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-text-primary flex items-center gap-2">
                      <AlertCircle size={18} className="text-warning-text" /> Da Approvare
                    </h4>
                    <button
                      onClick={() => navigate('/hr')}
                      className="text-accent text-xs font-bold hover:underline"
                    >
                      Vai a HR →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(radar?.pending?.reports ?? 0) > 0 && (
                      <div className="p-3 rounded-xl bg-warning-bg border border-warning-border flex items-start gap-3">
                        <Clock size={16} className="text-warning-text shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-warning-text">
                            {radar!.pending.reports} ore in attesa
                          </p>
                          <p className="text-xs text-warning-text opacity-80">Report da verificare</p>
                        </div>
                      </div>
                    )}
                    {(radar?.pending?.spese ?? 0) > 0 && (
                      <div className="p-3 rounded-xl bg-danger-bg border border-danger-border flex items-start gap-3">
                        <AlertCircle size={16} className="text-danger-text shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-danger-text">
                            {radar!.pending.spese} spese in attesa
                          </p>
                          <p className="text-xs text-danger-text opacity-80">Spese da verificare</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Project Status Chart */}
              <div className="bg-card p-6 rounded-3xl shadow-sm border border-border transition-colors duration-300 relative group">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold text-text-primary">Stato Budget Cantieri</h4>
                </div>
                <div className="h-64 relative">
                  {loadingRadar ? (
                    <div className="h-full flex items-center justify-center text-sm text-text-secondary">Caricamento…</div>
                  ) : projectStatusData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-text-secondary">Nessun dato disponibile</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={projectStatusData}
                          cx="50%" cy="50%"
                          innerRadius={60} outerRadius={80}
                          paddingAngle={5} dataKey="value"
                        >
                          {projectStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <p className="text-2xl font-bold text-text-primary">
                      {loadingCantieri ? '…' : cantieriList.length}
                    </p>
                    <p className="text-[10px] text-text-secondary uppercase tracking-wider">Totali</p>
                  </div>
                </div>
                {/* Legenda */}
                <div className="flex flex-wrap gap-3 mt-4">
                  {projectStatusData.map(d => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-text-secondary">{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Project List */}
              <div className="bg-card p-6 rounded-3xl shadow-sm border border-border transition-colors duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold text-text-primary">Ultimi Cantieri</h4>
                  <Link to="/projects" className="text-accent text-xs font-bold hover:underline">Vedi tutti →</Link>
                </div>
                <div className="space-y-4">
                  {loadingCantieri ? (
                    <p className="text-sm text-text-secondary text-center py-4">Caricamento...</p>
                  ) : cantieriList.length === 0 ? (
                    <p className="text-sm text-text-secondary text-center py-4">Nessun cantiere trovato.</p>
                  ) : cantieriList.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => navigate(`/projects/${c.id}`)}
                      className="flex items-center justify-between p-3 rounded-2xl hover:bg-background transition-colors cursor-pointer group relative"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          budgetStatusColor(radar?.cantieri?.find(rc => rc.id === c.id)?.status ?? 'gray')
                        )} />
                        <div className="min-w-0">
                          <p className="font-semibold text-text-primary truncate">{c.nome}</p>
                          <p className="text-xs text-text-secondary">{c.status}</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-text-secondary opacity-60 group-hover:text-accent transition-colors shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle Column — Attività Recenti */}
            <div className="lg:col-span-5 space-y-8">
              <div className="bg-card p-6 rounded-3xl shadow-sm border border-border h-full transition-colors duration-300 relative group">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold text-text-primary">Attività Recenti</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
                        <th className="pb-4 font-medium">Dipendente</th>
                        <th className="pb-4 font-medium">Attività</th>
                        <th className="pb-4 font-medium">Data</th>
                        <th className="pb-4 font-medium">Stato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loadingAudit ? (
                        <tr><td colSpan={4} className="py-8 text-center text-sm text-text-secondary">Caricamento...</td></tr>
                      ) : recentActivity.length === 0 ? (
                        <tr><td colSpan={4} className="py-8 text-center text-sm text-text-secondary">Nessuna attività recente.</td></tr>
                      ) : recentActivity.map((activity) => (
                        <tr key={activity.id} className="group/row hover:bg-background/50 transition-colors">
                          <td className="py-4">
                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs">
                              {activity.name.slice(0, 2).toUpperCase()}
                            </div>
                          </td>
                          <td className="py-4">
                            <p className="text-sm font-medium text-text-primary truncate max-w-[160px]">{activity.task}</p>
                            <p className="text-xs text-text-secondary mt-0.5">{activity.name}</p>
                          </td>
                          <td className="py-4">
                            <p className="text-xs text-text-secondary">
                              {new Date(activity.time).toLocaleDateString('it-IT')}
                            </p>
                          </td>
                          <td className="py-4">
                            <StatusBadge status={activity.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column — Ore Settimana */}
            <div className="lg:col-span-3 space-y-8">
              <div className="bg-card p-6 rounded-3xl shadow-sm border border-border transition-colors duration-300 relative group">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold text-text-primary">Ore Settimana</h4>
                </div>
                <div className="h-48">
                  {loadingRadar ? (
                    <div className="h-full flex items-center justify-center text-sm text-text-secondary">Caricamento…</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Scorsa', value: radar?.oreSettimana?.scorsa ?? 0 },
                        { name: 'Corrente', value: radar?.oreSettimana?.corrente ?? 0 },
                      ]}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8b8d97' }} />
                        <Tooltip cursor={{ fill: 'transparent' }} formatter={(v: unknown) => [`${v}h`, 'Ore']} />
                        <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-text-secondary">
                  <span>Scorsa: <b className="text-text-primary">{radar?.oreSettimana?.scorsa ?? '…'}h</b></span>
                  <span>Corrente: <b className="text-text-primary">{radar?.oreSettimana?.corrente ?? '…'}h</b></span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <DashboardKpiAddDialog
        open={addDialogOpen}
        tabLabel={DASHBOARD_TAB_LABELS[activeTab]}
        availableBuiltIns={availableBuiltIns}
        onClose={() => setAddDialogOpen(false)}
        onRestoreBuiltIn={(id) => handleRestoreBuiltIn(activeTab, id)}
        onCreateCustom={(payload) => handleCreateCustomKpi(activeTab, payload)}
      />
    </div>
  );
}
