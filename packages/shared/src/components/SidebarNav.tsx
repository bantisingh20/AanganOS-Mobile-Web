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

function flattenLeaves(nodes: MenuNode[]): MenuNode[] {
  const out: MenuNode[] = [];
  for (const n of nodes) {
    if (n.route) out.push(n);
    if (n.children.length > 0) out.push(...flattenLeaves(n.children));
  }
  return out;
}

export function SidebarNav({ items, currentPath, onNavigate, collapsed = false }: SidebarNavProps) {
  const { t } = useTranslation();

  if (collapsed) {
    return (
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {flattenLeaves(items).map((node) => (
          <NavRow key={node.key} node={node} currentPath={currentPath} onNavigate={onNavigate} collapsed depth={0} />
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
      {items.map((node) =>
        isGroup(node) ? (
          <div key={node.key} className="mb-1">
            <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t(`menu.${node.key}`, { defaultValue: node.label })}
            </div>
            {node.children.map((child) => (
              <NavRow key={child.key} node={child} currentPath={currentPath} onNavigate={onNavigate} collapsed={false} depth={0} />
            ))}
          </div>
        ) : (
          <NavRow key={node.key} node={node} currentPath={currentPath} onNavigate={onNavigate} collapsed={false} depth={0} />
        ),
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
          'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all sm:text-[13px]',
          collapsed ? 'justify-center px-0' : '',
          depth > 0 && !collapsed ? 'ml-3' : '',
          active
            ? 'bg-[#05b872] text-white shadow-sm shadow-[#05b872]/25'
            : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#111928] dark:hover:text-slate-100',
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed ? <span className="flex-1 truncate text-left">{label}</span> : null}
        {!collapsed && hasChildren && !node.route ? (
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open ? 'rotate-180' : '')} />
        ) : null}
      </button>
      {hasChildren && open && !collapsed
        ? node.children.map((child) => (
            <NavRow key={child.key} node={child} currentPath={currentPath} onNavigate={onNavigate} collapsed={collapsed} depth={depth + 1} />
          ))
        : null}
    </>
  );
}
