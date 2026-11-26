import { useMemo, useState } from 'react';
import { Database, Plus, Pencil, Trash2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { masterData, menuItems } from '@shared/services';
import type { MasterDataEntry } from '@shared/api/masterData';
import type { MenuItem } from '@shared/api/menuItems';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import { AddMasterEntryDialog, MenuItemDialog } from './master/MasterDataDialogs';

export function MasterDataMenuPage() {
  const [activeTab, setActiveTab] = useState<'master' | 'menu'>('master');

  // Master Data state
  const [selectedKey, setSelectedKey] = useState<string>('Resident_Type');
  const [masterDialogState, setMasterDialogState] = useState<{
    open: boolean;
    initialCode?: string;
    initialLabel?: string;
    initialSortOrder?: string;
    initialIsActive?: boolean;
  }>({ open: false });
  const [masterReloadKey, setMasterReloadKey] = useState(0);

  // Menu items state
  const [menuSurface, setMenuSurface] = useState<string>('all');
  const [menuDialogState, setMenuDialogState] = useState<{
    open: boolean;
    item: MenuItem | null;
  }>({ open: false, item: null });
  const [menuReloadKey, setMenuReloadKey] = useState(0);

  // 1. Load Master Keys from Backend
  const keysQuery = useAsync(() => masterData.listKeys().catch(() => ['Resident_Type', 'Unit_Type', 'Ticket_Category']), [masterReloadKey]);
  const keys = keysQuery.data ?? ['Resident_Type'];

  // 2. Load Master Entries for selectedKey
  const entriesQuery = useAsync(
    () => (selectedKey ? masterData.list(selectedKey, null) : Promise.resolve([] as MasterDataEntry[])),
    [selectedKey, masterReloadKey]
  );
  const masterEntries = entriesQuery.data ?? [];

  // 3. Load Menu Items from Backend
  const menuQuery = useAsync(
    () => menuItems.list(menuSurface === 'all' ? undefined : menuSurface).catch(() => [] as MenuItem[]),
    [menuSurface, menuReloadKey]
  );
  const menuList = useMemo(() => {
    return [...(menuQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [menuQuery.data]);

  const deleteMenuItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await menuItems.remove(id);
      toast.success('Menu item removed');
      setMenuReloadKey((r) => r + 1);
    } catch (err) { toast.error(toFormError(err).message); }
  };

  return (
    <div className="space-y-3.5 p-4 sm:p-6">
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <span>Master & Menus Configuration</span>
          </h1>
          <p className="text-xs text-muted-foreground">Manage platform reference master data and navigation menus using backend keys.</p>
        </div>

        <div className="flex items-center gap-1 rounded-[4px] bg-muted/60 p-1 border border-border/70 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('master')}
            className={`px-3 py-1 text-xs font-bold rounded-[3px] transition-colors ${activeTab === 'master' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'}`}
          >
            Master Data
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className={`px-3 py-1 text-xs font-bold rounded-[3px] transition-colors ${activeTab === 'menu' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'}`}
          >
            Menus & Tiles
          </button>
        </div>
      </div>

      {/* MASTER DATA VIEW */}
      {activeTab === 'master' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Select Master List:</span>
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger className="h-8 min-w-[200px] text-xs rounded-[4px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {keys.map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setMasterDialogState({ open: true })}
                className="h-8 rounded-[4px] px-3 text-xs font-semibold"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Master Entry
              </Button>
              <Button type="button" variant="outline" onClick={() => setMasterReloadKey((r) => r + 1)} className="h-8 w-8 p-0 rounded-[4px]">
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-card overflow-hidden shadow-xs">
            <Table>
              <THead>
                <TR>
                  <TH className="py-2 px-3 text-xs">Code (System Key)</TH>
                  <TH className="py-2 px-3 text-xs">Display Label</TH>
                  <TH className="py-2 px-3 text-xs">Sort Order</TH>
                  <TH className="py-2 px-3 text-xs">Status</TH>
                  <TH className="py-2 px-3 text-right text-xs">Action</TH>
                </TR>
              </THead>
              <TBody>
                {masterEntries.map((e) => (
                  <TR key={e.code}>
                    <TD className="py-2 px-3 text-xs font-mono font-semibold">{e.code}</TD>
                    <TD className="py-2 px-3 text-xs font-medium text-foreground">{e.label}</TD>
                    <TD className="py-2 px-3 text-xs tabular-nums text-muted-foreground">{e.sortOrder}</TD>
                    <TD className="py-2 px-3">
                      <Badge tone={e.isActive ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 rounded-[3px]">
                        {e.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TD>
                    <TD className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setMasterDialogState({
                            open: true,
                            initialCode: e.code,
                            initialLabel: e.label,
                            initialSortOrder: String(e.sortOrder),
                            initialIsActive: e.isActive,
                          });
                        }}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Edit
                      </button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      )}

      {/* MENUS VIEW */}
      {activeTab === 'menu' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Filter Surface:</span>
              <Select value={menuSurface} onValueChange={setMenuSurface}>
                <SelectTrigger className="h-8 w-36 text-xs rounded-[4px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Surfaces</SelectItem>
                  <SelectItem value="0">Admin Web (0)</SelectItem>
                  <SelectItem value="1">Mobile App (1)</SelectItem>
                  <SelectItem value="2">Gate / Staff (2)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setMenuDialogState({ open: true, item: null })}
                className="h-8 rounded-[4px] px-3 text-xs font-semibold"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Menu Item
              </Button>
              <Button type="button" variant="outline" onClick={() => setMenuReloadKey((r) => r + 1)} className="h-8 w-8 p-0 rounded-[4px]">
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-card overflow-hidden shadow-xs">
            <Table>
              <THead>
                <TR>
                  <TH className="py-2 px-3 text-xs">Menu Key</TH>
                  <TH className="py-2 px-3 text-xs">Label</TH>
                  <TH className="py-2 px-3 text-xs">Icon</TH>
                  <TH className="py-2 px-3 text-xs">Route</TH>
                  <TH className="py-2 px-3 text-xs">Surface</TH>
                  <TH className="py-2 px-3 text-xs">Sidebar</TH>
                  <TH className="py-2 px-3 text-xs">Status</TH>
                  <TH className="py-2 px-3 text-right text-xs">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {menuList.map((m) => (
                  <TR key={m.id}>
                    <TD className="py-2 px-3 text-xs font-mono font-semibold">{m.key}</TD>
                    <TD className="py-2 px-3 text-xs font-medium text-foreground">{m.label}</TD>
                    <TD className="py-2 px-3 text-xs text-muted-foreground font-mono">{m.icon || '—'}</TD>
                    <TD className="py-2 px-3 text-xs text-muted-foreground font-mono">{m.route || '—'}</TD>
                    <TD className="py-2 px-3 text-xs">
                      <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded-[3px]">
                        {m.surface === 0 ? 'Admin' : m.surface === 1 ? 'Mobile' : 'Staff'}
                      </Badge>
                    </TD>
                    <TD className="py-2 px-3 text-xs">
                      {m.showInSidebar ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                    </TD>
                    <TD className="py-2 px-3">
                      <Badge tone={m.isActive ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 rounded-[3px]">
                        {m.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TD>
                    <TD className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setMenuDialogState({ open: true, item: m })}
                          className="h-7 w-7 flex items-center justify-center rounded-[3px] border border-border hover:bg-muted text-muted-foreground"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMenuItem(m.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-[3px] border border-rose-200 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      )}

      {/* Add Master Data Entry Dialog */}
      {masterDialogState.open ? (
        <AddMasterEntryDialog
          open={masterDialogState.open}
          listKey={selectedKey}
          initialCode={masterDialogState.initialCode}
          initialLabel={masterDialogState.initialLabel}
          initialSortOrder={masterDialogState.initialSortOrder}
          initialIsActive={masterDialogState.initialIsActive}
          onClose={() => setMasterDialogState({ open: false })}
          onSaved={(savedKey) => {
            setSelectedKey(savedKey);
            setMasterReloadKey((r) => r + 1);
          }}
        />
      ) : null}

      {/* Add / Edit Menu Item Dialog */}
      {menuDialogState.open ? (
        <MenuItemDialog
          open={menuDialogState.open}
          item={menuDialogState.item}
          onClose={() => setMenuDialogState({ open: false, item: null })}
          onSaved={() => setMenuReloadKey((r) => r + 1)}
        />
      ) : null}
    </div>
  );
}

export default MasterDataMenuPage;
