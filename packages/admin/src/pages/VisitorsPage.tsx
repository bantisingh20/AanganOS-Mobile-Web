import { useMemo, useState } from 'react';
import { DoorOpen, Search, RefreshCw, Table as TableIcon, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@shared/components/ui/card';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { SelectField } from '@shared/components/SelectField';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster } from '@shared/components/ui/sonner';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { gate, masterData, organizations } from '@shared/services';
import type { Visitor } from '@shared/api/gate';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { useScope } from '@shared/lib/useScope';

async function fetchOrgPage(search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> {
  const d = await organizations.list({ search: search || undefined, page, pageSize }, { signal });
  return { items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount };
}
async function resolveOrgLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try { const o = await organizations.get(id, { signal }); return o.name; } catch { return null; }
}

type Option = { value: string; label: string };

const ALL_STATUSES = '__all__';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'default' | 'muted' {
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'entered') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'rejected') return 'danger';
  if (s === 'exited') return 'muted';
  return 'default';
}

export function VisitorsPage() {
  const { t } = useTranslation();
  const scope = useScope();
  const [search, setSearch] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const isSmall = useIsSmallScreen();
  const effectiveView = isSmall ? 'cards' : view;
  const [reloadKey, setReloadKey] = useState(0);

  const statusesQuery = useAsync((signal) => masterData.list('Visitor_Status', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const statusOptions = useMemo<Option[]>(() => (statusesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [statusesQuery.data]);
  const statusLabel = (code: string) => statusOptions.find((o) => o.value === code)?.label ?? code;

  const categoriesQuery = useAsync((signal) => masterData.list('Visitor_Category', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const categoryOptions = useMemo<Option[]>(() => (categoriesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [categoriesQuery.data]);
  const categoryLabel = (code: string) => categoryOptions.find((o) => o.value === code)?.label ?? code;

  const statusFilterOptions = useMemo<Option[]>(() => [{ value: ALL_STATUSES, label: t('visitors.allStatuses') }, ...statusOptions], [statusOptions, t]);

  const effectiveOrgId = filterOrgId ?? undefined;

  const query = useAsync(
    (signal) => gate.listVisitors(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, filterStatus, effectiveOrgId, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;
  const reload = () => setReloadKey((k) => k + 1);

  const StatusBadge = ({ s }: { s: Visitor }) => (
    <Badge tone={statusTone(s.status)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {statusLabel(s.status)}
    </Badge>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
              <DoorOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('visitors.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('visitors.subtitle')}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('visitors.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
          </div>
          {scope.showOrgFilter ? (
            <EntitySelect
              className="w-44"
              value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setPage(1); }}
              fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel}
              placeholder={t('visitors.filterOrg')}
            />
          ) : null}
          <div className="w-40">
            <SelectField value={filterStatus ?? ALL_STATUSES} options={statusFilterOptions} placeholder={t('visitors.filterStatus')} onChange={(v) => { setFilterStatus(v === ALL_STATUSES ? null : v); setPage(1); }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center rounded-lg border border-border p-0.5 md:flex">
            <button type="button" onClick={() => setView('table')} aria-label="Table view" className={`flex h-7 w-7 items-center justify-center rounded-md ${view === 'table' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent'}`}>
              <TableIcon className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setView('cards')} aria-label="Card view" className={`flex h-7 w-7 items-center justify-center rounded-md ${view === 'cards' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={reload} aria-label="Refresh" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-emerald-600">
            <RefreshCw className={`h-4 w-4 ${query.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {query.loading ? t('common.loading') : t('visitors.empty')}
        </Card>
      ) : effectiveView === 'table' ? (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('visitors.colVisitor')}</TH>
                {showCommunityCol ? <TH className="w-44">{t('visitors.colCommunity')}</TH> : null}
                <TH className="w-32">{t('visitors.colCategory')}</TH>
                <TH className="w-28">{t('visitors.colStatus')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((s, i) => (
                <TR key={s.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">{s.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{s.phone ?? s.hostUnitNumber ?? '—'}</div>
                    </div>
                  </TD>
                  {showCommunityCol ? <TD className="text-[11px] text-muted-foreground">{s.communityName ?? s.organizationName ?? '—'}</TD> : null}
                  <TD><Badge tone="default">{categoryLabel(s.category)}</Badge></TD>
                  <TD><StatusBadge s={s} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((s) => (
            <Card key={s.id} className="flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{s.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{s.phone ?? s.hostUnitNumber ?? '—'}</div>
                  {showCommunityCol ? <div className="truncate text-[11px] text-muted-foreground">{s.communityName ?? s.organizationName ?? '—'}</div> : null}
                </div>
                <StatusBadge s={s} />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <Badge tone="default">{categoryLabel(s.category)}</Badge>
                {s.whomToMeet ? <span className="truncate text-[11px] text-muted-foreground">{s.whomToMeet}</span> : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {(query.data?.totalCount ?? 0) > 0 ? (
        <Card className="rounded-xl p-1">
          <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0} onPageChange={setPage} onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }} />
        </Card>
      ) : null}

      <Toaster position="top-center" richColors />
    </div>
  );
}
