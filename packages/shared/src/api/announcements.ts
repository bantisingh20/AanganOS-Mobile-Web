import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface Announcement {
  id: string;
  communityId: string;
  title: string;
  body: string;
  category: string;
  publishedAtUtc: string;
  isActive: boolean;
  communityName?: string | null;
  organizationName?: string | null;
}

export interface AnnouncementListFilters {
  category?: string;
  communityId?: string;
  fromDate?: string;
  includeInactive?: boolean;
}

export interface CreateAnnouncementBody {
  communityId: string;
  title: string;
  body: string;
  category: string;
}

export interface UpdateAnnouncementBody {
  title?: string;
  body?: string;
  category?: string;
}

export class AnnouncementsClient {
  constructor(private readonly api: ApiClient) {}

  list(query: ListQuery = {}, filters: AnnouncementListFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<Announcement>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      category: filters.category,
      communityId: filters.communityId,
      fromDate: filters.fromDate,
      ...(filters.includeInactive ? { includeInactive: true } : {}),
    });
    return this.api.get<PagedData<Announcement>>(`/api/v1/announcements${qs}`, options);
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Announcement> {
    return this.api.get<Announcement>(`/api/v1/announcements/${id}`, options);
  }

  create(body: CreateAnnouncementBody): Promise<Announcement> {
    return this.api.post<Announcement>('/api/v1/announcements', { body });
  }

  update(id: string, body: UpdateAnnouncementBody): Promise<Announcement> {
    return this.api.put<Announcement>(`/api/v1/announcements/${id}`, { body });
  }

  activate(id: string): Promise<Announcement> {
    return this.api.post<Announcement>(`/api/v1/announcements/${id}/activate`, {});
  }

  deactivate(id: string): Promise<Announcement> {
    return this.api.post<Announcement>(`/api/v1/announcements/${id}/deactivate`, {});
  }

  remove(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/announcements/${id}`);
  }
}
