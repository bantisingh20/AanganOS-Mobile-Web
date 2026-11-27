import { useMemo, useState } from 'react';
import { Bell, Mail, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { PageShell, FilterBar, DataList, ResponsiveTabs, filterControlClass, type FilterLayout } from '@shared/components/layout';
import { notificationLogs } from '@shared/services';
import type { MessageLog, NotificationLog } from '@shared/api/notificationLogs';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';
import { EMPTY, formatDateTime } from '@shared/lib/format';
import { statusTone } from '@shared/lib/statusTone';
import { useListState } from '@shared/lib/hooks/useListState';

type Tab = 'messages' | 'push';

const startIso = (date: string) => { if (!date) return undefined; const d = new Date(`${date}T00:00:00`); return Number.isNaN(d.getTime()) ? undefined : d.toISOString(); };
const endIso = (date: string) => { if (!date) return undefined; const d = new Date(`${date}T23:59:59.999`); return Number.isNaN(d.getTime()) ? undefined : d.toISOString(); };

function RefreshTrailing({ total, loading, onRefresh }: { total: number; loading: boolean; onRefresh: () => void }) {
  const { t } = useTranslation();
  const compact = useIsCompact();
  return (
    <>
      <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>{t('common.total')}: <span className="font-semibold text-foreground">{total}</span></span>
      <RefreshButton onClick={onRefresh} loading={loading} />
    </>
  );
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const compact = useIsCompact();
  const [tab, setTab] = useState<Tab>('messages');

  // Desktop keeps the original segmented switcher in the header; compact uses ResponsiveTabs.
  const desktopSwitcher = (
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
  );

  return (
    <PageShell title={t('notifications.logsTitle')} subtitle={t('notifications.logsSubtitle')} icon={<Bell />} className="w-full"
      actions={compact ? undefined : desktopSwitcher}>
      {compact && (
        <ResponsiveTabs<Tab>
          tabs={[
            { key: 'messages', label: t('notifications.tabMessages') },
            { key: 'push', label: t('notifications.tabPush') },
          ]}
          value={tab}
          onChange={setTab}
        />
      )}
      {tab === 'messages' ? <MessagesTab /> : <PushTab />}
    </PageShell>
  );
}

function MessagesTab() {
  const { t } = useTranslation();
  const { search: recipient, setSearch: setRecipient, page, setPage, pageSize, setPageSize, reloadKey, reload, resetPage } = useListState();
  const [channel, setChannel] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [detail, setDetail] = useState<MessageLog | null>(null);

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
  const total = query.data?.totalCount ?? 0;

  const activeFilters = (channel !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0) + (fromDate ? 1 : 0) + (toDate ? 1 : 0);
  const resetFilters = () => { setChannel('all'); setStatus('all'); setFromDate(''); setToDate(''); resetPage(); };

  const renderFilters = (layout: FilterLayout) => (
    <>
      <Select value={channel} onValueChange={(v) => { setChannel(v); resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-28')}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('notifications.allChannels')}</SelectItem>
          <SelectItem value="Email">Email</SelectItem>
          <SelectItem value="Sms">SMS</SelectItem>
          <SelectItem value="WhatsApp">WhatsApp</SelectItem>
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(v) => { setStatus(v); resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-28')}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('notifications.allStatuses')}</SelectItem>
          <SelectItem value="Pending">{t('notifications.statusPending')}</SelectItem>
          <SelectItem value="Sent">{t('notifications.statusSent')}</SelectItem>
          <SelectItem value="Failed">{t('notifications.statusFailed')}</SelectItem>
        </SelectContent>
      </Select>
      <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); resetPage(); }} className={filterControlClass(layout, 'w-32')} />
      <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); resetPage(); }} className={filterControlClass(layout, 'w-32')} />
    </>
  );

  return (
    <div className="space-y-2">
      <FilterBar
        search={{ value: recipient, onChange: setRecipient, placeholder: t('notifications.searchRecipient') }}
        filters={renderFilters}
        activeCount={activeFilters}
        onReset={resetFilters}
        trailing={<RefreshTrailing total={total} loading={query.loading} onRefresh={reload} />}
      />

      <DataList
        items={items}
        keyOf={(m) => m.id}
        loading={query.loading}
        emptyIcon={<Mail className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={t('notifications.emptyLogs')}
        onItemClick={setDetail}
        pagination={{ page, pageSize, total, onPageChange: setPage, onPageSizeChange: setPageSize }}
        renderCard={(m) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded shrink-0">{m.channel}</Badge>
                  <span className="truncate text-sm font-semibold text-foreground">{m.recipient}</span>
                </div>
                {m.subject && <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.subject}</p>}
              </div>
              <Badge tone={statusTone(m.status)} className="text-xs px-1.5 py-0 rounded shrink-0">{m.status}</Badge>
            </div>
            {m.lastError && <p className="line-clamp-1 text-xs text-rose-500">{m.lastError}</p>}
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Attempts: {m.attempts}</span>
              <span>{formatDateTime(m.createdAtUtc)}</span>
            </div>
          </>
        )}
        renderTable={() => (
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
                  <TD className="py-1 px-2">{m.lastError ? <span className="line-clamp-1 text-[11px] text-rose-500">{m.lastError}</span> : <span className="text-muted-foreground text-xs">{EMPTY}</span>}</TD>
                  <TD className="py-1 px-2 text-right text-[10.5px] text-muted-foreground whitespace-nowrap">{formatDateTime(m.createdAtUtc)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />

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
              <Field label={t('notifications.colCreated')} value={formatDateTime(detail.createdAtUtc)} />
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
  const { search, setSearch, page, setPage, pageSize, setPageSize, reloadKey, reload, resetPage } = useListState();
  const [status, setStatus] = useState<string>('all');
  const [category, setCategory] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [detail, setDetail] = useState<NotificationLog | null>(null);

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
  const total = query.data?.totalCount ?? 0;

  const activeFilters = (status !== 'all' ? 1 : 0) + (category.trim() ? 1 : 0) + (fromDate ? 1 : 0) + (toDate ? 1 : 0);
  const resetFilters = () => { setStatus('all'); setCategory(''); setFromDate(''); setToDate(''); resetPage(); };

  const renderFilters = (layout: FilterLayout) => (
    <>
      <Select value={status} onValueChange={(v) => { setStatus(v); resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-28')}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('notifications.allStatuses')}</SelectItem>
          <SelectItem value="Pending">{t('notifications.statusPending')}</SelectItem>
          <SelectItem value="Sent">{t('notifications.statusSent')}</SelectItem>
          <SelectItem value="Failed">{t('notifications.statusFailed')}</SelectItem>
          <SelectItem value="Suppressed">{t('notifications.statusSuppressed')}</SelectItem>
        </SelectContent>
      </Select>
      <Input value={category} onChange={(e) => { setCategory(e.target.value); resetPage(); }} placeholder={t('notifications.categoryPlaceholder')} className={filterControlClass(layout, 'w-28')} />
      <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); resetPage(); }} className={filterControlClass(layout, 'w-32')} />
      <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); resetPage(); }} className={filterControlClass(layout, 'w-32')} />
    </>
  );

  return (
    <div className="space-y-2">
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t('notifications.searchTitle') }}
        filters={renderFilters}
        activeCount={activeFilters}
        onReset={resetFilters}
        trailing={<RefreshTrailing total={total} loading={query.loading} onRefresh={reload} />}
      />

      <DataList
        items={items}
        keyOf={(n) => n.id}
        loading={query.loading}
        emptyIcon={<MessageSquare className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={t('notifications.emptyLogs')}
        onItemClick={setDetail}
        pagination={{ page, pageSize, total, onPageChange: setPage, onPageSizeChange: setPageSize }}
        renderCard={(n) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{n.title}</div>
                {n.templateKey && <div className="truncate text-xs text-muted-foreground">{n.templateKey}</div>}
              </div>
              <Badge tone={statusTone(n.status)} className="text-xs px-1.5 py-0 rounded shrink-0">{n.status}</Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{n.category}</Badge>
              <span className="truncate text-muted-foreground">{n.channels}</span>
              <Badge tone={n.isRead ? 'info' : 'muted'} className="text-[10px] px-1.5 py-0 rounded ml-auto shrink-0">{n.isRead ? t('notifications.read') : t('notifications.unread')}</Badge>
            </div>
            <span className="text-right text-xs text-muted-foreground">{formatDateTime(n.createdAtUtc)}</span>
          </>
        )}
        renderTable={() => (
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
                  <TD className="py-1 px-2 text-right text-[10.5px] text-muted-foreground whitespace-nowrap">{formatDateTime(n.createdAtUtc)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />

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
              <Field label={t('notifications.colCreated')} value={formatDateTime(detail.createdAtUtc)} />
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
