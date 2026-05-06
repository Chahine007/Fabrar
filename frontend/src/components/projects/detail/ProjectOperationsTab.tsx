import { Bot, CheckSquare, Hash, MessageSquare } from 'lucide-react';
import WbsTab from '../../WbsTab';
import ActivitiesTab from './ActivitiesTab';
import MessagesTab from './MessagesTab';
import ProjectSubTabs from './ProjectSubTabs';
import TelegramFeedTab from './TelegramFeedTab';

interface ProjectOperationsTabProps {
  cantiereId: number;
  cantiereName: string;
  initialTab?: string;
}

export default function ProjectOperationsTab({
  cantiereId,
  cantiereName,
  initialTab,
}: ProjectOperationsTabProps) {
  return (
    <ProjectSubTabs
      initialTab={initialTab}
      tabs={[
        {
          id: 'tasks',
          label: 'Attivita',
          description: 'Task, assegnazioni e stato operativo del cantiere.',
          icon: CheckSquare,
          render: () => <ActivitiesTab cantiereId={cantiereId} />,
        },
        {
          id: 'wbs',
          label: 'WBS',
          description: 'Struttura di lavoro e nodi tecnici del progetto.',
          icon: Hash,
          render: () => <WbsTab cantiereId={cantiereId} />,
        },
        {
          id: 'project-messages',
          label: 'Messaggi',
          description: 'Conversazione collegata al cantiere.',
          icon: MessageSquare,
          render: () => <MessagesTab cantiereId={cantiereId} cantiereName={cantiereName} />,
        },
        {
          id: 'feed',
          label: 'Feed / Log',
          description: 'Eventi Telegram e registrazioni operative importate.',
          icon: Bot,
          render: () => <TelegramFeedTab cantiereId={cantiereId} />,
        },
      ]}
    />
  );
}
