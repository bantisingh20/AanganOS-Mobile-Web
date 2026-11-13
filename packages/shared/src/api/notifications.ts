import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface AppNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  payloadJson: string | null;
  isRead: boolean;
  createdAtUtc: string;
}

interface UnreadCount {
  unreadCount: number;
}

export class NotificationsClient {
  constructor(private readonly api: ApiClient) {}

  list(query: ListQuery = {}, options: { unreadOnly?: boolean; signal?: AbortSignal } = {}): Promise<PagedData<AppNotification>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      ...(options.unreadOnly ? { unreadOnly: true } : {}),
    });
    return this.api.get<PagedData<AppNotification>>(
      `/api/v1/notifications${qs}`,
      options.signal ? { signal: options.signal } : undefined,
    );
  }

  async unreadCount(options?: { signal?: AbortSignal }): Promise<number> {
    const data = await this.api.get<UnreadCount>('/api/v1/notifications/unread-count', options);
    return data.unreadCount;
  }

  markRead(id: string): Promise<unknown> {
    return this.api.post<unknown>(`/api/v1/notifications/${id}/read`);
  }

  markAllRead(): Promise<unknown> {
    return this.api.post<unknown>('/api/v1/notifications/read-all');
  }

  delete(id: string): Promise<unknown> {
    return this.api.delete<unknown>(`/api/v1/notifications/${id}`);
  }

  deleteAll(): Promise<unknown> {
    return this.api.delete<unknown>('/api/v1/notifications');
  }
}
