import {
  setAccessToken,
  getAccessToken,
  setRefreshToken,
  getRefreshToken,
  initializeTokenFromCookie,
} from './api';

interface Tokens {
  accessToken: string;
  refreshToken?: string;
}

function setCookie(name: string, value: string, days = 7): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`;
}

function removeCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

export function storeTokens(tokens: Tokens): void {
  setAccessToken(tokens.accessToken);
  setCookie('accessToken', tokens.accessToken);
  if (tokens.refreshToken) {
    setRefreshToken(tokens.refreshToken);
    setCookie('refreshToken', tokens.refreshToken);
  }
}

export function clearTokens(): void {
  setAccessToken(null);
  setRefreshToken(null);
  removeCookie('accessToken');
  removeCookie('refreshToken');
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export function initializeAuth(): void {
  initializeTokenFromCookie();
}

export { getAccessToken, setAccessToken, getRefreshToken };
