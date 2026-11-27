import { useEffect, useMemo, useState } from 'react';
import { Settings, Plus, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { EntitySelect } from '@shared/components/form/EntitySelect';
import { appConfig, organizations, communities } from '@shared/services';
import type { ConfigRow, UpsertConfigBody } from '@shared/api/config';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { tryToast } from '@shared/lib/withToast';
import { useListState } from '@shared/lib/hooks/useListState';
import { EMPTY } from '@shared/lib/format';
import { fetchOrgPage, fetchCommunityPage, resolveOrgLabel, resolveCommunityLabel } from '@shared/lib/entityFetchers';
import { PageShell, FilterBar, DataList } from '@shared/components/layout';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';

const SCOPE_PLATFORM = 0;
const SCOPE_COMMUNITY = 1;
const SCOPE_ORGANIZATION = 2;

export function ConfigPage() {
  const { t } = useTranslation();
  const compact = useIsCompact();
  const { search, setSearch, reloadKey, reload } = useListState();
  const [debounced, setDebounced] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ConfigRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfigRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

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

  const scopeLabel = (scope: number) => (scope === SCOPE_ORGANIZATION ? t('config.scopeOrganization') : scope === SCOPE_COMMUNITY ? t('config.scopeCommunity') : t('config.scopePlatform'));
  const target = (row: ConfigRow): string => {
    if (row.scope === SCOPE_ORGANIZATION) return row.organizationId ? (orgName.get(row.organizationId) ?? row.organizationId) : EMPTY;
    if (row.scope === SCOPE_COMMUNITY) return row.communityId ? (commName.get(row.communityId) ?? row.communityId) : EMPTY;
    return t('config.allCommunities');
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      const ok = await tryToast(() => appConfig.remove(confirmDelete.id), t('config.deleted'));
      if (ok) { setConfirmDelete(null); reload(); }
    } finally { setConfirmBusy(false); }
  };

  const actionSize = compact ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded-[3px]';
  const actionIcon = compact ? 'h-4 w-4' : 'h-3 w-3';
  const rowActions = (row: ConfigRow) => (
    <div className="flex items-center justify-end gap-1 shrink-0">
      <button type="button" onClick={() => setEditing(row)} title={t('config.edit')} className={cn('flex items-center justify-center border border-border/80 text-muted-foreground hover:text-primary transition-colors', actionSize)}>
        <Pencil className={actionIcon} />
      </button>
      <button type="button" onClick={() => setConfirmDelete(row)} title={t('config.delete')} className={cn('flex items-center justify-center border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors', actionSize)}>
        <Trash2 className={actionIcon} />
      </button>
    </div>
  );

  return (
    <PageShell
      className="w-full"
      title={t('config.title')}
      subtitle={t('config.subtitle')}
      icon={<Settings />}
      actions={(
        <Button size="sm" onClick={() => setCreating(true)} className={cn('gap-1 font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 px-2.5 rounded-[4px] text-[11px]')}>
          <Plus className="h-3 w-3 stroke-[2.5]" />{t('config.add')}
        </Button>
      )}
    >
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t('config.searchPlaceholder') }}
        trailing={(
          <>
            <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>{t('common.total')}: <span className="font-semibold text-foreground">{rows.length}</span></span>
            <RefreshButton onClick={reload} loading={query.loading} />
          </>
        )}
      />

      <DataList
        items={rows}
        keyOf={(row) => row.id}
        loading={query.loading}
        emptyIcon={<Settings className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={t('config.empty')}
        renderCard={(row) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{row.key}</div>
                <div className="truncate text-xs text-muted-foreground">{target(row)}</div>
              </div>
              <Badge tone={row.scope === SCOPE_PLATFORM ? 'muted' : 'default'} className="text-[10px] px-1.5 py-0 rounded shrink-0">
                {scopeLabel(row.scope)}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <code className="min-w-0 break-all font-mono text-xs text-muted-foreground">{row.value}</code>
              {rowActions(row)}
            </div>
          </>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR className="border-b border-border bg-muted/40">
                <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                <TH className="w-48 py-1.5 px-2 text-[10.5px] font-semibold">{t('config.colKey')}</TH>
                <TH className="w-28 py-1.5 px-2 text-[10.5px] font-semibold">{t('config.colScope')}</TH>
                <TH className="w-44 py-1.5 px-2 text-[10.5px] font-semibold">{t('config.colTarget')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('config.colValue')}</TH>
                <TH className="w-16 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('common.actions')}</TH>
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
                  <TD className="py-1 px-2 text-right">{rowActions(row)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />

      <ConfigFormDialog open={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
      <ConfigFormDialog open={!!editing} row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      <ConfirmDialog open={!!confirmDelete} tone="danger" title={t('config.delete')} description={confirmDelete ? t('config.deleteConfirm', { key: confirmDelete.key }) : ''} confirmLabel={t('config.delete')} cancelLabel={t('common.cancel')} busy={confirmBusy} onConfirm={doDelete} onClose={() => setConfirmDelete(null)} />
    </PageShell>
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
      if (await tryToast(() => appConfig.upsert(body), isEdit ? t('config.updated') : t('config.created'))) onSaved();
    } finally { setBusy(false); }
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
            <EntitySelect value={organizationId || null} onChange={(v) => setOrganizationId(v ?? '')} fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel} disabled={isEdit} placeholder={t('config.selectOrganization')}
              className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3" />
          </div>
        )}
        {needsComm && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('config.scopeCommunity')} *</label>
            <EntitySelect value={communityId || null} onChange={(v) => setCommunityId(v ?? '')} fetchPage={fetchCommunityPage}
              resolveLabel={resolveCommunityLabel} disabled={isEdit} placeholder={t('config.selectCommunity')}
              className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3" />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('config.valueLabel')} *</label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('config.valuePlaceholder')} maxLength={2000} className="h-9 text-xs rounded-[4px]" />
        </div>
        <div className="mt-2 pt-3 border-t border-border/70 flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="h-8.5 px-4 rounded-[4px] text-xs font-medium border-border/80">
            {t('common.cancel')}
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
