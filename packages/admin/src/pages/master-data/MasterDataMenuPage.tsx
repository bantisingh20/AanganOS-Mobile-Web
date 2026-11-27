import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Database, Plus, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { PageShell, FilterBar, DataList, ResponsiveTabs, filterControlClass, type FilterLayout } from '@shared/components/layout';
import { masterData, menuItems } from '@shared/services';
import type { MasterDataEntry } from '@shared/api/masterData';
import type { MenuItem } from '@shared/api/menuItems';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';
import { tryToast } from '@shared/lib/withToast';
import { EMPTY } from '@shared/lib/format';
import { AddMasterEntryDialog, MenuItemDialog } from './MasterDataDialogs';

export function MasterDataMenuPage() {
  const { t } = useTranslation();
  const compact = useIsCompact();
  // /master-menu opens the Menus & Tiles tab, /master-data the Master Data tab (two sidebar menus,
  // one page). Re-sync when the user switches between the two menus while the page stays mounted.
  const { pathname } = useLocation();
  const tabForPath = pathname.startsWith('/master-menu') ? 'menu' : 'master';
  const [activeTab, setActiveTab] = useState<'master' | 'menu'>(tabForPath);
  useEffect(() => { setActiveTab(tabForPath); }, [tabForPath]);

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  const deleteMenuItem = async () => {
    if (!confirmDeleteId || deleteBusy) return;
    const id = confirmDeleteId;
    setDeleteBusy(true);
    try {
      if (await tryToast(() => menuItems.remove(id), 'Menu item removed')) {
        setConfirmDeleteId(null);
        setMenuReloadKey((r) => r + 1);
      }
    } finally { setDeleteBusy(false); }
  };

  const editMaster = (e: MasterDataEntry) => {
    setMasterDialogState({
      open: true,
      initialCode: e.code,
      initialLabel: e.label,
      initialSortOrder: String(e.sortOrder),
      initialIsActive: e.isActive,
    });
  };

  const surfaceLabel = (s: number) => (s === 0 ? 'Admin' : s === 1 ? 'Mobile' : 'Staff');
  const actionSize = compact ? 'h-9 w-9 rounded-lg' : 'h-7 w-7 rounded-[3px]';
  const actionIcon = compact ? 'h-4 w-4' : 'h-3 w-3';
  const toolbarBtn = compact ? 'h-9 rounded-lg px-3 text-sm font-semibold' : 'h-8 rounded-[4px] px-3 text-xs font-semibold';

  const menuActions = (m: MenuItem) => (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setMenuDialogState({ open: true, item: m })}
        className={cn('flex items-center justify-center border border-border hover:bg-muted text-muted-foreground', actionSize)}
      >
        <Pencil className={actionIcon} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDeleteId(m.id)}
        className={cn('flex items-center justify-center border border-rose-200 text-rose-600 hover:bg-rose-50', actionSize)}
      >
        <Trash2 className={actionIcon} />
      </button>
    </div>
  );

  return (
    <PageShell
      className="space-y-3.5 sm:p-6"
      title="Master & Menus Configuration"
      subtitle="Manage platform reference master data and navigation menus using backend keys."
      icon={<Database />}
    >
      <ResponsiveTabs
        tabs={[{ key: 'master', label: 'Master Data' }, { key: 'menu', label: 'Menus & Tiles' }]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* MASTER DATA VIEW */}
      {activeTab === 'master' && (
        <div className="space-y-3">
          <FilterBar
            filters={(layout: FilterLayout) => (
              <div className={cn('flex gap-2', layout === 'sheet' ? 'flex-col gap-1' : 'items-center')}>
                <span className="text-xs font-semibold text-foreground">Select Master List:</span>
                <Select value={selectedKey} onValueChange={setSelectedKey}>
                  <SelectTrigger className={filterControlClass(layout, 'min-w-[200px]')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {keys.map((k) => (
                      <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            trailing={(
              <>
                {compact ? <span className="min-w-0 truncate font-mono text-xs font-semibold text-foreground">{selectedKey}</span> : null}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setMasterDialogState({ open: true })}
                    className={toolbarBtn}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Master Entry
                  </Button>
                  <RefreshButton onClick={() => setMasterReloadKey((r) => r + 1)} loading={entriesQuery.loading} />
                </div>
              </>
            )}
          />

          <DataList
            items={masterEntries}
            keyOf={(e) => e.code}
            loading={entriesQuery.loading}
            emptyText="No entries found"
            renderCard={(e) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{e.label}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="truncate font-mono font-semibold">{e.code}</span>
                    <span className="tabular-nums">Sort {e.sortOrder}</span>
                    <Badge tone={e.isActive ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 rounded-[3px]">
                      {e.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => editMaster(e)}
                  aria-label={t('common.edit')}
                  className={cn('flex shrink-0 items-center justify-center border border-border hover:bg-muted text-primary', actionSize)}
                >
                  <Pencil className={actionIcon} />
                </button>
              </div>
            )}
            renderTable={() => (
              <Table>
                <THead>
                  <TR>
                    <TH className="py-2 px-3 text-xs">Code (System Key)</TH>
                    <TH className="py-2 px-3 text-xs">Display Label</TH>
                    <TH className="py-2 px-3 text-xs">Sort Order</TH>
                    <TH className="py-2 px-3 text-xs">Status</TH>
                    <TH className="py-2 px-3 text-right text-xs">{t('common.actions')}</TH>
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
                          onClick={() => editMaster(e)}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          {t('common.edit')}
                        </button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          />
        </div>
      )}

      {/* MENUS VIEW */}
      {activeTab === 'menu' && (
        <div className="space-y-3">
          <FilterBar
            filters={(layout: FilterLayout) => (
              <div className={cn('flex gap-2', layout === 'sheet' ? 'flex-col gap-1' : 'items-center')}>
                <span className="text-xs font-semibold text-foreground">Filter Surface:</span>
                <Select value={menuSurface} onValueChange={setMenuSurface}>
                  <SelectTrigger className={filterControlClass(layout, 'w-36')}>
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
            )}
            activeCount={menuSurface !== 'all' ? 1 : 0}
            onReset={() => setMenuSurface('all')}
            trailing={(
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => setMenuDialogState({ open: true, item: null })}
                  className={toolbarBtn}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Menu Item
                </Button>
                <RefreshButton onClick={() => { menuItems.invalidate(); setMenuReloadKey((r) => r + 1); }} loading={menuQuery.loading} />
              </div>
            )}
          />

          <DataList
            items={menuList}
            keyOf={(m) => m.id}
            loading={menuQuery.loading}
            emptyText="No menu items found"
            renderCard={(m) => (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{m.label}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{m.key}</div>
                  </div>
                  {menuActions(m)}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="truncate font-mono">{m.route || EMPTY}</span>
                  <span className="font-mono">{m.icon || EMPTY}</span>
                  <span className="flex items-center gap-1">
                    {m.showInSidebar ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                    Sidebar
                  </span>
                  <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded-[3px]">{surfaceLabel(m.surface)}</Badge>
                  <Badge tone={m.isActive ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 rounded-[3px]">
                    {m.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </>
            )}
            renderTable={() => (
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
                    <TH className="py-2 px-3 text-right text-xs">{t('common.actions')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {menuList.map((m) => (
                    <TR key={m.id}>
                      <TD className="py-2 px-3 text-xs font-mono font-semibold">{m.key}</TD>
                      <TD className="py-2 px-3 text-xs font-medium text-foreground">{m.label}</TD>
                      <TD className="py-2 px-3 text-xs text-muted-foreground font-mono">{m.icon || EMPTY}</TD>
                      <TD className="py-2 px-3 text-xs text-muted-foreground font-mono">{m.route || EMPTY}</TD>
                      <TD className="py-2 px-3 text-xs">
                        <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded-[3px]">
                          {surfaceLabel(m.surface)}
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
                      <TD className="py-2 px-3 text-right">{menuActions(m)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        tone="danger"
        busy={deleteBusy}
        title="Are you sure you want to delete this menu item?"
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => void deleteMenuItem()}
        onClose={() => { if (!deleteBusy) setConfirmDeleteId(null); }}
      />

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
    </PageShell>
  );
}

export default MasterDataMenuPage;
