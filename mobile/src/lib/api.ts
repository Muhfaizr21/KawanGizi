// API client: Bearer access token (in-memory) + httpOnly refresh cookie.
// Base URL diturunkan dari host dev-server Expo (emulator/perangkat/web) sehingga
// satu build bisa mencapai backend tanpa konfigurasi tambahan.

import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';
import { saveAuthSession, loadAuthSession, clearAuthSession } from './storage';

export function resolveApiBase(): string {
  // 1. Explicit override via .env (EXPO_PUBLIC_API_URL)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 2. Web browser: gunakan hostname saat ini
  if (Platform.OS === 'web') {
    const host = typeof window !== 'undefined' ? window.location?.hostname : '';
    return `http://${host || 'localhost'}:8080`;
  }

  // 3. React Native Metro scriptURL: paling akurat mendeteksi IP laptop saat dev Expo/Metro
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
    if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
      return `http://${match[1]}:8080`;
    }
  }

  // 4. Expo Go & Development build debuggerHost
  const debuggerHost =
    (Constants as any).expoGoConfig?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost ||
    Constants.expoConfig?.hostUri;

  if (debuggerHost) {
    const host = String(debuggerHost).split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:8080`;
    }
  }

  // 5. experienceUrl / linkingUri (mis. exp://10.0.174.100:8081)
  const linkingUri = Constants.experienceUrl || Constants.linkingUri;
  if (linkingUri) {
    const match = String(linkingUri).match(/:\/\/([^:/]+)/);
    if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
      return `http://${match[1]}:8080`;
    }
  }

  // 6. Android Emulator loopback alias (10.0.2.2 mengarah ke 127.0.0.1 host machine)
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8080';
  }

  return 'http://localhost:8080';
}

export const API_BASE = resolveApiBase();


export interface BackendUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  npsn?: string;
  schoolName?: string;
  sppgId?: string;
  status?: string;
  createdAt?: string;
}

export interface AuthPayload {
  accessToken?: string;
  expiresIn?: number;
  user: BackendUser;
  permissions?: string[];
}

let accessToken: string | null = null;
let refreshPromise: Promise<AuthPayload | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

async function tryRefresh(): Promise<AuthPayload | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const base = resolveApiBase();
        const res = await fetch(`${base}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return null;
        const body = await res.json().catch(() => null);
        if (!body?.success) return null;
        accessToken = body.data.accessToken;
        return body.data as AuthPayload;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function api(path: string, options: RequestInit = {}): Promise<any> {
  // FormData: jangan set Content-Type manual, biar runtime menentukan boundary.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const base = resolveApiBase();

  const doFetch = () =>
    fetch(`${base}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options.headers || {}),
      },
    });

  let res = await doFetch();
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
    }
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error || body?.message || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return body;
}

export async function loginRequest(email: string, password: string): Promise<AuthPayload> {
  const body = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  accessToken = body.data.accessToken;
  await saveAuthSession(
    body.data.accessToken,
    body.data.user,
    body.data.permissions || [],
    false,
  );
  return body.data;
}

export async function meRequest(): Promise<AuthPayload> {
  const body = await api('/api/auth/me');
  return body.data;
}

export async function logoutRequest(): Promise<void> {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } finally {
    accessToken = null;
    await clearAuthSession();
  }
}

export interface ScanRequestParams {
  /** URI foto dari kamera (React Native). */
  uri?: string;
  /** Objek File/Blob dari web (dicatat lewat <input type=file>). */
  file?: Blob;
  name?: string;
  type?: string;
  qrToken?: string;
  boxId?: string;
  batchId?: string;
  holdingTempC?: number;
  releaseTempC?: number;
  /** Daftar bahan menu "Nama:gram,Nama2:gram" → makro dihitung dari dataset gizi. */
  items?: string;
}

/**
 * Kirim pemindaian boks (multipart) ke POST /api/scans.
 * Gateway Go meneruskan foto ke AI service Python lalu membalas kartu keputusan mutu.
 */
export async function scanRequest(params: ScanRequestParams): Promise<any> {
  const form = new FormData();
  const name = params.name ?? 'scan.jpg';
  const type = params.type ?? 'image/jpeg';

  if (params.file) {
    form.append('image', params.file, name);
  } else if (params.uri) {
    // React Native memahami { uri, name, type } pada FormData.
    form.append('image', { uri: params.uri, name, type } as any);
  }

  if (params.qrToken) form.append('qrToken', params.qrToken);
  if (params.boxId) form.append('boxId', params.boxId);
  if (params.batchId) form.append('batchId', params.batchId);
  if (params.holdingTempC !== undefined) form.append('holdingTempC', String(params.holdingTempC));
  if (params.releaseTempC !== undefined) form.append('releaseTempC', String(params.releaseTempC));
  if (params.items) form.append('items', params.items);

  return api('/api/scans', { method: 'POST', body: form });
}

/** Sesi diam-diam saat aplikasi dibuka: cek persistent storage lebih dulu, lalu refresh cookie bila perlu. */
export async function bootstrapSession(): Promise<AuthPayload | null> {
  try {
    // 1. Cek sesi tersimpan di storage (localStorage / AsyncStorage)
    const stored = await loadAuthSession();
    if (stored.token && stored.user) {
      accessToken = stored.token;

      // Mode Tamu: kembalikan langsung tanpa perlu panggil backend
      if (stored.isGuest || stored.user.role === 'guest') {
        return {
          accessToken: stored.token,
          user: stored.user,
          permissions: stored.permissions,
        };
      }

      // Akun validator: verifikasi /api/auth/me, fallback ke stored jika server belum siap
      try {
        const me = await meRequest();
        await saveAuthSession(stored.token, me.user, me.permissions || stored.permissions, false);
        return me;
      } catch {
        return {
          accessToken: stored.token,
          user: stored.user,
          permissions: stored.permissions,
        };
      }
    }

    // 2. Jika tidak ada di storage, coba refresh cookie
    const refreshed = await tryRefresh();
    if (refreshed) {
      const me = await meRequest();
      if (refreshed.accessToken) {
        await saveAuthSession(refreshed.accessToken, me.user, me.permissions || [], false);
      }
      return me;
    }
  } catch {
    accessToken = null;
    await clearAuthSession();
  }
  return null;
}
