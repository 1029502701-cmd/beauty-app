import { Preferences } from '@capacitor/preferences';

const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.();

async function get(key) {
  if (isNative) {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  }
  return localStorage.getItem(key);
}

async function set(key, value) {
  if (isNative) {
    await Preferences.set({ key, value: String(value) });
  } else {
    localStorage.setItem(key, String(value));
  }
}

async function remove(key) {
  if (isNative) {
    await Preferences.remove({ key });
  } else {
    localStorage.removeItem(key);
  }
}

export const STORAGE_KEYS = {
  SESSION_TOKEN: 'session_token',
  ADMIN_SESSION_TOKEN: 'admin_session_token',
  HAS_PASSWORD: 'has_password',
};

export async function getStorageItem(key) {
  return get(key);
}

export async function setStorageItem(key, value) {
  return set(key, value);
}

export async function removeStorageItem(key) {
  return remove(key);
}