import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

let accessToken: string | null = null;
let refreshTokenValue: string | null = null;
let refreshPromise: Promise<string> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setRefreshToken(token: string | null): void {
  refreshTokenValue = token;
}

export function getRefreshToken(): string | null {
  return refreshTokenValue;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const encoded = encodeURIComponent(name);
  const match = document.cookie.match(new RegExp(`(?:^|; )${encoded}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function initializeTokenFromCookie(): void {
  if (accessToken) return;
  const token = readCookie('accessToken');
  if (token) {
    accessToken = token;
  }
  const rt = readCookie('refreshToken');
  if (rt) {
    refreshTokenValue = rt;
  }
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      try {
        const newToken = await refreshPromise;
        accessToken = newToken;
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch {
        accessToken = null;
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

async function refreshAccessToken(): Promise<string> {
  const response = await axios.post(
    `${api.defaults.baseURL}/auth/refresh`,
    { refreshToken: refreshTokenValue },
    { withCredentials: true },
  );
  const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
    response.data.data;
  accessToken = newAccessToken;
  if (newRefreshToken) {
    refreshTokenValue = newRefreshToken;
  }
  return newAccessToken;
}

export default api;
