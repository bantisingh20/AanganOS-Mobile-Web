export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTEGRATION_FAILURE'
  | 'SUBSCRIPTION_EXPIRED'
  | 'INTERNAL_ERROR';

export interface FieldError {
  field: string;
  reason: string;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldError[];
}

export interface ApiResult<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  correlationId?: string;
}

export interface PagedData<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}
