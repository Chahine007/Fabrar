import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { AccountSettingsPanel } from '../components/settings/AccountSettingsPanel';
import { HelpPanel } from '../components/settings/HelpPanel';
import { NotificationsPanel, PreferencesPanel } from '../components/settings/PreferencePanels';
import { PasswordPanel, SessionsPanel, TwoFactorPanel } from '../components/settings/SecurityPanels';
import { CompanyPanel, RolesPanel, SupportPanel } from '../components/settings/SystemPanels';
import { ActivitiesPanel, HoursPanel, OrdersPanel } from '../components/settings/WorkPanels';
import {
  GROUP_LABELS,
  SETTINGS_SECTIONS,
  getValidSettingsSection,
} from '../components/settings/settingsShared';

export default function SettingsPage({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const activeSection = getValidSettingsSection(section);
  const groups = ['Settings', 'Security', 'My Work', 'System'] as const;

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSettingsPanel />;
      case 'notifications':
        return <NotificationsPanel />;
      case 'preferences':
        return <PreferencesPanel />;
      case 'password':
        return <PasswordPanel />;
      case 'sessions':
        return <SessionsPanel />;
      case '2fa':
        return <TwoFactorPanel />;
      case 'activities':
        return <ActivitiesPanel />;
      case 'hours':
        return <HoursPanel />;
      case 'orders':
        return <OrdersPanel />;
      case 'roles':
        return <RolesPanel />;
      case 'company':
        return <CompanyPanel />;
      case 'support':
        return <SupportPanel />;
      case 'help':
        return <HelpPanel />;
      default:
        return <AccountSettingsPanel />;
    }
  };

  return (
    <div className="flex h-full bg-card overflow-hidden transition-colors duration-300">
      <aside className="w-72 border-r border-border flex flex-col bg-background/50">
        <div className="p-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Impostazioni</h2>
            <p className="text-xs text-text-secondary mt-1">Account, sicurezza e lavoro</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:bg-card hover:text-text-primary rounded-xl transition-all"
            title="Chiudi"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-8 space-y-8 no-scrollbar">
          {groups.map((group) => (
            <div key={group} className="space-y-2">
              <h4 className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">{GROUP_LABELS[group]}</h4>
              <div className="space-y-1">
                {SETTINGS_SECTIONS.filter((item) => item.group === group).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/settings/${item.id}`)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group text-left',
                      activeSection === item.id
                        ? 'bg-card text-accent shadow-sm border border-border'
                        : 'text-text-secondary hover:bg-card hover:text-text-primary'
                    )}
                  >
                    <item.icon
                      size={18}
                      className={cn(
                        'transition-colors shrink-0',
                        activeSection === item.id ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'
                      )}
                    />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto bg-card no-scrollbar">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="max-w-3xl mx-auto p-12"
        >
          {renderContent()}
        </motion.div>
      </main>
    </div>
  );
}
