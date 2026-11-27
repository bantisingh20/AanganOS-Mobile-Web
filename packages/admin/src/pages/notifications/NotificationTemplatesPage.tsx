import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Mail, Plus, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Drawer } from '@shared/components/ui/drawer';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { PageShell, FilterBar, DataList } from '@shared/components/layout';
import { notificationTemplates } from '@shared/services';
import type { NotificationTemplate, NotificationTemplatePreview } from '@shared/api/notificationTemplates';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';
import { withToast } from '@shared/lib/withToast';
import { useListState } from '@shared/lib/hooks/useListState';

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
  const compact = useIsCompact();
  const { search, setSearch, reloadKey, reload } = useListState();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);

  const query = useAsync(
    (signal) => notificationTemplates.list(search.trim() || undefined, { signal }).catch(() => null),
    [search, reloadKey],
  );

  const items = useMemo(() => query.data ?? [], [query.data]);

  const editButton = (tpl: NotificationTemplate, extra?: string) => (
    <button type="button" onClick={() => setEditing(tpl)} title={t('templates.edit')}
      className={cn('flex shrink-0 items-center justify-center border border-border/80 text-muted-foreground hover:text-primary transition-colors',
        compact ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded-[3px]', extra)}>
      <Pencil className={compact ? 'h-4 w-4' : 'h-3 w-3'} />
    </button>
  );

  return (
    <PageShell
      title={t('templates.title')}
      subtitle={t('templates.subtitle')}
      icon={<Mail />}
      className="w-full"
      actions={(
        <Button size="sm" onClick={() => setCreating(true)}
          className={cn('gap-1 font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 px-2.5 rounded-[4px] text-[11px]')}>
          <Plus className="h-3 w-3 stroke-[2.5]" />{t('templates.add')}
        </Button>
      )}
    >
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t('templates.searchPlaceholder') }}
        trailing={(
          <>
            <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>{t('common.total')}: <span className="font-semibold text-foreground">{items.length}</span></span>
            <RefreshButton onClick={reload} loading={query.loading} />
          </>
        )}
      />

      <DataList
        items={items}
        keyOf={(tpl) => tpl.id}
        loading={query.loading}
        emptyIcon={<Mail className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={t('templates.empty')}
        renderCard={(tpl) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-mono text-sm font-semibold text-foreground">{tpl.key}</div>
                <p className="line-clamp-1 text-xs text-muted-foreground">{tpl.titleTemplate}</p>
              </div>
              <Badge tone={tpl.isActive ? 'success' : 'muted'} className="text-xs px-1.5 py-0 rounded shrink-0">
                {tpl.isActive ? t('templates.active') : t('templates.inactive')}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap gap-1">
                {channelLabels(tpl.channels, t).map((l) => (<Badge key={l} tone="default" className="text-[10px] px-1.5 py-0 rounded">{l}</Badge>))}
              </div>
              {editButton(tpl)}
            </div>
          </>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR className="border-b border-border bg-muted/40">
                <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                <TH className="w-52 py-1.5 px-2 text-[10.5px] font-semibold">{t('templates.colKey')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('templates.colTitle')}</TH>
                <TH className="w-48 py-1.5 px-2 text-[10.5px] font-semibold">{t('templates.colChannels')}</TH>
                <TH className="w-24 py-1.5 px-2 text-[10.5px] font-semibold">{t('templates.colStatus')}</TH>
                <TH className="w-16 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('common.actions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((tpl, i) => (
                <TR key={tpl.id} className="hover:bg-muted/30 transition-colors">
                  <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{i + 1}</TD>
                  <TD className="py-1 px-2 font-mono text-xs font-semibold text-foreground truncate">{tpl.key}</TD>
                  <TD className="py-1 px-2 text-xs text-muted-foreground truncate">{tpl.titleTemplate}</TD>
                  <TD className="py-1 px-2">
                    <div className="flex flex-wrap gap-1">
                      {channelLabels(tpl.channels, t).map((l) => (<Badge key={l} tone="default" className="text-[10px] px-1 py-0 rounded">{l}</Badge>))}
                    </div>
                  </TD>
                  <TD className="py-1 px-2">
                    <Badge tone={tpl.isActive ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 rounded">
                      {tpl.isActive ? t('templates.active') : t('templates.inactive')}
                    </Badge>
                  </TD>
                  <TD className="py-1 px-2 text-right">{editButton(tpl, 'ml-auto')}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />

      <TemplateFormDialog open={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
      <TemplateFormDialog open={!!editing} template={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
    </PageShell>
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
    key: key.trim(), channels, titleTemplate: titleTemplate.trim(), bodyTemplate: bodyTemplate.trim(),
    emailSubjectTemplate: emailSubjectTemplate.trim() || null, emailHtmlTemplate: emailHtmlTemplate.trim() || null,
    smsTemplate: smsTemplate.trim() || null, whatsappTemplateName: whatsappTemplateName.trim() || null,
    whatsappVarsJson: whatsappVarsJson.trim() || null,
  });

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const ok = await withToast(() => notificationTemplates.upsert({ ...buildBody(), isActive, communityId: null }), isEdit ? t('templates.updated') : t('templates.created'));
      if (ok !== undefined) onSaved();
    } finally { setBusy(false); }
  };

  const runPreview = async () => {
    if (previewBusy || !canSubmit) return;
    setPreviewBusy(true);
    try {
      const result = await withToast(() => notificationTemplates.preview({ ...buildBody(), sampleValues: {} }));
      if (result !== undefined) setPreview(result);
    } finally { setPreviewBusy(false); }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? (template?.key ?? t('templates.editTitle')) : t('templates.addTitle')}
      extra={
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={runPreview} disabled={previewBusy || !canSubmit} className="h-7.5 px-3 rounded-[4px] text-xs border-border/80">{t('templates.preview')}</Button>
          <Button onClick={submit} disabled={busy || !canSubmit} className="h-7.5 px-3 rounded-[4px] text-xs">{isEdit ? t('templates.saveChanges') : t('templates.save')}</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 text-xs">
        <div className="space-y-2.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('templates.keyLabel')} *</label>
            <Input autoFocus value={key} disabled={isEdit} onChange={(e) => setKey(e.target.value)} placeholder={t('templates.keyPlaceholder')} maxLength={200} className="h-8.5 rounded-[4px] text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('templates.channelsLabel')}</label>
            <div className="flex flex-wrap gap-2.5">
              {CHANNEL_FLAGS.map((c) => (
                <label key={c.bit} className="flex items-center gap-1.5 text-xs text-foreground">
                  <input type="checkbox" checked={(channels & c.bit) === c.bit} onChange={() => toggleChannel(c.bit)} className="h-3.5 w-3.5 rounded border-input accent-primary" />
                  {t(c.labelKey)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('templates.activeLabel')}</label>
            <div className="flex gap-1 rounded-[4px] bg-muted/60 p-0.5 border border-border/70 w-44">
              <button type="button" onClick={() => setIsActive(true)} className={cn('flex-1 rounded-[3px] px-2 py-0.5 text-xs font-medium transition-colors', isActive ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground')}>{t('templates.active')}</button>
              <button type="button" onClick={() => setIsActive(false)} className={cn('flex-1 rounded-[3px] px-2 py-0.5 text-xs font-medium transition-colors', !isActive ? 'bg-destructive text-destructive-foreground shadow-xs' : 'text-muted-foreground')}>{t('templates.inactive')}</button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('templates.titleLabel')} *</label>
            <Input value={titleTemplate} onChange={(e) => setTitleTemplate(e.target.value)} placeholder={t('templates.titlePlaceholder')} maxLength={500} className="h-8.5 rounded-[4px] text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('templates.bodyLabel')} *</label>
            <textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} placeholder={t('templates.bodyPlaceholder')} maxLength={4000} rows={2} className="w-full resize-none rounded-[4px] border border-input bg-background p-2 text-xs leading-relaxed focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('templates.emailSubjectLabel')}</label>
            <Input value={emailSubjectTemplate} onChange={(e) => setEmailSubjectTemplate(e.target.value)} placeholder={t('templates.emailSubjectPlaceholder')} maxLength={500} className="h-8.5 rounded-[4px] text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('templates.emailHtmlLabel')}</label>
            <textarea value={emailHtmlTemplate} onChange={(e) => setEmailHtmlTemplate(e.target.value)} placeholder={t('templates.emailHtmlPlaceholder')} rows={3} className="w-full resize-none rounded-[4px] border border-input bg-background p-2 font-mono text-[11px] leading-relaxed focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('templates.smsLabel')}</label>
            <textarea value={smsTemplate} onChange={(e) => setSmsTemplate(e.target.value)} placeholder={t('templates.smsPlaceholder')} rows={1.5} className="w-full resize-none rounded-[4px] border border-input bg-background p-2 text-xs leading-relaxed focus:border-primary focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('templates.whatsappNameLabel')}</label>
              <Input value={whatsappTemplateName} onChange={(e) => setWhatsappTemplateName(e.target.value)} placeholder={t('templates.whatsappNamePlaceholder')} maxLength={200} className="h-8.5 rounded-[4px] text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('templates.whatsappVarsLabel')}</label>
              <Input value={whatsappVarsJson} onChange={(e) => setWhatsappVarsJson(e.target.value)} placeholder={t('templates.whatsappVarsPlaceholder')} className="h-8.5 rounded-[4px] text-xs" />
            </div>
          </div>
          {preview && preview.placeholders.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground pt-1">
              <span>{t('templates.previewPlaceholders')}:</span>
              {preview.placeholders.map((p) => (<code key={p} className="rounded bg-muted px-1 py-0.5 font-mono text-[10.5px]">{`{${p}}`}</code>))}
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">{t('templates.previewTitle')}</span>
            <div className="flex gap-1 rounded-[4px] bg-muted/60 p-0.5 border border-border/70">
              <button type="button" onClick={() => setDevice('mobile')} className={cn('rounded-[3px] px-2 py-0.5 text-[11px] font-medium transition-colors', device === 'mobile' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground')}>{t('templates.deviceMobile')}</button>
              <button type="button" onClick={() => setDevice('desktop')} className={cn('rounded-[3px] px-2 py-0.5 text-[11px] font-medium transition-colors', device === 'desktop' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground')}>{t('templates.deviceDesktop')}</button>
            </div>
          </div>
          {previewBusy ? (
            <div className="grid h-36 place-items-center text-xs text-muted-foreground">{t('common.loading')}</div>
          ) : !preview ? (
            <div className="rounded-md border border-dashed border-border/80 p-5 text-center text-xs text-muted-foreground">{t('templates.previewHint')}</div>
          ) : (
            <div className="space-y-3">
              {(preview.pushTitle != null || preview.pushBody != null) && (
                <PreviewBlock title={t('templates.channelPush')}>
                  <div className="rounded-md border border-border/80 bg-card p-2.5 shadow-xs" style={{ maxWidth: device === 'mobile' ? 280 : '100%' }}>
                    <div className="text-xs font-semibold text-foreground">{preview.pushTitle}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{preview.pushBody}</div>
                  </div>
                </PreviewBlock>
              )}
              {preview.emailHtml != null && (
                <PreviewBlock title={t('templates.channelEmail')}>
                  {preview.emailSubject && <div className="mb-1 text-xs font-medium text-foreground">{preview.emailSubject}</div>}
                  <div className="overflow-hidden rounded-md border border-border/80 bg-white" style={{ width: device === 'mobile' ? 300 : '100%' }}>
                    <iframe title="email-preview" srcDoc={preview.emailHtml} className="w-full" style={{ height: 320, border: 'none' }} />
                  </div>
                </PreviewBlock>
              )}
              {preview.sms != null && (
                <PreviewBlock title={t('templates.channelSms')}>
                  <div className="inline-block max-w-[280px] rounded-md bg-muted/60 p-2 text-xs leading-relaxed">{preview.sms}</div>
                </PreviewBlock>
              )}
              {preview.whatsapp != null && (
                <PreviewBlock title={t('templates.channelWhatsApp')}>
                  <div className="inline-block max-w-[280px] rounded-md bg-[#dcf8c6] dark:bg-emerald-950/60 p-2 text-xs text-slate-800 dark:text-emerald-200 leading-relaxed">{preview.whatsapp}</div>
                </PreviewBlock>
              )}
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
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

export default NotificationTemplatesPage;
