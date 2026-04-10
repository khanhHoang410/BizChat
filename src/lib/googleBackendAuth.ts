import { API_BASE } from '@/constants/api';

export { API_BASE };

export const GOOGLE_WEB_CLIENT_ID =
  '296490459621-9kib4m5h4oi1ppetnn7bteu7vbs8kjv5.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID =
  '296490459621-jsbtmljnv158ql755gflgakucomafqs6.apps.googleusercontent.com';
export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID;

export async function postGoogleIdToken(idToken: string) {
  const res = await fetch(`${API_BASE}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: idToken }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function postEmailPasswordLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}
