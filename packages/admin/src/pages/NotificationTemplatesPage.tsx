import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Mail, Plus, Pencil, Search, RefreshCw, Table as TableIcon, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Drawer } from '@shared/components/ui/drawer';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Toaster } from '@shared/components/ui/sonner';
import { notificationTemplates } from '@shared/services';
import type { NotificationTemplate, NotificationTemplatePreview } from '@shared/api/notificationTemplates';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { cn } from '@shared/lib/utils';
import { toFormError } from '@shared/api/errors';

const CHANNEL_FLAGS = [
  { bit: 1, labelKey: 'templates.channelPush' },
  { bit: 2, labelKey: 'templates.channelSms' },
  { bit: 4, labelKey: 'templates.channelEmail' },
  { bit: 8, labelKey: 'templates.channelWhatsApp' },
] as const;

function channelLabels(channels: number, t: (k: string) => string): string[] {
  return CHANNEL_FLAGS.filter((c) => (channels & c.bit) === c.bit).map((c) => t(c.labelKey));
}

export function NotificationTemplatesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const isSmall = useIsSmallScreen();
  const effectiveView = isSmall ? 'cards' : view;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const query = useAsync(
    (signal) => notificationTemplates.list(search.trim() || undefined, { signal }).catch(() => null),
    [search, reloadKey],
  );

  const items = useMemo(() => query.data ?? [], [query.data]);
  const reload = () => setReloadKey((k) => k + 1);

  const ChannelBadges = ({ channels }: { channels: number }) => {
    const labels = channelLabels(channels, t);
    if (labels.length === 0) return <span className="text-[11px] text-muted-foreground">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {labels.map((l) => (
          <Badge key={l} tone="default">{l}</Badge>
        ))}
      </div>
    );
  };

  const StatusBadge = ({ tpl }: { tpl: NotificationTemplate }) => (
    <Badge tone={tpl.isActive ? 'success' : 'muted'}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {tpl.isActive ? t('templates.active') : t('templates.inactive')}
    </Badge>
  );

  const RowActions = ({ tpl }: { tpl: NotificationTemplate }) => (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" onClick={() => setEditing(tpl)} aria-label={t('templates.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
              <Mail className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('templates.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('templates.subtitle')}</p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)} className="h-9 shrink-0 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs hover:bg-emerald-700">
            <Plus className="h-4 w-4" />{t('templates.add')}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('templates.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center rounded-lg border border-border p-0.5 md:flex">
            <button type="button" onClick={() => setView('table')} aria-label="Table view" className={`flex h-7 w-7 items-center justify-center rounded-md ${view === 'table' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent'}`}>
              <TableIcon className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setView('cards')} aria-label="Card view" className={`flex h-7 w-7 items-center justify-center rounded-md ${view === 'cards' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={reload} aria-label="Refresh" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-emerald-600">
            <RefreshCw className={`h-4 w-4 ${query.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {query.loading ? t('common.loading') : t('templates.empty')}
        </Card>
      ) : effectiveView === 'table' ? (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH className="w-56">{t('templates.colKey')}</TH>
                <TH>{t('templates.colTitle')}</TH>
                <TH className="w-56">{t('templates.colChannels')}</TH>
                <TH className="w-28">{t('templates.colStatus')}</TH>
                <TH className="w-24 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((tpl, i) => (
                <TR key={tpl.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">{i + 1}</TD>
                  <TD className="font-mono text-[12px]">{tpl.key}</TD>
                  <TD className="max-w-xs truncate text-[13px]">{tpl.titleTemplate}</TD>
                  <TD><ChannelBadges channels={tpl.channels} /></TD>
                  <TD><StatusBadge tpl={tpl} /></TD>
                  <TD><RowActions tpl={tpl} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((tpl) => (
            <Card key={tpl.id} className="flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12px] font-semibold">{tpl.key}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{tpl.titleTemplate}</div>
                </div>
                <StatusBadge tpl={tpl} />
              </div>
              <div className="border-t border-border pt-2">
                <ChannelBadges channels={tpl.channels} />
              </div>
              <div className="flex items-center justify-end border-t border-border pt-3">
                <RowActions tpl={tpl} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <TemplateFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => { setCreating(false); reload(); }}
      />
      <TemplateFormDialog
        open={!!editing}
        template={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

function TemplateFormDialog({ open, template, onClose, onSaved }: { open: boolean; template?: NotificationTemplate | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!template;
  const [key, setKey] = useState('');
  const [channels, setChannels] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [titleTemplate, setTitleTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [emailSubjectTemplate, setEmailSubjectTemplate] = useState('');
  const [emailHtmlTemplate, setEmailHtmlTemplate] = useState('');
  const [smsTemplate, setSmsTemplate] = useState('');
  const [whatsappTemplateName, setWhatsappTemplateName] = useState('');
  const [whatsappVarsJson, setWhatsappVarsJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<NotificationTemplatePreview | null>(null);
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');

  useEffect(() => {
    if (!open) return;
    setKey(template?.key ?? '');
    setChannels(template?.channels ?? 0);
    setIsActive(template?.isActive ?? true);
    setTitleTemplate(template?.titleTemplate ?? '');
    setBodyTemplate(template?.bodyTemplate ?? '');
    setEmailSubjectTemplate(template?.emailSubjectTemplate ?? '');
    setEmailHtmlTemplate(template?.emailHtmlTemplate ?? '');
    setSmsTemplate(template?.smsTemplate ?? '');
    setWhatsappTemplateName(template?.whatsappTemplateName ?? '');
    setWhatsappVarsJson(template?.whatsappVarsJson ?? '');
    setPreview(null);
  }, [open, template]);

  const toggleChannel = (bit: number) => setChannels((c) => (c & bit ? c & ~bit : c | bit));

  const canSubmit = !!key.trim() && !!titleTemplate.trim() && !!bodyTemplate.trim();

  const buildBody = () => ({
    key: key.trim(),
    channels,
    titleTemplate: titleTemplate.trim(),
    bodyTemplate: bodyTemplate.trim(),
    emailSubjectTemplate: emailSubjectTemplate.trim() || null,
    emailHtmlTemplate: emailHtmlTemplate.trim() || null,
    smsTemplate: smsTemplate.trim() || null,
    whatsappTemplateName: whatsappTemplateName.trim() || null,
    whatsappVarsJson: whatsappVarsJson.trim() || null,
  });

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      await notificationTemplates.upsert({ ...buildBody(), isActive, communityId: null });
      toast.success(isEdit ? t('templates.updated') : t('templates.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async () => {
    if (previewBusy || !canSubmit) return;
    setPreviewBusy(true);
    try {
      const result = await notificationTemplates.preview({ ...buildBody(), sampleValues: {} });
      setPreview(result);
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setPreviewBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? (template?.key ?? t('templates.editTitle')) : t('templates.addTitle')}
      extra={
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={runPreview} disabled={previewBusy || !canSubmit} className="h-9 rounded-lg text-xs">{t('templates.preview')}</Button>
          <Button onClick={submit} disabled={busy || !canSubmit} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{isEdit ? t('templates.saveChanges') : t('templates.save')}</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('templates.keyLabel')}</label>
            <Input autoFocus value={key} disabled={isEdit} onChange={(e) => setKey(e.target.value)} placeholder={t('templates.keyPlaceholder')} maxLength={200} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('templates.channelsLabel')}</label>
            <div className="flex flex-wrap gap-3">
              {CHANNEL_FLAGS.map((c) => (
                <label key={c.bit} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={(channels & c.bit) === c.bit} onChange={() => toggleChannel(c.bit)} className="h-4 w-4 rounded border-input accent-emerald-600" />
                  {t(c.labelKey)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('templates.activeLabel')}</label>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <button type="button" onClick={() => setIsActive(true)} className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', isActive ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground')}>{t('templates.active')}</button>
              <button type="button" onClick={() => setIsActive(false)} className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', !isActive ? 'bg-card text-rose-600 shadow-sm' : 'text-muted-foreground')}>{t('templates.inactive')}</button>
            </div>
          </div>

          <div className="text-[11px] font-semibold uppercase text-muted-foreground">{t('templates.sectionPush')}</div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('templates.titleLabel')}</label>
            <Input value={titleTemplate} onChange={(e) => setTitleTemplate(e.target.value)} placeholder={t('templates.titlePlaceholder')} maxLength={500} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('templates.bodyLabel')}</label>
            <textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} placeholder={t('templates.bodyPlaceholder')} maxLength={4000} rows={3} className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          <div className="text-[11px] font-semibold uppercase text-muted-foreground">{t('templates.sectionEmail')}</div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('templates.emailSubjectLabel')}</label>
            <Input value={emailSubjectTemplate} onChange={(e) => setEmailSubjectTemplate(e.target.value)} placeholder={t('templates.emailSubjectPlaceholder')} maxLength={500} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('templates.emailHtmlLabel')}</label>
            <textarea value={emailHtmlTemplate} onChange={(e) => setEmailHtmlTemplate(e.target.value)} placeholder={t('templates.emailHtmlPlaceholder')} rows={4} className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          <div className="text-[11px] font-semibold uppercase text-muted-foreground">{t('templates.sectionSmsWhatsapp')}</div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('templates.smsLabel')}</label>
            <textarea value={smsTemplate} onChange={(e) => setSmsTemplate(e.target.value)} placeholder={t('templates.smsPlaceholder')} rows={2} className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('templates.whatsappNameLabel')}</label>
            <Input value={whatsappTemplateName} onChange={(e) => setWhatsappTemplateName(e.target.value)} placeholder={t('templates.whatsappNamePlaceholder')} maxLength={200} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('templates.whatsappVarsLabel')}</label>
            <Input value={whatsappVarsJson} onChange={(e) => setWhatsappVarsJson(e.target.value)} placeholder={t('templates.whatsappVarsPlaceholder')} />
          </div>

          {preview && preview.placeholders.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{t('templates.previewPlaceholders')}:</span>
              {preview.placeholders.map((p) => (
                <code key={p} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{`{${p}}`}</code>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">{t('templates.previewTitle')}</span>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <button type="button" onClick={() => setDevice('mobile')} className={cn('rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors', device === 'mobile' ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground')}>{t('templates.deviceMobile')}</button>
              <button type="button" onClick={() => setDevice('desktop')} className={cn('rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors', device === 'desktop' ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground')}>{t('templates.deviceDesktop')}</button>
            </div>
          </div>

          {previewBusy ? (
            <div className="grid h-40 place-items-center text-xs text-muted-foreground">{t('common.loading')}</div>
          ) : !preview ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{t('templates.previewHint')}</div>
          ) : (
            <div className="space-y-4">
              {preview.pushTitle != null || preview.pushBody != null ? (
                <PreviewBlock title={t('templates.channelPush')}>
                  <div className="rounded-xl border border-border bg-card p-3 shadow-sm" style={{ maxWidth: device === 'mobile' ? 320 : '100%' }}>
                    <div className="text-xs font-bold">{preview.pushTitle}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{preview.pushBody}</div>
                  </div>
                </PreviewBlock>
              ) : null}
              {preview.emailHtml != null ? (
                <PreviewBlock title={t('templates.channelEmail')}>
                  {preview.emailSubject ? <div className="mb-1 text-xs font-medium">{preview.emailSubject}</div> : null}
                  <div className="overflow-hidden rounded-xl border border-border bg-white" style={{ width: device === 'mobile' ? 340 : '100%' }}>
                    <iframe title="email-preview" srcDoc={preview.emailHtml} className="w-full" style={{ height: 420, border: 'none' }} />
                  </div>
                </PreviewBlock>
              ) : null}
              {preview.sms != null ? (
                <PreviewBlock title={t('templates.channelSms')}>
                  <div className="inline-block max-w-[300px] rounded-2xl bg-muted px-3 py-2 text-xs">{preview.sms}</div>
                </PreviewBlock>
              ) : null}
              {preview.whatsapp != null ? (
                <PreviewBlock title={t('templates.channelWhatsApp')}>
                  <div className="inline-block max-w-[300px] rounded-2xl bg-[#dcf8c6] px-3 py-2 text-xs text-slate-800">{preview.whatsapp}</div>
                </PreviewBlock>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function PreviewBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
