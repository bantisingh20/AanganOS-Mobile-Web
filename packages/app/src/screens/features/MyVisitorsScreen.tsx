import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Users,
  Check,
  X,
  Plus,
  Eye,
  Ticket,
  DoorOpen,
  Phone,
  Calendar,
  Car,
  User,
  Copy,
  Download,
  MessageSquare,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { residents, gate, files } from '@shared/services';
import type { Visitor } from '@shared/api/gate';
import { useAsync } from '@shared/lib/useAsync';
import { usePermission } from '@shared/lib/usePermission';
import { cn } from '@shared/lib/utils';
import { PageLayout } from '@app/components/PageLayout';

function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function VisitorPhotoAvatar({
  photoFileId,
  name,
  className,
}: {
  photoFileId?: string | null;
  name: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoFileId) {
      setUrl(null);
      return;
    }
    let active = true;
    void files
      .objectUrl(photoFileId)
      .then((u) => {
        if (active) setUrl(u);
      })
      .catch(() => setUrl(null));
    return () => {
      active = false;
    };
  }, [photoFileId]);

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={cn('h-11 w-11 rounded-2xl object-cover border border-border/50 shadow-sm shrink-0', className)}
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || 'V';
  return (
    <span
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black text-base shadow-sm',
        className,
      )}
    >
      {initial}
    </span>
  );
}

function StatusBadge({ visitor }: { visitor: Visitor }) {
  if (visitor.passType === 'pass') {
    if (visitor.status === 'active') {
      return (
        <span className="shrink-0 rounded-full bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 text-[11px] font-bold">
          Invited Pass
        </span>
      );
    }
    if (visitor.status === 'used') {
      return (
        <span className="shrink-0 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">
          Used
        </span>
      );
    }
    if (visitor.status === 'expired') {
      return (
        <span className="shrink-0 rounded-full bg-rose-500/10 text-rose-600 px-2.5 py-0.5 text-[11px] font-bold">
          Expired
        </span>
      );
    }
    return (
      <span className="shrink-0 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold capitalize">
        {visitor.status}
      </span>
    );
  }

  // Walk-in statuses:
  if (visitor.status === 'pending') {
    return (
      <span className="shrink-0 rounded-full bg-amber-500/10 text-amber-600 px-2.5 py-0.5 text-[11px] font-bold">
        Pending Approval
      </span>
    );
  }
  if (visitor.status === 'approved') {
    return (
      <span className="shrink-0 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-bold">
        Approved
      </span>
    );
  }
  if (visitor.status === 'rejected') {
    return (
      <span className="shrink-0 rounded-full bg-destructive/10 text-destructive px-2.5 py-0.5 text-[11px] font-bold">
        Rejected
      </span>
    );
  }
  if (visitor.status === 'entered') {
    return (
      <span className="shrink-0 rounded-full bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 text-[11px] font-bold">
        Entered Gate
      </span>
    );
  }
  if (visitor.status === 'exited') {
    return (
      <span className="shrink-0 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">
        Exited
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold capitalize">
      {visitor.status}
    </span>
  );
}

export function MyVisitorsScreen({ initialTab = 'all' }: { initialTab?: 'all' | 'approvals' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const perm = usePermission('approvals');
  const invitePerm = usePermission('my-visitors');
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const residentId = me.data?.resident?.id ?? null;
  const unitId = me.data?.units?.[0]?.unitId ?? null;

  const [tab, setTab] = useState<'all' | 'approvals'>(initialTab);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailVisitor, setDetailVisitor] = useState<Visitor | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const list = useAsync(
    (signal) =>
      unitId
        ? gate.listVisitors(
            { pageSize: 50, sort: 'createdAtUtc:desc' },
            { hostUnitId: unitId, ...(tab === 'approvals' ? { status: 'pending' } : {}) },
            { signal },
          )
        : Promise.resolve(null),
    [unitId, tab],
  );
  const items = list.data?.items ?? [];

  useEffect(() => {
    if (detailVisitor?.qrToken) {
      QRCode.toDataURL(detailVisitor.qrToken, { width: 260, margin: 1 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [detailVisitor]);

  const decide = async (id: string, approve: boolean) => {
    if (!residentId || busyId) return;
    setBusyId(id);
    try {
      if (approve) await gate.approveVisitor(id, { approvingResidentId: residentId });
      else await gate.rejectVisitor(id, { rejectingResidentId: residentId });
      list.reload();
      if (detailVisitor?.id === id) setDetailVisitor(null);
    } catch {
      void 0;
    } finally {
      setBusyId(null);
    }
  };

  const passUrl = detailVisitor
    ? `${window.location.origin}/pass/${detailVisitor.publicToken || detailVisitor.qrToken}`
    : '';

  const shareText = detailVisitor
    ? `🎟️ Visitor Gate Pass for ${detailVisitor.name}\n` +
      `🏢 Flat / Unit: ${detailVisitor.hostUnitNumber ?? ''}\n` +
      (detailVisitor.qrToken ? `🔐 Pass Token: ${detailVisitor.qrToken}\n` : '') +
      (detailVisitor.validUntilUtc ? `📅 Valid until: ${formatDateTime(detailVisitor.validUntilUtc)}\n\n` : '\n') +
      `📲 Tap link to view pass & QR code:\n${passUrl}`
    : '';

  const shareOnWhatsApp = () => {
    if (!detailVisitor) return;
    const rawPhone = (detailVisitor.phone ?? '').replace(/[^0-9]/g, '');
    const waUrl = rawPhone
      ? `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodeURIComponent(shareText)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank');
  };

  const copyLink = async () => {
    if (!passUrl) return;
    await navigator.clipboard?.writeText(passUrl).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const downloadQr = () => {
    if (!qrDataUrl || !detailVisitor) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `pass-${detailVisitor.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <PageLayout
      title={t('myVisitors.title')}
      subtitle={t('myVisitors.subtitle')}
      right={
        invitePerm.canAdd && unitId ? (
          <button
            type="button"
            onClick={() => navigate('/invite-visitor')}
            aria-label={t('myVisitors.invite')}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/15"
          >
            <Plus className="h-5 w-5" />
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        {/* Tabs */}
        <div className="flex rounded-full bg-muted p-1">
          {(['all', 'approvals'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTab(f)}
              className={cn(
                'flex-1 rounded-full py-1.5 text-sm font-bold transition-colors',
                tab === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {t(f === 'all' ? 'myVisitors.title' : 'myVisitors.approvals')}
            </button>
          ))}
        </div>

        {me.loading || list.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {t(tab === 'approvals' ? 'myVisitors.noApprovals' : 'myVisitors.empty')}
            </p>
          </div>
        ) : (
          items.map((v) => {
            const isWalkinPending = v.passType === 'walkin' && v.status === 'pending';
            const canDecide = isWalkinPending && perm.canApprove;

            return (
              <article
                key={v.id}
                className="flex flex-col gap-2.5 rounded-2xl bg-card p-4 shadow-sm border border-border/50 hover:border-primary/30 transition-all"
              >
                {/* Top Row: Avatar + Name + Status */}
                <div className="flex items-start gap-3">
                  <VisitorPhotoAvatar photoFileId={v.photoFileId} name={v.name} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="truncate text-[15px] font-extrabold text-foreground">{v.name}</span>
                      {v.passType === 'pass' ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                          <Ticket className="h-3 w-3" /> Pre-Invite
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-500/10 px-2 py-0.5 rounded-full">
                          <DoorOpen className="h-3 w-3" /> Walk-In
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      <span className="capitalize font-semibold text-foreground/80">{v.category}</span>
                      {v.whomToMeet ? ` · To meet: ${v.whomToMeet}` : ''}
                      {v.purpose ? ` · ${v.purpose}` : ''}
                    </div>

                    {v.vehicleNumber ? (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <Car className="h-3 w-3 text-muted-foreground/70" />
                        <span className="uppercase font-semibold">{v.vehicleNumber}</span>
                      </div>
                    ) : null}

                    {v.createdAtUtc ? (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDateTime(v.createdAtUtc)}</span>
                      </div>
                    ) : null}
                  </div>

                  <StatusBadge visitor={v} />
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setDetailVisitor(v)}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:underline px-1 py-1"
                  >
                    <Eye className="h-3.5 w-3.5" /> View Pass & Details
                  </button>

                  {canDecide ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === v.id}
                        onClick={() => decide(v.id, false)}
                        className="flex items-center gap-1 rounded-xl border border-destructive/30 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> {t('myVisitors.reject')}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === v.id}
                        onClick={() => decide(v.id, true)}
                        className="flex items-center gap-1 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-105 disabled:opacity-50 shadow-sm"
                      >
                        <Check className="h-3.5 w-3.5" /> {t('myVisitors.approve')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}

        {/* View Details Modal / Bottom Sheet */}
        {detailVisitor ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-y-auto rounded-3xl bg-card shadow-2xl border border-border/60 p-5 gap-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <VisitorPhotoAvatar photoFileId={detailVisitor.photoFileId} name={detailVisitor.name} />
                  <div>
                    <h3 className="text-base font-extrabold text-foreground leading-tight">
                      {detailVisitor.name}
                    </h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {detailVisitor.category} · {detailVisitor.passType === 'pass' ? 'Invited Pass' : 'Gate Walk-In'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailVisitor(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* QR Code Section (if present) */}
              {qrDataUrl ? (
                <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-muted/30 p-4 border border-border/50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <ShieldCheck className="h-4 w-4" /> Active Gate QR Code
                  </div>
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-border/40">
                    <img src={qrDataUrl} alt="Gate Pass QR" className="h-44 w-44 object-contain" />
                  </div>
                  <p className="text-center text-[11px] text-muted-foreground font-medium">
                    Show this QR code at the security gate for entry
                  </p>

                  {/* Share buttons */}
                  <div className="flex w-full gap-2 mt-1">
                    <button
                      type="button"
                      onClick={shareOnWhatsApp}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-white py-2 text-xs font-bold shadow-sm hover:brightness-105 active:scale-95"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={copyLink}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-bold text-foreground hover:bg-muted active:scale-95"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy Link
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={downloadQr}
                      aria-label="Save QR"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted active:scale-95"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Details List */}
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card text-xs divide-y divide-border/60">
                <div className="flex justify-between items-center p-3">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Visitor Name
                  </span>
                  <span className="font-bold text-foreground">{detailVisitor.name}</span>
                </div>

                {detailVisitor.phone ? (
                  <div className="flex justify-between items-center p-3">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Phone Number
                    </span>
                    <a
                      href={`tel:${detailVisitor.phone}`}
                      className="font-bold text-primary hover:underline"
                    >
                      {detailVisitor.phone}
                    </a>
                  </div>
                ) : null}

                {detailVisitor.hostUnitNumber ? (
                  <div className="flex justify-between items-center p-3">
                    <span className="text-muted-foreground">Visiting Unit</span>
                    <span className="font-bold text-foreground">{detailVisitor.hostUnitNumber}</span>
                  </div>
                ) : null}

                {detailVisitor.whomToMeet ? (
                  <div className="flex justify-between items-center p-3">
                    <span className="text-muted-foreground">Whom to Meet</span>
                    <span className="font-semibold text-foreground">{detailVisitor.whomToMeet}</span>
                  </div>
                ) : null}

                {detailVisitor.vehicleNumber ? (
                  <div className="flex justify-between items-center p-3">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5" /> Vehicle Number
                    </span>
                    <span className="font-bold uppercase text-foreground">{detailVisitor.vehicleNumber}</span>
                  </div>
                ) : null}

                {detailVisitor.purpose ? (
                  <div className="flex justify-between items-center p-3">
                    <span className="text-muted-foreground">Purpose of Visit</span>
                    <span className="font-semibold text-foreground">{detailVisitor.purpose}</span>
                  </div>
                ) : null}

                {detailVisitor.validUntilUtc ? (
                  <div className="flex justify-between items-center p-3">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Valid Until
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatDateTime(detailVisitor.validUntilUtc)}
                    </span>
                  </div>
                ) : null}

                <div className="flex justify-between items-center p-3">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge visitor={detailVisitor} />
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setDetailVisitor(null)}
                className="w-full py-2.5 rounded-xl border border-border bg-muted/40 text-xs font-bold text-foreground hover:bg-muted transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
}
