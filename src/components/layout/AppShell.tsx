import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MobileTabBar, SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';

/**
 * App shell: left sidebar (264px / 84px collapsed), sticky frosted top filter
 * bar, routed content slot, desktop status bar, mobile bottom tab bar.
 * Wraps all routes via nested routes + <Outlet/>.
 */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="relative z-[1] min-h-[100dvh]">
      <SidebarNav collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className={cn('flex min-h-[100dvh] flex-col transition-[margin] duration-200 ease-out', collapsed ? 'md:ml-[84px]' : 'md:ml-[264px]')}>
        <TopBar />

        <main className="mx-auto w-full max-w-[1680px] flex-1 px-3 pb-24 pt-6 md:px-6 md:pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        <StatusBar />
      </div>

      <MobileTabBar />
      {/* ARIA live region announcing route changes */}
      <div aria-live="polite" className="sr-only">
        {document.title}
      </div>
    </div>
  );
}
