import React, { useState } from 'react';
import { Activity, ChevronDown, ChevronLeft, LogOut, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useCapabilities } from '../../hooks/api/useAuth';
import { useAuthContext } from '../../context/AuthContext';
import { NAV_TREE, type NavNode } from './navConfig';

function useVisibleNavTree() {
  const { user } = useAuthContext();
  const { data: capabilitiesData } = useCapabilities();
  const role = user?.role;
  const capabilities = capabilitiesData?.capabilities ?? [];
  const hasCapabilities = capabilities.length > 0;

  const canAccessNode = React.useCallback(
    (node: NavNode) => {
      if (node.capability && hasCapabilities) return capabilities.includes(node.capability);
      return !node.roles || (!!role && node.roles.includes(role));
    },
    [capabilities, hasCapabilities, role]
  );

  return React.useMemo(() => {
    const filterNodes = (nodes: NavNode[]): NavNode[] => nodes
      .filter((node) => !node.hidden && canAccessNode(node))
      .map((node) => ({ ...node, children: node.children ? filterNodes(node.children) : undefined }))
      .filter((node) => !!node.path || (node.children?.length ?? 0) > 0);

    return filterNodes(NAV_TREE);
  }, [canAccessNode]);
}

export default function Sidebar({
  isMobileOpen,
  setIsMobileOpen,
  onLogout,
}: {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  onLogout: () => void;
}) {
  const [isLockedExpanded, setIsLockedExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('fabrar.nav.expanded');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const location = useLocation();
  const visibleNavTree = useVisibleNavTree();
  const isExpanded = isMobileOpen || isLockedExpanded || isHovered;
  const closeMobile = () => setIsMobileOpen(false);

  const isPathActive = React.useCallback((path?: string) => {
    if (!path) return false;
    const normalizePath = (value: string) => (value === '/' ? value : value.replace(/\/+$/, ''));
    const currentPath = normalizePath(location.pathname);
    const targetPath = normalizePath(path);

    if (targetPath === '/projects') return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
    if (targetPath === '/hr') return currentPath === targetPath || currentPath.startsWith('/hr/employees/');
    return currentPath === targetPath;
  }, [location.pathname]);

  const isNodeActive = React.useCallback((node: NavNode): boolean => {
    return isPathActive(node.path) || !!node.children?.some(isNodeActive);
  }, [isPathActive]);

  React.useEffect(() => {
    try {
      localStorage.setItem('fabrar.nav.expanded', JSON.stringify(expandedSections));
    } catch {
      // Local storage can be unavailable in private/locked-down browser contexts.
    }
  }, [expandedSections]);

  React.useEffect(() => {
    setExpandedSections((current) => {
      let changed = false;
      const next = { ...current };
      visibleNavTree.forEach((node) => {
        if (node.children?.length && isNodeActive(node) && !next[node.id]) {
          next[node.id] = true;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [isNodeActive, visibleNavTree]);

  const toggleExpandedSection = (id: string) => {
    setExpandedSections((current) => ({ ...current, [id]: !current[id] }));
  };

  const renderExpandedNode = (node: NavNode) => {
    const Icon = node.icon;
    const hasChildren = !!node.children?.length;
    const active = isNodeActive(node);
    const open = expandedSections[node.id] ?? active;

    if (!hasChildren && node.path) {
      return (
        <Link
          key={node.id}
          to={node.path}
          onClick={closeMobile}
          className={cn(
            'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
            active ? 'bg-sidebar-hover text-white shadow-lg' : 'text-slate-300 hover:bg-sidebar-hover/50 hover:text-white'
          )}
        >
          {Icon && <Icon size={18} className={cn('shrink-0', active ? 'text-accent' : 'text-slate-400')} />}
          <span className="truncate">{node.label}</span>
        </Link>
      );
    }

    return (
      <div key={node.id} className="space-y-1">
        <button
          type="button"
          onClick={() => toggleExpandedSection(node.id)}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-all duration-200',
            active ? 'bg-sidebar-hover/60 text-white' : 'text-slate-400 hover:bg-sidebar-hover/50 hover:text-white'
          )}
        >
          {Icon && <Icon size={18} className={cn('shrink-0', active ? 'text-accent' : 'text-slate-500')} />}
          <span className="min-w-0 flex-1 truncate text-left">{node.label}</span>
          <ChevronDown size={16} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="ml-4 space-y-1 border-l border-slate-700/60 pl-3">
                {node.children?.map((child) => renderExpandedNode(child))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderCollapsedNode = (node: NavNode) => {
    const Icon = node.icon;
    const hasChildren = !!node.children?.length;
    const active = isNodeActive(node);
    const firstPath = node.path || node.children?.find((child) => child.path)?.path || '/';

    return (
      <div key={node.id} className="group/flyout relative">
        <Link
          to={firstPath}
          onClick={closeMobile}
          aria-label={node.label}
          className={cn(
            'mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200',
            active ? 'bg-sidebar-hover text-white shadow-lg' : 'text-slate-400 hover:bg-sidebar-hover/50 hover:text-white'
          )}
        >
          {Icon && <Icon size={19} className={cn(active && 'text-accent')} />}
        </Link>

        <div className="pointer-events-none absolute left-full top-0 z-50 ml-3 hidden min-w-56 rounded-2xl border border-slate-700 bg-sidebar p-2 text-sm shadow-2xl group-hover/flyout:block group-hover/flyout:pointer-events-auto">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{node.label}</div>
          <div className="space-y-1">
            {hasChildren ? node.children?.map((child) => {
              const ChildIcon = child.icon;
              const childActive = isNodeActive(child);
              return child.path ? (
                <Link
                  key={child.id}
                  to={child.path}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 font-medium transition-colors',
                    childActive ? 'bg-sidebar-hover text-white' : 'text-slate-300 hover:bg-sidebar-hover/50 hover:text-white'
                  )}
                >
                  {ChildIcon && <ChildIcon size={16} className={cn(childActive ? 'text-accent' : 'text-slate-500')} />}
                  <span>{child.label}</span>
                </Link>
              ) : null;
            }) : (
              <Link
                to={firstPath}
                onClick={closeMobile}
                className="flex items-center gap-3 rounded-xl px-3 py-2 font-medium text-slate-300 hover:bg-sidebar-hover/50 hover:text-white"
              >
                {Icon && <Icon size={16} className="text-slate-500" />}
                <span>{node.label}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  };

  const navContent = (
    <>
      <div className={cn('flex shrink-0 items-center p-6', !isExpanded ? 'justify-center' : 'justify-between')}>
        <Link to="/" className="group/logo flex cursor-pointer items-center gap-3" onClick={closeMobile}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent font-bold text-white shadow-lg shadow-accent/20 transition-transform group-hover/logo:scale-110">
            <Activity size={20} />
          </div>
          {isExpanded && <span className="text-xl font-bold tracking-tight text-white">ERP Pro</span>}
        </Link>
        {isExpanded && !isMobileOpen && (
          <button
            onClick={() => setIsLockedExpanded(!isLockedExpanded)}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-sidebar-hover hover:text-white"
          >
            <ChevronLeft size={18} className={cn('transition-transform', !isLockedExpanded && 'rotate-180')} />
          </button>
        )}
      </div>

      <nav className={cn('no-scrollbar mt-4 flex-1 overflow-y-auto', isExpanded ? 'space-y-2 px-4' : 'space-y-3 px-3')}>
        {visibleNavTree.map((node, index) => (
          <React.Fragment key={node.id}>
            {!isExpanded && index !== 0 && <div className="mx-auto h-px w-8 bg-slate-700/40" />}
            {isExpanded ? renderExpandedNode(node) : renderCollapsedNode(node)}
          </React.Fragment>
        ))}
      </nav>

      <div className={cn('shrink-0 border-t border-slate-700/50 bg-sidebar transition-all duration-300', !isExpanded ? 'p-3' : 'p-4')}>
        <div className={cn('flex items-center gap-2', !isExpanded ? 'flex-col' : 'justify-between')}>
          <Link
            to="/settings/account"
            onClick={closeMobile}
            className={cn(
              'group relative flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl transition-all hover:bg-sidebar-hover/50',
              !isExpanded ? 'justify-center p-2' : 'p-2'
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-400 transition-all group-hover:text-accent">
              <Settings size={18} />
            </div>
            {isExpanded && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold uppercase tracking-wider text-white">Impostazioni</p>
              </div>
            )}
          </Link>

          <button
            onClick={onLogout}
            title="Esci dal sistema"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition-all hover:bg-red-500/20"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'no-scrollbar sticky top-0 z-20 hidden h-screen shrink-0 flex-col border-r border-white/5 bg-sidebar text-slate-300 transition-all duration-300 ease-in-out lg:flex',
          isExpanded ? 'w-64' : 'w-20'
        )}
      >
        {navContent}
      </aside>

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar lg:hidden"
            >
              {navContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
