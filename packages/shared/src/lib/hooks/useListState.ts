import { useCallback, useState } from 'react';

/**
 * Search + paging + reload state shared by every list page. Changing the search or page size
 * jumps back to page 1. Pass `reloadKey` into useAsync deps and call `reload()` after edits.
 */
export function useListState(initialPageSize = 10) {
  const [search, setSearchRaw] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);
  const [reloadKey, setReloadKey] = useState(0);

  const setSearch = useCallback((v: string) => { setSearchRaw(v); setPage(1); }, []);
  const setPageSize = useCallback((n: number) => { setPageSizeRaw(n); setPage(1); }, []);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  /** Call after changing any filter so the list restarts at page 1. */
  const resetPage = useCallback(() => setPage(1), []);

  return { search, setSearch, page, setPage, pageSize, setPageSize, reloadKey, reload, resetPage };
}

export type ListState = ReturnType<typeof useListState>;
