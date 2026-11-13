import type { ApiClient } from './client';
import { buildQuery } from './query';

export interface NotificationTemplate {
  id: string;
  key: string;
  category: string;
  categoryKind: number;
  channels: number;
  titleTemplate: string;
  bodyTemplate: string;
  emailSubjectTemplate?: string | null;
  emailHtmlTemplate?: string | null;
  smsTemplate?: string | null;
  whatsappTemplateName?: string | null;
  whatsappVarsJson?: string | null;
  isActive: boolean;
  communityId?: string | null;
}

export interface NotificationTemplatePreview {
  pushTitle?: string | null;
  pushBody?: string | null;
  emailSubject?: string | null;
  emailHtml?: string | null;
  sms?: string | null;
  whatsapp?: string | null;
  placeholders: string[];
}

export interface UpsertNotificationTemplateBody {
  key: string;
  channels: number;
  titleTemplate: string;
  bodyTemplate: string;
  emailSubjectTemplate?: string | null;
  emailHtmlTemplate?: string | null;
  smsTemplate?: string | null;
  whatsappTemplateName?: string | null;
  whatsappVarsJson?: string | null;
  isActive: boolean;
  communityId?: string | null;
}

export interface PreviewNotificationTemplateBody {
  key: string;
  channels: number;
  titleTemplate: string;
  bodyTemplate: string;
  emailSubjectTemplate?: string | null;
  emailHtmlTemplate?: string | null;
  smsTemplate?: string | null;
  whatsappTemplateName?: string | null;
  whatsappVarsJson?: string | null;
  sampleValues?: Record<string, string>;
}

export class NotificationTemplatesClient {
  constructor(private readonly api: ApiClient) {}

  list(search?: string, options?: { signal?: AbortSignal }): Promise<NotificationTemplate[]> {
    const qs = buildQuery({ search });
    return this.api.get<NotificationTemplate[]>(`/api/v1/notification-templates${qs}`, options);
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<NotificationTemplate> {
    return this.api.get<NotificationTemplate>(`/api/v1/notification-templates/${id}`, options);
  }

  upsert(body: UpsertNotificationTemplateBody): Promise<NotificationTemplate> {
    return this.api.post<NotificationTemplate>('/api/v1/notification-templates', { body });
  }

  preview(body: PreviewNotificationTemplateBody): Promise<NotificationTemplatePreview> {
    return this.api.post<NotificationTemplatePreview>('/api/v1/notification-templates/preview', { body });
  }
}
