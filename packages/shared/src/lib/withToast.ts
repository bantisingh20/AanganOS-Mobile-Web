import { toast } from 'sonner';
import { toFormError } from '@shared/api/errors';

/**
 * Runs an API call and reports the result as a toast, replacing the repeated
 *   try { await x(); toast.success(msg) } catch (err) { toast.error(toFormError(err).message) }
 * Returns the result, or `undefined` if it failed (the error toast is already shown).
 *
 *   const ok = await withToast(() => tickets.changeStatus(id, body), t('tickets.updated'));
 *   if (ok !== undefined) reload();
 */
export async function withToast<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
  try {
    const result = await fn();
    if (success) toast.success(success);
    return result;
  } catch (err) {
    toast.error(toFormError(err).message);
    return undefined;
  }
}

/** Same, but returns true/false — handy for `if (await tryToast(...)) close()`. */
export async function tryToast(fn: () => Promise<unknown>, success?: string): Promise<boolean> {
  try {
    await fn();
    if (success) toast.success(success);
    return true;
  } catch (err) {
    toast.error(toFormError(err).message);
    return false;
  }
}
