import { toast } from 'sonner';

/**
 * Unified permission request helper for Web & Capacitor Hybrid environments.
 * Handles: camera, contacts, notifications, files/storage.
 */

export async function requestCameraPermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    toast.error('Camera is not supported on this device/browser.');
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    // Stop tracks immediately after granting permission
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (err: any) {
    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      toast.error('Camera permission was denied. Please allow camera access in your device/browser settings.');
    } else {
      toast.error('Unable to access camera: ' + (err?.message || 'Unknown error'));
    }
    return false;
  }
}

export async function requestContactPermission(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
    return true;
  }
  // If native navigator.permissions query is supported:
  if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
    try {
      const status = await (navigator.permissions as any).query({ name: 'contacts' as any });
      if (status.state === 'granted') return true;
      if (status.state === 'denied') {
        toast.error('Contact permission is denied in browser settings.');
        return false;
      }
    } catch {
      // Ignore query error, fallback to device check
    }
  }
  toast.info('Contact picker is available on supported mobile browsers (e.g. Chrome on Android).');
  return false;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission === 'denied') {
    toast.error('Notification permission is blocked. Please enable notifications in device settings.');
    return false;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      toast.success('Notification permission granted.');
      return true;
    }
    toast.error('Notification permission denied.');
    return false;
  } catch {
    return false;
  }
}
