import { X } from 'lucide-react';
import logoUrl from '@shared/assets/logo.png';
import { SidebarNav } from '@shared/components/SidebarNav';
import type { MenuNode } from '@shared/api/menu';

export interface MenuDrawerProps {
  open: boolean;
  onClose: () => void;
  items: MenuNode[];
  currentPath: string;
  onNavigate: (route: string) => void;
}

export function MenuDrawer({ open, onClose, items, currentPath, onNavigate }: MenuDrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="safe-top safe-bottom absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col bg-card shadow-xl">
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
          <img src={logoUrl} alt="AanganOS" className="h-9 w-9 rounded-xl object-cover" />
          <span className="text-left leading-none">
            <span className="block text-base font-bold tracking-tight">
              <span>Aangan</span><span className="text-primary">OS</span>
            </span>
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarNav
          items={items}
          currentPath={currentPath}
          onNavigate={(route) => { onNavigate(route); onClose(); }}
        />
      </aside>
    </div>
  );
}
