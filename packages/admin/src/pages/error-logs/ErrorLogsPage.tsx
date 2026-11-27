import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Eye, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { errorLogs } from '@shared/services';
import type { ErrorLogSummary, ErrorLogDetail } from '@shared/api/errorLogs';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { PageShell, FilterBar, DataList, filterControlClass, type FilterLayout } from '@shared/components/layout';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';
import { EMPTY, formatDateTime } from '@shared/lib/format';
import { useListState } from '@shared/lib/hooks/useListState';
import { ErrorLogDetailDrawer } from './ErrorLogDetailDrawer';

export function ErrorLogsPage() {
  const { t } = useTranslation();
  const compact = useIsCompact();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ErrorLogSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const { search, setSearch, page, setPage, pageSize, setPageSize, resetPage } = useListState(20);
  const [statusCodeFilter, setStatusCodeFilter] = useState<string>('all');

  const [selectedDetail, setSelectedDetail] = useState<ErrorLogDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: 'delete'; id: string } | { kind: 'clear' } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const code = statusCodeFilter === 'all' ? undefined : Number.parseInt(statusCodeFilter, 10);
      const res = await errorLogs.list({
        page,
        pageSize,
        search: search.trim() || undefined,
        statusCode: Number.isNaN(code) ? undefined : code,
      });
      setItems(res.items ?? []);
      setTotalCount(res.totalCount ?? 0);
    } catch (err) {
      toast.error(t('errorLogs.fetchFailed', { defaultValue: 'Failed to load error logs' }));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusCodeFilter, t]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const viewDetail = async (id: string) => {
    try {
      const detail = await errorLogs.get(id);
      setSelectedDetail(detail);
      setDrawerOpen(true);
    } catch {
      toast.error(t('errorLogs.detailFailed', { defaultValue: 'Failed to fetch error details' }));
    }
  };

  const deleteLog = async (id: string) => {
    try {
      await errorLogs.delete(id);
      toast.success(t('errorLogs.deleted', { defaultValue: 'Error log removed' }));
      void fetchLogs();
    } catch {
      toast.error(t('errorLogs.deleteFailed', { defaultValue: 'Failed to delete error log' }));
    }
  };

  const clearAll = async () => {
    try {
      const count = await errorLogs.clear();
      toast.success(t('errorLogs.cleared', { defaultValue: `Cleared ${count} error log(s)` }));
      void fetchLogs();
    } catch {
      toast.error(t('errorLogs.clearFailed', { defaultValue: 'Failed to clear logs' }));
    }
  };

  const runConfirm = async () => {
    if (!confirm || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (confirm.kind === 'delete') await deleteLog(confirm.id);
      else await clearAll();
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  };

  const statusBadge = (log: ErrorLogSummary) => {
    const is500 = log.statusCode >= 500;
    const is400 = log.statusCode >= 400 && log.statusCode < 500;
    return (
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'px-1.5 py-0.5 text-[10.5px] font-bold font-mono rounded-[3px] border',
            is500 && 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-400',
            is400 && 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-400',
            !is500 && !is400 && 'bg-muted text-muted-foreground border-border',
          )}
        >
          {log.statusCode}
        </span>
        <span className="font-mono text-[10px] font-bold text-muted-foreground">
          {log.httpMethod}
        </span>
      </div>
    );
  };

  const rowActions = (log: ErrorLogSummary) => (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void viewDetail(log.id); }}
        className={cn('flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors', compact ? 'h-9 w-9 rounded-lg border border-border/80' : 'p-1 rounded-[4px]')}
        title="View full details"
      >
        <Eye className={compact ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'delete', id: log.id }); }}
        className={cn('flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors', compact ? 'h-9 w-9 rounded-lg border border-border/80' : 'p-1 rounded-[4px]')}
        title={t('common.delete')}
      >
        <Trash2 className={compact ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      </button>
    </div>
  );

  const renderFilters = (layout: FilterLayout) => (
    <div className={cn('flex gap-2', layout === 'sheet' ? 'w-full flex-col gap-1' : 'items-center')}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
        <Filter className="h-3 w-3" />
        <span>Status:</span>
      </div>
      <Select value={statusCodeFilter} onValueChange={(v) => { setStatusCodeFilter(v); resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-36')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="500">500 (Server Error)</SelectItem>
          <SelectItem value="400">400 (Bad Request)</SelectItem>
          <SelectItem value="401">401 (Unauthorized)</SelectItem>
          <SelectItem value="403">403 (Forbidden)</SelectItem>
          <SelectItem value="404">404 (Not Found)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const headerBtn = compact ? 'h-9 rounded-lg px-3 text-sm' : 'h-7 rounded-[4px] px-2.5 text-xs';

  return (
    <PageShell
      className="w-full space-y-2.5"
      title={t('errorLogs.title', { defaultValue: 'Backend Error Logs' })}
      subtitle={t('errorLogs.subtitle', { defaultValue: 'Inspect API errors, controllers, line numbers, and user context' })}
      icon={<AlertTriangle className="text-rose-500" />}
      actions={(
        <>
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={loading}
            className={cn('flex items-center gap-1.5 border border-border/80 bg-card font-medium text-slate-700 hover:bg-accent/50 dark:text-slate-300 disabled:opacity-50 shadow-xs', headerBtn)}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            <span>{t('common.refresh', { defaultValue: 'Refresh' })}</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirm({ kind: 'clear' })}
            className={cn('flex items-center gap-1.5 border border-rose-500/30 bg-rose-500/10 font-medium text-rose-600 hover:bg-rose-500/20 dark:text-rose-400 shadow-xs', headerBtn)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t('errorLogs.clearAll', { defaultValue: 'Clear Logs' })}</span>
          </button>
        </>
      )}
    >
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t('errorLogs.searchPlaceholder', { defaultValue: 'Search API, error, controller, user...' }),
        }}
        filters={renderFilters}
        activeCount={statusCodeFilter !== 'all' ? 1 : 0}
        onReset={() => { setStatusCodeFilter('all'); resetPage(); }}
        trailing={(
          <span className="text-[11px] text-muted-foreground">
            Total {totalCount} error record(s)
          </span>
        )}
      />

      <DataList
        items={items}
        keyOf={(log) => log.id}
        loading={loading}
        emptyText="No error logs found."
        onItemClick={(log) => void viewDetail(log.id)}
        pagination={{ page, pageSize, total: totalCount, onPageChange: setPage, onPageSizeChange: setPageSize }}
        renderCard={(log) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                {statusBadge(log)}
                <div className="truncate font-mono text-sm font-medium text-foreground">{log.apiPath}</div>
              </div>
              {rowActions(log)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-rose-600 dark:text-rose-400">{log.exceptionType.split('.').pop()}</div>
              <div className="line-clamp-2 text-xs text-muted-foreground">{log.errorMessage}</div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="min-w-0 truncate font-mono">
                {log.controllerOrFunction || EMPTY}
                {log.lineNumber ? <span className="text-emerald-600 dark:text-emerald-400"> · Line {log.lineNumber}</span> : null}
              </span>
              <span className="truncate">{log.userName || 'Anonymous'}{log.userRole ? ` (${log.userRole})` : ''}</span>
              <span className="font-mono">{formatDateTime(log.createdAtUtc)}</span>
            </div>
          </>
        )}
        renderTable={() => (
          <Table className="w-full text-xs">
            <THead className="bg-muted/40">
              <TR className="border-b border-border text-[11px] font-semibold text-muted-foreground">
                <TH className="py-2 px-3 text-left w-28">Status & Method</TH>
                <TH className="py-2 px-3 text-left">API Endpoint</TH>
                <TH className="py-2 px-3 text-left">Error / Exception</TH>
                <TH className="py-2 px-3 text-left">Code Location</TH>
                <TH className="py-2 px-3 text-left">User / Context</TH>
                <TH className="py-2 px-3 text-left w-36">Time (UTC)</TH>
                <TH className="py-2 px-3 text-right w-20">{t('common.actions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((log) => (
                <TR
                  key={log.id}
                  onClick={() => void viewDetail(log.id)}
                  className="cursor-pointer border-b border-border/60 hover:bg-accent/40 transition-colors"
                >
                  {/* Status & Method */}
                  <TD className="py-2 px-3">{statusBadge(log)}</TD>

                  {/* API Endpoint */}
                  <TD className="py-2 px-3 font-mono font-medium text-foreground max-w-[180px] truncate">
                    {log.apiPath}
                  </TD>

                  {/* Error & Exception */}
                  <TD className="py-2 px-3 max-w-[260px]">
                    <div className="truncate font-semibold text-rose-600 dark:text-rose-400 text-[11.5px]">
                      {log.exceptionType.split('.').pop()}
                    </div>
                    <div className="truncate text-muted-foreground text-[10.5px]">
                      {log.errorMessage}
                    </div>
                  </TD>

                  {/* Code Location */}
                  <TD className="py-2 px-3 max-w-[180px]">
                    <div className="truncate font-mono text-[11px] text-foreground">
                      {log.controllerOrFunction || EMPTY}
                    </div>
                    {log.lineNumber ? (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                        Line {log.lineNumber}
                      </div>
                    ) : null}
                  </TD>

                  {/* User Context */}
                  <TD className="py-2 px-3 max-w-[140px]">
                    <div className="truncate font-medium text-foreground text-[11px]">
                      {log.userName || 'Anonymous'}
                    </div>
                    {log.userRole ? (
                      <div className="text-[10px] text-muted-foreground">{log.userRole}</div>
                    ) : null}
                  </TD>

                  {/* Time */}
                  <TD className="py-2 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDateTime(log.createdAtUtc)}
                  </TD>

                  {/* Actions */}
                  <TD className="py-2 px-3 text-right">{rowActions(log)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />

      {/* Drawer */}
      <ErrorLogDetailDrawer
        log={selectedDetail}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedDetail(null); }}
      />

      <ConfirmDialog
        open={!!confirm}
        tone="danger"
        busy={confirmBusy}
        title={confirm?.kind === 'clear'
          ? t('errorLogs.clearConfirm', { defaultValue: 'Clear all error logs? This cannot be undone.' })
          : t('errorLogs.deleteConfirm', { defaultValue: 'Delete this error log record?' })}
        confirmLabel={confirm?.kind === 'clear' ? t('errorLogs.clearAll', { defaultValue: 'Clear Logs' }) : t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => void runConfirm()}
        onClose={() => { if (!confirmBusy) setConfirm(null); }}
      />
    </PageShell>
  );
}
export default ErrorLogsPage;
