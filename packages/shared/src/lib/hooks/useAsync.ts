import { useCallback, useEffect, useRef, useState } from 'react';
import { toFormError, type FormErrorView } from '@shared/api/errors';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: FormErrorView | null;
  reload: () => void;
}

export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FormErrorView | null>(null);
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current(controller.signal)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err: unknown) => {
        if (active && !controller.signal.aborted) setError(toFormError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      //controller.abort();
      // Do not forcefully abort the HTTP connection on component unmount / StrictMode re-render
      // to avoid triggering TaskCanceledException and resetting connection pool on the remote database.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

export interface AsyncAction<Args extends unknown[]> {
  run: (...args: Args) => Promise<boolean>;
  running: boolean;
  error: FormErrorView | null;
  reset: () => void;
}

export function useAsyncAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<unknown>,
): AsyncAction<Args> {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<FormErrorView | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args: Args): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setRunning(true);
      setError(null);
      try {
        await action(...args);
        return true;
      } catch (err) {
        if (mounted.current) setError(toFormError(err));
        return false;
      } finally {
        inFlight.current = false;
        if (mounted.current) setRunning(false);
      }
    },
    [action],
  );

  const reset = useCallback(() => setError(null), []);
  return { run, running, error, reset };
}
