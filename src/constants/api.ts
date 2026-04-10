import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Production / máy chủ mặc định khi không dev local. */
const REMOTE_API = 'http://103.82.25.230:3001';

/**
 * Android emulator: backend trên PC → 10.0.2.2:3001
 * Expo Go (điện thoại): dùng hostUri (IP LAN từ Metro) + cổng API
 */
function resolveNativeDevApiBase(): string | null {
  if (!__DEV__) return null;
  // Chỉ dùng Metro host/emulator khi bạn CHỦ ĐỘNG bật.
  // Mặc định ưu tiên REMOTE_API để tránh Android gọi nhầm IP Metro:3001 và login fail.
  const useMetroHost = process.env.EXPO_PUBLIC_USE_METRO_API === '1';
  if (!useMetroHost) return null;
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host) return `http://${host}:3001`;
    }
  } catch {
    // ignore
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  if (Platform.OS === 'ios') {
    return 'http://localhost:3001';
  }
  return null;
}

/**
 * URL backend BizChat.
 * 1) EXPO_PUBLIC_API_BASE trong .env (ưu tiên tuyệt đối, ví dụ IP LAN khi cần)
 * 2) Web localhost → http://localhost:3001
 * 3) iOS/Android dev → Metro host / emulator
 * 4) Bản release hoặc fallback → REMOTE_API
 */
function resolveApiBase(): string {
  const env = process.env.EXPO_PUBLIC_API_BASE;
  if (typeof env === 'string' && env.trim()) {
    return env.trim().replace(/\/$/, '');
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') {
      return 'http://localhost:3001';
    }
  }
  const devNative = resolveNativeDevApiBase();
  if (devNative) return devNative;
  return REMOTE_API;
}

export const API_BASE = resolveApiBase();
