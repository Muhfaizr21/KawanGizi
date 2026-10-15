import { Platform } from 'react-native';
import { BackendUser } from './api';

const TOKEN_KEY = '@kawangizi_token';
const USER_KEY = '@kawangizi_user';
const PERMS_KEY = '@kawangizi_perms';
const GUEST_KEY = '@kawangizi_is_guest';

export interface StoredSession {
  token: string | null;
  user: BackendUser | null;
  permissions: string[];
  isGuest: boolean;
}

// In-memory fallback untuk lingkungan non-browser atau SSR
const memoryStorage = new Map<string, string>();

/** Mencoba mengambil native AsyncStorage secara aman tanpa memicu error resolusi statis Metro */
function getOptionalNativeStorage(): any {
  try {
    // Cek globalThis terlebih dahulu jika sudah di-inject
    const g = globalThis as any;
    if (g?.AsyncStorage) {
      return g.AsyncStorage;
    }
    // Hindari static AST parser Metro dengan pemanggilan dinamis runtime
    const dynamicRequire = typeof g?.require === 'function' ? g.require : null;
    if (dynamicRequire) {
      const mod = dynamicRequire('@react-native-async-storage/async-storage');
      return mod?.default || mod;
    }
  } catch {
    // Abaikan jika modul belum di-link atau pada platform browser
  }
  return null;
}

function getWebLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Akses localStorage dapat ditolak pada sandbox iframe tertentu
  }
  return null;
}

export async function saveAuthSession(
  token: string,
  user: BackendUser,
  permissions: string[] = [],
  isGuest: boolean = false,
): Promise<void> {
  const userJson = JSON.stringify(user);
  const permsJson = JSON.stringify(permissions);
  const guestStr = isGuest ? 'true' : 'false';

  // 1. Simpan ke Web localStorage (bertahan saat refresh browser)
  const local = getWebLocalStorage();
  if (local) {
    try {
      local.setItem(TOKEN_KEY, token);
      local.setItem(USER_KEY, userJson);
      local.setItem(PERMS_KEY, permsJson);
      local.setItem(GUEST_KEY, guestStr);
    } catch (err) {
      console.warn('[Storage] Web localStorage write error:', err);
    }
  }

  // 2. Simpan ke in-memory fallback
  memoryStorage.set(TOKEN_KEY, token);
  memoryStorage.set(USER_KEY, userJson);
  memoryStorage.set(PERMS_KEY, permsJson);
  memoryStorage.set(GUEST_KEY, guestStr);

  // 3. Simpan ke Native AsyncStorage jika runtime menyediakannya
  const native = getOptionalNativeStorage();
  if (native?.multiSet) {
    try {
      await native.multiSet([
        [TOKEN_KEY, token],
        [USER_KEY, userJson],
        [PERMS_KEY, permsJson],
        [GUEST_KEY, guestStr],
      ]);
    } catch (err) {
      console.warn('[Storage] Native AsyncStorage write error:', err);
    }
  }
}

export async function loadAuthSession(): Promise<StoredSession> {
  let token: string | null = null;
  let userJson: string | null = null;
  let permsJson: string | null = null;
  let guestStr: string | null = null;

  // 1. Ambil dari Web localStorage jika tersedia (sangat cepat pada platform Web)
  const local = getWebLocalStorage();
  if (local) {
    try {
      token = local.getItem(TOKEN_KEY);
      userJson = local.getItem(USER_KEY);
      permsJson = local.getItem(PERMS_KEY);
      guestStr = local.getItem(GUEST_KEY);
    } catch (err) {
      console.warn('[Storage] Web localStorage read error:', err);
    }
  }

  // 2. Ambil dari Native AsyncStorage jika belum ada di localStorage
  if (!token || !userJson) {
    const native = getOptionalNativeStorage();
    if (native?.multiGet) {
      try {
        const items = await native.multiGet([TOKEN_KEY, USER_KEY, PERMS_KEY, GUEST_KEY]);
        const map = Object.fromEntries(items);
        token = token || map[TOKEN_KEY] || null;
        userJson = userJson || map[USER_KEY] || null;
        permsJson = permsJson || map[PERMS_KEY] || null;
        guestStr = guestStr || map[GUEST_KEY] || null;
      } catch (err) {
        console.warn('[Storage] Native AsyncStorage read error:', err);
      }
    }
  }

  // 3. Fallback ke in-memory map jika keduanya kosong
  if (!token || !userJson) {
    token = token || memoryStorage.get(TOKEN_KEY) || null;
    userJson = userJson || memoryStorage.get(USER_KEY) || null;
    permsJson = permsJson || memoryStorage.get(PERMS_KEY) || null;
    guestStr = guestStr || memoryStorage.get(GUEST_KEY) || null;
  }

  let user: BackendUser | null = null;
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch {
      user = null;
    }
  }

  let permissions: string[] = [];
  if (permsJson) {
    try {
      permissions = JSON.parse(permsJson);
    } catch {
      permissions = [];
    }
  }

  return {
    token,
    user,
    permissions,
    isGuest: guestStr === 'true',
  };
}

export async function clearAuthSession(): Promise<void> {
  // 1. Bersihkan Web localStorage
  const local = getWebLocalStorage();
  if (local) {
    try {
      local.removeItem(TOKEN_KEY);
      local.removeItem(USER_KEY);
      local.removeItem(PERMS_KEY);
      local.removeItem(GUEST_KEY);
    } catch (err) {
      console.warn('[Storage] Web localStorage clear error:', err);
    }
  }

  // 2. Bersihkan in-memory map
  memoryStorage.delete(TOKEN_KEY);
  memoryStorage.delete(USER_KEY);
  memoryStorage.delete(PERMS_KEY);
  memoryStorage.delete(GUEST_KEY);

  // 3. Bersihkan Native AsyncStorage jika ada
  const native = getOptionalNativeStorage();
  if (native?.multiRemove) {
    try {
      await native.multiRemove([TOKEN_KEY, USER_KEY, PERMS_KEY, GUEST_KEY]);
    } catch (err) {
      console.warn('[Storage] Native AsyncStorage clear error:', err);
    }
  }
}

export async function getStorageItem(key: string): Promise<string | null> {
  const local = getWebLocalStorage();
  if (local) {
    try {
      const val = local.getItem(key);
      if (val !== null) return val;
    } catch {
      // ignore
    }
  }

  const native = getOptionalNativeStorage();
  if (native?.getItem) {
    try {
      const val = await native.getItem(key);
      if (val !== null) return val;
    } catch {
      // ignore
    }
  }

  return memoryStorage.get(key) || null;
}

export async function setStorageItem(key: string, value: string): Promise<void> {
  const local = getWebLocalStorage();
  if (local) {
    try {
      local.setItem(key, value);
    } catch {
      // ignore
    }
  }

  memoryStorage.set(key, value);

  const native = getOptionalNativeStorage();
  if (native?.setItem) {
    try {
      await native.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

export async function removeStorageItem(key: string): Promise<void> {
  const local = getWebLocalStorage();
  if (local) {
    try {
      local.removeItem(key);
    } catch {
      // ignore
    }
  }

  memoryStorage.delete(key);

  const native = getOptionalNativeStorage();
  if (native?.removeItem) {
    try {
      await native.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/**
 * Adapter AsyncStorage kompatibel lintas platform (Web localStorage, React Native, In-Memory)
 */
export const AsyncStorage = {
  getItem: getStorageItem,
  setItem: setStorageItem,
  removeItem: removeStorageItem,
};

export default AsyncStorage;
