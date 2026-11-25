import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building, Plus, Pencil, Trash2, Search, RefreshCw, Home, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { CommunityFormDialog } from './communities/CommunityFormDialog';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { communities } from '@shared/services';
import type { Community } from '@shared/api/communities';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';

export function CommunitiesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgFilter = searchParams.get('organizationId') ?? undefined;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Community | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Community | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const query = useAsync(
    (signal) => communities.list(
      { search: search.trim() || undefined, page, pageSize },
      { ...(orgFilter ? { organizationId: orgFilter } : {}) },
      { signal },
    ).catch(() => null),
    [search, orgFilter, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const reload = () => setReloadKey((k) => k + 1);

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await communities.remove(confirmDelete.id);
      toast.success(t('communities.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const openUnits = (c: Community) => navigate(`/units?communityId=${c.id}&communityName=${encodeURIComponent(c.name)}`);

  return (
    <div className="w-full space-y-2">
      {/* Page Header: Compact Title & Action Button */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <Building className="h-3.5 w-3.5 text-primary" />
            {t('communities.title')}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {t('communities.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="h-7 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium"
          >
            <Plus className="h-3 w-3 stroke-[2.5]" />
            {t('communities.add')}
          </Button>
        </div>
      </div>

      {/* Scoped Organization Filter Alert if active */}
      {orgFilter && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px]">
          <span className="font-medium text-foreground">{t('communities.filteredByOrg')}</span>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="flex items-center gap-1 font-semibold text-primary hover:underline text-[11px]"
          >
            <X className="h-3 w-3" />
            {t('communities.clearFilter')}
          </button>
        </div>
      )}

      {/* Filter Bar: Clean Alignment & Compact Sizing */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="relative min-w-[140px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('communities.searchPlaceholder')}
              className="h-7.5 w-full rounded-md pl-7 pr-2 text-[11px] bg-background"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">
            {t('orgs.total')}: <span className="font-semibold text-foreground">{query.data?.totalCount ?? 0}</span>
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reload}
            aria-label="Refresh"
            className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80"
          >
            <RefreshCw className={cn('h-3 w-3', query.loading && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      {/* Communities Container: Table on Desktop/Tablet, Clean Compact Cards on Mobile */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {query.loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />
            {t('common.loading')}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Building className="h-6 w-6 text-muted-foreground/50 mb-1.5" />
            <p className="text-xs font-semibold text-foreground">{t('communities.empty')}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Create your first community to begin managing units and residents.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View: Compact Cards (hidden on md and up) */}
            <div className="divide-y divide-border/60 md:hidden">
              {items.map((c, i) => (
                <div key={c.id} className="p-2.5 flex flex-col gap-2 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <Building className="h-3 w-3" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-foreground truncate">{c.name}</span>
                          <span className="font-mono text-[9px] text-muted-foreground">#{(page - 1) * pageSize + i + 1}</span>
                        </div>
                        <span className="block truncate text-[11px] text-muted-foreground">{c.organizationName ?? '—'}</span>
                      </div>
                    </div>

                    <Badge tone="success" className="text-[10px] px-1.5 py-0 rounded shrink-0">
                      <span className="h-1 w-1 rounded-full bg-emerald-500 mr-1" />
                      {t('communities.active')}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => openUnits(c)}
                      className="inline-flex items-center gap-1 rounded-[3px] border border-border/80 bg-muted/50 px-2 py-0.5 text-[10.5px] font-medium text-foreground hover:bg-accent"
                    >
                      <Home className="h-3 w-3 text-primary" />
                      {t('communities.manageUnits')}
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        title={t('communities.edit')}
                        className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(c)}
                        title={t('communities.delete')}
                        className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / Tablet View: Compact Table (hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <THead>
                  <TR className="border-b border-border bg-muted/40">
                    <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('communities.colName')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('communities.colOrganization')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('communities.colStatus')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('communities.colUnits')}</TH>
                    <TH className="w-16 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('orgs.colActions')}</TH>
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
                            <span className="font-semibold text-xs text-foreground leading-none">{c.name}</span>
                            <span className="block font-mono text-[9px] text-muted-foreground leading-none mt-0.5">ID: {c.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </TD>
                      <TD className="py-1 px-2 text-xs text-muted-foreground">{c.organizationName ?? '—'}</TD>
                      <TD className="py-1 px-2">
                        <Badge tone="success" className="text-[10px] px-1.5 py-0 rounded">
                          <span className="h-1 w-1 rounded-full bg-emerald-500 mr-1" />
                          {t('communities.active')}
                        </Badge>
                      </TD>
                      <TD className="py-1 px-2">
                        <button
                          type="button"
                          onClick={() => openUnits(c)}
                          className="inline-flex items-center gap-1 rounded-[3px] border border-border/80 bg-muted/50 px-2 py-0.5 text-[10.5px] font-medium text-foreground hover:bg-accent"
                        >
                          <Home className="h-3 w-3 text-primary" />
                          {t('communities.manageUnits')}
                        </button>
                      </TD>
                      <TD className="py-1 px-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(c)}
                            title={t('communities.edit')}
                            className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(c)}
                            title={t('communities.delete')}
                            className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors"
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
          </>
        )}

        {/* Integrated Pagination Bar */}
        {(query.data?.totalCount ?? 0) > 0 && (
          <div className="border-t border-border px-2.5 py-1 bg-muted/20">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={query.data?.totalCount ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </div>

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
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
