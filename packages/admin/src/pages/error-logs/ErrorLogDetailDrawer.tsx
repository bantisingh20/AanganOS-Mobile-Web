import { useState } from 'react';
import { X, Copy, Check, AlertTriangle, User, Terminal, Code2, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ErrorLogDetail } from '@shared/api/errorLogs';
import { cn } from '@shared/lib/utils';
import { EMPTY } from '@shared/lib/format';

interface ErrorLogDetailDrawerProps {
  log: ErrorLogDetail | null;
  open: boolean;
  onClose: () => void;
}

export function ErrorLogDetailDrawer({ log, open, onClose }: ErrorLogDetailDrawerProps) {
  const { t } = useTranslation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!open || !log) return null;

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(t('common.copied', { defaultValue: 'Copied to clipboard' }));
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const statusColor =
    log.statusCode >= 500
      ? 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-400'
      : log.statusCode >= 400
        ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-400'
        : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <aside className="w-screen max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={cn('px-2 py-0.5 text-xs font-bold font-mono rounded-[4px] border', statusColor)}>
                {log.statusCode}
              </span>
              <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-muted rounded-[4px]">
                {log.httpMethod}
              </span>
              <h2 className="text-sm font-semibold truncate text-foreground">{log.apiPath}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
            {/* Error Message Box */}
            <div className="p-3.5 rounded-[4px] border border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/20 space-y-1.5">
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-semibold text-[11.5px]">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{log.exceptionType}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(log.errorMessage, 'msg')}
                  className="p-1 hover:bg-rose-500/10 rounded-[4px] text-muted-foreground hover:text-foreground"
                  title="Copy error message"
                >
                  {copiedKey === 'msg' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="font-mono text-xs text-foreground whitespace-pre-wrap break-words">
                {log.errorMessage}
              </p>
            </div>

            {/* Code Location & Line Number */}
            <section className="space-y-2">
              <h3 className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-primary" />
                <span>Source Code Location</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-muted/30 rounded-[4px] border border-border/70">
                <div className="space-y-0.5">
                  <span className="text-[10.5px] text-muted-foreground">Controller / Function:</span>
                  <p className="font-mono text-xs font-semibold break-all text-foreground">
                    {log.controllerOrFunction || EMPTY}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10.5px] text-muted-foreground">Line Number:</span>
                  <p className="font-mono text-xs font-semibold text-foreground">
                    {log.lineNumber ? `Line ${log.lineNumber}` : EMPTY}
                  </p>
                </div>
                <div className="sm:col-span-2 space-y-0.5 pt-1 border-t border-border/40">
                  <span className="text-[10.5px] text-muted-foreground">File Path:</span>
                  <p className="font-mono text-[11px] break-all text-muted-foreground select-all">
                    {log.fileName || EMPTY}
                  </p>
                </div>
              </div>
            </section>

            {/* User & Organization Context */}
            <section className="space-y-2">
              <h3 className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
                <span>User & Organization Context</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-muted/30 rounded-[4px] border border-border/70">
                <div className="space-y-0.5">
                  <span className="text-[10.5px] text-muted-foreground">Logged-In Person:</span>
                  <p className="font-medium text-foreground">{log.userName || 'Anonymous / Guest'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10.5px] text-muted-foreground">Role:</span>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">{log.userRole || EMPTY}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10.5px] text-muted-foreground">User ID:</span>
                  <p className="font-mono text-[11px] text-muted-foreground truncate">{log.userId || EMPTY}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10.5px] text-muted-foreground">Correlation ID:</span>
                  <p className="font-mono text-[11px] text-muted-foreground truncate">{log.correlationId || EMPTY}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10.5px] text-muted-foreground">Organization ID:</span>
                  <p className="font-mono text-[11px] text-muted-foreground truncate">{log.organizationId || EMPTY}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10.5px] text-muted-foreground">Community ID:</span>
                  <p className="font-mono text-[11px] text-muted-foreground truncate">{log.communityId || EMPTY}</p>
                </div>
              </div>
            </section>

            {/* Request Context */}
            <section className="space-y-2">
              <h3 className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span>Request Details</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-muted/30 rounded-[4px] border border-border/70">
                <div className="space-y-0.5">
                  <span className="text-[10.5px] text-muted-foreground">Time (UTC):</span>
                  <p className="font-mono text-xs">{new Date(log.createdAtUtc).toUTCString()}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10.5px] text-muted-foreground">Client IP:</span>
                  <p className="font-mono text-xs">{log.clientIp || EMPTY}</p>
                </div>
                {log.queryParams ? (
                  <div className="sm:col-span-2 space-y-0.5">
                    <span className="text-[10.5px] text-muted-foreground">Query Parameters:</span>
                    <p className="font-mono text-[11px] bg-muted/50 p-1.5 rounded-[4px] break-all">{log.queryParams}</p>
                  </div>
                ) : null}
                {log.userAgent ? (
                  <div className="sm:col-span-2 space-y-0.5">
                    <span className="text-[10.5px] text-muted-foreground">User Agent:</span>
                    <p className="font-mono text-[10.5px] text-muted-foreground break-all">{log.userAgent}</p>
                  </div>
                ) : null}
              </div>
            </section>

            {/* Request Body Payload */}
            {log.requestBody ? (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-primary" />
                    <span>Request Body (Payload)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => copyText(log.requestBody || '', 'body')}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    {copiedKey === 'body' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === 'body' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-[4px] font-mono text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap break-all border border-slate-800">
                  {log.requestBody}
                </pre>
              </section>
            ) : null}

            {/* Full Stack Trace */}
            {log.stackTrace ? (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-primary" />
                    <span>Exception Stack Trace</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => copyText(log.stackTrace || '', 'stack')}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    {copiedKey === 'stack' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === 'stack' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 text-slate-200 rounded-[4px] font-mono text-[11px] max-h-72 overflow-y-auto whitespace-pre-wrap break-words border border-slate-800 leading-relaxed">
                  {log.stackTrace}
                </pre>
              </section>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-5 py-3 border-t border-border bg-muted/10">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-[4px] border border-border bg-card text-foreground hover:bg-accent transition-colors shadow-xs"
            >
              {t('common.close', { defaultValue: 'Close' })}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
