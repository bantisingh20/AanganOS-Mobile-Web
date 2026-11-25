import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MenuNode } from '@shared/api/menu';
import { menuIcon } from '@shared/components/menuIcons';
import { cn } from '@shared/lib/utils';

export interface SidebarNavProps {
  items: MenuNode[];
  currentPath: string;
  onNavigate: (route: string) => void;
  collapsed?: boolean;
}

function isActive(route: string | null, currentPath: string): boolean {
  if (!route) return false;
  const norm = route.startsWith('/') ? route : `/${route}`;
  if (norm === '/') return currentPath === '/';
  return currentPath === norm || currentPath.startsWith(`${norm}/`);
}

function anyChildActive(node: MenuNode, currentPath: string): boolean {
  return node.children.some((c) => isActive(c.route, currentPath) || anyChildActive(c, currentPath));
}

function isGroup(node: MenuNode): boolean {
  return !node.route && node.children.length > 0;
}

export function SidebarNav({ items, currentPath, onNavigate, collapsed = false }: SidebarNavProps) {
  const { t } = useTranslation();

  if (collapsed) {
    return (
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5 scrollbar-thin">
        {items.map((node, idx) => (
          <div key={node.key} className="flex flex-col gap-1">
            {idx > 0 && <div className="my-1 border-t border-slate-200/80 dark:border-slate-800" />}
            {isGroup(node)
              ? node.children.map((child) => (
                  <NavRow key={child.key} node={child} currentPath={currentPath} onNavigate={onNavigate} collapsed depth={0} />
                ))
              : (
                  <NavRow key={node.key} node={node} currentPath={currentPath} onNavigate={onNavigate} collapsed depth={0} />
                )}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2 scrollbar-thin">
      {items.map((node) =>
        isGroup(node) ? (
          <div key={node.key} className="mb-1.5">
            <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400/90 dark:text-slate-500">
              {t(`menu.${node.key}`, { defaultValue: node.label })}
            </div>
            <div className="flex flex-col gap-0.5">
              {node.children.map((child) => (
                <NavRow key={child.key} node={child} currentPath={currentPath} onNavigate={onNavigate} collapsed={false} depth={0} />
              ))}
            </div>
          </div>
        ) : (
          <NavRow key={node.key} node={node} currentPath={currentPath} onNavigate={onNavigate} collapsed={false} depth={0} />
        )
      )}
    </nav>
  );
}

function NavRow({
  node,
  currentPath,
  onNavigate,
  collapsed,
  depth,
}: {
  node: MenuNode;
  currentPath: string;
  onNavigate: (route: string) => void;
  collapsed: boolean;
  depth: number;
}) {
  const { t } = useTranslation();
  const hasChildren = node.children.length > 0;
  const active = isActive(node.route, currentPath);
  const [open, setOpen] = useState(() => anyChildActive(node, currentPath));
  const Icon = menuIcon(node.icon);
  const label = t(`menu.${node.key}`, { defaultValue: node.label });

  const onClick = () => {
    if (hasChildren && !node.route) {
      setOpen((o) => !o);
      return;
    }
    if (node.route) onNavigate(node.route);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={cn(
          'group relative flex items-center transition-colors font-medium text-xs rounded-[4px]',
          collapsed
            ? 'h-8.5 w-8.5 mx-auto justify-center'
            : cn('w-full gap-2.5 px-2.5', depth > 0 ? 'h-7.5 text-[11.5px]' : 'h-8 text-xs'),
          active
            ? 'bg-emerald-600 text-white font-semibold shadow-xs'
            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
        )}
      >
        <Icon className={cn('shrink-0', depth > 0 ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        {!collapsed && <span className="flex-1 truncate text-left">{label}</span>}
        {!collapsed && hasChildren && !node.route && (
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200', open && 'rotate-180')} />
        )}
      </button>

      {hasChildren && open && !collapsed && (
        <div className="ml-3.5 mt-0.5 flex flex-col gap-0.5 border-l border-slate-200/80 pl-2 dark:border-slate-800">
          {node.children.map((child) => (
            <NavRow key={child.key} node={child} currentPath={currentPath} onNavigate={onNavigate} collapsed={collapsed} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}
