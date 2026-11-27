import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building, Plus, Pencil, Trash2, Home, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { CommunityFormDialog } from './CommunityFormDialog';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { PageShell, FilterBar, DataList } from '@shared/components/layout';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { communities } from '@shared/services';
import type { Community } from '@shared/api/communities';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useListState } from '@shared/lib/hooks/useListState';
import { tryToast } from '@shared/lib/withToast';
import { EMPTY } from '@shared/lib/format';
import { cn } from '@shared/lib/utils';

export function CommunitiesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const compact = useIsCompact();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgFilter = searchParams.get('organizationId') ?? undefined;

  const list = useListState();
  const { search, page, pageSize, reloadKey, reload } = list;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Community | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Community | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const query = useAsync(
    (signal) => communities.list(
      { search: search.trim() || undefined, page, pageSize },
      { ...(orgFilter ? { organizationId: orgFilter } : {}) },
      { signal },
    ).catch(() => null),
    [search, orgFilter, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (await tryToast(() => communities.remove(confirmDelete.id), t('communities.deleted'))) {
        setConfirmDelete(null);
        reload();
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  const openUnits = (c: Community) => navigate(`/units?communityId=${c.id}&communityName=${encodeURIComponent(c.name)}`);

  const total = query.data?.totalCount ?? 0;
  const actionSize = compact ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded-[3px]';
  const iconSize = compact ? 'h-4 w-4' : 'h-3 w-3';

  const renderActions = (c: Community) => (
    <div className="flex items-center justify-end gap-1 shrink-0">
      <button
        type="button"
        onClick={() => setEditing(c)}
        title={t('communities.edit')}
        className={cn('flex items-center justify-center border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors', actionSize)}
      >
        <Pencil className={iconSize} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(c)}
        title={t('communities.delete')}
        className={cn('flex items-center justify-center border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors', actionSize)}
      >
        <Trash2 className={iconSize} />
      </button>
    </div>
  );

  const unitsButton = (c: Community) => (
    <button
      type="button"
      onClick={() => openUnits(c)}
      className={cn('inline-flex items-center gap-1 border border-border/80 bg-muted/50 font-medium text-foreground hover:bg-accent',
        compact ? 'h-9 rounded-lg px-2.5 text-xs' : 'rounded-[3px] px-2 py-0.5 text-[10.5px]')}
    >
      <Home className={cn(iconSize, 'text-primary')} />
      {t('communities.manageUnits')}
    </button>
  );

  const activeBadge = (
    <Badge tone="success" className="text-[10px] px-1.5 py-0 rounded shrink-0">
      <span className="h-1 w-1 rounded-full bg-emerald-500 mr-1" />
      {t('communities.active')}
    </Badge>
  );

  return (
    <PageShell
      className="w-full"
      title={t('communities.title')}
      subtitle={t('communities.subtitle')}
      icon={<Building />}
      actions={(
        <Button
          size="sm"
          onClick={() => setCreating(true)}
          className={cn('gap-1 font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 px-2.5 rounded-[4px] text-[11px]')}
        >
          <Plus className="h-3 w-3 stroke-[2.5]" />
          {t('communities.add')}
        </Button>
      )}
    >
      {/* Scoped Organization Filter Alert if active */}
      {orgFilter && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px]">
          <span className="font-medium text-foreground">{t('communities.filteredByOrg')}</span>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className={cn('flex items-center gap-1 font-semibold text-primary hover:underline text-[11px]', compact && 'min-h-9')}
          >
            <X className="h-3 w-3" />
            {t('communities.clearFilter')}
          </button>
        </div>
      )}

      <FilterBar
        search={{ value: search, onChange: list.setSearch, placeholder: t('communities.searchPlaceholder') }}
        trailing={(
          <>
            <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>
              {t('common.total')}: <span className="font-semibold text-foreground">{total}</span>
            </span>
            <RefreshButton onClick={reload} loading={query.loading} />
          </>
        )}
      />

      <DataList
        items={items}
        keyOf={(c) => c.id}
        loading={query.loading}
        emptyIcon={<Building className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={(
          <>
            {t('communities.empty')}
            <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
              Create your first community to begin managing units and residents.
            </span>
          </>
        )}
        pagination={{ page, pageSize, total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
        renderCard={(c, i) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>{c.code ? <span className="ml-1.5 rounded-[3px] bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">{c.code}</span> : null}
                    <span className="font-mono text-[10px] text-muted-foreground">#{(page - 1) * pageSize + i + 1}</span>
                  </div>
                  <span className="block truncate text-xs text-muted-foreground">{c.organizationName ?? EMPTY}</span>
                </div>
              </div>
              {activeBadge}
            </div>

            <div className="flex items-center justify-between gap-2">
              {unitsButton(c)}
              {renderActions(c)}
            </div>
          </>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR className="border-b border-border bg-muted/40">
                <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('communities.colName')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('communities.colOrganization')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('communities.colStatus')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('communities.colUnits')}</TH>
                <TH className="w-16 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('common.actions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((c, i) => (
                <TR key={c.id} className="hover:bg-muted/30 transition-colors">
                  <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">
                    {(page - 1) * pageSize + i + 1}
                  </TD>
                  <TD className="py-1 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <Building className="h-3 w-3" />
                      </span>
                      <div>
                        <span className="font-semibold text-xs text-foreground leading-none">{c.name}</span>{c.code ? <span className="ml-1.5 rounded-[3px] bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">{c.code}</span> : null}
                        <span className="block font-mono text-[9px] text-muted-foreground leading-none mt-0.5">ID: {c.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </TD>
                  <TD className="py-1 px-2 text-xs text-muted-foreground">{c.organizationName ?? EMPTY}</TD>
                  <TD className="py-1 px-2">{activeBadge}</TD>
                  <TD className="py-1 px-2">{unitsButton(c)}</TD>
                  <TD className="py-1 px-2">{renderActions(c)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />

      <CommunityFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => { setCreating(false); reload(); }}
        {...(orgFilter ? { presetOrgId: orgFilter } : {})}
      />

      <CommunityFormDialog
        open={!!editing}
        community={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('communities.delete')}
        description={confirmDelete ? t('communities.deleteConfirm', { name: confirmDelete.name }) : ''}
        confirmLabel={t('communities.delete')}
        cancelLabel={t('common.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </PageShell>
  );
}
