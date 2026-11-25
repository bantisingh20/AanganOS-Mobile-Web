import { useEffect, useMemo, useState } from 'react';
import { Settings, Plus, Pencil, Trash2, Search, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { appConfig, organizations, communities } from '@shared/services';
import type { ConfigRow, UpsertConfigBody } from '@shared/api/config';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';

const SCOPE_PLATFORM = 0;
const SCOPE_COMMUNITY = 1;
const SCOPE_ORGANIZATION = 2;

const fetchOrg = (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
  organizations.list({ search: search || undefined, page, pageSize }, { signal }).then((d) => ({ items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount }));

const fetchComm = (organizationId?: string) => (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
  communities.list({ search: search || undefined, page, pageSize }, organizationId ? { organizationId } : {}, { signal }).then((d) => ({ items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount }));

export function ConfigPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ConfigRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfigRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = useAsync((signal) => appConfig.list(debounced || undefined, { signal }).catch(() => [] as ConfigRow[]), [debounced, reloadKey]);
  const orgQuery = useAsync((signal) => organizations.list({ pageSize: 500 }, { signal }).catch(() => null), []);
  const commQuery = useAsync((signal) => communities.list({ pageSize: 500 }, {}, { signal }).catch(() => null), []);

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const orgName = useMemo(() => new Map((orgQuery.data?.items ?? []).map((o) => [o.id, o.name])), [orgQuery.data]);
  const commName = useMemo(() => new Map((commQuery.data?.items ?? []).map((c) => [c.id, c.name])), [commQuery.data]);
  const reload = () => setReloadKey((k) => k + 1);

  const scopeLabel = (scope: number) => (scope === SCOPE_ORGANIZATION ? t('config.scopeOrganization') : scope === SCOPE_COMMUNITY ? t('config.scopeCommunity') : t('config.scopePlatform'));
  const target = (row: ConfigRow): string => {
    if (row.scope === SCOPE_ORGANIZATION) return row.organizationId ? (orgName.get(row.organizationId) ?? row.organizationId) : '—';
    if (row.scope === SCOPE_COMMUNITY) return row.communityId ? (commName.get(row.communityId) ?? row.communityId) : '—';
    return t('config.allCommunities');
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await appConfig.remove(confirmDelete.id);
      toast.success(t('config.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setConfirmBusy(false); }
  };

  return (
    <div className="w-full space-y-2">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5 text-primary" />{t('config.title')}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{t('config.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} className="h-7 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium">
          <Plus className="h-3 w-3 stroke-[2.5]" />{t('config.add')}
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="relative min-w-[140px] max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('config.searchPlaceholder')} className="h-7.5 w-full rounded-md pl-7 pr-2 text-[11px] bg-background" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">Total: <span className="font-semibold text-foreground">{rows.length}</span></span>
          <Button type="button" variant="outline" size="sm" onClick={reload} aria-label={t('config.refresh')} className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80">
            <RefreshCw className={cn('h-3 w-3', query.loading && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {query.loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground"><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-xs text-muted-foreground">
            <Settings className="h-6 w-6 text-muted-foreground/50 mb-1.5" />{t('config.empty')}
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="divide-y divide-border/60 md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="p-2.5 flex flex-col gap-1.5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-foreground truncate">{row.key}</span>
                    <Badge tone={row.scope === SCOPE_PLATFORM ? 'muted' : 'default'} className="text-[9px] px-1 py-0 rounded shrink-0">
                      {scopeLabel(row.scope)}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{target(row)}</div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10.5px]">
                    <code className="text-muted-foreground truncate max-w-[200px] font-mono text-[10.5px]">{row.value}</code>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => setEditing(row)} title={t('config.edit')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary transition-colors">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(row)} title={t('config.delete')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
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
                    <TH className="w-48 py-1.5 px-2 text-[10.5px] font-semibold">{t('config.colKey')}</TH>
                    <TH className="w-28 py-1.5 px-2 text-[10.5px] font-semibold">{t('config.colScope')}</TH>
                    <TH className="w-44 py-1.5 px-2 text-[10.5px] font-semibold">{t('config.colTarget')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('config.colValue')}</TH>
                    <TH className="w-16 py-1.5 px-2 text-right text-[10.5px] font-semibold">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((row, i) => (
                    <TR key={row.id} className="hover:bg-muted/30 transition-colors">
                      <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{i + 1}</TD>
                      <TD className="py-1 px-2 font-semibold text-xs text-foreground truncate">{row.key}</TD>
                      <TD className="py-1 px-2"><Badge tone={row.scope === SCOPE_PLATFORM ? 'muted' : 'default'} className="text-[10px] px-1.5 py-0 rounded">{scopeLabel(row.scope)}</Badge></TD>
                      <TD className="py-1 px-2 text-xs text-muted-foreground truncate">{target(row)}</TD>
                      <TD className="py-1 px-2"><code className="text-xs font-mono text-muted-foreground break-all">{row.value}</code></TD>
                      <TD className="py-1 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => setEditing(row)} title={t('config.edit')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(row)} title={t('config.delete')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors">
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
      </div>

      <ConfigFormDialog open={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
      <ConfigFormDialog open={!!editing} row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      <ConfirmDialog open={!!confirmDelete} tone="danger" title={t('config.delete')} description={confirmDelete ? t('config.deleteConfirm', { key: confirmDelete.key }) : ''} confirmLabel={t('config.delete')} cancelLabel={t('orgs.cancel')} busy={confirmBusy} onConfirm={doDelete} onClose={() => setConfirmDelete(null)} />
    </div>
  );
}

function ConfigFormDialog({ open, row, onClose, onSaved }: { open: boolean; row?: ConfigRow | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!row;
  const [key, setKey] = useState('');
  const [scope, setScope] = useState(String(SCOPE_PLATFORM));
  const [organizationId, setOrganizationId] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKey(row?.key ?? '');
    setScope(String(row?.scope ?? SCOPE_PLATFORM));
    setOrganizationId(row?.organizationId ?? '');
    setCommunityId(row?.communityId ?? '');
    setValue(row?.value ?? '');
  }, [open, row]);

  const scopeNum = Number.parseInt(scope, 10);
  const needsOrg = scopeNum === SCOPE_ORGANIZATION;
  const needsComm = scopeNum === SCOPE_COMMUNITY;
  const canSubmit = !!key.trim() && !!value.trim() && (!needsOrg || !!organizationId) && (!needsComm || !!communityId);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const body: UpsertConfigBody = {
        key: key.trim(), scope: scopeNum, organizationId: needsOrg ? organizationId || null : null,
        communityId: needsComm ? communityId || null : null, value,
      };
      await appConfig.upsert(body);
      toast.success(isEdit ? t('config.updated') : t('config.created'));
      onSaved();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md rounded-lg p-5">
      <DialogHeader title={isEdit ? t('config.editTitle') : t('config.addTitle')} />
      <form onSubmit={submit} className="flex flex-col gap-3 pt-1">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('config.keyLabel')} *</label>
          <Input autoFocus value={key} disabled={isEdit} onChange={(e) => setKey(e.target.value)} placeholder={t('config.keyPlaceholder')} maxLength={200} className="h-9 text-xs rounded-[4px]" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('config.colScope')} *</label>
          <Select value={scope} disabled={isEdit} onValueChange={(v) => { setScope(v); setOrganizationId(''); setCommunityId(''); }}>
            <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={String(SCOPE_PLATFORM)}>{t('config.scopePlatformFull')}</SelectItem>
              <SelectItem value={String(SCOPE_ORGANIZATION)}>{t('config.scopeOrganization')}</SelectItem>
              <SelectItem value={String(SCOPE_COMMUNITY)}>{t('config.scopeCommunity')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {needsOrg && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('config.scopeOrganization')} *</label>
            <EntitySelect value={organizationId || null} onChange={(v) => setOrganizationId(v ?? '')} fetchPage={fetchOrg}
              resolveLabel={(id, sig) => organizations.get(id, { signal: sig }).then((o) => o.name).catch(() => null)} disabled={isEdit} placeholder={t('config.selectOrganization')}
              className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3" />
          </div>
        )}
        {needsComm && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('config.scopeCommunity')} *</label>
            <EntitySelect value={communityId || null} onChange={(v) => setCommunityId(v ?? '')} fetchPage={fetchComm()}
              resolveLabel={(id, sig) => communities.get(id, { signal: sig }).then((c) => c.name).catch(() => null)} disabled={isEdit} placeholder={t('config.selectCommunity')}
              className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3" />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('config.valueLabel')} *</label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('config.valuePlaceholder')} maxLength={2000} className="h-9 text-xs rounded-[4px]" />
        </div>
        <div className="mt-2 pt-3 border-t border-border/70 flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="h-8.5 px-4 rounded-[4px] text-xs font-medium border-border/80">
            {t('orgs.cancel')}
          </Button>
          <Button type="submit" disabled={busy || !canSubmit} className="h-8.5 px-4 rounded-[4px] text-xs font-medium">
            {busy ? t('common.saving') : isEdit ? t('config.saveChanges') : t('config.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default ConfigPage;
