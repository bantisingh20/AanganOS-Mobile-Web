import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, LogIn, ScanLine } from 'lucide-react';
import { gate } from '@shared/services';
import type { VerifyVisitPassResult } from '@shared/api/gate';
import { useAsyncAction } from '@shared/lib/useAsync';
import { PageLayout } from '@app/components/PageLayout';
import { TextField } from '@shared/components/TextField';
import { PrimaryButton } from '@shared/components/PrimaryButton';

function humanize(code: string): string {
  return code.split(/[_\s]+/).map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ');
}

export function VerifyPassScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'qr' | 'otp'>('qr');
  const [value, setValue] = useState('');
  const [result, setResult] = useState<VerifyVisitPassResult | null>(null);
  const [recorded, setRecorded] = useState(false);

  const verify = useAsyncAction(async () => {
    const v = value.trim();
    if (!v) return;
    const body = mode === 'qr' ? { qrToken: v } : { otp: v };
    const res = await gate.verifyVisitPass(body);
    setResult(res);
    setRecorded(false);
  });

  const recordEntry = useAsyncAction(async () => {
    if (!result?.pass) return;
    await gate.recordEntry({ visitPassId: result.pass.id });
    setRecorded(true);
  });

  const reset = () => { setResult(null); setValue(''); setRecorded(false); };

  return (
    <PageLayout title={t('verifyPass.title')} subtitle={t('verifyPass.subtitle')}>
      <div className="flex flex-col gap-4 px-4 py-4">
        {!result ? (
          <>
            <div className="flex rounded-full bg-muted p-1">
              {(['qr', 'otp'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 rounded-full py-1.5 text-sm font-bold transition-colors ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                  {t(m === 'qr' ? 'verifyPass.byToken' : 'verifyPass.byOtp')}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-5 shadow-sm">
              <ScanLine className="h-10 w-10 text-primary" />
              <p className="text-center text-sm text-muted-foreground">{t('verifyPass.hint')}</p>
            </div>
            <TextField
              label={mode === 'qr' ? t('verifyPass.tokenLabel') : t('verifyPass.otpLabel')}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === 'qr' ? t('verifyPass.tokenPlaceholder') : t('verifyPass.otpPlaceholder')}
              onEnter={() => verify.run()}
            />
            {verify.error ? <p className="text-sm text-destructive">{verify.error.message}</p> : null}
            <PrimaryButton label={t('verifyPass.verify')} arrow={false} loading={verify.running} disabled={value.trim().length === 0} onClick={() => verify.run()} />
          </>
        ) : (
          <>
            {result.accepted && result.pass ? (
              <div className="flex flex-col gap-3 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-5">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-7 w-7" />
                  <span className="text-lg font-extrabold">{t('verifyPass.accepted')}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-extrabold">{result.pass.visitorName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {result.pass.hostUnitNumber ? `${t('verifyPass.unit')} ${result.pass.hostUnitNumber}` : ''}
                    {result.pass.vehicleNumber ? ` · ${result.pass.vehicleNumber}` : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('verifyPass.usage', { used: result.pass.useCount, max: result.pass.maxUses })} · {humanize(result.pass.status)}
                  </p>
                </div>
                {recorded ? (
                  <span className="flex items-center gap-2 self-start rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-bold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {t('verifyPass.entryRecorded')}
                  </span>
                ) : (
                  <button type="button" onClick={() => recordEntry.run()} disabled={recordEntry.running} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
                    <LogIn className="h-4 w-4" />
                    {recordEntry.running ? t('common.loading') : t('verifyPass.recordEntry')}
                  </button>
                )}
                {recordEntry.error ? <p className="text-sm text-destructive">{recordEntry.error.message}</p> : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-5">
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-7 w-7" />
                  <span className="text-lg font-extrabold">{t('verifyPass.rejected')}</span>
                </div>
                <p className="text-sm text-muted-foreground">{result.rejectionReason ? humanize(result.rejectionReason) : t('verifyPass.rejectedGeneric')}</p>
              </div>
            )}
            <PrimaryButton label={t('verifyPass.scanAnother')} arrow={false} onClick={reset} />
          </>
        )}
      </div>
    </PageLayout>
  );
}
