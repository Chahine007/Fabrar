import { BarChart3, Euro } from 'lucide-react';
import BillingTab from '../BillingTab';
import JobCostingTab from '../JobCostingTab';
import ProjectSubTabs from './ProjectSubTabs';

export default function ProjectFinanceTab({
  cantiereId,
  initialTab,
}: {
  cantiereId: number;
  initialTab?: string;
}) {
  return (
    <ProjectSubTabs
      initialTab={initialTab}
      tabs={[
        {
          id: 'job-costing',
          label: 'Job Costing',
          description: 'Confronto tra budget, costi reali e delta per attivita.',
          icon: BarChart3,
          render: () => <JobCostingTab cantiereId={cantiereId} />,
        },
        {
          id: 'billing',
          label: 'Fatturazione',
          description: 'Piano rate, fatture emesse e incassi del cantiere.',
          icon: Euro,
          render: () => <BillingTab cantiereId={cantiereId} />,
        },
      ]}
    />
  );
}
