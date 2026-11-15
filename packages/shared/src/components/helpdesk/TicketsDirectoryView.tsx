import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LifeBuoy, Search, RefreshCw, Table as TableIcon, LayoutGrid,
  Plus, ArrowLeftRight, Clock, ChevronRight, Camera, X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { SmartFormDrawer } from '@shared/components/ui/smart-form-drawer';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { TextField } from '@shared/components/TextField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { AdaptiveShell } from '@shared/components/layout/AdaptiveShell';
import { tickets, masterData, residents, files } from '@shared/services';
import type { Ticket } from '@shared/api/tickets';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';

const STATUS_ACCENT: Record<string, { rail: string; pill: string; text: string; tone: 'success' | 'warning' | 'danger' | 'default' | 'muted' }> = {
  new: { rail: 'bg-sky-500', pill: 'bg-sky-500', text: 'text-sky-600', tone: 'default' },
  open: { rail: 'bg-sky-500', pill: 'bg-sky-500', text: 'text-sky-600', tone: 'default' },
  assigned: { rail: 'bg-indigo-500', pill: 'bg-indigo-500', text: 'text-indigo-600', tone: 'warning' },
  in_progress: { rail: 'bg-amber-500', pill: 'bg-amber-500', text: 'text-amber-600', tone: 'warning' },
  waiting: { rail: 'bg-orange-500', pill: 'bg-orange-500', text: 'text-orange-600', tone: 'warning' },
  resolved: { rail: 'bg-emerald-500', pill: 'bg-emerald-500', text: 'text-emerald-600', tone: 'success' },
  closed: { rail: 'bg-slate-500', pill: 'bg-slate-500', text: 'text-slate-600', tone: 'muted' },
  reopened: { rail: 'bg-rose-500', pill: 'bg-rose-500', text: 'text-rose-600', tone: 'danger' },
};

function accentFor(status: string) {
  const s = status.toLowerCase();
  return STATUS_ACCENT[s] ?? STATUS_ACCENT.new!;
}

function priorityTone(priority: string): 'success' | 'warning' | 'danger' | 'default' | 'muted' {
  const p = priority.toLowerCase();
  if (p === 'high' || p === 'urgent' || p === 'critical') return 'danger';
  if (p === 'medium' || p === 'normal') return 'warning';
  if (p === 'low') return 'muted';
  return 'default';
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export interface TicketsDirectoryViewProps {
  standalone?: boolean;
  initialTab?: 'all' | 'open' | 'in_progress' | 'resolved';
}

export function TicketsDirectoryView({ standalone = false, initialTab = 'all' }: TicketsDirectoryViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isSmall = useIsSmallScreen();

  const [tab, setTab] = useState<'all' | 'open' | 'in_progress' | 'resolved'>(initialTab);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [desktopView, setDesktopView] = useState<'table' | 'cards'>('table');
  const [reloadKey, setReloadKey] = useState(0);

  // Drawers and Dialogs
  const [raiseDrawerOpen, setRaiseDrawerOpen] = useState(false);
  const [statusDialogTicket, setStatusDialogTicket] = useState<Ticket | null>(null);

  const query = useAsync(
    (signal) => {
      let statusFilter: string | undefined;
      if (tab === 'open') statusFilter = 'new';
      else if (tab === 'in_progress') statusFilter = 'in_progress';
      else if (tab === 'resolved') statusFilter = 'resolved';

      return tickets.list(
        { page, pageSize, sort: 'createdAtUtc:desc' },
        {
          ...(statusFilter ? { status: statusFilter } : {}),
        },
        { signal },
      ).catch(() => null);
    },
    [tab, page, pageSize, reloadKey],
  );

  const allItems = useMemo(() => query.data?.items ?? [], [query.data]);
  const items = useMemo(() => {
    if (!search.trim()) return allItems;
    const q = search.toLowerCase();
    return allItems.filter(
      (tk) =>
        tk.title.toLowerCase().includes(q) ||
        tk.category.toLowerCase().includes(q) ||
        (tk.description && tk.description.toLowerCase().includes(q)),
    );
  }, [allItems, search]);

  const totalCount = query.data?.totalCount ?? 0;
  const reload = () => setReloadKey((k) => k + 1);

  return (
    <AdaptiveShell
      showBack={standalone}
      title={t('helpdesk.title', 'Helpdesk & Complaints')}
      subtitle={t('helpdesk.subtitle', 'Raise complaints, maintenance requests, and track SLA')}
      rightAction={
        <Button
          type="button"
          size="sm"
          onClick={() => setRaiseDrawerOpen(true)}
          className="h-9 gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {t('helpdesk.newTicket', 'Raise Ticket')}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Filter Navigation Tabs */}
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border/60 pb-3">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'all', label: 'All Tickets' },
                { id: 'open', label: 'Open' },
                { id: 'in_progress', label: 'In Progress' },
                { id: 'resolved', label: 'Resolved / Closed' },
              ] as const
            ).map((tTab) => (
              <button
                key={tTab.id}
                type="button"
                onClick={() => {
                  setTab(tTab.id);
                  setPage(1);
                }}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                  tab === tTab.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {tTab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isSmall && (
              <div className="flex items-center rounded-xl border border-border/60 bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setDesktopView('table')}
                  className={cn(
                    'p-1.5 rounded-lg text-xs transition-colors',
                    desktopView === 'table' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground',
                  )}
                  title="Table view"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDesktopView('cards')}
                  className={cn(
                    'p-1.5 rounded-lg text-xs transition-colors',
                    desktopView === 'cards' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground',
                  )}
                  title="Card view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reload}
              className="h-8 w-8 p-0 rounded-xl border-border/60"
              title="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', query.loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets by title, category, or description…"
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-4 text-xs font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          />
        </div>

        {/* Tickets Content View */}
        {query.loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin text-primary mb-2" />
            <p className="text-xs font-medium">Loading tickets…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
              <LifeBuoy className="h-7 w-7" />
            </div>
            <h3 className="text-sm font-bold text-foreground">No tickets found</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {search.trim() ? 'No tickets matched your search keywords.' : 'No tickets logged in this tab yet.'}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setRaiseDrawerOpen(true)}
                className="h-9 rounded-xl bg-primary text-xs text-primary-foreground font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Raise Ticket
              </Button>
            </div>
          </div>
        ) : !isSmall && desktopView === 'table' ? (
          /* Desktop Data Table */
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xs">
            <Table>
              <THead className="bg-muted/40">
                <TR>
                  <TH className="py-3 px-4 text-xs font-bold text-foreground">Title & Details</TH>
                  <TH className="py-3 px-4 text-xs font-bold text-foreground">Category</TH>
                  <TH className="py-3 px-4 text-xs font-bold text-foreground">Priority</TH>
                  <TH className="py-3 px-4 text-xs font-bold text-foreground">Status</TH>
                  <TH className="py-3 px-4 text-xs font-bold text-foreground">Created</TH>
                  <TH className="py-3 px-4 text-right text-xs font-bold text-foreground">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((tk) => {
                  const acc = accentFor(tk.status);

                  return (
                    <TR key={tk.id} className="hover:bg-muted/20 transition-colors">
                      <TD className="py-3 px-4">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => navigate(`/my-tickets/${tk.id}`)}
                            className="font-bold text-foreground text-xs hover:text-primary transition-colors text-left truncate block max-w-sm"
                          >
                            {tk.title}
                          </button>
                          {tk.description ? (
                            <p className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5">
                              {tk.description}
                            </p>
                          ) : null}
                        </div>
                      </TD>

                      <TD className="py-3 px-4 text-xs">
                        <Badge tone="default">{tk.category}</Badge>
                        {tk.subcategory ? (
                          <span className="block text-[11px] text-muted-foreground mt-0.5">{tk.subcategory}</span>
                        ) : null}
                      </TD>

                      <TD className="py-3 px-4">
                        <Badge tone={priorityTone(tk.priority)}>{tk.priority}</Badge>
                      </TD>

                      <TD className="py-3 px-4">
                        <Badge tone={acc.tone}>{tk.status}</Badge>
                      </TD>

                      <TD className="py-3 px-4 text-xs text-muted-foreground">
                        {formatDate(tk.createdAtUtc)}
                      </TD>

                      <TD className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setStatusDialogTicket(tk)}
                            className="h-8 rounded-lg text-xs"
                            title="Update Status"
                          >
                            <ArrowLeftRight className="h-3 w-3 mr-1 text-primary" /> Status
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/my-tickets/${tk.id}`)}
                            className="h-8 rounded-lg text-xs"
                          >
                            View
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        ) : (
          /* Mobile / Card Grid View */
          <div className="space-y-3">
            {items.map((tk) => {
              const acc = accentFor(tk.status);

              return (
                <div
                  key={tk.id}
                  onClick={() => navigate(`/my-tickets/${tk.id}`)}
                  className="group relative flex cursor-pointer overflow-hidden rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm"
                >
                  <div className={cn('absolute left-0 top-0 bottom-0 w-1.5', acc.rail)} />

                  <div className="flex-1 min-w-0 pl-1.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-extrabold text-foreground truncate group-hover:text-primary transition-colors">
                          {tk.title}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                          <span className="font-semibold text-primary">{tk.category}</span>
                          {tk.subcategory ? <span>• {tk.subcategory}</span> : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Badge tone={acc.tone}>{tk.status}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>

                    {tk.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {tk.description}
                      </p>
                    ) : null}

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground/70" />
                        <span>{formatDate(tk.createdAtUtc)}</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <Badge tone={priorityTone(tk.priority)} className="text-[10px] py-0 px-1.5">
                          {tk.priority}
                        </Badge>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusDialogTicket(tk);
                          }}
                          className="px-2 py-0.5 rounded-lg border border-border/80 text-[11px] font-semibold text-foreground hover:bg-muted"
                        >
                          Change Status
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalCount > pageSize && (
          <div className="pt-2 flex justify-end">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {/* 1. Raise Ticket Drawer (> 3 fields -> Drawer) */}
      <RaiseTicketDrawer
        open={raiseDrawerOpen}
        onClose={() => setRaiseDrawerOpen(false)}
        onSaved={() => {
          setRaiseDrawerOpen(false);
          reload();
        }}
      />

      {/* 2. Change Ticket Status Dialog (<= 3 fields -> Dialog) */}
      {statusDialogTicket && (
        <ChangeStatusDialog
          ticket={statusDialogTicket}
          onClose={() => setStatusDialogTicket(null)}
          onSaved={() => {
            setStatusDialogTicket(null);
            reload();
          }}
        />
      )}
    </AdaptiveShell>
  );
}

function RaiseTicketDrawer({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const resident = me.data?.resident ?? null;
  const units = me.data?.units ?? [];
  const soleUnitId = units.length === 1 ? units[0]!.unitId : null;

  const [unitId, setUnitId] = useState<string | null>(soleUnitId);
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveUnitId = unitId ?? soleUnitId;
  const selectedUnit = units.find((u) => u.unitId === effectiveUnitId) ?? null;
  const communityId = selectedUnit?.communityId ?? resident?.communityId ?? units[0]?.communityId ?? null;

  const cats = useAsync((signal) => masterData.list('Ticket_Category', communityId, { signal }).catch(() => []), [communityId]);
  const subcats = useAsync((signal) => masterData.list('Ticket_Subcategory', communityId, { signal }).catch(() => []), [communityId]);
  const prios = useAsync((signal) => masterData.list('Ticket_Priority', communityId, { signal }).catch(() => []), [communityId]);

  const catOptions: SelectOption[] = (cats.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  const subOptions: SelectOption[] = (subcats.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  const prioOptions: SelectOption[] = (prios.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  const unitOptions: SelectOption[] = units.map((u) => ({ value: u.unitId, label: `Flat / Unit ${u.unitNumber}` }));

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || pendingFiles.length >= 4) return;
    setPendingFiles((p) => [...p, file]);
    setPreviews((p) => [...p, URL.createObjectURL(file)]);
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    setPendingFiles((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (busy) return;
    if (!effectiveUnitId) {
      toast.error('Please select destination unit');
      return;
    }
    if (!category) {
      toast.error('Please select complaint category');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter a brief title');
      return;
    }

    setBusy(true);
    try {
      const uploadedIds: string[] = [];
      if (communityId) {
        for (const f of pendingFiles) {
          const up = await files.upload(f, { owningResourceType: 'Ticket', communityId });
          uploadedIds.push(up.reference);
        }
      }

      await tickets.create({
        hostUnitId: effectiveUnitId,
        title: title.trim(),
        description: description.trim(),
        category,
        subcategory: subcategory ?? undefined,
        priority: priority ?? 'normal',
        attachmentFileIds: uploadedIds.length > 0 ? uploadedIds : undefined,
      });

      toast.success(t('raiseTicket.created', 'Ticket raised successfully'));
      // Reset fields
      setTitle('');
      setDescription('');
      setCategory(null);
      setSubcategory(null);
      setPendingFiles([]);
      setPreviews([]);
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SmartFormDrawer
      open={open}
      onClose={onClose}
      title="Raise Support Ticket"
      subtitle="Report an issue, maintenance request or society complaint"
      fieldsCount={6}
      onSave={submit}
      saveLabel={busy ? 'Submitting…' : 'Submit Ticket'}
      isSaving={busy}
      cancelLabel="Cancel"
    >
      <div className="space-y-4 py-2">
        {/* Unit Selector */}
        {units.length > 1 && (
          <div>
            <label className="mb-1.5 block font-bold text-foreground text-xs">Flat / Unit *</label>
            <SelectField
              value={effectiveUnitId}
              options={unitOptions}
              onChange={setUnitId}
              placeholder="Select your flat…"
            />
          </div>
        )}

        {/* Category & Subcategory */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block font-bold text-foreground text-xs">Category *</label>
            <SelectField
              value={category}
              options={catOptions.length > 0 ? catOptions : [{ value: 'electrical', label: 'Electrical' }, { value: 'plumbing', label: 'Plumbing' }, { value: 'carpentry', label: 'Carpentry' }, { value: 'general', label: 'General' }]}
              onChange={setCategory}
              placeholder="Select category…"
            />
          </div>

          <div>
            <label className="mb-1.5 block font-bold text-foreground text-xs">Subcategory</label>
            <SelectField
              value={subcategory}
              options={subOptions}
              onChange={setSubcategory}
              placeholder="Select subcategory…"
            />
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground text-xs">Priority</label>
          <SelectField
            value={priority}
            options={prioOptions.length > 0 ? prioOptions : [{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]}
            onChange={setPriority}
            placeholder="Select urgency level…"
          />
        </div>

        {/* Title */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground text-xs">Issue Title *</label>
          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief summary (e.g. Water leakage in bathroom)"
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground text-xs">Detailed Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain the issue with location details, timings, etc."
            rows={3}
            className="w-full rounded-xl border border-border bg-background p-3 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs resize-none"
          />
        </div>

        {/* Photos */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground text-xs">Attach Photos (Up to 4)</label>
          <div className="flex items-center gap-3 flex-wrap">
            {previews.map((src, i) => (
              <div key={i} className="relative h-16 w-16 rounded-xl border border-border overflow-hidden shadow-xs">
                <img src={src} alt="attachment" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {previews.length < 4 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Camera className="h-5 w-5" />
                <span className="text-[10px] font-semibold mt-1">Add</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPickPhoto}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </SmartFormDrawer>
  );
}

function ChangeStatusDialog({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: Ticket;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [toStatus, setToStatus] = useState(ticket.status);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await tickets.changeStatus(ticket.id, {
        toStatus,
        reason: reason.trim() || undefined,
      });
      toast.success('Ticket status updated');
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} className="max-w-md">
      <DialogHeader title="Update Ticket Status" description={ticket.title} />
      <div className="space-y-3 py-3">
        <div>
          <label className="mb-1.5 block font-bold text-foreground text-xs">New Status *</label>
          <SelectField
            value={toStatus}
            options={[
              { value: 'new', label: 'New / Open' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'waiting', label: 'Waiting for Parts / Info' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ]}
            onChange={setToStatus}
          />
        </div>

        <div>
          <label className="mb-1.5 block font-bold text-foreground text-xs">Reason / Note (Optional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Electrician visited and repaired wire"
            className="h-9.5 w-full rounded-xl border border-border px-3 text-xs"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-xl text-xs">
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={busy}
          className="h-9 rounded-xl bg-primary text-xs text-primary-foreground font-semibold"
        >
          {busy ? 'Saving…' : 'Update Status'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export default TicketsDirectoryView;
