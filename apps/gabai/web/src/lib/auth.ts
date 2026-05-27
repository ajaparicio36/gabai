import { setAccessToken, getAccessToken } from './api';

interface Tokens {
  accessToken: string;
}

export function storeTokens(tokens: Tokens): void {
  setAccessToken(tokens.accessToken);
}

export function clearTokens(): void {
  setAccessToken(null);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export { getAccessToken, setAccessToken };
