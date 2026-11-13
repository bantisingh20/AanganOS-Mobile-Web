import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDynamicTiles, type TileGroup } from '@shared/lib/appTiles';
import { TopBar } from '@app/components/TopBar';
import { tileIcon } from '@app/lib/tileIcons';

const GROUP_ORDER: { group: TileGroup; titleKey: string }[] = [
  { group: 'myHome', titleKey: 'services.groupMyHome' },
  { group: 'community', titleKey: 'services.groupCommunity' },
  { group: 'security', titleKey: 'services.groupSecurity' },
  { group: 'support', titleKey: 'services.groupSupport' },
];

export function ServicesTab({ unreadCount = 0, onNotifications }: { unreadCount?: number; onNotifications?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { byGroup, loading } = useDynamicTiles();

  const visibleGroups = GROUP_ORDER.map((g) => ({ ...g, items: byGroup(g.group) })).filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <TopBar title={t('services.title')} subtitle={t('services.subtitle')} notificationCount={unreadCount} {...(onNotifications ? { onNotifications } : {})} />
      <div className="flex flex-col gap-6 px-4 py-5">
        {loading && visibleGroups.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : null}
        {visibleGroups.map((group) => (
          <section key={group.group}>
            <h2 className="mb-2 ml-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{t(group.titleKey)}</h2>
            <div className="grid grid-cols-2 gap-3">
              {group.items.map((item) => {
                const Icon = tileIcon(item.icon);
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => navigate(item.route)}
                    className="flex flex-col gap-2 rounded-2xl bg-card p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${item.tint}1f` }}>
                      <Icon className="h-[22px] w-[22px]" style={{ color: item.tint }} />
                    </span>
                    <span className="block text-[15px] font-bold leading-tight">{t(item.labelKey)}</span>
                    <span className="line-clamp-2 block text-xs text-muted-foreground">{t(item.subKey)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
