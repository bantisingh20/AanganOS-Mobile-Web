import { useMemo, useState } from 'react';
import { Bell, Search, RefreshCw, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@shared/components/ui/card';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { SelectField } from '@shared/components/SelectField';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster } from '@shared/components/ui/sonner';
import { notificationLogs } from '@shared/services';
import type { MessageLog, NotificationLog } from '@shared/api/notificationLogs';
import { useAsync } from '@shared/lib/useAsync';
import { cn } from '@shared/lib/utils';

type Tab = 'messages' | 'push';
type Option = { value: string; label: string };

const ALL = '__all__';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'muted' | 'default' {
  const s = status.toLowerCase();
  if (s === 'sent') return 'success';
  if (s === 'failed') return 'danger';
  if (s === 'pending') return 'warning';
  if (s === 'suppressed') return 'muted';
  return 'default';
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function startOfDayIso(date: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function endOfDayIso(date: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('messages');

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex items-center gap-3 py-3.5 pl-4 pr-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Bell className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight">{t('notifications.logsTitle')}</h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('notifications.logsSubtitle')}</p>
          </div>
        </div>
      </Card>

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button type="button" onClick={() => setTab('messages')} className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors', tab === 'messages' ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground')}>{t('notifications.tabMessages')}</button>
        <button type="button" onClick={() => setTab('push')} className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors', tab === 'push' ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground')}>{t('notifications.tabPush')}</button>
      </div>

      {tab === 'messages' ? <MessagesTab /> : <PushTab />}

      <Toaster position="top-center" richColors />
    </div>
  );
}

function MessagesTab() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [channel, setChannel] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [detail, setDetail] = useState<MessageLog | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const channelOptions = useMemo<Option[]>(() => [
    { value: ALL, label: t('notifications.allChannels') },
    { value: 'Email', label: 'Email' },
    { value: 'Sms', label: 'SMS' },
    { value: 'WhatsApp', label: 'WhatsApp' },
  ], [t]);

  const statusOptions = useMemo<Option[]>(() => [
    { value: ALL, label: t('notifications.allStatuses') },
    { value: 'Pending', label: t('notifications.statusPending') },
    { value: 'Sent', label: t('notifications.statusSent') },
    { value: 'Failed', label: t('notifications.statusFailed') },
  ], [t]);

  const query = useAsync(
    (signal) => notificationLogs.listMessages(
      { page, pageSize },
      {
        ...(channel ? { channel } : {}),
        ...(status ? { status } : {}),
        ...(recipient.trim() ? { recipient: recipient.trim() } : {}),
        ...(startOfDayIso(fromDate) ? { fromDate: startOfDayIso(fromDate) } : {}),
        ...(endOfDayIso(toDate) ? { toDate: endOfDayIso(toDate) } : {}),
      },
      { signal },
    ).catch(() => null),
    [page, pageSize, channel, status, recipient, fromDate, toDate, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  return (
    <>
      <Card className="flex flex-wrap items-end gap-2 rounded-2xl p-3">
        <div className="w-40">
          <SelectField label={t('notifications.filterChannel')} value={channel ?? ALL} options={channelOptions} onChange={(v) => { setChannel(v === ALL ? null : v); setPage(1); }} />
        </div>
        <div className="w-40">
          <SelectField label={t('notifications.filterStatus')} value={status ?? ALL} options={statusOptions} onChange={(v) => { setStatus(v === ALL ? null : v); setPage(1); }} />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('notifications.searchRecipient')}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={recipient} onChange={(e) => { setRecipient(e.target.value); setPage(1); }} placeholder={t('notifications.searchRecipient')} className="h-9 pl-9 text-sm" />
          </div>
        </div>
        <div className="w-40">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('notifications.fromDate')}</label>
          <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="h-9 text-sm" />
        </div>
        <div className="w-40">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('notifications.toDate')}</label>
          <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="h-9 text-sm" />
        </div>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} aria-label="Refresh" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-emerald-600">
          <RefreshCw className={`h-4 w-4 ${query.loading ? 'animate-spin' : ''}`} />
        </button>
      </Card>

      {items.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {query.loading ? t('common.loading') : t('notifications.emptyLogs')}
        </Card>
      ) : (
        <Card className="overflow-x-auto rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH className="w-28">{t('notifications.colChannel')}</TH>
                <TH>{t('notifications.colRecipient')}</TH>
                <TH className="w-28">{t('notifications.colStatus')}</TH>
                <TH className="w-24">{t('notifications.colAttempts')}</TH>
                <TH className="w-56">{t('notifications.colError')}</TH>
                <TH className="w-44">{t('notifications.colCreated')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((m, i) => (
                <TR key={m.id} onClick={() => setDetail(m)} className="cursor-pointer">
                  <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD><Badge tone="default">{m.channel}</Badge></TD>
                  <TD>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate text-[13px] font-medium"><Mail className="h-3 w-3 shrink-0 text-slate-400" />{m.recipient}</div>
                      {m.subject ? <div className="truncate text-[11px] text-muted-foreground">{m.subject}</div> : null}
                    </div>
                  </TD>
                  <TD><Badge tone={statusTone(m.status)}>{m.status}</Badge></TD>
                  <TD className="text-[12px] text-muted-foreground">{m.attempts}</TD>
                  <TD>{m.lastError ? <span className="line-clamp-1 text-[11px] text-rose-500">{m.lastError}</span> : <span className="text-muted-foreground">—</span>}</TD>
                  <TD className="text-[11px] text-muted-foreground">{fmt(m.createdAtUtc)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {(query.data?.totalCount ?? 0) > 0 ? (
        <Card className="rounded-xl p-1">
          <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0} onPageChange={setPage} onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }} />
        </Card>
      ) : null}

      <Dialog open={!!detail} onClose={() => setDetail(null)} className="max-w-lg">
        {detail ? (
          <>
            <DialogHeader title={t('notifications.detailTitle')} />
            <div className="space-y-3 text-sm">
              <Field label={t('notifications.colChannel')} value={detail.channel} />
              <Field label={t('notifications.colRecipient')} value={detail.recipient} />
              {detail.subject ? <Field label={t('notifications.colSubject')} value={detail.subject} /> : null}
              <Field label={t('notifications.colStatus')} value={detail.status} />
              <Field label={t('notifications.colAttempts')} value={String(detail.attempts)} />
              <Field label={t('notifications.colCreated')} value={fmt(detail.createdAtUtc)} />
              {detail.nextAttemptUtc ? <Field label={t('notifications.nextAttempt')} value={fmt(detail.nextAttemptUtc)} /> : null}
              {detail.lastError ? <Field label={t('notifications.colError')} value={detail.lastError} /> : null}
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">{t('notifications.body')}</div>
                <div className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted p-3 text-xs">{detail.body}</div>
                <p className="mt-1 text-[10px] text-muted-foreground">{t('notifications.bodyHtmlNote')}</p>
              </div>
            </div>
          </>
        ) : null}
      </Dialog>
    </>
  );
}

function PushTab() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [detail, setDetail] = useState<NotificationLog | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const statusOptions = useMemo<Option[]>(() => [
    { value: ALL, label: t('notifications.allStatuses') },
    { value: 'Pending', label: t('notifications.statusPending') },
    { value: 'Sent', label: t('notifications.statusSent') },
    { value: 'Failed', label: t('notifications.statusFailed') },
    { value: 'Suppressed', label: t('notifications.statusSuppressed') },
  ], [t]);

  const query = useAsync(
    (signal) => notificationLogs.listNotifications(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(status ? { status } : {}),
        ...(category.trim() ? { category: category.trim() } : {}),
        ...(startOfDayIso(fromDate) ? { fromDate: startOfDayIso(fromDate) } : {}),
        ...(endOfDayIso(toDate) ? { toDate: endOfDayIso(toDate) } : {}),
      },
      { signal },
    ).catch(() => null),
    [page, pageSize, status, category, search, fromDate, toDate, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  return (
    <>
      <Card className="flex flex-wrap items-end gap-2 rounded-2xl p-3">
        <div className="w-40">
          <SelectField label={t('notifications.filterStatus')} value={status ?? ALL} options={statusOptions} onChange={(v) => { setStatus(v === ALL ? null : v); setPage(1); }} />
        </div>
        <div className="w-44">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('notifications.colCategory')}</label>
          <Input value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} placeholder={t('notifications.categoryPlaceholder')} className="h-9 text-sm" />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('notifications.searchTitle')}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('notifications.searchTitle')} className="h-9 pl-9 text-sm" />
          </div>
        </div>
        <div className="w-40">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('notifications.fromDate')}</label>
          <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="h-9 text-sm" />
        </div>
        <div className="w-40">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('notifications.toDate')}</label>
          <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="h-9 text-sm" />
        </div>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} aria-label="Refresh" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-emerald-600">
          <RefreshCw className={`h-4 w-4 ${query.loading ? 'animate-spin' : ''}`} />
        </button>
      </Card>

      {items.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {query.loading ? t('common.loading') : t('notifications.emptyLogs')}
        </Card>
      ) : (
        <Card className="overflow-x-auto rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('notifications.colTitle')}</TH>
                <TH className="w-32">{t('notifications.colCategory')}</TH>
                <TH className="w-32">{t('notifications.colChannels')}</TH>
                <TH className="w-28">{t('notifications.colStatus')}</TH>
                <TH className="w-24">{t('notifications.colRead')}</TH>
                <TH className="w-44">{t('notifications.colCreated')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((n, i) => (
                <TR key={n.id} onClick={() => setDetail(n)} className="cursor-pointer">
                  <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{n.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{n.templateKey}</div>
                    </div>
                  </TD>
                  <TD><Badge tone="default">{n.category}</Badge></TD>
                  <TD className="text-[11px] text-muted-foreground">{n.channels}</TD>
                  <TD><Badge tone={statusTone(n.status)}>{n.status}</Badge></TD>
                  <TD><Badge tone={n.isRead ? 'info' : 'muted'}>{n.isRead ? t('notifications.read') : t('notifications.unread')}</Badge></TD>
                  <TD className="text-[11px] text-muted-foreground">{fmt(n.createdAtUtc)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {(query.data?.totalCount ?? 0) > 0 ? (
        <Card className="rounded-xl p-1">
          <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0} onPageChange={setPage} onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }} />
        </Card>
      ) : null}

      <Dialog open={!!detail} onClose={() => setDetail(null)} className="max-w-lg">
        {detail ? (
          <>
            <DialogHeader title={t('notifications.detailTitle')} />
            <div className="space-y-3 text-sm">
              <Field label={t('notifications.colTitle')} value={detail.title} />
              <Field label={t('notifications.colTemplate')} value={detail.templateKey} />
              <Field label={t('notifications.colCategory')} value={detail.category} />
              <Field label={t('notifications.colChannels')} value={detail.channels} />
              <Field label={t('notifications.recipientUser')} value={detail.recipientUserId} />
              {detail.targetPlayerId ? <Field label={t('notifications.targetDevice')} value={detail.targetPlayerId} /> : null}
              <Field label={t('notifications.colStatus')} value={detail.status} />
              <Field label={t('notifications.colAttempts')} value={String(detail.attempts)} />
              <Field label={t('notifications.colRead')} value={detail.isRead ? t('notifications.read') : t('notifications.unread')} />
              <Field label={t('notifications.colCreated')} value={fmt(detail.createdAtUtc)} />
              {detail.lastError ? <Field label={t('notifications.colError')} value={detail.lastError} /> : null}
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">{t('notifications.body')}</div>
                <div className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted p-3 text-xs">{detail.body}</div>
              </div>
            </div>
          </>
        ) : null}
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="break-all text-foreground">{value}</div>
    </div>
  );
}
