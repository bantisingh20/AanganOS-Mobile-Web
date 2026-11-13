import type { TokenStore } from './tokenStore';
import type { ErrorCode } from './types';
import { ApiRequestError } from './errors';

export interface UploadFileResult {
  reference: string;
  fileName?: string;
  contentType?: string;
}

interface UploadEnvelope {
  success: boolean;
  data?: { reference?: string; id?: string; fileName?: string; contentType?: string };
  error?: { code: string; message: string };
}

export interface UploadOptions {
  owningResourceType: string;
  communityId: string;
  owningResourceId?: string;
}

export class FilesClient {
  constructor(
    private readonly baseUrl: string,
    private readonly tokenStore: TokenStore,
  ) {}

  private get root(): string {
    return this.baseUrl.replace(/\/+$/, '');
  }

  async upload(file: File | Blob, options: UploadOptions): Promise<UploadFileResult> {
    const params = new URLSearchParams({ owningResourceType: options.owningResourceType, communityId: options.communityId });
    if (options.owningResourceId) params.set('owningResourceId', options.owningResourceId);

    const form = new FormData();
    form.append('file', file, file instanceof File ? file.name : 'upload.jpg');

    const token = this.tokenStore.getAccessToken();
    const res = await fetch(`${this.root}/api/v1/files?${params.toString()}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const envelope = (await res.json().catch(() => null)) as UploadEnvelope | null;
    if (!res.ok || !envelope?.success) {
      throw new ApiRequestError({
        code: (envelope?.error?.code as ErrorCode | undefined) ?? 'INTERNAL_ERROR',
        message: envelope?.error?.message ?? `Upload failed (HTTP ${res.status}).`,
        correlationId: '',
        httpStatus: res.status,
      });
    }
    const reference = envelope.data?.reference ?? envelope.data?.id ?? '';
    return {
      reference,
      ...(envelope.data?.fileName ? { fileName: envelope.data.fileName } : {}),
      ...(envelope.data?.contentType ? { contentType: envelope.data.contentType } : {}),
    };
  }

  async objectUrl(reference: string): Promise<string | null> {
    const token = this.tokenStore.getAccessToken();
    const res = await fetch(`${this.root}/api/v1/files/${reference}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
}
