import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';

/**
 * Sticky frosted top bar holding the global filters.
 * 72px high, backdrop blur, z-40 (design.md section 5).
 */
export function TopBar() {
  return (
    <header className="sticky top-0 z-40 flex min-h-[72px] items-center border-b border-[var(--dcl-line)] bg-[rgba(245,247,251,0.75)] px-4 py-3 backdrop-blur-[18px] md:px-6">
      <GlobalFilterBar />
    </header>
  );
}
