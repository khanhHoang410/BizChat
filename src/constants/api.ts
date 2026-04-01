import { Platform } from 'react-native';

/** Máy chủ từ xa (deploy). Dùng khi không phải web localhost và không set EXPO_PUBLIC_API_BASE. */
const REMOTE_API = 'http://103.82.25.230:3001';

/**
 * URL backend BizChat.
 * - Ưu tiên EXPO_PUBLIC_API_BASE (file .env trong BizChat: EXPO_PUBLIC_API_BASE=http://192.168.1.x:3001)
 * - Web trên localhost → http://localhost:3001 (trùng backend chạy máy bạn, user seed có hiệu)
 * - Còn lại → REMOTE_API (Expo Go / build trên điện thoại…)
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
  return REMOTE_API;
}

export const API_BASE = resolveApiBase();
