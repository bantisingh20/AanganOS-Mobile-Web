import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlarmClock,
  FileText,
  Flag,
  Image as ImageIcon,
  MessageSquare,
  PenLine,
  Send,
  Star,
  User,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { tickets, files } from '@shared/services';
import type { TicketAttachment } from '@shared/api/tickets';
import { useAsync, useAsyncAction } from '@shared/lib/hooks/useAsync';
import { cn } from '@shared/lib/utils';
import { PageShell } from '@shared/components/layout';
import { SurfaceProvider, useResolvedSurface } from '@shared/lib/surface';
import { formatDateTime, humanize } from '@shared/lib/format';
import { statusTone, type StatusTone } from '@shared/lib/statusTone';

const RATING_CHOICES = [1, 2, 3, 4, 5] as const;

/** Hero card background per status tone (colour rule from statusTone). */
const HERO_BG: Record<StatusTone, string> = {
  info: 'bg-sky-600',
  warning: 'bg-amber-600',
  success: 'bg-emerald-600',
  muted: 'bg-slate-600',
  danger: 'bg-rose-600',
  default: 'bg-primary',
};

export interface TicketDetailsPageProps {
  ticketId?: string;
  mode?: 'admin' | 'mobile';
  title?: string;
  listPath?: string;
  onBack?: () => void;
}

function isFeedbackEligible(status: string): boolean {
  return status === 'resolved' || status === 'closed';
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-3 flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function TimelineRow({
  icon,
  label,
  value,
  done,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  done: boolean;
  last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex w-6 flex-col items-center">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-white', done ? 'bg-emerald-500' : 'bg-muted-foreground/40')}>
          {icon}
        </span>
        {!last ? <span className="w-0.5 flex-1 bg-border" /> : null}
      </div>
      <div className="flex-1 pb-3">
        <div className="text-sm font-bold">{label}</div>
        <div className="text-xs text-muted-foreground">{value}</div>
      </div>
    </div>
  );
}

function AttachmentThumb({ attachment }: { attachment: TicketAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let created: string | null = null;
    files
      .objectUrl(attachment.fileId)
      .then((u) => {
        if (active) {
          created = u;
          setUrl(u);
        }
      })
      .catch(() => void 0);
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [attachment.fileId]);

  return url ? (
    <img src={url} alt="" className="h-20 w-20 rounded-xl object-cover" />
  ) : (
    <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-border bg-muted">
      <FileText className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

export function TicketDetailsPage(props: TicketDetailsPageProps) {
  const surface = useResolvedSurface(props.mode);
  return <SurfaceProvider value={surface}><TicketDetails {...props} /></SurfaceProvider>;
}

function TicketDetails({ ticketId: propId, title, listPath = '/helpdesk', onBack }: TicketDetailsPageProps) {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const id = propId ?? params.id ?? '';
  const ticketState = useAsync((signal) => tickets.get(id, { signal }), [id]);
  const attachmentsState = useAsync((signal) => tickets.attachments(id, { signal }).catch(() => []), [id]);
  const commentsState = useAsync((signal) => tickets.comments(id, { signal }), [id]);

  const ticket = ticketState.data;
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [newComment, setNewComment] = useState('');
  const composeRef = useRef<HTMLTextAreaElement>(null);

  const postComment = useAsyncAction(async () => {
    const text = newComment.trim();
    if (!text) return;
    await tickets.addComment(id, { body: text });
    setNewComment('');
    commentsState.reload();
  });

  const submitFeedback = useAsyncAction(async () => {
    if (rating === null) return;
    await tickets.submitFeedback(id, { rating, ...(feedbackComment.trim() ? { comment: feedbackComment.trim() } : {}) });
    ticketState.reload();
  });

  const attachments = attachmentsState.data ?? [];
  const comments = commentsState.data ?? [];
  const tone = ticket ? HERO_BG[statusTone(ticket.status)] : 'bg-primary';

  return (
    <PageShell title={title ?? t('myTickets.detailTitle')} showBack onBack={onBack} backTo={listPath}>
      {ticketState.loading && !ticket ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : !ticket ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('myTickets.detailEmpty')}</p>
      ) : (
        <div className="mx-auto w-full max-w-3xl">
          <div className={cn('relative overflow-hidden rounded-2xl p-5 text-white shadow-md', tone)}>
            <div className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-black/10" />
            <div className="relative flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                <Wrench className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{humanize(ticket.category)}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-foreground">
                {humanize(ticket.status)}
              </span>
            </div>
            <h1 className="relative mt-3 text-xl font-extrabold leading-snug">{ticket.title}</h1>
            <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-white/90">
              <span className="flex items-center gap-1">
                <Flag className="h-3.5 w-3.5" />
                {humanize(ticket.priority)}
              </span>
              <span className="h-1 w-1 rounded-full bg-white/50" />
              <span>{t('myTickets.raisedOn', { date: formatDateTime(ticket.createdAtUtc) })}</span>
            </div>
          </div>

          <Section title={t('myTickets.description')} icon={<FileText className="h-4 w-4" />}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
          </Section>

          <Section title={t('myTickets.timeline')} icon={<AlarmClock className="h-4 w-4" />}>
            <TimelineRow
              icon={<PenLine className="h-3 w-3" />}
              label={t('myTickets.raised')}
              value={formatDateTime(ticket.createdAtUtc)}
              done
            />
            <TimelineRow
              icon={<UserCheck className="h-3 w-3" />}
              label={t('myTickets.assigned')}
              value={ticket.assignedAtUtc ? formatDateTime(ticket.assignedAtUtc) : t('myTickets.notAssigned')}
              done={Boolean(ticket.assignedAtUtc)}
              last={!ticket.slaDueAtUtc}
            />
            {ticket.slaDueAtUtc ? (
              <TimelineRow
                icon={<AlarmClock className="h-3 w-3" />}
                label={t('myTickets.targetResolution')}
                value={formatDateTime(ticket.slaDueAtUtc)}
                done={isFeedbackEligible(ticket.status)}
                last
              />
            ) : null}
          </Section>

          <Section title={t('myTickets.attachments')} icon={<ImageIcon className="h-4 w-4" />}>
            {attachmentsState.loading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('myTickets.noAttachments')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <AttachmentThumb key={a.id} attachment={a} />
                ))}
              </div>
            )}
          </Section>

          <Section title={t('myTickets.comments')} icon={<MessageSquare className="h-4 w-4" />}>
            {commentsState.loading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('myTickets.noComments')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex-1 rounded-xl bg-muted p-3">
                      <p className="text-sm leading-relaxed">{c.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(c.createdAtUtc)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 flex flex-col gap-2">
              <textarea
                ref={composeRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t('myTickets.commentPlaceholder')}
                rows={2}
                className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
              />
              {postComment.error ? <p className="text-sm text-destructive">{postComment.error.message}</p> : null}
              <button
                type="button"
                onClick={() => postComment.run()}
                disabled={newComment.trim().length === 0 || postComment.running}
                className="flex items-center gap-1.5 self-end rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {postComment.running ? t('myTickets.posting') : t('myTickets.post')}
              </button>
            </div>
          </Section>

          <Section title={t('myTickets.feedback')} icon={<Star className="h-4 w-4" />}>
            {ticket.feedbackAtUtc && ticket.rating != null ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-1">
                  {RATING_CHOICES.map((n) => (
                    <Star key={n} className={cn('h-6 w-6', n <= ticket.rating! ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                  ))}
                </div>
                {ticket.feedbackComment ? <p className="text-sm leading-relaxed">{ticket.feedbackComment}</p> : null}
                <span className="self-start rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                  {t('myTickets.submitted')}
                </span>
              </div>
            ) : isFeedbackEligible(ticket.status) ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{t('myTickets.feedbackPrompt')}</p>
                <div className="flex gap-1.5">
                  {RATING_CHOICES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      aria-label={`${n}`}
                      className="p-0.5"
                    >
                      <Star className={cn('h-8 w-8', rating !== null && n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder={t('myTickets.commentOptionalPlaceholder')}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
                />
                {submitFeedback.error ? <p className="text-sm text-destructive">{submitFeedback.error.message}</p> : null}
                <button
                  type="button"
                  onClick={() => submitFeedback.run()}
                  disabled={rating === null || submitFeedback.running}
                  className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {submitFeedback.running ? t('common.loading') : t('myTickets.submitFeedback')}
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('myTickets.feedbackLater')}</p>
            )}
          </Section>
        </div>
      )}
    </PageShell>
  );
}
