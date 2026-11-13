import type { ApiError, ErrorCode, FieldError } from './types';

export interface FormErrorView {
  message: string;
  fieldErrors: Record<string, string>;
}

export class ApiRequestError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors: FieldError[];
  readonly correlationId?: string;
  readonly httpStatus: number;

  constructor(init: { code: ErrorCode; message: string; fieldErrors?: FieldError[]; correlationId?: string; httpStatus: number }) {
    super(init.message);
    this.name = 'ApiRequestError';
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? [];
    this.correlationId = init.correlationId;
    this.httpStatus = init.httpStatus;
  }

  get isUnauthenticated(): boolean {
    return this.code === 'UNAUTHENTICATED' || this.httpStatus === 401;
  }

  static fromApiError(error: ApiError, correlationId: string | undefined, httpStatus: number): ApiRequestError {
    return new ApiRequestError({
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors ?? [],
      correlationId,
      httpStatus,
    });
  }
}

export function toFormError(err: unknown): FormErrorView {
  if (err instanceof ApiRequestError) {
    const fieldErrors: Record<string, string> = {};
    for (const fe of err.fieldErrors) fieldErrors[fe.field] = fe.reason;
    return { message: err.message, fieldErrors };
  }
  return { message: err instanceof Error ? err.message : 'Something went wrong.', fieldErrors: {} };
}
