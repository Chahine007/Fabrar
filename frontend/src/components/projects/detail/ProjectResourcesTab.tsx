import { Clock, Package } from 'lucide-react';
import MaterialiTab from '../../MaterialiTab';
import HoursTab from './HoursTab';
import ProjectSubTabs from './ProjectSubTabs';

export default function ProjectResourcesTab({
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
          id: 'hours',
          label: 'Ore',
          description: 'Tabulati, consuntivi e costo manodopera del cantiere.',
          icon: Clock,
          render: () => <HoursTab cantiereId={cantiereId} />,
        },
        {
          id: 'materials',
          label: 'Materiali',
          description: 'Movimenti, scarichi e materiali imputati al progetto.',
          icon: Package,
          render: () => <MaterialiTab cantiereId={cantiereId} />,
        },
      ]}
    />
  );
}
