export interface ListQuery {
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 20;

export function buildQuery(
  params: Readonly<Record<string, string | number | boolean | null | undefined>>,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const str = String(value);
    if (str.length === 0) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(str)}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export function listQueryParams(query: ListQuery = {}): Record<string, string | number | undefined> {
  return {
    search: query.search,
    sort: normalizeSort(query.sort),
    page: query.page,
    pageSize: query.pageSize,
  };
}

function normalizeSort(sort: string | undefined): string | undefined {
  if (!sort) return undefined;
  const trimmed = sort.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.includes(':')) return trimmed;
  if (trimmed.startsWith('-')) return `${trimmed.slice(1)}:desc`;
  return `${trimmed}:asc`;
}
