import { useEffect, useState } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Eye,
  EyeOff,
  Clock,
  Terminal,
  Settings2,
  Smartphone,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { communicationTest } from '@shared/services';
import type {
  CommunicationConfigSummary,
  TestEmailResponse,
  TestSmsResponse,
} from '@shared/api/communicationTest';
import { useAsync } from '@shared/lib/useAsync';
import { cn } from '@shared/lib/utils';
import { useTranslation } from 'react-i18next';

export function CommunicationTestPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email');

  // Config summary from server
  const [summaryKey, setSummaryKey] = useState(0);
  const summaryQuery = useAsync(
    (signal) => communicationTest.getConfigSummary({ signal }).catch(() => null),
    [summaryKey]
  );
  const config = summaryQuery.data as CommunicationConfigSummary | null;

  // ------------------------- Email (SMTP) State -------------------------
  const [emailUseAppSettings, setEmailUseAppSettings] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('AanganOS Support');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpEnableSsl, setSmtpEnableSsl] = useState(true);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  // Email test payload
  const [toEmail, setToEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('AanganOS SMTP Delivery Test');
  const [emailBody, setEmailBody] = useState(
    'This is a test email sent from AanganOS Admin to verify SMTP communication settings.'
  );
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailResult, setEmailResult] = useState<TestEmailResponse | null>(null);

  // ------------------------- SMS State -------------------------
  const [smsUseAppSettings, setSmsUseAppSettings] = useState(true);
  const [smsProvider, setSmsProvider] = useState<'GenericHttp' | 'Twilio' | 'Fast2SMS'>('GenericHttp');
  const [smsApiUrl, setSmsApiUrl] = useState('');
  const [smsApiKey, setSmsApiKey] = useState('');
  const [smsSenderId, setSmsSenderId] = useState('');
  const [smsAccountSid, setSmsAccountSid] = useState('');
  const [smsAuthToken, setSmsAuthToken] = useState('');
  const [smsFromNumber, setSmsFromNumber] = useState('');
  const [smsHttpMethod, setSmsHttpMethod] = useState<'POST' | 'GET'>('POST');
  const [smsCustomBodyTemplate, setSmsCustomBodyTemplate] = useState('');
  const [showSmsSecret, setShowSmsSecret] = useState(false);

  // SMS test payload
  const [toPhone, setToPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState(
    'AanganOS SMS Gateway test: Your communication setup is working properly!'
  );
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsResult, setSmsResult] = useState<TestSmsResponse | null>(null);

  // Sync default values when config loads
  useEffect(() => {
    if (config?.smtp) {
      if (!smtpHost && config.smtp.host) setSmtpHost(config.smtp.host);
      if (config.smtp.port) setSmtpPort(config.smtp.port);
      if (!smtpUser && config.smtp.user) setSmtpUser(config.smtp.user);
      if (!smtpFromName && config.smtp.fromName) setSmtpFromName(config.smtp.fromName);
      if (!smtpFromEmail && config.smtp.user) setSmtpFromEmail(config.smtp.user);
    }
  }, [config]);

  // Handle Send Test Email
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail.trim()) {
      toast.error('Please enter a recipient email address.');
      return;
    }

    setEmailBusy(true);
    setEmailResult(null);

    try {
      const res = await communicationTest.testEmail({
        useAppSettings: emailUseAppSettings,
        host: emailUseAppSettings ? undefined : smtpHost,
        port: emailUseAppSettings ? undefined : Number(smtpPort),
        user: emailUseAppSettings ? undefined : smtpUser,
        password: emailUseAppSettings ? undefined : smtpPassword,
        fromName: emailUseAppSettings ? undefined : smtpFromName,
        fromEmail: emailUseAppSettings ? undefined : smtpFromEmail,
        enableSsl: emailUseAppSettings ? undefined : smtpEnableSsl,
        toEmail: toEmail.trim(),
        subject: emailSubject.trim(),
        body: emailBody,
      });

      setEmailResult(res);
      if (res.success) {
        toast.success('Test email delivered successfully!');
      } else {
        toast.error(res.message || 'Failed to send test email.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown communication error occurred.';
      setEmailResult({
        success: false,
        message,
        durationMs: 0,
        details: String(err),
      });
      toast.error(message);
    } finally {
      setEmailBusy(false);
    }
  };

  // Handle Send Test SMS
  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toPhone.trim()) {
      toast.error('Please enter a recipient phone number.');
      return;
    }

    setSmsBusy(true);
    setSmsResult(null);

    try {
      const res = await communicationTest.testSms({
        useAppSettings: smsUseAppSettings,
        provider: smsUseAppSettings ? undefined : smsProvider,
        apiUrl: smsUseAppSettings ? undefined : smsApiUrl,
        apiKey: smsUseAppSettings ? undefined : smsApiKey,
        senderId: smsUseAppSettings ? undefined : smsSenderId,
        accountSid: smsUseAppSettings ? undefined : smsAccountSid,
        authToken: smsUseAppSettings ? undefined : smsAuthToken,
        fromNumber: smsUseAppSettings ? undefined : smsFromNumber,
        httpMethod: smsUseAppSettings ? undefined : smsHttpMethod,
        customBodyTemplate: smsUseAppSettings ? undefined : (smsCustomBodyTemplate || undefined),
        toPhone: toPhone.trim(),
        message: smsMessage.trim(),
      });

      setSmsResult(res);
      if (res.success) {
        toast.success('Test SMS dispatched successfully!');
      } else {
        toast.error(res.message || 'SMS test failed.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown SMS error occurred.';
      setSmsResult({
        success: false,
        message,
        durationMs: 0,
        details: String(err),
      });
      toast.error(message);
    } finally {
      setSmsBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Server className="h-6 w-6 text-primary" />
            {t('commTest.title', { defaultValue: 'Communication & Gateway Testing' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('commTest.subtitle', { defaultValue: 'Test and verify outgoing Email (SMTP) and SMS gateways using server appsettings or custom manual credentials.' })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSummaryKey((k) => k + 1)}
          disabled={summaryQuery.loading}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={cn('h-4 w-4', summaryQuery.loading && 'animate-spin')} />
          {t('commTest.refreshStatus', { defaultValue: 'Refresh Status' })}
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors',
            activeTab === 'email'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Mail className="h-4 w-4" />
          Email (SMTP) Testing
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sms')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors',
            activeTab === 'sms'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Smartphone className="h-4 w-4" />
          SMS Gateway Testing
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EMAIL (SMTP) TESTING                                              */}
      {/* ========================================================================= */}
      {activeTab === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Configuration Mode & Credentials */}
          <div className="lg:col-span-5 space-y-5">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
                  <Settings2 className="h-4 w-4 text-primary" />
                  SMTP Credentials Source
                </h2>
                <Badge tone={emailUseAppSettings ? 'info' : 'warning'}>
                  {emailUseAppSettings ? 'AppSettings.json' : 'Manual Entry'}
                </Badge>
              </div>

              {/* Source Toggle Selection */}
              <div className="grid grid-cols-2 gap-2 bg-muted/50 p-1.5 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setEmailUseAppSettings(true)}
                  className={cn(
                    'py-2 text-xs font-semibold rounded-md transition-all',
                    emailUseAppSettings
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Use AppSettings
                </button>
                <button
                  type="button"
                  onClick={() => setEmailUseAppSettings(false)}
                  className={cn(
                    'py-2 text-xs font-semibold rounded-md transition-all',
                    !emailUseAppSettings
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Manually Type
                </button>
              </div>

              {/* If using AppSettings: Read-only summary card */}
              {emailUseAppSettings ? (
                <div className="space-y-3 pt-2">
                  <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between pb-1 border-b border-border/50">
                      <span className="text-muted-foreground font-medium">Server Configuration:</span>
                      {config?.smtp?.isConfigured ? (
                        <Badge tone="success">Configured</Badge>
                      ) : (
                        <Badge tone="danger">Incomplete</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-muted-foreground">Host:</span>
                      <span className="col-span-2 font-mono font-medium text-foreground">
                        {config?.smtp?.host || 'mail.sharcnix.com'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-muted-foreground">Port:</span>
                      <span className="col-span-2 font-mono text-foreground">
                        {config?.smtp?.port || 587}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-muted-foreground">Sender User:</span>
                      <span className="col-span-2 font-mono text-foreground">
                        {config?.smtp?.user || 'info@sharcnix.com'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-muted-foreground">From Name:</span>
                      <span className="col-span-2 text-foreground">
                        {config?.smtp?.fromName || 'Sharcnix'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-muted-foreground">SSL / TLS:</span>
                      <span className="col-span-2 text-foreground font-medium text-emerald-600 dark:text-emerald-400">
                        {config?.smtp?.enableSsl ? 'Enabled (SSL)' : 'Disabled (Plain)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-muted-foreground">Password:</span>
                      <span className="col-span-2 text-muted-foreground font-mono">
                        {config?.smtp?.hasPassword ? '••••••••••••' : '(Not configured)'}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 leading-relaxed">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    Credentials are securely loaded from the backend's environment / <code>appsettings.json</code>.
                  </p>
                </div>
              ) : (
                /* If Manual: Editable inputs */
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-medium text-foreground">SMTP Host *</label>
                    <Input
                      placeholder="e.g. mail.sharcnix.com or smtp.gmail.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="mt-1 font-mono text-xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground">Port *</label>
                      <Input
                        type="number"
                        placeholder="587"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(Number(e.target.value))}
                        className="mt-1 font-mono text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground">Enable SSL / TLS</label>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="smtpSsl"
                          checked={smtpEnableSsl}
                          onChange={(e) => setSmtpEnableSsl(e.target.checked)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <label htmlFor="smtpSsl" className="text-xs text-foreground cursor-pointer select-none">
                          Yes, require SSL
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground">SMTP Username *</label>
                    <Input
                      placeholder="e.g. info@sharcnix.com"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      className="mt-1 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground">SMTP Password *</label>
                    <div className="relative mt-1">
                      <Input
                        type={showSmtpPassword ? 'text' : 'password'}
                        placeholder="Password or App Password"
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                        className="pr-10 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground">From Name</label>
                      <Input
                        placeholder="Sharcnix Support"
                        value={smtpFromName}
                        onChange={(e) => setSmtpFromName(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground">From Email</label>
                      <Input
                        placeholder="info@sharcnix.com"
                        value={smtpFromEmail}
                        onChange={(e) => setSmtpFromEmail(e.target.value)}
                        className="mt-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Send Test Form & Diagnostic Results */}
          <div className="lg:col-span-7 space-y-5">
            <Card className="p-5">
              <form onSubmit={handleSendTestEmail} className="space-y-4">
                <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
                  <Send className="h-4 w-4 text-primary" />
                  Send Test Email
                </h2>

                <div>
                  <label className="text-xs font-medium text-foreground">
                    Recipient Email Address (To) *
                  </label>
                  <Input
                    type="email"
                    placeholder="Enter email to receive test message (e.g. yourname@domain.com)"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    className="mt-1 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Subject</label>
                  <Input
                    placeholder="Email subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Message Body</label>
                  <textarea
                    rows={3}
                    placeholder="Email message content"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Tests full SMTP handshake, SSL negotiation & delivery.
                  </span>
                  <Button type="submit" disabled={emailBusy} className="gap-2">
                    {emailBusy ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Sending Test...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Test Email
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Email Test Diagnostic Result Output */}
            {emailResult && (
              <Card
                className={cn(
                  'p-5 border-l-4 transition-all',
                  emailResult.success
                    ? 'border-l-emerald-500 bg-emerald-500/5'
                    : 'border-l-rose-500 bg-rose-500/5'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    {emailResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <h3
                        className={cn(
                          'text-sm font-semibold',
                          emailResult.success
                            ? 'text-emerald-900 dark:text-emerald-200'
                            : 'text-rose-900 dark:text-rose-200'
                        )}
                      >
                        {emailResult.success ? 'Delivery Succeeded' : 'Delivery Failed'}
                      </h3>
                      <p className="text-xs text-foreground/80 mt-0.5">{emailResult.message}</p>
                    </div>
                  </div>
                  {emailResult.durationMs > 0 && (
                    <Badge tone="muted" className="gap-1 font-mono text-[11px]">
                      <Clock className="h-3 w-3" />
                      {emailResult.durationMs}ms
                    </Badge>
                  )}
                </div>

                {/* Additional diagnostic metadata */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-border/50 pt-3">
                  {emailResult.serverUsed && (
                    <div>
                      <span className="text-muted-foreground font-medium">Server: </span>
                      <span className="font-mono">{emailResult.serverUsed}</span>
                    </div>
                  )}
                  {emailResult.fromUsed && (
                    <div>
                      <span className="text-muted-foreground font-medium">From: </span>
                      <span className="font-mono">{emailResult.fromUsed}</span>
                    </div>
                  )}
                  {emailResult.errorCode && (
                    <div className="col-span-full">
                      <span className="text-muted-foreground font-medium">Error Code: </span>
                      <Badge tone="danger">{emailResult.errorCode}</Badge>
                    </div>
                  )}
                </div>

                {/* Raw technical details / stack trace */}
                {emailResult.details && (
                  <div className="mt-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      <Terminal className="h-3.5 w-3.5" />
                      Technical Diagnostics
                    </div>
                    <pre className="max-h-48 overflow-auto rounded bg-zinc-950 p-3 text-[11px] text-zinc-100 font-mono leading-relaxed whitespace-pre-wrap">
                      {emailResult.details}
                    </pre>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SMS GATEWAY TESTING                                               */}
      {/* ========================================================================= */}
      {activeTab === 'sms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: SMS Configuration Source */}
          <div className="lg:col-span-5 space-y-5">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
                  <Settings2 className="h-4 w-4 text-primary" />
                  SMS Gateway Source
                </h2>
                <Badge tone={smsUseAppSettings ? 'info' : 'warning'}>
                  {smsUseAppSettings ? 'AppSettings.json' : 'Manual Entry'}
                </Badge>
              </div>

              {/* Source Toggle Selection */}
              <div className="grid grid-cols-2 gap-2 bg-muted/50 p-1.5 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setSmsUseAppSettings(true)}
                  className={cn(
                    'py-2 text-xs font-semibold rounded-md transition-all',
                    smsUseAppSettings
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Use AppSettings
                </button>
                <button
                  type="button"
                  onClick={() => setSmsUseAppSettings(false)}
                  className={cn(
                    'py-2 text-xs font-semibold rounded-md transition-all',
                    !smsUseAppSettings
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Manually Type
                </button>
              </div>

              {/* If using AppSettings */}
              {smsUseAppSettings ? (
                <div className="space-y-3 pt-2">
                  <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between pb-1 border-b border-border/50">
                      <span className="text-muted-foreground font-medium">Server Status:</span>
                      {config?.sms?.isConfigured ? (
                        <Badge tone="success">Configured ({config.sms.provider})</Badge>
                      ) : (
                        <Badge tone="muted">Not configured in appsettings</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-muted-foreground">Provider:</span>
                      <span className="col-span-2 font-medium text-foreground">
                        {config?.sms?.provider || 'None'}
                      </span>
                    </div>
                    {config?.sms?.apiUrl && (
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-muted-foreground">Endpoint:</span>
                        <span className="col-span-2 font-mono truncate text-foreground">
                          {config.sms.apiUrl}
                        </span>
                      </div>
                    )}
                    {config?.sms?.senderId && (
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-muted-foreground">Sender ID:</span>
                        <span className="col-span-2 font-mono text-foreground">
                          {config.sms.senderId}
                        </span>
                      </div>
                    )}
                  </div>

                  {!config?.sms?.isConfigured && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        No SMS provider is currently active in <code>appsettings.json</code>. Switch to{' '}
                        <strong>"Manually Type"</strong> to test any custom HTTP gateway, Twilio, or Fast2SMS.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* If Manual: Provider choices & fields */
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-medium text-foreground">SMS Provider / Protocol</label>
                    <select
                      value={smsProvider}
                      onChange={(e) => setSmsProvider(e.target.value as any)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="GenericHttp">Generic REST / HTTP URL (Fast2SMS, MSG91, Textlocal, etc.)</option>
                      <option value="Twilio">Twilio REST API</option>
                      <option value="Fast2SMS">Fast2SMS Direct API</option>
                    </select>
                  </div>

                  {smsProvider === 'Twilio' && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-foreground">Twilio Account SID *</label>
                        <Input
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={smsAccountSid}
                          onChange={(e) => setSmsAccountSid(e.target.value)}
                          className="mt-1 font-mono text-xs"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground">Twilio Auth Token *</label>
                        <div className="relative mt-1">
                          <Input
                            type={showSmsSecret ? 'text' : 'password'}
                            placeholder="Auth Token"
                            value={smsAuthToken}
                            onChange={(e) => setSmsAuthToken(e.target.value)}
                            className="pr-10 text-xs font-mono"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmsSecret(!showSmsSecret)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showSmsSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground">From Number / Sender ID</label>
                        <Input
                          placeholder="+1234567890"
                          value={smsFromNumber}
                          onChange={(e) => setSmsFromNumber(e.target.value)}
                          className="mt-1 font-mono text-xs"
                        />
                      </div>
                    </>
                  )}

                  {smsProvider === 'Fast2SMS' && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-foreground">Fast2SMS Authorization API Key *</label>
                        <div className="relative mt-1">
                          <Input
                            type={showSmsSecret ? 'text' : 'password'}
                            placeholder="Fast2SMS API Key"
                            value={smsApiKey}
                            onChange={(e) => setSmsApiKey(e.target.value)}
                            className="pr-10 text-xs font-mono"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmsSecret(!showSmsSecret)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showSmsSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {smsProvider === 'GenericHttp' && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-foreground">API Gateway Endpoint URL *</label>
                        <Input
                          placeholder="https://api.sms-provider.com/send?to={phone}&msg={message}&key={apiKey}"
                          value={smsApiUrl}
                          onChange={(e) => setSmsApiUrl(e.target.value)}
                          className="mt-1 font-mono text-xs"
                          required
                        />
                        <span className="text-[10px] text-muted-foreground mt-1 block">
                          Supports <code>{'{phone}'}</code>, <code>{'{message}'}</code>, <code>{'{apiKey}'}</code>, <code>{'{sender}'}</code> tokens.
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-foreground">HTTP Method</label>
                          <select
                            value={smsHttpMethod}
                            onChange={(e) => setSmsHttpMethod(e.target.value as any)}
                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="POST">POST</option>
                            <option value="GET">GET</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-foreground">Sender ID (Optional)</label>
                          <Input
                            placeholder="AANGAN"
                            value={smsSenderId}
                            onChange={(e) => setSmsSenderId(e.target.value)}
                            className="mt-1 text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-foreground">API Key / Token (Optional)</label>
                        <Input
                          placeholder="Provider API Key"
                          value={smsApiKey}
                          onChange={(e) => setSmsApiKey(e.target.value)}
                          className="mt-1 font-mono text-xs"
                        />
                      </div>

                      {smsHttpMethod === 'POST' && (
                        <div>
                          <label className="text-xs font-medium text-foreground">Custom JSON / POST Body (Optional)</label>
                          <textarea
                            rows={2}
                            placeholder='e.g. {"to":"{phone}","message":"{message}"}'
                            value={smsCustomBodyTemplate}
                            onChange={(e) => setSmsCustomBodyTemplate(e.target.value)}
                            className="w-full mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Send Test SMS Form & Diagnostics */}
          <div className="lg:col-span-7 space-y-5">
            <Card className="p-5">
              <form onSubmit={handleSendTestSms} className="space-y-4">
                <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
                  <Send className="h-4 w-4 text-primary" />
                  Send Test SMS
                </h2>

                <div>
                  <label className="text-xs font-medium text-foreground">
                    Recipient Mobile Number (To) *
                  </label>
                  <Input
                    placeholder="e.g. +919876543210 or 9876543210"
                    value={toPhone}
                    onChange={(e) => setToPhone(e.target.value)}
                    className="mt-1 font-mono text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">SMS Message Content</label>
                  <textarea
                    rows={3}
                    placeholder="Enter SMS message text"
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                    <span>Standard single SMS length is 160 characters.</span>
                    <span className="font-mono">{smsMessage.length} chars</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Delivers directly through configured SMS gateway.
                  </span>
                  <Button type="submit" disabled={smsBusy} className="gap-2">
                    {smsBusy ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Dispatching SMS...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Test SMS
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Card>

            {/* SMS Diagnostic Results Output */}
            {smsResult && (
              <Card
                className={cn(
                  'p-5 border-l-4 transition-all',
                  smsResult.success
                    ? 'border-l-emerald-500 bg-emerald-500/5'
                    : 'border-l-rose-500 bg-rose-500/5'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    {smsResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <h3
                        className={cn(
                          'text-sm font-semibold',
                          smsResult.success
                            ? 'text-emerald-900 dark:text-emerald-200'
                            : 'text-rose-900 dark:text-rose-200'
                        )}
                      >
                        {smsResult.success ? 'SMS Dispatched Successfully' : 'SMS Dispatch Failed'}
                      </h3>
                      <p className="text-xs text-foreground/80 mt-0.5">{smsResult.message}</p>
                    </div>
                  </div>
                  {smsResult.durationMs > 0 && (
                    <Badge tone="muted" className="gap-1 font-mono text-[11px]">
                      <Clock className="h-3 w-3" />
                      {smsResult.durationMs}ms
                    </Badge>
                  )}
                </div>

                {/* Additional diagnostic metadata */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-border/50 pt-3">
                  {smsResult.providerUsed && (
                    <div>
                      <span className="text-muted-foreground font-medium">Provider: </span>
                      <span className="font-semibold">{smsResult.providerUsed}</span>
                    </div>
                  )}
                  {smsResult.httpStatusCode && (
                    <div>
                      <span className="text-muted-foreground font-medium">HTTP Status: </span>
                      <Badge tone={smsResult.httpStatusCode >= 200 && smsResult.httpStatusCode < 300 ? 'success' : 'danger'}>
                        {smsResult.httpStatusCode}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Gateway response body */}
                {smsResult.responseBody && (
                  <div className="mt-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      <Terminal className="h-3.5 w-3.5" />
                      Gateway Server Response
                    </div>
                    <pre className="max-h-48 overflow-auto rounded bg-zinc-950 p-3 text-[11px] text-zinc-100 font-mono leading-relaxed whitespace-pre-wrap">
                      {smsResult.responseBody}
                    </pre>
                  </div>
                )}

                {/* Error details if any */}
                {smsResult.details && !smsResult.responseBody && (
                  <div className="mt-3">
                    <pre className="max-h-48 overflow-auto rounded bg-zinc-950 p-3 text-[11px] text-zinc-100 font-mono leading-relaxed whitespace-pre-wrap">
                      {smsResult.details}
                    </pre>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
