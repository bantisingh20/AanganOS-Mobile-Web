import { useCallback } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';

/**
 * Back handler for page headers: goes back in history when there is somewhere to go back to,
 * otherwise (deep link, fresh tab, notification tap) goes to `fallback`.
 */
export function useBackNavigation(fallback: string, onBack?: () => void): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (onBack) return onBack();
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback, onBack]);
}

/**
 * Permanent redirect for an old URL. Fills `:params` in `to` from the current route and keeps
 * the query string, e.g. <RedirectTo to="/helpdesk/:id" /> on "/my-tickets/:id".
 */
export function RedirectTo({ to }: { to: string }) {
  const params = useParams();
  const { search } = useLocation();
  const path = to.replace(/:(\w+)/g, (_, key: string) => encodeURIComponent(params[key] ?? ''));
  return <Navigate to={`${path}${search}`} replace />;
}
