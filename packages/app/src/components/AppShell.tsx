import * as React from 'react';
import { Home, LayoutGrid, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@shared/lib/utils';

export type TabKey = 'home' | 'services' | 'profile';

export function AppShell({
  children,
  activeTab,
  onTabChange,
  showTabBar = true,
}: {
  children: React.ReactNode;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  showTabBar?: boolean;
}) {
  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-background">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      {showTabBar ? <BottomTabBar active={activeTab} onChange={onTabChange} /> : null}
    </div>
  );
}

const TABS: { key: TabKey; icon: typeof Home; labelKey: string }[] = [
  { key: 'home', icon: Home, labelKey: 'common.tabHome' },
  { key: 'services', icon: LayoutGrid, labelKey: 'common.tabServices' },
  { key: 'profile', icon: User, labelKey: 'common.tabProfile' },
];

function BottomTabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  const { t } = useTranslation();
  return (
    <nav className="safe-bottom flex shrink-0 items-stretch border-t border-border bg-card" aria-label="Main">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-current={isActive ? 'page' : undefined}
            className="flex flex-1 flex-col items-center gap-1 pb-1.5 pt-2"
          >
            <span className={cn('flex items-center justify-center rounded-full px-3 py-0.5 transition-colors', isActive ? 'bg-accent' : '')}>
              <tab.icon className={cn('h-[22px] w-[22px]', isActive ? 'text-primary' : 'text-muted-foreground')} />
            </span>
            <span className={cn('text-[11px]', isActive ? 'font-bold text-primary' : 'font-medium text-muted-foreground')}>
              {t(tab.labelKey)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
