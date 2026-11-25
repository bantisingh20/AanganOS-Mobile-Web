import { useMemo, useState } from 'react';
import { DoorOpen, Search, RefreshCw, Phone, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Button } from '@shared/components/ui/button';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { gate, masterData, organizations } from '@shared/services';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { cn } from '@shared/lib/utils';

async function fetchOrgPage(search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> {
  const d = await organizations.list({ search: search || undefined, page, pageSize }, { signal });
  return { items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount };
}

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
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);

  const statusesQuery = useAsync((signal) => masterData.list('Visitor_Status', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const statusOptions = useMemo(() => (statusesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [statusesQuery.data]);
  const statusLabel = (code: string) => statusOptions.find((o) => o.value === code)?.label ?? code;

  const categoriesQuery = useAsync((signal) => masterData.list('Visitor_Category', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const categoryOptions = useMemo(() => (categoriesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [categoriesQuery.data]);
  const categoryLabel = (code: string) => categoryOptions.find((o) => o.value === code)?.label ?? code;

  const query = useAsync(
    (signal) => gate.listVisitors(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
        ...(filterOrgId ? { organizationId: filterOrgId } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, filterStatus, filterOrgId, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;
  const reload = () => setReloadKey((k) => k + 1);

  return (
    <div className="w-full space-y-2">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <DoorOpen className="h-3.5 w-3.5 text-primary" />{t('visitors.title')}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{t('visitors.subtitle')}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="relative min-w-[140px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('visitors.searchPlaceholder')} className="h-7.5 w-full rounded-md pl-7 pr-2 text-[11px] bg-background" />
          </div>
          {scope.showOrgFilter && (
            <EntitySelect className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-md [&>button]:text-[11px] [&>button]:px-2" value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setPage(1); }} fetchPage={fetchOrgPage}
              resolveLabel={(id, sig) => organizations.get(id, { signal: sig }).then((o) => o.name).catch(() => null)} placeholder={t('visitors.filterOrg')} />
          )}
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
            <SelectTrigger className="h-7.5 w-28 rounded-md text-[11px] bg-background px-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('visitors.allStatuses')}</SelectItem>
              {statusOptions.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">Total: <span className="font-semibold text-foreground">{query.data?.totalCount ?? 0}</span></span>
          <Button type="button" variant="outline" size="sm" onClick={reload} aria-label="Refresh" className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80">
            <RefreshCw className={cn('h-3 w-3', query.loading && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {query.loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground"><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-xs text-muted-foreground">
            <DoorOpen className="h-6 w-6 text-muted-foreground/50 mb-1.5" />{t('visitors.empty')}
          </div>
        ) : (
          <>
            {/* Mobile View: Compact Cards */}
            <div className="divide-y divide-border/60 md:hidden">
              {items.map((s) => (
                <div key={s.id} className="p-2.5 flex flex-col gap-1.5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-foreground truncate">{s.name}</span>
                    <Badge tone={statusTone(s.status)} className="text-[9px] px-1 py-0 rounded shrink-0">
                      {statusLabel(s.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {s.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3 opacity-60" />{s.phone}</span>}
                    {s.hostUnitNumber && <span>Unit: {s.hostUnitNumber}</span>}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10.5px]">
                    <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{categoryLabel(s.category)}</Badge>
                    {s.whomToMeet && <span className="flex items-center gap-0.5 text-muted-foreground truncate"><UserCheck className="h-3 w-3 opacity-60" />{s.whomToMeet}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <THead>
                  <TR className="border-b border-border bg-muted/40">
                    <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('visitors.colVisitor')}</TH>
                    {showCommunityCol && <TH className="w-36 py-1.5 px-2 text-[10.5px] font-semibold">{t('visitors.colCommunity')}</TH>}
                    <TH className="w-28 py-1.5 px-2 text-[10.5px] font-semibold">{t('visitors.colCategory')}</TH>
                    <TH className="w-24 py-1.5 px-2 text-[10.5px] font-semibold">{t('visitors.colStatus')}</TH>
                    <TH className="w-36 py-1.5 px-2 text-right text-[10.5px] font-semibold">Whom to Meet</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((s, i) => (
                    <TR key={s.id} className="hover:bg-muted/30 transition-colors">
                      <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                      <TD className="py-1 px-2">
                        <div className="min-w-0">
                          <span className="font-semibold text-xs text-foreground block truncate">{s.name}</span>
                          <span className="text-[10.5px] text-muted-foreground block truncate">{s.phone ?? (s.hostUnitNumber ? `Unit: ${s.hostUnitNumber}` : '—')}</span>
                        </div>
                      </TD>
                      {showCommunityCol && <TD className="py-1 px-2 text-xs text-muted-foreground truncate">{s.communityName ?? s.organizationName ?? '—'}</TD>}
                      <TD className="py-1 px-2"><Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{categoryLabel(s.category)}</Badge></TD>
                      <TD className="py-1 px-2">
                        <Badge tone={statusTone(s.status)} className="text-[10px] px-1.5 py-0 rounded">
                          {statusLabel(s.status)}
                        </Badge>
                      </TD>
                      <TD className="py-1 px-2 text-right text-[11px] text-muted-foreground truncate">{s.whomToMeet ?? '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </>
        )}

        {(query.data?.totalCount ?? 0) > 0 && (
          <div className="border-t border-border px-2.5 py-1 bg-muted/20">
            <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0} onPageChange={setPage} onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default VisitorsPage;
