import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Search, RefreshCw, Trash2, Eye, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { errorLogs } from '@shared/services';
import type { ErrorLogSummary, ErrorLogDetail } from '@shared/api/errorLogs';
import { Input } from '@shared/components/ui/input';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { cn } from '@shared/lib/utils';
import { ErrorLogDetailDrawer } from './error-logs/ErrorLogDetailDrawer';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ErrorLogsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ErrorLogSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusCodeFilter, setStatusCodeFilter] = useState<string>('all');

  const [selectedDetail, setSelectedDetail] = useState<ErrorLogDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const deleteLog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('errorLogs.deleteConfirm', { defaultValue: 'Delete this error log record?' }))) return;
    try {
      await errorLogs.delete(id);
      toast.success(t('errorLogs.deleted', { defaultValue: 'Error log removed' }));
      void fetchLogs();
    } catch {
      toast.error(t('errorLogs.deleteFailed', { defaultValue: 'Failed to delete error log' }));
    }
  };

  const clearAll = async () => {
    if (!window.confirm(t('errorLogs.clearConfirm', { defaultValue: 'Clear all error logs? This cannot be undone.' }))) return;
    try {
      const count = await errorLogs.clear();
      toast.success(t('errorLogs.cleared', { defaultValue: `Cleared ${count} error log(s)` }));
      void fetchLogs();
    } catch {
      toast.error(t('errorLogs.clearFailed', { defaultValue: 'Failed to clear logs' }));
    }
  };

  return (
    <div className="w-full space-y-2.5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <span>{t('errorLogs.title', { defaultValue: 'Backend Error Logs' })}</span>
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {t('errorLogs.subtitle', { defaultValue: 'Inspect API errors, controllers, line numbers, and user context' })}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={loading}
            className="flex h-7 items-center gap-1.5 rounded-[4px] border border-border/80 bg-card px-2.5 text-xs font-medium text-slate-700 hover:bg-accent/50 dark:text-slate-300 disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            <span>{t('common.refresh', { defaultValue: 'Refresh' })}</span>
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="flex h-7 items-center gap-1.5 rounded-[4px] border border-rose-500/30 bg-rose-500/10 px-2.5 text-xs font-medium text-rose-600 hover:bg-rose-500/20 dark:text-rose-400 shadow-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t('errorLogs.clearAll', { defaultValue: 'Clear Logs' })}</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between rounded-[4px] border border-border/80 bg-card/60 p-2 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('errorLogs.searchPlaceholder', { defaultValue: 'Search API, error, controller, user...' })}
            className="h-7 pl-8 text-xs rounded-[4px]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
            <Filter className="h-3 w-3" />
            <span>Status:</span>
          </div>
          <Select value={statusCodeFilter} onValueChange={(v) => { setStatusCodeFilter(v); setPage(1); }}>
            <SelectTrigger className="h-7 w-36 text-xs rounded-[4px]">
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
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-[4px] border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <Table className="w-full text-xs">
            <THead className="bg-muted/40">
              <TR className="border-b border-border text-[11px] font-semibold text-muted-foreground">
                <TH className="py-2 px-3 text-left w-28">Status & Method</TH>
                <TH className="py-2 px-3 text-left">API Endpoint</TH>
                <TH className="py-2 px-3 text-left">Error / Exception</TH>
                <TH className="py-2 px-3 text-left">Code Location</TH>
                <TH className="py-2 px-3 text-left">User / Context</TH>
                <TH className="py-2 px-3 text-left w-36">Time (UTC)</TH>
                <TH className="py-2 px-3 text-right w-20">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                        <span>Loading error logs...</span>
                      </div>
                    ) : (
                      'No error logs found.'
                    )}
                  </TD>
                </TR>
              ) : (
                items.map((log) => {
                  const is500 = log.statusCode >= 500;
                  const is400 = log.statusCode >= 400 && log.statusCode < 500;
                  return (
                    <TR
                      key={log.id}
                      onClick={() => void viewDetail(log.id)}
                      className="cursor-pointer border-b border-border/60 hover:bg-accent/40 transition-colors"
                    >
                      {/* Status & Method */}
                      <TD className="py-2 px-3">
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
                      </TD>

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
                          {log.controllerOrFunction || '—'}
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
                        {fmtDate(log.createdAtUtc)}
                      </TD>

                      {/* Actions */}
                      <TD className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void viewDetail(log.id); }}
                            className="p-1 rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="View full details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => void deleteLog(log.id, e)}
                            className="p-1 rounded-[4px] text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="border-t border-border px-3 py-2 bg-muted/10 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Total {totalCount} error record(s)
          </span>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalCount}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* Drawer */}
      <ErrorLogDetailDrawer
        log={selectedDetail}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedDetail(null); }}
      />
    </div>
  );
}
export default ErrorLogsPage;
