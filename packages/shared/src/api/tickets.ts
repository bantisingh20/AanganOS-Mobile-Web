import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface Ticket {
  id: string;
  communityId: string;
  hostUnitId: string;
  raisedByResidentId?: string | null;
  title: string;
  description: string;
  category: string;
  subcategory?: string | null;
  priority: string;
  status: string;
  assignedToUserId?: string | null;
  assignedAtUtc?: string | null;
  slaDueAtUtc?: string | null;
  slaEscalatedAtUtc?: string | null;
  rating?: number | null;
  feedbackComment?: string | null;
  feedbackAtUtc?: string | null;
  createdAtUtc: string;
  communityName?: string | null;
  organizationName?: string | null;
}

export interface TicketComment {
  id: string;
  communityId: string;
  ticketId: string;
  body: string;
  createdBy?: string | null;
  createdAtUtc: string;
}

export interface TicketAttachment {
  id: string;
  communityId: string;
  ticketId: string;
  fileId: string;
}

export interface TicketListFilters {
  status?: string;
  category?: string;
  subcategory?: string;
  priority?: string;
  hostUnitId?: string;
  assignedToUserId?: string;
  communityId?: string;
}

export interface CreateTicketBody {
  hostUnitId: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  priority?: string;
  attachmentFileIds?: string[];
}

export interface AddTicketCommentBody {
  body: string;
}

export interface AssignTicketBody {
  assignedToUserId: string;
}

export interface ChangeTicketStatusBody {
  toStatus: string;
  reason?: string;
}

export interface SubmitTicketFeedbackBody {
  rating: number;
  comment?: string;
}

export class TicketsClient {
  constructor(private readonly api: ApiClient) {}

  list(query: ListQuery = {}, filters: TicketListFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<Ticket>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      status: filters.status,
      category: filters.category,
      subcategory: filters.subcategory,
      priority: filters.priority,
      hostUnitId: filters.hostUnitId,
      assignedToUserId: filters.assignedToUserId,
      communityId: filters.communityId,
    });
    return this.api.get<PagedData<Ticket>>(`/api/v1/tickets${qs}`, options);
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Ticket> {
    return this.api.get<Ticket>(`/api/v1/tickets/${id}`, options);
  }

  create(body: CreateTicketBody): Promise<Ticket> {
    return this.api.post<Ticket>('/api/v1/tickets', { body });
  }

  comments(id: string, options?: { signal?: AbortSignal }): Promise<TicketComment[]> {
    return this.api.get<TicketComment[]>(`/api/v1/tickets/${id}/comments`, options);
  }

  attachments(id: string, options?: { signal?: AbortSignal }): Promise<TicketAttachment[]> {
    return this.api.get<TicketAttachment[]>(`/api/v1/tickets/${id}/attachments`, options);
  }

  addComment(id: string, body: AddTicketCommentBody): Promise<TicketComment> {
    return this.api.post<TicketComment>(`/api/v1/tickets/${id}/comments`, { body });
  }

  assign(id: string, body: AssignTicketBody): Promise<Ticket> {
    return this.api.post<Ticket>(`/api/v1/tickets/${id}/assign`, { body });
  }

  changeStatus(id: string, body: ChangeTicketStatusBody): Promise<Ticket> {
    return this.api.post<Ticket>(`/api/v1/tickets/${id}/status`, { body });
  }

  submitFeedback(id: string, body: SubmitTicketFeedbackBody): Promise<Ticket> {
    return this.api.post<Ticket>(`/api/v1/tickets/${id}/feedback`, { body });
  }
}
