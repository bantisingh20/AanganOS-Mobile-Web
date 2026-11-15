import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { ShieldCheck, Download, AlertCircle, Building2, User, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { gate } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { BrandLogo } from '@shared/components/BrandLogo';
import { cn } from '@shared/lib/utils';

function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function PublicPassScreen() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const query = useAsync(
    (signal) => (token ? gate.getPublicPass(token, { signal }) : Promise.resolve(null)),
    [token],
  );

  const pass = query.data;

  useEffect(() => {
    if (pass?.qrToken) {
      QRCode.toDataURL(pass.qrToken, { width: 280, margin: 1 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    }
  }, [pass?.qrToken]);

  const downloadQr = () => {
    if (!qrDataUrl || !pass) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `pass-${pass.visitorName.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between px-2">
          <BrandLogo size="md" />
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified Gate Pass
          </span>
        </div>

        {query.loading ? (
          <div className="rounded-3xl bg-card p-8 shadow-md border border-border/40 text-center text-sm text-muted-foreground animate-pulse">
            {t('common.loading')}
          </div>
        ) : query.error || !pass ? (
          <div className="rounded-3xl bg-card p-8 shadow-md border border-border/40 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold">Pass Not Available</h2>
            <p className="text-sm text-muted-foreground">
              {query.error?.message || 'This pass link is invalid, expired, or has already been used.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-card shadow-lg border border-border/50">
            {/* Banner with Community & Status */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-100">
                    <Building2 className="h-3.5 w-3.5" />
                    <span className="truncate">{pass.communityName ?? 'Gated Society'}</span>
                  </div>
                  <h1 className="mt-1 text-xl font-extrabold tracking-tight">Visitor Entry Pass</h1>
                </div>
                <span
                  className={cn(
                    'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold shadow-sm',
                    pass.isValidNow
                      ? 'bg-white text-emerald-700'
                      : 'bg-white/20 text-white backdrop-blur-sm',
                  )}
                >
                  {pass.isValidNow ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5" /> {pass.status}
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* QR Card */}
            <div className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-card">
              <div className="text-center">
                <h2 className="text-lg font-black text-foreground">{pass.visitorName}</h2>
                {pass.hostUnitNumber ? (
                  <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                    Visiting Flat / Unit: <span className="text-foreground font-bold">{pass.hostUnitNumber}</span>
                  </p>
                ) : null}
              </div>

              <div className="relative flex aspect-square w-64 items-center justify-center rounded-2xl border-2 border-emerald-500/20 bg-emerald-50/30 p-2 shadow-inner">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Gate Pass QR" className="h-full w-full rounded-xl object-contain" />
                ) : (
                  <div className="h-full w-full animate-pulse rounded-xl bg-muted" />
                )}
              </div>

              <p className="text-center text-xs font-medium text-muted-foreground">
                Show this QR code at the security gate for instant check-in
              </p>

              {qrDataUrl ? (
                <button
                  type="button"
                  onClick={downloadQr}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted/50 transition-colors shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-primary" />
                  Save QR to Gallery
                </button>
              ) : null}
            </div>

            {/* Pass details */}
            <div className="border-t border-dashed border-border/80 bg-muted/20 px-6 py-4 text-xs space-y-2.5">
              {pass.whomToMeet ? (
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3.5 w-3.5" /> Whom to Meet
                  </span>
                  <span className="font-semibold text-foreground">{pass.whomToMeet}</span>
                </div>
              ) : null}

              {pass.numberOfPersons ? (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Expected Persons</span>
                  <span className="font-semibold text-foreground">{pass.numberOfPersons}</span>
                </div>
              ) : null}

              {pass.vehicleNumber ? (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Vehicle Number</span>
                  <span className="font-semibold text-foreground uppercase">{pass.vehicleNumber}</span>
                </div>
              ) : null}

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Valid Until
                </span>
                <span className="font-semibold text-foreground">{formatDateTime(pass.validUntilUtc)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-[11px] text-muted-foreground py-2">
          Powered by AanganOS Smart Gate System
        </div>
      </div>
    </div>
  );
}
