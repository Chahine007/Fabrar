import { useEffect, useState } from 'react';
import { cn } from '../../../lib/utils';
import type { ProjectSubTab } from '../../../types/project-detail';

interface ProjectSubTabsProps {
  tabs: ProjectSubTab[];
  initialTab?: string;
}

export default function ProjectSubTabs({ tabs, initialTab }: ProjectSubTabsProps) {
  const firstTab = tabs[0]?.id ?? '';
  const [activeSubTab, setActiveSubTab] = useState(initialTab ?? firstTab);

  useEffect(() => {
    if (initialTab && tabs.some((tab) => tab.id === initialTab)) {
      setActiveSubTab(initialTab);
    }
  }, [initialTab, tabs]);

  const activeTabConfig = tabs.find((tab) => tab.id === activeSubTab) ?? tabs[0];

  if (!activeTabConfig) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card border border-border rounded-3xl p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all',
                  'border min-h-[44px]',
                  isActive
                    ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20'
                    : 'bg-background text-text-secondary border-border hover:text-text-primary hover:border-accent/30'
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTabConfig.description && (
        <div className="rounded-2xl border border-border bg-card px-5 py-4 text-sm text-text-secondary shadow-sm">
          {activeTabConfig.description}
        </div>
      )}

      <div>{activeTabConfig.render()}</div>
    </div>
  );
}
