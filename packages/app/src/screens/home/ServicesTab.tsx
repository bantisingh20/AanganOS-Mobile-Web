import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMenu } from '@shared/lib/useMenu';
import { menuIcon } from '@shared/components/menuIcons';
import type { MenuNode } from '@shared/api/menu';

function flattenLeaves(nodes: MenuNode[]): MenuNode[] {
  const out: MenuNode[] = [];
  for (const n of nodes) {
    const route = (n.route ?? '').toLowerCase().replace(/^\/+/, '');
    // Exclude home/dashboard routes as they belong to the Home tab
    if (route === '' || route === 'home') continue;
    if (n.route) out.push(n);
    if (n.children && n.children.length > 0) out.push(...flattenLeaves(n.children));
  }
  return out;
}

export function ServicesTab(_props?: { unreadCount?: number; onNotifications?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items: menuTree, loading } = useMenu();

  const sections = useMemo(() => {
    const list: { id: string; title: string; items: MenuNode[] }[] = [];
    const ungrouped: MenuNode[] = [];

    for (const node of menuTree) {
      if (node.children && node.children.length > 0) {
        const leaves = flattenLeaves(node.children);
        if (leaves.length > 0) {
          list.push({
            id: node.key,
            title: t(`menu.${node.key}`, { defaultValue: node.label }),
            items: leaves,
          });
        }
      } else if (node.route) {
        const route = (node.route ?? '').toLowerCase().replace(/^\/+/, '');
        if (route !== '' && route !== 'home') {
          ungrouped.push(node);
        }
      }
    }

    if (ungrouped.length > 0) {
      list.unshift({
        id: 'main',
        title: t('services.groupMain', { defaultValue: 'Society Services' }),
        items: ungrouped,
      });
    }

    return list;
  }, [menuTree, t]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="flex flex-col gap-6 px-4 py-4 sm:px-6">
        {loading && sections.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground font-medium">
            {t('common.loading', 'Loading services…')}
          </div>
        ) : sections.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground font-medium">
            No services accessible for your role.
          </div>
        ) : null}

        {sections.map((section) => (
          <section key={section.id}>
            <h2 className="mb-3 ml-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {section.items.map((item) => {
                const Icon = menuIcon(item.icon);
                const itemSub = t(`menu.${item.key}Sub`, { defaultValue: '' });
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      if (item.route) {
                        const target = item.route.startsWith('/') ? item.route : `/${item.route}`;
                        navigate(target);
                      }
                    }}
                    className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-2xs transition-all hover:border-primary/50 hover:shadow-xs active:scale-[0.98]"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="block text-[14px] font-bold leading-tight text-foreground truncate">
                      {t(`menu.${item.key}`, { defaultValue: item.label })}
                    </span>
                    {itemSub ? (
                      <span className="line-clamp-1 block text-[11px] text-muted-foreground">
                        {itemSub}
                      </span>
                    ) : null}
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

export default ServicesTab;
