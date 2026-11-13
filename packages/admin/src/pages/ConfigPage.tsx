import { useEffect, useMemo, useState } from 'react';
import { Settings, Plus, Pencil, Trash2, Search, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { SelectField } from '@shared/components/SelectField';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Toaster } from '@shared/components/ui/sonner';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { appConfig, organizations, communities } from '@shared/services';
import type { ConfigRow, UpsertConfigBody } from '@shared/api/config';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';

const SCOPE_PLATFORM = 0;
const SCOPE_COMMUNITY = 1;
const SCOPE_ORGANIZATION = 2;

type Option = { value: string; label: string };

async function fetchOrgPage(search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> {
  const d = await organizations.list({ search: search || undefined, page, pageSize }, { signal });
  return { items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount };
}
function makeCommunityFetch(organizationId?: string) {
  return async (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> => {
    const d = await communities.list({ search: search || undefined, page, pageSize }, organizationId ? { organizationId } : {}, { signal });
    return { items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount };
  };
}
async function resolveCommunityLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try { const c = await communities.get(id, { signal }); return c.name; } catch { return null; }
}
async function resolveOrgLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try { const o = await organizations.get(id, { signal }); return o.name; } catch { return null; }
}

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
  const scopeTone = (scope: number): 'default' | 'success' | 'muted' => (scope === SCOPE_ORGANIZATION ? 'default' : scope === SCOPE_COMMUNITY ? 'default' : 'muted');
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
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
              <Settings className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('config.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('config.subtitle')}</p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)} className="h-9 shrink-0 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs hover:bg-emerald-700">
            <Plus className="h-4 w-4" />{t('config.add')}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('config.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
        </div>
        <button type="button" onClick={reload} aria-label={t('config.refresh')} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-emerald-600">
          <RefreshCw className={`h-4 w-4 ${query.loading ? 'animate-spin' : ''}`} />
        </button>
      </Card>

      {rows.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {query.loading ? t('common.loading') : t('config.empty')}
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('config.colKey')}</TH>
                <TH className="w-36">{t('config.colScope')}</TH>
                <TH className="w-52">{t('config.colTarget')}</TH>
                <TH>{t('config.colValue')}</TH>
                <TH className="w-28 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row, i) => (
                <TR key={row.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">{i + 1}</TD>
                  <TD><span className="text-[13px] font-semibold">{row.key}</span></TD>
                  <TD><Badge tone={scopeTone(row.scope)}>{scopeLabel(row.scope)}</Badge></TD>
                  <TD className="text-[11px] text-muted-foreground">{target(row)}</TD>
                  <TD><code className="break-all text-xs">{row.value}</code></TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => setEditing(row)} aria-label={t('config.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(row)} aria-label={t('config.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <ConfigFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => { setCreating(false); reload(); }}
      />
      <ConfigFormDialog
        open={!!editing}
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('config.delete')}
        description={confirmDelete ? t('config.deleteConfirm', { key: confirmDelete.key }) : ''}
        confirmLabel={t('config.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />

      <Toaster position="top-center" richColors />
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

  const scopeOptions: Option[] = [
    { value: String(SCOPE_PLATFORM), label: t('config.scopePlatformFull') },
    { value: String(SCOPE_ORGANIZATION), label: t('config.scopeOrganization') },
    { value: String(SCOPE_COMMUNITY), label: t('config.scopeCommunity') },
  ];

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const body: UpsertConfigBody = {
        key: key.trim(),
        scope: scopeNum,
        organizationId: needsOrg ? organizationId || null : null,
        communityId: needsComm ? communityId || null : null,
        value,
      };
      await appConfig.upsert(body);
      toast.success(isEdit ? t('config.updated') : t('config.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader title={isEdit ? t('config.editTitle') : t('config.addTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('config.keyLabel')}</label>
          <Input autoFocus value={key} disabled={isEdit} onChange={(e) => setKey(e.target.value)} placeholder={t('config.keyPlaceholder')} maxLength={200} />
        </div>
        <SelectField label={t('config.colScope')} value={scope} options={scopeOptions} disabled={isEdit} onChange={(v) => { setScope(v); setOrganizationId(''); setCommunityId(''); }} />
        {needsOrg ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('config.scopeOrganization')}</label>
            <EntitySelect value={organizationId || null} onChange={(v) => setOrganizationId(v ?? '')} fetchPage={fetchOrgPage} resolveLabel={resolveOrgLabel} disabled={isEdit} placeholder={t('config.selectOrganization')} />
          </div>
        ) : null}
        {needsComm ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('config.scopeCommunity')}</label>
            <EntitySelect value={communityId || null} onChange={(v) => setCommunityId(v ?? '')} fetchPage={makeCommunityFetch()} resolveLabel={resolveCommunityLabel} disabled={isEdit} placeholder={t('config.selectCommunity')} />
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('config.valueLabel')}</label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('config.valuePlaceholder')} maxLength={2000} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !canSubmit} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{isEdit ? t('config.saveChanges') : t('config.save')}</Button>
      </DialogFooter>
    </Dialog>
  );
}
