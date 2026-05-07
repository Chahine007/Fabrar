import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckSquare,
  ChevronDown,
  Euro,
  FileText,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import CantiereSettingsTab from '../components/CantiereSettingsTab';
import Spinner from '../components/Spinner';
import OverviewTab from '../components/projects/detail/OverviewTab';
import DocumentsTab from '../components/projects/detail/DocumentsTab';
import ProjectOperationsTab from '../components/projects/detail/ProjectOperationsTab';
import ProjectResourcesTab from '../components/projects/detail/ProjectResourcesTab';
import ProjectFinanceTab from '../components/projects/detail/ProjectFinanceTab';
import { useCantieri, useCantiereDetail } from '../hooks/api/useCantieri';
import type { ProjectDetailTabId, ProjectTabDefinition } from '../types/project-detail';

const TABS: ProjectTabDefinition[] = [
  { id: 'overview', label: 'Panoramica' },
  { id: 'operations', label: 'Operativita' },
  { id: 'resources', label: 'Risorse' },
  { id: 'finance', label: 'Contabilita' },
  { id: 'documents', label: 'Documenti' },
  { id: 'settings', label: 'Impostazioni' },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cantiereId = id ? parseInt(id, 10) : null;
  const detailCantiereId = Number.isInteger(cantiereId) ? cantiereId : null;

  const { data: cantieri, isLoading: loadingList } = useCantieri();
  const { data: projectDetail } = useCantiereDetail(detailCantiereId);

  const [activeTab, setActiveTab] = useState<ProjectDetailTabId>('overview');
  const [projectActionsOpen, setProjectActionsOpen] = useState(false);

  const cantiere = cantieri?.find((item) => item.id === cantiereId) ?? null;
  const headerContractValue = projectDetail?.cantiere?.valore_contratto ?? cantiere?.valore_contratto ?? cantiere?.budget ?? 0;
  const headerRealCost = projectDetail?.kpi?.costoTotale ?? cantiere?.costo_reale ?? 0;
  const headerInvoiced = projectDetail?.kpi?.totaleFatturato ?? 0;
  const headerCollected = projectDetail?.kpi?.totaleIncassato ?? 0;

  if (loadingList && !cantiere) {
    return <Spinner fullScreen label="Caricamento progetto..." />;
  }

  if (cantiereId === null || Number.isNaN(cantiereId)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-text-secondary">ID progetto non valido.</p>
        <button onClick={() => navigate('/projects')} className="text-accent hover:underline text-sm">← Torna ai Progetti</button>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab cantiereId={cantiereId} />;
      case 'operations':
      case 'activities':
      case 'wbs':
      case 'messages':
      case 'telegram':
        return (
          <ProjectOperationsTab
            cantiereId={cantiereId}
            cantiereName={cantiere?.nome ?? ''}
            initialTab={
              activeTab === 'wbs'
                ? 'wbs'
                : activeTab === 'messages'
                  ? 'project-messages'
                  : activeTab === 'telegram'
                    ? 'feed'
                    : 'tasks'
            }
          />
        );
      case 'resources':
      case 'hours':
      case 'materiali':
      case 'warehouse':
        return (
          <ProjectResourcesTab
            cantiereId={cantiereId}
            initialTab={activeTab === 'materiali' || activeTab === 'warehouse' ? 'materials' : 'hours'}
          />
        );
      case 'finance':
      case 'job-costing':
      case 'billing':
      case 'invoices':
        return (
          <ProjectFinanceTab
            cantiereId={cantiereId}
            initialTab={activeTab === 'billing' ? 'billing' : 'job-costing'}
          />
        );
      case 'documents':
        return <DocumentsTab cantiereId={cantiereId} />;
      case 'settings':
        return <CantiereSettingsTab cantiereId={cantiereId} />;
      default:
        return <OverviewTab cantiereId={cantiereId} />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 overflow-hidden transition-colors duration-300">
      <header className="bg-card border-b border-border px-4 pt-5 md:px-8 md:pt-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 hover:text-accent transition-colors font-medium"
          >
            <ArrowLeft size={14} /> Tutti i Progetti
          </button>
          <span>/</span>
          <span className="text-text-primary font-semibold truncate">{cantiere?.nome ?? `Cantiere #${cantiereId}`}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold text-text-primary tracking-tight">
                {cantiere?.nome ?? `Cantiere #${cantiereId}`}
              </h2>
              {cantiere?.status && (
                <span className="px-3 py-1 bg-info-bg text-info-text text-xs font-bold rounded-lg uppercase tracking-wider border border-info-border">
                  {cantiere.status}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-text-secondary font-medium">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="opacity-60" />
                Contratto: €{headerContractValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2">
                <Users size={16} className="opacity-60" />
                Costo: €{headerRealCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2">
                <FileText size={16} className="opacity-60" />
                Fatturato: €{headerInvoiced.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2">
                <Euro size={16} className="opacity-60" />
                Incassato: €{headerCollected.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('activities')}
              className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-sm font-bold transition-all border border-accent shadow-lg shadow-accent/20"
            >
              <CheckSquare size={16} /> Nuovo Task
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setProjectActionsOpen((open) => !open)}
                className="flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-background text-text-primary rounded-xl text-sm font-bold transition-all border border-border shadow-sm"
              >
                Azioni
                <ChevronDown
                  size={16}
                  className={cn('transition-transform', projectActionsOpen && 'rotate-180')}
                />
              </button>

              <AnimatePresence>
                {projectActionsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-border bg-card p-2 shadow-xl z-30"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setProjectActionsOpen(false);
                        setActiveTab('documents');
                      }}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-text-primary hover:bg-background transition-colors"
                    >
                      <FileText size={16} /> Vai ai Documenti
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectActionsOpen(false);
                        setActiveTab('messages');
                      }}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger-text hover:bg-danger-bg transition-colors"
                    >
                      <AlertCircle size={16} /> Segnala Problema
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8 mt-8 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-4 text-sm font-bold transition-colors relative px-1 whitespace-nowrap shrink-0',
                activeTab === tab.id ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="projectDetailTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {renderTab()}
          </AnimatePresence>
        </div>
      </main>

    </div>
  );
}
