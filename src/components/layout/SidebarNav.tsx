import { useState } from 'react';
import { NavLink } from 'react-router';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Database,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Lightbulb,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DOMAINS } from '@/data/domains';
import type { LucideIcon } from 'lucide-react';

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  'clinical-outcome': Activity,
  'patient-safety': ShieldAlert,
  'financial-efficiency': Wallet,
  'operational-efficiency': Gauge,
  'hr-development': GraduationCap,
};

interface SidebarNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SidebarNav({ collapsed, onToggle }: SidebarNavProps) {
  const [offlineReady] = useState(true);

  const linkClass = (isActive: boolean) =>
    cn(
      'group relative flex h-11 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition-colors duration-150',
      isActive
        ? 'text-[var(--dcl-ink-900)]'
        : 'text-[var(--dcl-ink-500)] hover:text-[var(--dcl-ink-900)] hover:bg-white/70',
    );

  const activeStyle = (isActive: boolean, color: string) =>
    isActive
      ? { backgroundColor: `${color}14`, boxShadow: `inset 3px 0 0 0 ${color}` }
      : undefined;

  const logoSrc = `${import.meta.env.BASE_URL}dcl-logo.svg`;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-[var(--dcl-line)] bg-white/80 backdrop-blur-xl transition-[width] duration-200 ease-out md:flex',
        collapsed ? 'w-[84px]' : 'w-[264px]',
      )}
      aria-label="Primary navigation"
    >
      {/* Logo */}
      <div className={cn('flex h-[72px] items-center gap-3 px-5', collapsed && 'justify-center px-0')}>
        <img src={logoSrc} alt="DCL Pulse logo" className="h-9 w-9 shrink-0 rounded-[10px]" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-display text-[17px] font-bold tracking-[-0.02em] text-[var(--dcl-ink-900)]">DCL Pulse</p>
            <p className="truncate text-[11px] font-medium text-[var(--dcl-ink-400)]">Hospital Performance</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn('flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-3', collapsed && 'items-center px-3')}>
        <NavLink to="/" end className={({ isActive }) => linkClass(isActive)} style={({ isActive }) => activeStyle(isActive, '#007AFF')}>
          <LayoutDashboard className="h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
          {!collapsed && <span>Overview</span>}
        </NavLink>

        {!collapsed && (
          <p className="px-3 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--dcl-ink-400)]">
            Domains
          </p>
        )}
        {collapsed && <div className="my-2 h-px w-8 bg-[var(--dcl-line)]" />}

        {DOMAINS.map((d) => {
          const Icon = DOMAIN_ICONS[d.id] ?? Activity;
          return (
            <NavLink
              key={d.id}
              to={d.route}
              className={({ isActive }) => linkClass(isActive)}
              style={({ isActive }) => activeStyle(isActive, d.color)}
              title={collapsed ? d.name : undefined}
            >
              <span style={{ color: d.color }} className="flex shrink-0">
                <Icon className="h-[18px] w-[18px] transition-transform duration-150 group-hover:translate-x-0.5" />
              </span>
              {!collapsed && <span>{d.name.replace(' Efficiency', '').replace(' Outcome', '')}</span>}
            </NavLink>
          );
        })}

        {!collapsed && (
          <p className="px-3 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--dcl-ink-400)]">
            System
          </p>
        )}
        {collapsed && <div className="my-2 h-px w-8 bg-[var(--dcl-line)]" />}

        <NavLink to="/data" className={({ isActive }) => linkClass(isActive)} style={({ isActive }) => activeStyle(isActive, '#007AFF')} title={collapsed ? 'Data' : undefined}>
          <Database className="h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
          {!collapsed && <span>Data</span>}
        </NavLink>
        <NavLink to="/insights" className={({ isActive }) => linkClass(isActive)} style={({ isActive }) => activeStyle(isActive, '#007AFF')} title={collapsed ? 'Insights' : undefined}>
          <Lightbulb className="h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
          {!collapsed && <span>Insights</span>}
        </NavLink>
      </nav>

      {/* Footer: offline pill + collapse */}
      <div className={cn('flex flex-col gap-2 border-t border-[var(--dcl-line)] p-4', collapsed && 'items-center')}>
        <div
          className={cn(
            'flex items-center gap-2 rounded-full border border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] px-3 py-1.5 text-[11px] font-medium text-[var(--dcl-ink-500)]',
            collapsed && 'px-2',
          )}
          title={offlineReady ? 'Offline ready' : 'Sync needed'}
        >
          <span className={cn('h-2 w-2 rounded-full', offlineReady ? 'bg-[#34C759]' : 'bg-[#FFCC00]')} />
          {!collapsed && <span>{offlineReady ? 'Offline ready' : 'Sync needed'}</span>}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--dcl-line)] text-[12px] font-medium text-[var(--dcl-ink-500)] transition-colors hover:bg-[var(--dcl-surface-tint)] hover:text-[var(--dcl-ink-900)]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

/** Mobile bottom tab bar */
export function MobileTabBar() {
  const tabs = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/domains/clinical-outcome', label: 'Clinical', icon: Activity },
    { to: '/domains/patient-safety', label: 'Safety', icon: ShieldAlert },
    { to: '/data', label: 'Data', icon: Database },
    { to: '/insights', label: 'Insights', icon: Lightbulb },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-[var(--dcl-line)] bg-white/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile navigation"
    >
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium',
              isActive ? 'text-[#007AFF]' : 'text-[var(--dcl-ink-400)]',
            )
          }
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function SidebarNavAnimated(props: SidebarNavProps) {
  return (
    <motion.div initial={false}>
      <SidebarNav {...props} />
    </motion.div>
  );
}
