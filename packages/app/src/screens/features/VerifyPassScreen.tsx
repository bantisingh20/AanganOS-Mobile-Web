import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle2, XCircle, LogIn, Camera, CameraOff } from 'lucide-react';
import { gate } from '@shared/services';
import type { VerifyVisitPassResult } from '@shared/api/gate';
import { useAsyncAction } from '@shared/lib/useAsync';
import { PageLayout } from '@app/components/PageLayout';
import { TextField } from '@shared/components/TextField';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { requestCameraPermission } from '@shared/lib/permissionsHelper';

function humanize(code: string): string {
  return code.split(/[_\s]+/).map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ');
}

export function VerifyPassScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'qr' | 'otp'>('qr');
  const [value, setValue] = useState('');
  const [result, setResult] = useState<VerifyVisitPassResult | null>(null);
  const [recorded, setRecorded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-reader-target';

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // Ignore stop errors
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (scannerRef.current?.isScanning) {
        await stopCamera();
      }

      const html5QrCode = new Html5Qrcode(containerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          let token = decodedText.trim();
          if (token.includes('/pass/')) {
            token = token.split('/pass/').pop()?.split(/[?#]/)[0] ?? token;
          }
          setValue(token);
          await stopCamera();
          // Auto verify
          void triggerVerify(token, 'qr');
        },
        () => {
          // Frame error (no QR detected yet) - ignore
        },
      );

      setIsCameraActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access denied or unavailable.';
      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Stop camera if switching to OTP
  useEffect(() => {
    if (mode === 'otp' && isCameraActive) {
      void stopCamera();
    }
  }, [mode, isCameraActive]);

  const triggerVerify = async (val: string, verifyMode: 'qr' | 'otp') => {
    const v = val.trim();
    if (!v) return;
    try {
      const body = verifyMode === 'qr' ? { qrToken: v } : { otp: v };
      const res = await gate.verifyVisitPass(body);
      setResult(res);
      setRecorded(false);
    } catch {
      // Handled by verify hook if called via verify.run
    }
  };

  const verify = useAsyncAction(async () => {
    const v = value.trim();
    if (!v) return;
    await triggerVerify(v, mode);
  });

  const recordEntry = useAsyncAction(async () => {
    if (!result?.pass) return;
    await gate.recordEntry({ visitPassId: result.pass.id });
    setRecorded(true);
  });

  const reset = () => {
    setResult(null);
    setValue('');
    setRecorded(false);
    setCameraError(null);
  };

  return (
    <PageLayout title={t('verifyPass.title')} subtitle={t('verifyPass.subtitle')}>
      <div className="flex flex-col gap-4 px-4 py-4">
        {!result ? (
          <>
            <div className="flex rounded-full bg-muted p-1">
              {(['qr', 'otp'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-full py-1.5 text-sm font-bold transition-colors ${
                    mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {t(m === 'qr' ? 'verifyPass.byToken' : 'verifyPass.byOtp')}
                </button>
              ))}
            </div>

            {mode === 'qr' ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-4 shadow-sm border border-border/50">
                {/* QR Scanner Container */}
                <div
                  id={containerId}
                  className={`overflow-hidden rounded-xl border-2 border-dashed ${
                    isCameraActive
                      ? 'border-emerald-500 w-full max-w-[280px] aspect-square bg-black'
                      : 'border-border/60 w-full max-w-[280px] h-36 bg-muted/30 flex flex-col items-center justify-center p-3'
                  }`}
                >
                  {!isCameraActive ? (
                    <div className="flex flex-col items-center gap-1.5 text-center">
                      <Camera className="h-8 w-8 text-primary" />
                      <p className="text-xs font-semibold text-muted-foreground">
                        Scan gate pass QR code using device camera
                      </p>
                    </div>
                  ) : null}
                </div>

                {cameraError ? (
                  <div className="flex flex-col items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-center w-full max-w-[280px]">
                    <p className="text-xs text-destructive font-medium">
                      {cameraError}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        const granted = await requestCameraPermission();
                        if (granted) {
                          setCameraError(null);
                          void startCamera();
                        }
                      }}
                      className="mt-1 rounded-[4px] bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
                    >
                      Allow Camera Permission
                    </button>
                  </div>
                ) : null}

                <div className="flex gap-2 w-full max-w-[280px]">
                  {!isCameraActive ? (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white py-2.5 text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
                    >
                      <Camera className="h-4 w-4" /> Start Camera Scanner
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive py-2.5 text-xs font-bold hover:bg-destructive/20 active:scale-95 transition-all"
                    >
                      <CameraOff className="h-4 w-4" /> Stop Camera
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            <TextField
              label={mode === 'qr' ? t('verifyPass.tokenLabel') : t('verifyPass.otpLabel')}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === 'qr' ? t('verifyPass.tokenPlaceholder') : t('verifyPass.otpPlaceholder')}
              onEnter={() => verify.run()}
            />
            {verify.error ? <p className="text-sm text-destructive">{verify.error.message}</p> : null}
            <PrimaryButton
              label={t('verifyPass.verify')}
              arrow={false}
              loading={verify.running}
              disabled={value.trim().length === 0}
              onClick={() => verify.run()}
            />
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
                  <button
                    type="button"
                    onClick={() => recordEntry.run()}
                    disabled={recordEntry.running}
                    className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
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
                <p className="text-sm text-muted-foreground">
                  {result.rejectionReason ? humanize(result.rejectionReason) : t('verifyPass.rejectedGeneric')}
                </p>
              </div>
            )}
            <PrimaryButton label={t('verifyPass.scanAnother')} arrow={false} onClick={reset} />
          </>
        )}
      </div>
    </PageLayout>
  );
}
