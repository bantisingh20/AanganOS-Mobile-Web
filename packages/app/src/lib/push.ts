import { Capacitor } from '@capacitor/core';
import { auth } from '@shared/services';

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;
const REGISTER_PATH = import.meta.env.VITE_DEVICE_REGISTER_PATH ?? '/api/v1/devices';

type OneSignalApi = {
  initialize: (appId: string) => void;
  Notifications: {
    requestPermission: (fallback: boolean) => Promise<boolean>;
    permissionNative?: () => Promise<unknown>;
  };
  User: { pushSubscription: { getIdAsync: () => Promise<string | null>; optIn?: () => void } };
  login?: (externalId: string) => void;
};

let initialized = false;
let readyPromise: Promise<OneSignalApi | null> | null = null;

function getOneSignal(): OneSignalApi | null {
  const w = window as unknown as {
    OneSignal?: OneSignalApi & { default?: OneSignalApi };
    plugins?: { OneSignal?: OneSignalApi };
  };
  const candidates = [w.plugins?.OneSignal, w.OneSignal?.default, w.OneSignal];
  for (const c of candidates) {
    if (c && typeof c.initialize === 'function') return c;
  }
  return null;
}

function waitForOneSignal(timeoutMs = 8000): Promise<OneSignalApi | null> {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise<OneSignalApi | null>((resolve) => {
    const existing = getOneSignal();
    if (existing) {
      resolve(existing);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => {
      const os = getOneSignal();
      if (os) {
        clearInterval(id);
        resolve(os);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(id);
        resolve(null);
      }
    }, 200);
  });
  return readyPromise;
}

export async function initPush(): Promise<void> {
  if (initialized || !Capacitor.isNativePlatform() || !APP_ID) return;
  const os = await waitForOneSignal();
  if (!os) return;
  initialized = true;
  try {
    os.initialize(APP_ID);
    await os.Notifications.requestPermission(true).catch(() => undefined);
    os.User.pushSubscription.optIn?.();
  } catch {
    initialized = false;
  }
}

export async function registerPushDevice(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !APP_ID) return;
  const os = await waitForOneSignal();
  if (!os) return;
  try {
    if (!initialized) await initPush();
    await os.Notifications.requestPermission(true).catch(() => undefined);
    os.User.pushSubscription.optIn?.();
    let playerId: string | null = null;
    for (let i = 0; i < 10 && !playerId; i++) {
      playerId = await os.User.pushSubscription.getIdAsync().catch(() => null);
      if (!playerId) await new Promise((r) => setTimeout(r, 600));
    }
    if (playerId) {
      await auth.registerDevice(REGISTER_PATH, playerId, Capacitor.getPlatform());
    }
  } catch {
    void 0;
  }
}
