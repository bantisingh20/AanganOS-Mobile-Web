import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface MessageLog {
  id: string;
  channel: string;
  recipient: string;
  subject?: string | null;
  body: string;
  status: string;
  attempts: number;
  nextAttemptUtc?: string | null;
  lastError?: string | null;
  createdAtUtc: string;
}

export interface NotificationLog {
  id: string;
  communityId: string;
  templateKey: string;
  category: string;
  channels: string;
  recipientUserId: string;
  targetPlayerId?: string | null;
  title: string;
  body: string;
  status: string;
  attempts: number;
  nextAttemptUtc?: string | null;
  lastError?: string | null;
  isRead: boolean;
  createdAtUtc: string;
}

export interface MessageLogFilters {
  channel?: string;
  status?: string;
  recipient?: string;
  fromDate?: string;
  toDate?: string;
}

export interface NotificationLogFilters {
  status?: string;
  category?: string;
  templateKey?: string;
  recipientUserId?: string;
  fromDate?: string;
  toDate?: string;
}

export class NotificationLogsClient {
  constructor(private readonly api: ApiClient) {}

  listMessages(query: ListQuery = {}, filters: MessageLogFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<MessageLog>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      channel: filters.channel,
      status: filters.status,
      recipient: filters.recipient,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    });
    return this.api.get<PagedData<MessageLog>>(`/api/v1/message-outbox${qs}`, options);
  }

  listNotifications(query: ListQuery = {}, filters: NotificationLogFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<NotificationLog>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      status: filters.status,
      category: filters.category,
      templateKey: filters.templateKey,
      recipientUserId: filters.recipientUserId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    });
    return this.api.get<PagedData<NotificationLog>>(`/api/v1/notification-outbox${qs}`, options);
  }
}
