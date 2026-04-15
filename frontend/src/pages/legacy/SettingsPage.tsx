import React, { useState } from 'react';
import { 
  User, 
  Bell, 
  Settings as SettingsIcon, 
  Lock, 
  ShieldCheck, 
  History, 
  Briefcase, 
  Clock, 
  ShoppingBag, 
  Building2, 
  LifeBuoy, 
  BookOpen,
  ChevronRight,
  Mail,
  Smartphone,
  Globe,
  Moon,
  Pencil,
  Key,
  LogOut,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ElementType;
  group: 'Settings' | 'Security' | 'My Work' | 'System';
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  // Settings
  { id: 'account', label: 'Account', icon: User, group: 'Settings' },
  { id: 'notifications', label: 'Notifications', icon: Bell, group: 'Settings' },
  { id: 'preferences', label: 'Preferences', icon: SettingsIcon, group: 'Settings' },
  // Security
  { id: 'password', label: 'Password management', icon: Key, group: 'Security' },
  { id: 'sessions', label: 'Active sessions', icon: History, group: 'Security' },
  { id: '2fa', label: 'Two-Factor Auth', icon: ShieldCheck, group: 'Security' },
  // My Work
  { id: 'activities', label: 'My Activities', icon: Briefcase, group: 'My Work' },
  { id: 'hours', label: 'My Hours', icon: Clock, group: 'My Work' },
  { id: 'orders', label: 'My Orders', icon: ShoppingBag, group: 'My Work' },
  // System
  { id: 'roles', label: 'Roles & permissions', icon: ShieldCheck, group: 'System' },
  { id: 'company', label: 'Company switch', icon: Building2, group: 'System' },
  { id: 'support', label: 'Support', icon: LifeBuoy, group: 'System' },
  { id: 'help', label: 'Help / Documentation', icon: BookOpen, group: 'System' },
];

export default function SettingsPage({ onClose }: { onClose: () => void }) {
  const [activeSection, setActiveSection] = useState('account');

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-6">
              <div className="relative">
                <img 
                  src="https://i.pravatar.cc/150?u=me" 
                  alt="Profile" 
                  className="w-24 h-24 rounded-3xl border-4 border-card shadow-xl"
                  referrerPolicy="no-referrer"
                />
                <button className="absolute -bottom-2 -right-2 p-2 bg-accent text-white rounded-xl shadow-lg hover:scale-110 transition-transform">
                  <Pencil size={16} />
                </button>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-text-primary">Alessandro Rossi</h3>
                <p className="text-text-secondary">alessandro.rossi@erppro.com</p>
                <span className="inline-block mt-2 px-3 py-1 bg-accent/10 text-accent text-xs font-bold rounded-full">Administrator</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Full Name</label>
                <input type="text" defaultValue="Alessandro Rossi" className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 transition-all text-text-primary" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Email Address</label>
                <input type="email" defaultValue="alessandro.rossi@erppro.com" className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 transition-all text-text-primary" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Phone Number</label>
                <input type="tel" defaultValue="+39 333 1234567" className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 transition-all text-text-primary" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Department</label>
                <input type="text" defaultValue="Operations" className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 transition-all text-text-primary" />
              </div>
            </div>

            <div className="pt-6 border-t border-border flex justify-end gap-4">
              <button className="px-6 py-2 rounded-xl text-text-secondary font-semibold hover:bg-background transition-colors">Discard</button>
              <button className="px-6 py-2 rounded-xl bg-accent text-white font-semibold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors">Save Changes</button>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-text-primary">Notification Preferences</h3>
            <div className="space-y-4">
              {[
                { label: 'Email Notifications', desc: 'Receive daily summaries and important alerts via email.', icon: Mail },
                { label: 'Push Notifications', desc: 'Get real-time updates directly on your browser or mobile.', icon: Smartphone },
                { label: 'Telegram Alerts', desc: 'Connect your Telegram account for critical system alerts.', icon: Globe },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-background border border-border hover:border-accent/20 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-card rounded-xl shadow-sm text-text-secondary group-hover:text-accent transition-colors">
                      <item.icon size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">{item.label}</p>
                      <p className="text-xs text-text-secondary">{item.desc}</p>
                    </div>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={i < 2} />
                    <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-card after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'preferences':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-text-primary">System Preferences</h3>
            <div className="space-y-6 max-w-md">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Language</label>
                <select className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 transition-all text-text-primary">
                  <option>English</option>
                  <option>Italiano</option>
                  <option>Español</option>
                  <option>Français</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Timezone</label>
                <select className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 transition-all text-text-primary">
                  <option>Europe/Rome (GMT+1)</option>
                  <option>Europe/London (GMT+0)</option>
                  <option>America/New_York (GMT-5)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Date Format</label>
                <select className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 transition-all text-text-primary">
                  <option>DD/MM/YYYY</option>
                  <option>MM/DD/YYYY</option>
                  <option>YYYY-MM-DD</option>
                </select>
              </div>
              <button className="w-full py-3 bg-accent text-white font-bold rounded-xl shadow-lg hover:bg-accent/90 transition-all">Save Preferences</button>
            </div>
          </div>
        );
      case 'activities':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-text-primary">My Activities</h3>
            <div className="space-y-3">
              {[
                { title: 'Review Q1 Financials', project: 'Finance', due: 'Today', priority: 'High' },
                { title: 'Update Client Database', project: 'CRM', due: 'Tomorrow', priority: 'Medium' },
                { title: 'Team Sync Meeting', project: 'Internal', due: 'Apr 10', priority: 'Low' },
              ].map((task, i) => (
                <div key={i} className="p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      task.priority === 'High' ? "bg-danger-bg text-danger-text" : 
                      task.priority === 'Medium' ? "bg-warning-bg text-warning-text" : "bg-info-bg text-info-text"
                    )}>
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">{task.title}</p>
                      <p className="text-xs text-text-secondary">{task.project} • Due {task.due}</p>
                    </div>
                  </div>
                  <button className="p-2 text-text-secondary hover:text-accent transition-colors">
                    <ChevronRight size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      case 'password':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-text-primary">Password Management</h3>
            <div className="space-y-6 max-w-md">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Current Password</label>
                <input type="password" placeholder="••••••••" className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 transition-all text-text-primary" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">New Password</label>
                <input type="password" placeholder="••••••••" className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 transition-all text-text-primary" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Confirm New Password</label>
                <input type="password" placeholder="••••••••" className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 transition-all text-text-primary" />
              </div>
              <button className="w-full py-3 bg-slate-900 dark:bg-accent text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 dark:hover:bg-accent/90 transition-all">Update Password</button>
            </div>
          </div>
        );
      case 'sessions':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-text-primary">Active Sessions</h3>
            <div className="space-y-4">
              {[
                { device: 'MacBook Pro 16"', location: 'Milan, Italy', status: 'Current Session', icon: Smartphone },
                { device: 'iPhone 15 Pro', location: 'Rome, Italy', status: 'Last active: 2h ago', icon: Smartphone },
                { device: 'Chrome on Windows', location: 'London, UK', status: 'Last active: 1d ago', icon: Globe },
              ].map((session, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-background border border-border">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-card rounded-xl shadow-sm text-text-secondary">
                      <session.icon size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">{session.device}</p>
                      <p className="text-xs text-text-secondary">{session.location} • {session.status}</p>
                    </div>
                  </div>
                  {i > 0 && (
                    <button className="text-xs font-bold text-danger-text hover:underline">Revoke</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      case 'roles':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-text-primary">Roles & Permissions</h3>
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-background border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-text-primary">Administrator</h4>
                    <p className="text-sm text-text-secondary">Full access to all modules and settings.</p>
                  </div>
                  <span className="px-3 py-1 bg-success-bg text-success-text text-xs font-bold rounded-full border border-success-border">Active Role</span>
                </div>
                <button className="text-sm font-bold text-accent hover:underline">View Permissions</button>
              </div>
              <div className="p-6 rounded-2xl bg-background border border-border opacity-60">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-text-primary">Project Manager</h4>
                    <p className="text-sm text-text-secondary">Access to projects, tasks, and team management.</p>
                  </div>
                </div>
                <button className="text-sm font-bold text-text-secondary hover:text-text-primary transition-colors">View Permissions</button>
              </div>
            </div>
          </div>
        );
      case '2fa':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-text-primary">Two-Factor Authentication</h3>
            <div className="p-6 rounded-2xl bg-background border border-border flex items-start gap-4">
              <div className="p-3 bg-success-bg text-success-text rounded-xl">
                <ShieldCheck size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-text-primary mb-1">2FA is Enabled</h4>
                <p className="text-sm text-text-secondary mb-4">Your account is protected with an additional layer of security. You will be required to enter a code from your authenticator app when logging in.</p>
                <button className="px-4 py-2 bg-card border border-border text-text-primary font-bold rounded-xl shadow-sm hover:bg-background transition-all">Manage 2FA Settings</button>
              </div>
            </div>
          </div>
        );
      case 'hours':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text-primary">Time Tracking</h3>
              <button className="px-4 py-2 bg-accent text-white text-xs font-bold rounded-xl shadow-lg shadow-accent/20">Log Hours</button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'This Week', value: '38.5h', trend: '+2h' },
                { label: 'This Month', value: '156h', trend: '-5h' },
                { label: 'Billable', value: '92%', trend: '+4%' },
              ].map((stat, i) => (
                <div key={i} className="p-4 rounded-2xl bg-background border border-border">
                  <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">{stat.label}</p>
                  <div className="flex items-end justify-between mt-1">
                    <p className="text-xl font-bold text-text-primary">{stat.value}</p>
                    <p className="text-[10px] font-bold text-success-text">{stat.trend}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'company':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-text-primary">Switch Company</h3>
            <div className="space-y-3">
              {[
                { name: 'ERP Pro Italia S.r.l.', role: 'Administrator', active: true },
                { name: 'Global Logistics Ltd.', role: 'Project Manager', active: false },
                { name: 'Tech Solutions GmbH', role: 'Consultant', active: false },
              ].map((comp, i) => (
                <button key={i} className={cn(
                  "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                  comp.active ? "bg-accent/5 border-accent shadow-sm" : "bg-card border-border hover:border-accent/20"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                      comp.active ? "bg-accent text-white" : "bg-background text-text-secondary"
                    )}>
                      {comp.name[0]}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-text-primary">{comp.name}</p>
                      <p className="text-xs text-text-secondary">{comp.role}</p>
                    </div>
                  </div>
                  {comp.active && <CheckCircle2 size={20} className="text-accent" />}
                </button>
              ))}
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 animate-in fade-in duration-500">
            <div className="p-4 bg-slate-50 rounded-full">
              <SettingsIcon size={48} className="opacity-20" />
            </div>
            <p className="text-sm font-medium">This section is under development.</p>
          </div>
        );
    }
  };

  const groups = ['Settings', 'Security', 'My Work', 'System'];

  return (
    <div className="flex h-full bg-card overflow-hidden transition-colors duration-300">
      {/* Settings Sidebar */}
      <aside className="w-72 border-r border-border flex flex-col bg-background/50">
        <div className="p-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary">User Settings</h2>
            <p className="text-xs text-text-secondary mt-1">Manage your account and work</p>
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
          {groups.map(group => (
            <div key={group} className="space-y-2">
              <h4 className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">{group}</h4>
              <div className="space-y-1">
                {SETTINGS_SECTIONS.filter(s => s.group === group).map(section => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group",
                      activeSection === section.id 
                        ? "bg-card text-accent shadow-sm border border-border" 
                        : "text-text-secondary hover:bg-card hover:text-text-primary"
                    )}
                  >
                    <section.icon size={18} className={cn(
                      "transition-colors",
                      activeSection === section.id ? "text-accent" : "text-text-secondary group-hover:text-text-primary"
                    )} />
                    <span className="text-sm font-semibold">{section.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>


      </aside>

      {/* Settings Content */}
      <main className="flex-1 overflow-y-auto bg-card no-scrollbar">
        <div className="max-w-3xl mx-auto p-12">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
