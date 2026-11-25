import { useMemo, useState } from 'react';
import { Bell, Search, RefreshCw, Mail, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Button } from '@shared/components/ui/button';
import { notificationLogs } from '@shared/services';
import type { MessageLog, NotificationLog } from '@shared/api/notificationLogs';
import { useAsync } from '@shared/lib/useAsync';
import { cn } from '@shared/lib/utils';

type Tab = 'messages' | 'push';

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

const startIso = (date: string) => { if (!date) return undefined; const d = new Date(`${date}T00:00:00`); return Number.isNaN(d.getTime()) ? undefined : d.toISOString(); };
const endIso = (date: string) => { if (!date) return undefined; const d = new Date(`${date}T23:59:59.999`); return Number.isNaN(d.getTime()) ? undefined : d.toISOString(); };

export function NotificationsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('messages');

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5 text-primary" />{t('notifications.logsTitle')}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{t('notifications.logsSubtitle')}</p>
        </div>
        <div className="flex gap-1 rounded-[4px] bg-muted/60 p-0.5 border border-border/70 self-start sm:self-auto">
          <button type="button" onClick={() => setTab('messages')}
            className={cn('rounded-[3px] px-2.5 py-1 text-[11px] font-medium transition-colors', tab === 'messages' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
            {t('notifications.tabMessages')}
          </button>
          <button type="button" onClick={() => setTab('push')}
            className={cn('rounded-[3px] px-2.5 py-1 text-[11px] font-medium transition-colors', tab === 'push' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
            {t('notifications.tabPush')}
          </button>
        </div>
      </div>
      {tab === 'messages' ? <MessagesTab /> : <PushTab />}
    </div>
  );
}

function MessagesTab() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [channel, setChannel] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [recipient, setRecipient] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [detail, setDetail] = useState<MessageLog | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const query = useAsync(
    (signal) => notificationLogs.listMessages(
      { page, pageSize },
      {
        ...(channel !== 'all' ? { channel } : {}),
        ...(status !== 'all' ? { status } : {}),
        ...(recipient.trim() ? { recipient: recipient.trim() } : {}),
        ...(startIso(fromDate) ? { fromDate: startIso(fromDate) } : {}),
        ...(endIso(toDate) ? { toDate: endIso(toDate) } : {}),
      },
      { signal },
    ).catch(() => null),
    [page, pageSize, channel, status, recipient, fromDate, toDate, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="relative min-w-[130px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={recipient} onChange={(e) => { setRecipient(e.target.value); setPage(1); }} placeholder={t('notifications.searchRecipient')} className="h-7.5 w-full rounded-md pl-7 pr-2 text-[11px] bg-background" />
          </div>
          <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1); }}>
            <SelectTrigger className="h-7.5 w-28 rounded-md text-[11px] bg-background px-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('notifications.allChannels')}</SelectItem>
              <SelectItem value="Email">Email</SelectItem>
              <SelectItem value="Sms">SMS</SelectItem>
              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-7.5 w-28 rounded-md text-[11px] bg-background px-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('notifications.allStatuses')}</SelectItem>
              <SelectItem value="Pending">{t('notifications.statusPending')}</SelectItem>
              <SelectItem value="Sent">{t('notifications.statusSent')}</SelectItem>
              <SelectItem value="Failed">{t('notifications.statusFailed')}</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="h-7.5 w-32 rounded-md text-[11px] bg-background px-2" />
          <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="h-7.5 w-32 rounded-md text-[11px] bg-background px-2" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">Total: <span className="font-semibold text-foreground">{query.data?.totalCount ?? 0}</span></span>
          <Button type="button" variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)} aria-label="Refresh" className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80">
            <RefreshCw className={cn('h-3 w-3', query.loading && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {query.loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground"><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-xs text-muted-foreground">
            <Mail className="h-6 w-6 text-muted-foreground/50 mb-1.5" />{t('notifications.emptyLogs')}
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/60 md:hidden">
              {items.map((m) => (
                <div key={m.id} onClick={() => setDetail(m)} className="p-2.5 flex flex-col gap-1.5 hover:bg-muted/20 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{m.channel}</Badge>
                      <span className="font-semibold text-xs text-foreground truncate">{m.recipient}</span>
                    </div>
                    <Badge tone={statusTone(m.status)} className="text-[9px] px-1 py-0 rounded">{m.status}</Badge>
                  </div>
                  {m.subject && <p className="text-[11px] text-muted-foreground truncate">{m.subject}</p>}
                  <div className="flex items-center justify-between text-[10.5px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>Attempts: {m.attempts}</span>
                    <span>{fmt(m.createdAtUtc)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table>
                <THead>
                  <TR className="border-b border-border bg-muted/40">
                    <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                    <TH className="w-24 py-1.5 px-2 text-[10.5px] font-semibold">{t('notifications.colChannel')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('notifications.colRecipient')}</TH>
                    <TH className="w-24 py-1.5 px-2 text-[10.5px] font-semibold">{t('notifications.colStatus')}</TH>
                    <TH className="w-20 py-1.5 px-2 text-center text-[10.5px] font-semibold">{t('notifications.colAttempts')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('notifications.colError')}</TH>
                    <TH className="w-32 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('notifications.colCreated')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((m, i) => (
                    <TR key={m.id} onClick={() => setDetail(m)} className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                      <TD className="py-1 px-2"><Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{m.channel}</Badge></TD>
                      <TD className="py-1 px-2">
                        <div className="min-w-0">
                          <span className="flex items-center gap-1 font-semibold text-xs text-foreground truncate"><Mail className="h-3 w-3 opacity-60 shrink-0" />{m.recipient}</span>
                          {m.subject && <span className="text-[11px] text-muted-foreground block truncate">{m.subject}</span>}
                        </div>
                      </TD>
                      <TD className="py-1 px-2"><Badge tone={statusTone(m.status)} className="text-[10px] px-1.5 py-0 rounded">{m.status}</Badge></TD>
                      <TD className="py-1 px-2 text-center text-xs text-muted-foreground font-mono">{m.attempts}</TD>
                      <TD className="py-1 px-2">{m.lastError ? <span className="line-clamp-1 text-[11px] text-rose-500">{m.lastError}</span> : <span className="text-muted-foreground text-xs">—</span>}</TD>
                      <TD className="py-1 px-2 text-right text-[10.5px] text-muted-foreground whitespace-nowrap">{fmt(m.createdAtUtc)}</TD>
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

      <Dialog open={!!detail} onClose={() => setDetail(null)} className="max-w-md rounded-xl p-5">
        {detail && (
          <>
            <DialogHeader title={t('notifications.detailTitle')} />
            <div className="space-y-2.5 text-xs pt-1">
              <Field label={t('notifications.colChannel')} value={detail.channel} />
              <Field label={t('notifications.colRecipient')} value={detail.recipient} />
              {detail.subject && <Field label={t('notifications.colSubject')} value={detail.subject} />}
              <div className="flex gap-4">
                <Field label={t('notifications.colStatus')} value={detail.status} />
                <Field label={t('notifications.colAttempts')} value={String(detail.attempts)} />
              </div>
              <Field label={t('notifications.colCreated')} value={fmt(detail.createdAtUtc)} />
              {detail.lastError && <Field label={t('notifications.colError')} value={detail.lastError} isError />}
              <div>
                <span className="block text-[11px] font-medium text-foreground mb-1">{t('notifications.body')}</span>
                <div className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/80 bg-muted/40 p-2 text-[11px] font-mono leading-relaxed">{detail.body}</div>
              </div>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}

function PushTab() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<string>('all');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [detail, setDetail] = useState<NotificationLog | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const query = useAsync(
    (signal) => notificationLogs.listNotifications(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(status !== 'all' ? { status } : {}),
        ...(category.trim() ? { category: category.trim() } : {}),
        ...(startIso(fromDate) ? { fromDate: startIso(fromDate) } : {}),
        ...(endIso(toDate) ? { toDate: endIso(toDate) } : {}),
      },
      { signal },
    ).catch(() => null),
    [page, pageSize, status, category, search, fromDate, toDate, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="relative min-w-[130px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('notifications.searchTitle')} className="h-7.5 w-full rounded-md pl-7 pr-2 text-[11px] bg-background" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-7.5 w-28 rounded-md text-[11px] bg-background px-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('notifications.allStatuses')}</SelectItem>
              <SelectItem value="Pending">{t('notifications.statusPending')}</SelectItem>
              <SelectItem value="Sent">{t('notifications.statusSent')}</SelectItem>
              <SelectItem value="Failed">{t('notifications.statusFailed')}</SelectItem>
              <SelectItem value="Suppressed">{t('notifications.statusSuppressed')}</SelectItem>
            </SelectContent>
          </Select>
          <Input value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} placeholder={t('notifications.categoryPlaceholder')} className="h-7.5 w-28 rounded-md text-[11px] bg-background px-2" />
          <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="h-7.5 w-32 rounded-md text-[11px] bg-background px-2" />
          <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="h-7.5 w-32 rounded-md text-[11px] bg-background px-2" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">Total: <span className="font-semibold text-foreground">{query.data?.totalCount ?? 0}</span></span>
          <Button type="button" variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)} aria-label="Refresh" className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80">
            <RefreshCw className={cn('h-3 w-3', query.loading && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {query.loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground"><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-xs text-muted-foreground">
            <MessageSquare className="h-6 w-6 text-muted-foreground/50 mb-1.5" />{t('notifications.emptyLogs')}
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/60 md:hidden">
              {items.map((n) => (
                <div key={n.id} onClick={() => setDetail(n)} className="p-2.5 flex flex-col gap-1.5 hover:bg-muted/20 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-foreground truncate">{n.title}</span>
                    <Badge tone={statusTone(n.status)} className="text-[9px] px-1 py-0 rounded">{n.status}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10.5px]">
                    <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{n.category}</Badge>
                    <span className="text-muted-foreground">{n.channels}</span>
                    <Badge tone={n.isRead ? 'info' : 'muted'} className="text-[9px] px-1 py-0 rounded ml-auto">{n.isRead ? t('notifications.read') : t('notifications.unread')}</Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground text-right border-t border-border/40 pt-1">{fmt(n.createdAtUtc)}</span>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table>
                <THead>
                  <TR className="border-b border-border bg-muted/40">
                    <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('notifications.colTitle')}</TH>
                    <TH className="w-28 py-1.5 px-2 text-[10.5px] font-semibold">{t('notifications.colCategory')}</TH>
                    <TH className="w-28 py-1.5 px-2 text-[10.5px] font-semibold">{t('notifications.colChannels')}</TH>
                    <TH className="w-24 py-1.5 px-2 text-[10.5px] font-semibold">{t('notifications.colStatus')}</TH>
                    <TH className="w-20 py-1.5 px-2 text-center text-[10.5px] font-semibold">{t('notifications.colRead')}</TH>
                    <TH className="w-32 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('notifications.colCreated')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((n, i) => (
                    <TR key={n.id} onClick={() => setDetail(n)} className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                      <TD className="py-1 px-2">
                        <div className="min-w-0">
                          <span className="font-semibold text-xs text-foreground block truncate">{n.title}</span>
                          <span className="text-[10px] text-muted-foreground block truncate">{n.templateKey}</span>
                        </div>
                      </TD>
                      <TD className="py-1 px-2"><Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{n.category}</Badge></TD>
                      <TD className="py-1 px-2 text-xs text-muted-foreground">{n.channels}</TD>
                      <TD className="py-1 px-2"><Badge tone={statusTone(n.status)} className="text-[10px] px-1.5 py-0 rounded">{n.status}</Badge></TD>
                      <TD className="py-1 px-2 text-center"><Badge tone={n.isRead ? 'info' : 'muted'} className="text-[10px] px-1.5 py-0 rounded">{n.isRead ? t('notifications.read') : t('notifications.unread')}</Badge></TD>
                      <TD className="py-1 px-2 text-right text-[10.5px] text-muted-foreground whitespace-nowrap">{fmt(n.createdAtUtc)}</TD>
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

      <Dialog open={!!detail} onClose={() => setDetail(null)} className="max-w-md rounded-xl p-5">
        {detail && (
          <>
            <DialogHeader title={t('notifications.detailTitle')} />
            <div className="space-y-2.5 text-xs pt-1">
              <Field label={t('notifications.colTitle')} value={detail.title} />
              <Field label={t('notifications.colTemplate')} value={detail.templateKey} />
              <div className="flex gap-4">
                <Field label={t('notifications.colCategory')} value={detail.category} />
                <Field label={t('notifications.colChannels')} value={detail.channels} />
              </div>
              <Field label={t('notifications.recipientUser')} value={detail.recipientUserId} />
              {detail.targetPlayerId && <Field label={t('notifications.targetDevice')} value={detail.targetPlayerId} />}
              <div className="flex gap-4">
                <Field label={t('notifications.colStatus')} value={detail.status} />
                <Field label={t('notifications.colAttempts')} value={String(detail.attempts)} />
                <Field label={t('notifications.colRead')} value={detail.isRead ? t('notifications.read') : t('notifications.unread')} />
              </div>
              <Field label={t('notifications.colCreated')} value={fmt(detail.createdAtUtc)} />
              {detail.lastError && <Field label={t('notifications.colError')} value={detail.lastError} isError />}
              <div>
                <span className="block text-[11px] font-medium text-foreground mb-1">{t('notifications.body')}</span>
                <div className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/80 bg-muted/40 p-2 text-[11px] font-mono leading-relaxed">{detail.body}</div>
              </div>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}

function Field({ label, value, isError }: { label: string; value: string; isError?: boolean }) {
  return (
    <div>
      <span className="block text-[10.5px] font-medium text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-medium break-all', isError ? 'text-rose-500' : 'text-foreground')}>{value}</span>
    </div>
  );
}

export default NotificationsPage;
